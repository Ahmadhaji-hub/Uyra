/**
 * Identity Memory — reader.
 *
 * readIdentity() assembles the IdentityModel (profile + facets) for one owner in
 * a single parallel round-trip. Returns the same { model, ok } trustworthiness
 * shape as the memory reader: `ok` is false if any query errored, so callers can
 * distinguish "not computed yet" (ok=true, profile=null) from "read failed".
 *
 * ⚠️  Server-only. NEVER import from client components.
 */

import type { ServerSupabaseClient } from '@/lib/supabase-server'
import type {
  IdentityFacetRecord,
  IdentityProfileRecord,
  IdentityReadResult,
  FacetType,
  IdentitySummary,
} from '@/types/identity'

export async function readIdentity(
  supabase: ServerSupabaseClient,
  ownerId:  string,
): Promise<IdentityReadResult> {
  const [profileRes, facetsRes] = await Promise.all([
    supabase
      .from('identity_profile')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle(),

    supabase
      .from('identity_facet')
      .select('*')
      .eq('owner_id', ownerId),
  ])

  if (profileRes.error) console.error('[identity-reader] profile:', profileRes.error.message)
  if (facetsRes.error)  console.error('[identity-reader] facets:',  facetsRes.error.message)

  const ok = !profileRes.error && !facetsRes.error

  return {
    ok,
    model: {
      profile: profileRes.data ? mapProfile(profileRes.data) : null,
      facets:  (facetsRes.data ?? []).map(mapFacet),
    },
  }
}

// ── Mappers (snake_case row → camelCase record) ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(row: any): IdentityProfileRecord {
  return {
    id:              row.id,
    ownerId:         row.owner_id,
    version:         row.version,
    summary:         (row.summary ?? {}) as IdentitySummary,
    confidence:      row.confidence,
    sourceSignature: row.source_signature,
    generatedAt:     row.generated_at,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFacet(row: any): IdentityFacetRecord {
  return {
    id:               row.id,
    ownerId:          row.owner_id,
    facetType:        row.facet_type as FacetType,
    facetKey:         row.facet_key,
    label:            row.label,
    value:            (row.value ?? {}) as Record<string, unknown>,
    weight:           row.weight,
    confidence:       row.confidence,
    evidence:         (row.evidence ?? {}) as Record<string, unknown>,
    firstObservedAt:  row.first_observed_at,
    lastComputedAt:   row.last_computed_at,
    algorithmVersion: row.algorithm_version,
  }
}
