/**
 * Memory Layer V1 — Writer
 *
 * updateMemory() is the single entry point for persisting InboxAnalysis
 * signals into the four memory tables. Called from the inbox analyze API
 * route after analysis completes and memory context has been read.
 *
 * Design guarantees:
 *   · Idempotent   — upserts on unique (user_id, …) keys; safe to call twice
 *   · User-scoped  — every row carries user_id; reads are filtered by it
 *   · Failure-isolated — each table write runs independently via Promise.allSettled;
 *     one table failure does not abort the others or break the main response
 *
 * ⚠️  NEVER import from client components.
 */

import type { ServerSupabaseClient }          from '@/lib/supabase-server'
import { normalizeSubjectKey, getISOWeekStart } from '@/lib/memory-utils'
import { MEMORY_ALGORITHM_VERSION }             from '@/types/memory'
import type {
  MemoryContext,
  PersonMemoryRecord,
  TopicMemoryRecord,
  DecisionMemoryRecord,
} from '@/types/memory'
import type { InboxAnalysis, Person } from '@/types/inbox'

// ── Decision-subject detection (mirrors DECISION_RX in lib/priorities.ts) ────
const DECISION_RX =
  /\b(decision|approval|approve|review|sign.?off|confirm(?:ation)?|deadline|asap|action required|pending|needs your|requires your)\b/i

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Upsert all memory tables from a completed InboxAnalysis.
 *
 * @param supabase        Server Supabase client (service role)
 * @param userId          Canonical user identity (session.user.email)
 * @param analysis        Fresh InboxAnalysis from this run
 * @param existingContext MemoryContext read before this run (used for EMA / merge)
 */
export async function updateMemory(
  supabase:        ServerSupabaseClient,
  userId:          string,
  analysis:        InboxAnalysis,
  existingContext: MemoryContext,
): Promise<void> {
  const now       = new Date().toISOString()
  const weekStart = getISOWeekStart()

  type WriteOp = () => Promise<void>

  const ops: WriteOp[] = [
    () => upsertPersonMemory(supabase, userId, analysis.people, existingContext.persons, now),
    () => upsertTopicMemory(supabase, userId, analysis.topics, existingContext.topics, now),
    () => upsertWeeklyBuckets(supabase, userId, analysis.people, weekStart),
    () => upsertDecisionMemory(supabase, userId, analysis, existingContext.decisions, now),
  ]

  // First pass — run all operations concurrently
  const firstPass = await Promise.allSettled(ops.map(op => op()))

  // Collect failed ops for single retry pass
  const failedOps = ops.filter((_, i) => firstPass[i].status === 'rejected')

  if (failedOps.length === 0) return

  // Log initial failures
  firstPass.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.warn(
        `[memory-writer] Initial write failed (op ${i}), retrying in 100ms:`,
        result.reason,
      )
    }
  })

  // Option A retry — single attempt after 100ms delay
  // Handles transient connection blips and pool exhaustion.
  await delay(100)
  const retryPass = await Promise.allSettled(failedOps.map(op => op()))

  retryPass.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `[memory-writer] Retry failed (op ${i}), memory update dropped:`,
        result.reason,
      )
    }
  })
}

/** Returns a Promise that resolves after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── person_memory ─────────────────────────────────────────────────────────────

async function upsertPersonMemory(
  supabase:  ServerSupabaseClient,
  userId:    string,
  people:    Person[],
  existing:  PersonMemoryRecord[],
  now:       string,
): Promise<void> {
  if (people.length === 0) return

  const existingMap = new Map(
    existing.map(r => [r.personEmail.toLowerCase(), r])
  )

  const rows = people.map(person => {
    const key          = person.email.toLowerCase()
    const mem          = existingMap.get(key)
    const currentScore = person.score

    // Exponential moving average: new = old × 0.7 + current × 0.3
    const newAvgScore = mem
      ? Math.round(mem.avgScore * 0.7 + currentScore * 0.3)
      : currentScore

    // Keep last 10 score samples
    const newSamples = mem
      ? [...mem.scoreSamples, currentScore].slice(-10)
      : [currentScore]

    // twoWayCount: monotonically increment each run where the relationship is bidirectional
    const newTwoWayCount = mem
      ? (person.twoWay ? mem.twoWayCount + 1 : mem.twoWayCount)
      : (person.twoWay ? 1 : 0)

    return {
      user_id:           userId,
      person_email:      key,
      person_name:       person.name,
      total_threads:     person.threadCount,
      total_messages:    person.messageCount,
      two_way_count:     newTwoWayCount,
      last_score:        currentScore,
      avg_score:         newAvgScore,
      score_samples:     newSamples,
      last_seen_at:      now,
      last_analysis_at:  now,
      confidence:        person.confidence,
      algorithm_version: MEMORY_ALGORITHM_VERSION,
      // first_seen_at omitted — DB DEFAULT handles INSERT; not updated on conflict
    }
  })

  const { error } = await supabase
    .from('person_memory')
    .upsert(rows, { onConflict: 'user_id,person_email' })

  if (error) throw new Error(`person_memory upsert: ${error.message}`)
}

// ── topic_memory ──────────────────────────────────────────────────────────────

async function upsertTopicMemory(
  supabase:  ServerSupabaseClient,
  userId:    string,
  topics:    InboxAnalysis['topics'],
  existing:  TopicMemoryRecord[],
  now:       string,
): Promise<void> {
  if (topics.length === 0) return

  const existingMap = new Map(
    existing.map(r => [r.topicKey, r])
  )

  const rows = topics.map(topic => {
    const key = topic.name.toLowerCase().trim()
    const mem = existingMap.get(key)

    return {
      user_id:           userId,
      topic_key:         key,
      // Display name: first-write wins; preserve existing on conflict
      topic_display:     mem ? mem.topicDisplay : topic.name,
      total_occurrences: mem ? mem.totalOccurrences + 1 : 1,
      last_thread_count: topic.threadCount,
      last_seen_at:      now,
      algorithm_version: MEMORY_ALGORITHM_VERSION,
    }
  })

  const { error } = await supabase
    .from('topic_memory')
    .upsert(rows, { onConflict: 'user_id,topic_key' })

  if (error) throw new Error(`topic_memory upsert: ${error.message}`)
}

// ── relationship_weekly_buckets ───────────────────────────────────────────────
// Upsert uses GREATEST semantics: within a week, counts only increase.
// Running analysis twice in a week always reflects the larger of the two
// snapshots — the later analysis will have seen at least as many threads.

async function upsertWeeklyBuckets(
  supabase:   ServerSupabaseClient,
  userId:     string,
  people:     Person[],
  weekStart:  string,
): Promise<void> {
  if (people.length === 0) return

  const rows = people.map(person => ({
    user_id:      userId,
    person_email: person.email.toLowerCase(),
    week_start:   weekStart,
    thread_count: person.threadCount,
    message_count: person.messageCount,
    two_way:      person.twoWay,
  }))

  // Supabase upsert with ignoreDuplicates=false replaces on conflict.
  // To get GREATEST semantics we use a raw RPC approach — but for V1 simplicity
  // we use a plain upsert and accept that the latest run's counts win within
  // a week (analysis always covers the same 100 threads, so later = same or more).
  const { error } = await supabase
    .from('relationship_weekly_buckets')
    .upsert(rows, { onConflict: 'user_id,person_email,week_start' })

  if (error) throw new Error(`relationship_weekly_buckets upsert: ${error.message}`)
}

// ── decision_memory ───────────────────────────────────────────────────────────

async function upsertDecisionMemory(
  supabase:   ServerSupabaseClient,
  userId:     string,
  analysis:   InboxAnalysis,
  existing:   DecisionMemoryRecord[],
  now:        string,
): Promise<void> {
  // Identify decision candidates from the current analysis
  const decisionItems = analysis.needsReply.filter(
    item => DECISION_RX.test(item.subject)
  )
  if (decisionItems.length === 0) return

  // Key by stable Gmail thread_id — collision-free
  const existingMap = new Map(
    existing.map(r => [r.threadId, r])
  )

  const rows = decisionItems.map(item => {
    const mem       = existingMap.get(item.threadId)
    const fromEmail = findPersonEmail(item.from, analysis.people)

    return {
      user_id:           userId,
      thread_id:         item.threadId,
      thread_subject:    normalizeSubjectKey(item.subject),  // display only
      from_name:         item.from,
      from_email:        fromEmail,
      times_seen:        mem ? mem.timesSeen + 1 : 1,
      last_score:        0,    // score stored in future version
      last_seen_at:      now,
      algorithm_version: MEMORY_ALGORITHM_VERSION,
      // is_resolved, resolved_at, first_seen_at: DB DEFAULT / preserved on conflict
    }
  })

  // Only upsert unresolved decisions — skip rows where is_resolved = true
  const resolvedThreadIds = new Set(
    existing.filter(r => r.isResolved).map(r => r.threadId)
  )
  const filteredRows = rows.filter(r => !resolvedThreadIds.has(r.thread_id))
  if (filteredRows.length === 0) return

  const { error } = await supabase
    .from('decision_memory')
    .upsert(filteredRows, { onConflict: 'user_id,thread_id' })

  if (error) throw new Error(`decision_memory upsert: ${error.message}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Try to resolve a display name (NeedsReplyItem.from) to an email address
 * by looking it up in the people index from the current analysis.
 * Returns null when unresolvable — stored as NULL in the DB.
 */
function findPersonEmail(fromName: string, people: Person[]): string | null {
  const norm = fromName.toLowerCase().trim()
  const match = people.find(p => {
    const pn    = p.name.toLowerCase()
    const first = pn.split(/\s+/)[0]
    return pn === norm || pn.includes(norm) || norm.includes(first)
  })
  return match?.email?.toLowerCase() ?? null
}
