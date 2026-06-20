/**
 * Owner identity resolver  (Identity Memory)
 *
 * app_user is the stable owner identity introduced in migration 002. Memory V1
 * tables remain keyed on user_id (the email string); this module maps that
 * email to a stable owner UUID and keeps the additive owner_id columns on the
 * V1 tables populated.
 *
 * ⚠️  Server-only. NEVER import from client components.
 */

import type { ServerSupabaseClient } from '@/lib/supabase-server'

/** The four Memory V1 tables that carry the additive owner_id column. */
const V1_TABLES = [
  'person_memory',
  'topic_memory',
  'relationship_weekly_buckets',
  'decision_memory',
] as const

/** Normalise an owner email to its canonical (lowercased, trimmed) form. */
export function canonicalEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Resolve an owner email to its stable UUID, creating the app_user row if it
 * does not exist yet. Idempotent via the email unique constraint.
 *
 * Returns the owner UUID, or null if the row could neither be created nor read
 * (caller treats null as "skip this owner").
 */
export async function ensureOwner(
  supabase: ServerSupabaseClient,
  email:    string,
): Promise<string | null> {
  const canonical = canonicalEmail(email)
  if (!canonical) return null

  // Upsert is idempotent on the email unique key; returns the row either way.
  const { data, error } = await supabase
    .from('app_user')
    .upsert({ email: canonical }, { onConflict: 'email', ignoreDuplicates: false })
    .select('id')
    .single()

  if (error) {
    // Lost-race fallback: another concurrent upsert created it — read it back.
    const { data: existing, error: readErr } = await supabase
      .from('app_user')
      .select('id')
      .eq('email', canonical)
      .single()
    if (readErr || !existing) {
      console.error('[owner] ensureOwner failed:', error.message)
      return null
    }
    return existing.id as string
  }

  return data?.id as string ?? null
}

/** Read-only lookup of an owner UUID by email. Returns null if not present. */
export async function getOwnerId(
  supabase: ServerSupabaseClient,
  email:    string,
): Promise<string | null> {
  const canonical = canonicalEmail(email)
  if (!canonical) return null

  const { data, error } = await supabase
    .from('app_user')
    .select('id')
    .eq('email', canonical)
    .maybeSingle()

  if (error) {
    console.error('[owner] getOwnerId failed:', error.message)
    return null
  }
  return (data?.id as string) ?? null
}

/**
 * Keep the additive owner_id columns on the V1 tables populated for this owner.
 * Updates only rows where owner_id IS NULL (cheap, idempotent — does nothing
 * once filled). Runs off the hot path from the cron job, failure-isolated per
 * table.
 *
 * `userIdValue` must be the V1 user_id exactly as stored (the raw session email
 * the memory writers used). The cron derives owners from V1 user_id values and
 * passes them straight through, so casing always matches — the existing-row
 * backfill in migration 002 handled any historical casing variance separately.
 */
export async function backfillOwnerId(
  supabase:    ServerSupabaseClient,
  ownerId:     string,
  userIdValue: string,
): Promise<void> {
  if (!ownerId || !userIdValue) return

  await Promise.allSettled(
    V1_TABLES.map(table =>
      supabase
        .from(table)
        .update({ owner_id: ownerId })
        .eq('user_id', userIdValue)
        .is('owner_id', null)
        .then(({ error }) => {
          if (error) {
            console.warn(`[owner] backfillOwnerId ${table}:`, error.message)
          }
        }),
    ),
  )
}
