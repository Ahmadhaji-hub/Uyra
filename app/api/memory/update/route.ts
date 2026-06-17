/**
 * POST /api/memory/update
 *
 * Explicitly updates all memory tables for the authenticated user from a
 * provided InboxAnalysis payload. Useful for:
 *   · Decoupled / background memory updates
 *   · Future scheduled-task or webhook triggers
 *   · Testing memory writes in isolation
 *
 * The inbox analyze route calls updateMemory() directly (function call, not
 * HTTP) for the hot path. This endpoint exists as a clean external interface.
 *
 * Auth: requires valid NextAuth session. User identity is taken from the
 * verified server-side session — never from the request body.
 */

import { NextRequest, NextResponse }    from 'next/server'
import { getServerSession }             from 'next-auth'
import { authOptions }                  from '@/lib/auth'
import { createServerSupabaseClient }   from '@/lib/supabase-server'
import { readMemoryContext }            from '@/lib/memory-reader'
import { updateMemory }                 from '@/lib/memory-writer'
import type { InboxAnalysis }           from '@/types/inbox'

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = session.user?.email
  if (!userId) {
    return NextResponse.json({ error: 'Missing user identity' }, { status: 400 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let analysis: InboxAnalysis
  try {
    const body = await req.json() as { analysis?: InboxAnalysis }
    if (
      !body.analysis?.people ||
      !body.analysis?.topics ||
      !body.analysis?.needsReply
    ) {
      return NextResponse.json(
        { error: 'Invalid analysis payload — expected { analysis: InboxAnalysis }' },
        { status: 400 },
      )
    }
    analysis = body.analysis
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Read + update memory ─────────────────────────────────────────────────────
  try {
    const supabase = createServerSupabaseClient()
    const existing = await readMemoryContext(supabase, userId)
    await updateMemory(supabase, userId, analysis, existing)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Memory update failed'
    console.error('[api/memory/update]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
