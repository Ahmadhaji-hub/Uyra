/**
 * GET /api/identity
 *
 * Read-only Identity Memory for the authenticated user. Resolves the session
 * email to a stable owner UUID (creating the app_user row if needed) and returns
 * the assembled IdentityModel.
 *
 * The model is empty (profile: null) until the scheduled cron job has run at
 * least once for this owner — identity is computed off the hot path, so a fresh
 * user sees an empty model with `pending: true` rather than an error.
 *
 * No writes. GET only.
 */

import { NextResponse }               from 'next/server'
import { getServerSession }           from 'next-auth'
import { authOptions }                from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ensureOwner }                from '@/lib/owner'
import { readIdentity }               from '@/lib/identity-reader'

export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const email = session.user.email

  try {
    const supabase = createServerSupabaseClient()

    const ownerId = await ensureOwner(supabase, email)
    if (!ownerId) {
      return NextResponse.json({ error: 'Could not resolve owner identity' }, { status: 500 })
    }

    const { model, ok } = await readIdentity(supabase, ownerId)

    return NextResponse.json({
      ownerId,
      profile:     model.profile,
      facets:      model.facets,
      pending:     model.profile === null,   // not yet computed by the cron
      readOk:      ok,
      generatedAt: model.profile?.generatedAt ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Identity read failed'
    console.error('[api/identity]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
