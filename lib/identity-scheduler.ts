/**
 * Identity Memory — scheduler.
 *
 * Runs OFF the hot path (invoked by the cron route, never by inbox analysis).
 * For each owner it: ensures the app_user row, keeps the V1 owner_id columns
 * populated, reads that owner's MemoryContext, and recomputes identity. The
 * writer's signature gate makes per-owner work cheap when nothing changed, so a
 * tick can safely visit every owner up to a batch limit.
 *
 * Failure-isolated per owner: one owner's error never aborts the batch.
 *
 * ⚠️  Server-only. NEVER import from client components.
 */

import type { ServerSupabaseClient } from '@/lib/supabase-server'
import { readMemoryContext } from '@/lib/memory-reader'
import { ensureOwner, backfillOwnerId } from '@/lib/owner'
import { updateIdentity } from '@/lib/identity-writer'

/** Default number of owners processed per cron tick. */
export const DEFAULT_BATCH_LIMIT = 50

export interface RecomputeSummary {
  owners:     number
  recomputed: number
  skipped:    number
  failed:     number
  unreadable: number   // owners whose memory read was not trustworthy (skipped writes)
}

/**
 * Recompute identity for a batch of owners.
 *
 * Owners are derived from the V1 person_memory.user_id values (the raw email
 * strings the memory writers used), so casing matches the V1 rows exactly.
 */
export async function recomputeIdentityBatch(
  supabase: ServerSupabaseClient,
  limit:    number = DEFAULT_BATCH_LIMIT,
): Promise<RecomputeSummary> {
  const emails = await listOwnerEmails(supabase, limit)

  const summary: RecomputeSummary = {
    owners: emails.length, recomputed: 0, skipped: 0, failed: 0, unreadable: 0,
  }

  for (const email of emails) {
    try {
      const ownerId = await ensureOwner(supabase, email)
      if (!ownerId) { summary.failed++; continue }

      // Keep the additive V1 owner_id columns populated (off the hot path).
      await backfillOwnerId(supabase, ownerId, email)

      // Only recompute from a trustworthy baseline — same guarantee the memory
      // hardening relies on. A partial read must not drive identity.
      const read = await readMemoryContext(supabase, email)
      if (!read.ok) { summary.unreadable++; continue }

      const outcome = await updateIdentity(supabase, ownerId, read.context)
      if (outcome === 'recomputed') summary.recomputed++
      else                          summary.skipped++
    } catch (err) {
      summary.failed++
      console.error(`[identity-scheduler] owner "${email}" failed:`, err)
    }
  }

  return summary
}

/** Page size for owner discovery scans (PostgREST default max is ~1000). */
const DISCOVERY_PAGE = 1000

/** Hard ceiling on rows scanned during discovery, as a runaway guard. */
const DISCOVERY_MAX_ROWS = 50_000

/**
 * Distinct owner emails to process this tick, taken from person_memory.user_id.
 * person_memory is the canonical signal of an active owner (no person rows ⇒
 * nothing to derive identity from). The raw user_id is used verbatim so memory
 * reads and the owner_id backfill match the V1 rows exactly (no casing drift).
 *
 * Paginated with .range() so owners are never silently dropped past PostgREST's
 * implicit row cap. Ordered most-recently-active first, then capped at `limit`.
 *
 * NOTE (deferred, scale): once distinct owners can exceed the per-tick `limit`,
 * the most-active owners would be reprocessed while the tail starves. A stale-
 * first rotation (ordering by identity_profile.generated_at) is the future fix;
 * at current scale (owners ≪ limit) every owner is processed each tick.
 */
async function listOwnerEmails(
  supabase: ServerSupabaseClient,
  limit:    number,
): Promise<string[]> {
  const seen: Set<string> = new Set()
  const emails: string[] = []

  for (let from = 0; from < DISCOVERY_MAX_ROWS; from += DISCOVERY_PAGE) {
    const to = from + DISCOVERY_PAGE - 1
    const { data, error } = await supabase
      .from('person_memory')
      .select('user_id, last_analysis_at')
      .order('last_analysis_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('[identity-scheduler] listOwnerEmails:', error.message)
      break
    }

    const rows = data ?? []
    for (const row of rows) {
      const uid = (row as { user_id: string }).user_id
      if (!uid || seen.has(uid)) continue
      seen.add(uid)
      emails.push(uid)
      if (emails.length >= limit) return emails
    }

    if (rows.length < DISCOVERY_PAGE) break   // last page reached
  }

  return emails
}
