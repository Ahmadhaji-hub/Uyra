/**
 * Memory Layer V1 — Reader
 *
 * readMemoryContext() assembles the full MemoryContext for a user from the
 * four memory tables in one parallel round-trip. Called in the inbox/analyze
 * route BEFORE priority generation so priorities can be memory-aware.
 *
 * ⚠️  NEVER import from client components.
 * All queries are user-scoped by user_id (the user's email from NextAuth).
 */

import type { ServerSupabaseClient } from '@/lib/supabase-server'
import { getWeeksAgoDate }           from '@/lib/memory-utils'
import type {
  MemoryContext,
  PersonMemoryRecord,
  TopicMemoryRecord,
  WeeklyBucketRecord,
  DecisionMemoryRecord,
} from '@/types/memory'

// How many weeks of bucket history to load for relationship-decay detection
const WEEKS_BACK = 12

// ── Read result ───────────────────────────────────────────────────────────────

/**
 * Result of a memory read.
 *
 * `ok` is the trustworthiness flag for the baseline:
 *   true  — every table query succeeded (context may legitimately be empty for
 *           a brand-new user; that is still a trustworthy baseline)
 *   false — at least one query errored, so the context is partial. Callers that
 *           WRITE memory must NOT proceed on ok=false: deriving EMA / samples /
 *           times_seen from a partial baseline and upserting would destructively
 *           reset accumulated history. Read-only callers may use the context as-is.
 */
export interface MemoryReadResult {
  context: MemoryContext
  ok:      boolean
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Fetch the complete memory context for `userId` in a single parallel
 * round-trip (4 concurrent Supabase queries).
 *
 * Never throws for per-query errors — callers always get a valid MemoryContext
 * shape (empty arrays for any failed table). The `ok` flag reports whether the
 * baseline is complete; write-path callers must gate updates on it.
 */
export async function readMemoryContext(
  supabase: ServerSupabaseClient,
  userId:   string,
): Promise<MemoryReadResult> {
  const weekCutoff = getWeeksAgoDate(WEEKS_BACK)

  const [personsRes, topicsRes, bucketsRes, decisionsRes] = await Promise.all([
    supabase
      .from('person_memory')
      .select('*')
      .eq('user_id', userId),

    supabase
      .from('topic_memory')
      .select('*')
      .eq('user_id', userId),

    supabase
      .from('relationship_weekly_buckets')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start', weekCutoff),

    supabase
      .from('decision_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('is_resolved', false),
  ])

  if (personsRes.error)   console.error('[memory-reader] persons:',   personsRes.error.message)
  if (topicsRes.error)    console.error('[memory-reader] topics:',    topicsRes.error.message)
  if (bucketsRes.error)   console.error('[memory-reader] buckets:',   bucketsRes.error.message)
  if (decisionsRes.error) console.error('[memory-reader] decisions:', decisionsRes.error.message)

  // Baseline is trustworthy only if EVERY table query succeeded. A single
  // failed query means the corresponding context array is empty for the wrong
  // reason — writers must not derive a fresh baseline from it.
  const ok =
    !personsRes.error &&
    !topicsRes.error &&
    !bucketsRes.error &&
    !decisionsRes.error

  return {
    ok,
    context: {
      persons:   (personsRes.data   ?? []).map(mapPerson),
      topics:    (topicsRes.data    ?? []).map(mapTopic),
      buckets:   (bucketsRes.data   ?? []).map(mapBucket),
      decisions: (decisionsRes.data ?? []).map(mapDecision),
    },
  }
}

// ── Mappers (snake_case DB row → camelCase TS record) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPerson(row: any): PersonMemoryRecord {
  return {
    id:               row.id,
    userId:           row.user_id,
    personEmail:      row.person_email,
    personName:       row.person_name,
    totalThreads:     row.total_threads,
    totalMessages:    row.total_messages,
    twoWayCount:      row.two_way_count,
    lastScore:        row.last_score,
    avgScore:         row.avg_score,
    scoreSamples:     row.score_samples ?? [],
    firstSeenAt:      row.first_seen_at,
    lastSeenAt:       row.last_seen_at,
    lastAnalysisAt:   row.last_analysis_at,
    confidence:       row.confidence,
    algorithmVersion: row.algorithm_version,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTopic(row: any): TopicMemoryRecord {
  return {
    id:               row.id,
    userId:           row.user_id,
    topicKey:         row.topic_key,
    topicDisplay:     row.topic_display,
    totalOccurrences: row.total_occurrences,
    lastThreadCount:  row.last_thread_count,
    firstSeenAt:      row.first_seen_at,
    lastSeenAt:       row.last_seen_at,
    algorithmVersion: row.algorithm_version,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBucket(row: any): WeeklyBucketRecord {
  return {
    id:           row.id,
    userId:       row.user_id,
    personEmail:  row.person_email,
    weekStart:    row.week_start,
    threadCount:  row.thread_count,
    messageCount: row.message_count,
    twoWay:       row.two_way,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDecision(row: any): DecisionMemoryRecord {
  return {
    id:               row.id,
    userId:           row.user_id,
    threadId:         row.thread_id,
    threadSubject:    row.thread_subject,
    fromName:         row.from_name,
    fromEmail:        row.from_email ?? null,
    timesSeen:        row.times_seen,
    lastScore:        row.last_score,
    isResolved:       row.is_resolved,
    resolvedAt:       row.resolved_at ?? null,
    firstSeenAt:      row.first_seen_at,
    lastSeenAt:       row.last_seen_at,
    algorithmVersion: row.algorithm_version,
  }
}
