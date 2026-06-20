/**
 * Identity Memory — TypeScript types  (Digital Self, Layer 1)
 *
 * Mirrors supabase/migrations/002_identity_memory.sql. camelCase here;
 * snake_case ↔ camelCase mapping happens in lib/identity-reader.ts (reads) and
 * lib/identity-writer.ts (writes).
 *
 * Identity Memory is a DERIVED, owner-level layer computed deterministically
 * from the four Memory V1 tables. It is keyed by a stable owner UUID (app_user),
 * never by email.
 *
 * NEVER import this file from client components — identity is server-only.
 */

// ── Algorithm versioning ──────────────────────────────────────────────────────

/**
 * Bump when the identity computation or any facet jsonb shape changes.
 * Stored on identity_profile.version and identity_facet.algorithm_version; a
 * mismatch forces a full recompute (which fully "migrates" the derived jsonb —
 * no data migration needed, because everything is recomputable from V1).
 */
export const IDENTITY_ALGORITHM_VERSION = 1

// ── Facet taxonomy ────────────────────────────────────────────────────────────

/**
 * Dimensions of the digital self. Kept as a string union mirroring the DB's
 * free-text facet_type — new dimensions are additive (add a member here, emit
 * rows; no schema change).
 */
export type FacetType =
  | 'key_relationship'      // per-person — who matters, and which bonds are cooling
  | 'topic_affinity'        // per-topic  — what the owner repeatedly engages with
  | 'communication_pattern' // aggregate  — reciprocity, breadth, concentration
  | 'decision_behavior'     // aggregate  — how open decisions are handled
  | 'engagement_rhythm'     // aggregate  — temporal activity shape

/** Stable facet_key used for the single aggregate facets. */
export const AGGREGATE_FACET_KEY = 'overall'

// ── Row records ───────────────────────────────────────────────────────────────

export interface IdentityProfileRecord {
  id:              string
  ownerId:         string
  version:         number
  summary:         IdentitySummary
  confidence:      number
  sourceSignature: string
  generatedAt:     string
  createdAt:       string
  updatedAt:       string
}

export interface IdentityFacetRecord {
  id:               string
  ownerId:          string
  facetType:        FacetType
  facetKey:         string
  label:            string
  value:            Record<string, unknown>
  weight:           number
  confidence:       number
  evidence:         Record<string, unknown>
  firstObservedAt:  string
  lastComputedAt:   string
  algorithmVersion: number
}

// ── Denormalised summary (identity_profile.summary jsonb) ──────────────────────

export interface SummaryRef {
  key:    string
  label:  string
  weight: number
}

export interface IdentitySummary {
  /** Deterministic one-line descriptor of the dominant identity signal. */
  headline:         string
  topRelationships: SummaryRef[]
  topTopics:        SummaryRef[]
  communication:    Record<string, number>
  decisionBehavior: Record<string, number>
  engagement:       Record<string, number>
  facetCount:       number
}

// ── Computation draft (output of lib/identity-compute.ts) ──────────────────────

/** A facet as produced by computeIdentity, before persistence. */
export interface FacetDraft {
  facetType:  FacetType
  facetKey:   string
  label:      string
  value:      Record<string, unknown>
  weight:     number
  confidence: number
  evidence:   Record<string, unknown>
}

export interface IdentityDraft {
  summary:         IdentitySummary
  confidence:      number
  sourceSignature: string
  facets:          FacetDraft[]
}

// ── Assembled model (output of lib/identity-reader.ts / GET /api/identity) ──────

export interface IdentityModel {
  profile: IdentityProfileRecord | null
  facets:  IdentityFacetRecord[]
}

/** Result of a read, with the same trustworthiness flag pattern as memory. */
export interface IdentityReadResult {
  model: IdentityModel
  ok:    boolean
}
