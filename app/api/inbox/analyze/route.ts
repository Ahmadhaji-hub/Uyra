/**
 * GET /api/inbox/analyze
 *
 * Runs Gmail inbox analysis, reads memory context, generates memory-aware
 * priorities server-side, updates memory tables, and returns the combined
 * result to the client.
 *
 * Response shape: InboxAnalysis fields + priorities: Priority[]
 *
 * Memory update strategy:
 *   · readMemoryContext() runs BEFORE priority generation so priorities
 *     benefit from historical data on every subsequent call.
 *   · updateMemory() runs AFTER priorities are computed and is wrapped in
 *     try/catch so a DB write failure never breaks the analysis response.
 */

import { NextResponse }                          from 'next/server'
import { getServerSession }                      from 'next-auth'
import { authOptions }                           from '@/lib/auth'
import { analyzeInbox }                          from '@/lib/gmail'
import { generatePriorities, PrioritiesDebug }  from '@/lib/priorities'
import { createServerSupabaseClient }            from '@/lib/supabase-server'
import { readMemoryContext }                     from '@/lib/memory-reader'
import { updateMemory }                          from '@/lib/memory-writer'
import fs                                        from 'fs'
import path                                      from 'path'

export async function GET() {
  // ── 1. Auth check ────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ── Gmail connection state gate ───────────────────────────────────────────────
  // 'needs_reconnect' — refresh token revoked or scopes changed; user must
  //   re-grant via the connect page. Return 401 so the client routes there.
  // 'disconnected'    — user has never connected Gmail. Return 403.
  // 'connected'       — access token is valid, proceed.
  if (session.gmailStatus === 'needs_reconnect') {
    return NextResponse.json(
      { error: 'Gmail access expired. Please reconnect.', code: 'GMAIL_NEEDS_RECONNECT' },
      { status: 401 }
    )
  }

  if (session.gmailStatus !== 'connected') {
    return NextResponse.json(
      { error: 'Gmail not connected.', code: 'GMAIL_NOT_CONNECTED' },
      { status: 403 }
    )
  }

  if (!session.accessToken) {
    return NextResponse.json(
      { error: 'Missing access token. Please sign in again.' },
      { status: 401 }
    )
  }

  if (!session.user?.email) {
    return NextResponse.json({ error: 'Missing user email' }, { status: 400 })
  }

  const userId = session.user.email

  // ── 2. Run Gmail analysis ────────────────────────────────────────────────────
  let analysis
  try {
    analysis = await analyzeInbox(session.accessToken, userId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed'

    // Token expired — tell client to re-authenticate
    if (message.includes('401') || message.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }

    console.error('[inbox/analyze] Gmail error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 3. Read memory context ───────────────────────────────────────────────────
  // Memory read errors are non-fatal: fall back to empty context so priorities
  // are still generated (without historical enrichment).
  let memoryContext
  try {
    const supabase = createServerSupabaseClient()
    memoryContext  = await readMemoryContext(supabase, userId)
  } catch (err) {
    console.error('[inbox/analyze] Memory read failed (non-fatal):', err)
    memoryContext = { persons: [], topics: [], buckets: [], decisions: [] }
  }

  // ── 4. Generate memory-aware priorities (server-side) ───────────────────────
  // In development: capture before/after sender-dedup state for validation.
  const dedupDebug: PrioritiesDebug | undefined =
    process.env.NODE_ENV === 'development'
      ? { needsReplyAllPassed: [], needsReplyAfterDedup: [] }
      : undefined

  const priorities = generatePriorities(analysis, memoryContext, dedupDebug)

  if (dedupDebug) {
    try {
      fs.writeFileSync(
        path.join(process.cwd(), 'validate-priorities-output.json'),
        JSON.stringify({
          generatedAt:        new Date().toISOString(),
          rawNeedsReplyCount: analysis.needsReply.length,
          rawNeedsReply:      analysis.needsReply,
          beforeDedup:        dedupDebug.needsReplyAllPassed,
          afterDedup:         dedupDebug.needsReplyAfterDedup,
          finalPriorities:    priorities,
        }, null, 2)
      )
    } catch { /* non-fatal */ }
  }

  // ── 5. Update memory tables (non-blocking on failure) ───────────────────────
  // Runs after priorities so memory latency does not affect this response.
  // Errors are logged but never surfaced to the client.
  try {
    const supabase = createServerSupabaseClient()
    await updateMemory(supabase, userId, analysis, memoryContext)
  } catch (err) {
    console.error('[inbox/analyze] Memory update failed (non-fatal):', err)
  }

  // ── 6. Return combined result ────────────────────────────────────────────────
  return NextResponse.json({ ...analysis, priorities })
}
