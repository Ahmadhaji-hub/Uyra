/**
 * GET /api/cron/identity
 *
 * Scheduled background recompute of Identity Memory for all owners (batched).
 * Runs OFF the hot path — inbox analysis and memory writes never touch identity.
 *
 * Auth: this endpoint processes EVERY owner, so it is NOT session-scoped. It is
 * protected by a shared secret (CRON_SECRET). Vercel Cron sends it as
 * `Authorization: Bearer <CRON_SECRET>`. Requests without the matching secret
 * are rejected — this prevents abuse / DoS via repeated full recomputes.
 *
 * Schedule is configured in vercel.json.
 */

import { NextRequest, NextResponse }    from 'next/server'
import { createServerSupabaseClient }   from '@/lib/supabase-server'
import { recomputeIdentityBatch, DEFAULT_BATCH_LIMIT } from '@/lib/identity-scheduler'

// Identity recompute can iterate many owners — give it room beyond the default.
export const maxDuration = 60
export const dynamic     = 'force-dynamic'

export async function GET(req: NextRequest) {
  // ── Secret-gated auth ──────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/identity] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Optional batch override (?limit=N), bounded ────────────────────────────
  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam
    ? Math.max(1, Math.min(parseInt(limitParam, 10) || DEFAULT_BATCH_LIMIT, 500))
    : DEFAULT_BATCH_LIMIT

  // ── Run ────────────────────────────────────────────────────────────────────
  try {
    const supabase = createServerSupabaseClient()
    const summary  = await recomputeIdentityBatch(supabase, limit)
    return NextResponse.json({ ok: true, ...summary, ranAt: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Identity recompute failed'
    console.error('[cron/identity]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
