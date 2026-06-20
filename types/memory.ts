/**
 * Memory Layer V1 — TypeScript types
 *
 * These types mirror the Supabase tables in supabase/migrations/001_memory_v1.sql.
 * All field names are camelCase here; snake_case ↔ camelCase mapping happens
 * in lib/memory-reader.ts (reads) and lib/memory-writer.ts (writes).
 *
 * NEVER import this file from client components — memory is server-only.
 */

// ── Algorithm versioning ──────────────────────────────────────────────────────

/**
 * Increment when scoring logic changes significantly. Stored on every row.
 * v2 (Memory V1.5): adds reply-latency + inbound/outbound directionality.
 * A version=2 row had the chance to observe these signals; a version=1 row
 * never did (so reply_count=0 means "never measured", not "no replies").
 */
export const MEMORY_ALGORITHM_VERSION = 2

// ── Row types ─────────────────────────────────────────────────────────────────

/** Persistent signal profile for a single human contact. (person_memory) */
export interface PersonMemoryRecord {
  id:               string
  userId:           string
  personEmail:      string
  personName:       string

  // Interaction counters
  totalThreads:     number
  totalMessages:    number
  twoWayCount:      number   // runs where relationship was bidirectional

  // Score history
  lastScore:        number
  avgScore:         number   // EMA (α=0.3), updated each analysis run
  scoreSamples:     number[] // last 10 raw scores

  // Directionality (V1.5) — latest snapshot, mirrors totalMessages semantics
  inboundCount:     number   // messages person→owner this run
  outboundCount:    number   // messages owner→person this run

  // Reply latency (V1.5)
  replyCount:          number          // cumulative inbound→outbound pairs observed
  avgReplyLatencySec:  number | null   // EMA (α=0.3) of latency; null = unknown (never 0)
  replyLatencySamples: number[]        // last 10 per-run median latencies (seconds)

  // Timestamps
  firstSeenAt:      string   // ISO 8601 — never overwritten after first insert
  lastSeenAt:       string
  lastAnalysisAt:   string

  // Meta
  confidence:       number
  algorithmVersion: number
}

/** Recurring subject profile. (topic_memory) */
export interface TopicMemoryRecord {
  id:               string
  userId:           string
  topicKey:         string   // normalized lowercase key
  topicDisplay:     string   // display name, first-write wins

  totalOccurrences: number   // incremented each run this topic appears
  lastThreadCount:  number   // thread count from last run

  firstSeenAt:      string
  lastSeenAt:       string

  algorithmVersion: number
}

/** Weekly interaction bucket per person. (relationship_weekly_buckets) */
export interface WeeklyBucketRecord {
  id:           string
  userId:       string
  personEmail:  string
  weekStart:    string   // ISO date 'YYYY-MM-DD' — always Monday

  threadCount:  number
  messageCount: number
  twoWay:       boolean

  // Directionality (V1.5) — weekly counts, monotonic-within-week (GREATEST)
  inboundCount:  number   // messages person→owner this week
  outboundCount: number   // messages owner→person this week
}

/** Tracked decision / pending approval. (decision_memory) */
export interface DecisionMemoryRecord {
  id:               string
  userId:           string
  threadId:         string   // stable Gmail thread ID — primary lookup key
  threadSubject:    string   // display subject (not used for keying)

  fromName:         string
  fromEmail:        string | null   // null if not resolvable from people index

  timesSeen:        number   // incremented each run this subject appears as decision
  lastScore:        number

  isResolved:       boolean
  resolvedAt:       string | null

  firstSeenAt:      string
  lastSeenAt:       string

  algorithmVersion: number
}

// ── Assembled context ─────────────────────────────────────────────────────────

/**
 * The full memory context for a single user, assembled before priority
 * generation. Passed to generatePriorities() and updateMemory().
 *
 * buckets   — last 12 weeks only (readers filter by date)
 * decisions — unresolved only (readers filter by is_resolved = false)
 */
export interface MemoryContext {
  persons:   PersonMemoryRecord[]
  topics:    TopicMemoryRecord[]
  buckets:   WeeklyBucketRecord[]
  decisions: DecisionMemoryRecord[]
}
