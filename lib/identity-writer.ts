/**
 * Identity Memory — writer.
 *
 * updateIdentity() persists a computed IdentityDraft for one owner:
 *   · skips entirely when the source signature and algorithm version are
 *     unchanged (no churn when nothing in V1 moved),
 *   · writes facets first, prunes stale facets, and writes identity_profile
 *     LAST so source_signature only advances after the facet set is committed.
 *
 * Commit-marker ordering: identity_profile.source_signature is the completion
 * marker the skip-gate reads. It must be written last, otherwise a failure in
 * the facet write/prune after an early profile write would advance the signature
 * while leaving facets stale — and the skip-gate would then refuse to repair it
 * until V1 changed. Writing the profile last means any partial failure simply
 * leaves the old signature in place and the next cron pass retries (all upserts
 * are idempotent on their unique keys).
 *
 * Idempotent and recomputable: identity is derived, so a failed write is never
 * data loss — the next cron pass rebuilds it from V1.
 *
 * ⚠️  Server-only. NEVER import from client components.
 */

import type { ServerSupabaseClient } from '@/lib/supabase-server'
import type { MemoryContext } from '@/types/memory'
import type { IdentityDraft } from '@/types/identity'
import { IDENTITY_ALGORITHM_VERSION } from '@/types/identity'
import { computeIdentity } from '@/lib/identity-compute'

export type IdentityUpdateOutcome = 'recomputed' | 'skipped'

/**
 * Recompute and persist identity for one owner from a trustworthy MemoryContext.
 *
 * @param supabase Service-role client
 * @param ownerId  Stable owner UUID (app_user.id)
 * @param context  MemoryContext read for this owner (must be from an ok read)
 */
export async function updateIdentity(
  supabase: ServerSupabaseClient,
  ownerId:  string,
  context:  MemoryContext,
): Promise<IdentityUpdateOutcome> {
  const draft = computeIdentity(context)

  // ── Skip gate: nothing changed since last successful compute ────────────────
  const { data: existing, error: readErr } = await supabase
    .from('identity_profile')
    .select('source_signature, version')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (readErr) throw new Error(`identity_profile read: ${readErr.message}`)

  if (
    existing &&
    existing.version === IDENTITY_ALGORITHM_VERSION &&
    existing.source_signature === draft.sourceSignature
  ) {
    return 'skipped'
  }

  const runTs = new Date().toISOString()

  // Order matters — see "Commit-marker ordering" above. Facets + prune first,
  // then the profile (which carries source_signature) last.
  await upsertFacets(supabase, ownerId, draft, runTs)
  await pruneStaleFacets(supabase, ownerId, runTs)
  await upsertProfile(supabase, ownerId, draft, runTs)

  return 'recomputed'
}

// ── identity_profile ──────────────────────────────────────────────────────────

async function upsertProfile(
  supabase: ServerSupabaseClient,
  ownerId:  string,
  draft:    IdentityDraft,
  runTs:    string,
): Promise<void> {
  const row = {
    owner_id:         ownerId,
    version:          IDENTITY_ALGORITHM_VERSION,
    summary:          draft.summary,
    confidence:       draft.confidence,
    source_signature: draft.sourceSignature,
    generated_at:     runTs,
    updated_at:       runTs,
    // created_at omitted — DB DEFAULT on insert, preserved on conflict.
  }

  const { error } = await supabase
    .from('identity_profile')
    .upsert(row, { onConflict: 'owner_id' })

  if (error) throw new Error(`identity_profile upsert: ${error.message}`)
}

// ── identity_facet ────────────────────────────────────────────────────────────

async function upsertFacets(
  supabase: ServerSupabaseClient,
  ownerId:  string,
  draft:    IdentityDraft,
  runTs:    string,
): Promise<void> {
  if (draft.facets.length === 0) return

  const rows = draft.facets.map(f => ({
    owner_id:          ownerId,
    facet_type:        f.facetType,
    facet_key:         f.facetKey,
    label:             f.label,
    value:             f.value,
    weight:            f.weight,
    confidence:        f.confidence,
    evidence:          f.evidence,
    last_computed_at:  runTs,
    algorithm_version: IDENTITY_ALGORITHM_VERSION,
    // first_observed_at omitted — DB DEFAULT on insert, preserved on conflict.
  }))

  const { error } = await supabase
    .from('identity_facet')
    .upsert(rows, { onConflict: 'owner_id,facet_type,facet_key' })

  if (error) throw new Error(`identity_facet upsert: ${error.message}`)
}

/**
 * Delete this owner's facets that were not written in this run. Every current
 * facet was just stamped with last_computed_at = runTs, so anything older is
 * stale and dropped. Keeps the persisted identity equal to the current model.
 */
async function pruneStaleFacets(
  supabase: ServerSupabaseClient,
  ownerId:  string,
  runTs:    string,
): Promise<void> {
  const { error } = await supabase
    .from('identity_facet')
    .delete()
    .eq('owner_id', ownerId)
    .lt('last_computed_at', runTs)

  if (error) throw new Error(`identity_facet prune: ${error.message}`)
}
