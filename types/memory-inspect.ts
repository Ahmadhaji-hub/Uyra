/**
 * Memory Inspector — API response types
 *
 * Returned by GET /api/memory/inspect.
 * All aggregation happens server-side; the client receives pre-computed values.
 *
 * ⚠️  Read-only. No mutation types are defined here.
 */

export type ScoreTrend = 'up' | 'down' | 'flat'

// ── Per-person week bucket (summary, not raw row) ─────────────────────────────

export interface WeekSummary {
  weekStart:    string   // 'YYYY-MM-DD' — Monday of ISO week
  threadCount:  number
  messageCount: number
  twoWay:       boolean
}

// ── Person row ────────────────────────────────────────────────────────────────

export interface PersonInspectRow {
  personEmail:      string
  personName:       string

  avgScore:         number          // EMA (α=0.3) across all analysis runs
  lastScore:        number          // score from most recent run
  scoreSamples:     number[]        // last 10 raw scores — client renders as sparkline
  scoresTrend:      ScoreTrend      // computed server-side from scoreSamples

  twoWayCount:      number          // runs where relationship was bidirectional
  totalThreads:     number
  totalMessages:    number
  confidence:       number

  firstSeenAt:      string
  lastSeenAt:       string

  recentWeeks:      WeekSummary[]   // person's buckets from last 12 weeks, sorted asc
  algorithmVersion: number
}

// ── Topic row ─────────────────────────────────────────────────────────────────

export interface TopicInspectRow {
  topicDisplay:     string          // prettified name, first-write wins
  topicKey:         string          // normalized lowercase key
  totalOccurrences: number          // incremented each run this topic appears
  lastThreadCount:  number          // thread count from most recent run
  firstSeenAt:      string
  lastSeenAt:       string
}

// ── Decision row ──────────────────────────────────────────────────────────────

export interface DecisionInspectRow {
  threadId:      string
  threadSubject: string             // display subject (not used for keying)
  fromName:      string
  fromEmail:     string | null
  timesSeen:     number             // runs where this thread appeared as a decision
  firstSeenAt:   string
  lastSeenAt:    string
}

// ── System health ─────────────────────────────────────────────────────────────

export interface MemoryHealthSummary {
  /**
   * Sourced from MEMORY_ALGORITHM_VERSION in types/memory.ts — the same constant
   * used by the memory writer. Never hardcoded here.
   */
  schemaVersion:           number

  totalPersonRecords:      number
  totalTopicRecords:       number

  /**
   * Unresolved decisions only — matches the V1 reader filter (is_resolved = false).
   * Deliberately named to reflect what is actually counted.
   */
  unresolvedDecisionCount: number

  totalBucketRecords:      number

  oldestRecordAt:          string | null  // min(first_seen_at) across persons/topics/decisions
  newestRecordAt:          string | null  // max(last_seen_at) across persons/topics/decisions
  lastMemoryUpdateAt:      string | null  // max(last_analysis_at) from person_memory; null if no runs yet
}

// ── Full response ─────────────────────────────────────────────────────────────

export interface MemoryInspectResponse {
  persons:        PersonInspectRow[]
  topics:         TopicInspectRow[]
  decisions:      DecisionInspectRow[]

  /** Union of all week_starts present in the last 12 weeks, sorted asc.
   *  Used by the client to render a consistent activity grid across all persons. */
  bucketWeeks:    string[]

  health:         MemoryHealthSummary

  generatedAt:    string     // ISO timestamp of this response
  totalPersons:   number
  totalTopics:    number
  totalDecisions: number     // unresolved only (matches decisions array length)
}
