/**
 * GET /api/memory/inspect
 *
 * Read-only memory inspector. Returns the full MemoryContext for the
 * authenticated user, aggregated into a MemoryInspectResponse.
 *
 * No writes. GET only — any other method is not handled (Next.js returns 405).
 *
 * schemaVersion is sourced from MEMORY_ALGORITHM_VERSION — the same constant
 * used by the memory writer, ensuring the value is never hardcoded here.
 */

import { NextResponse }               from 'next/server'
import { getServerSession }           from 'next-auth'
import { authOptions }                from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { readMemoryContext }          from '@/lib/memory-reader'
import { MEMORY_ALGORITHM_VERSION }   from '@/types/memory'
import type { WeeklyBucketRecord }    from '@/types/memory'
import type {
  MemoryInspectResponse,
  PersonInspectRow,
  TopicInspectRow,
  DecisionInspectRow,
  MemoryHealthSummary,
  ScoreTrend,
  WeekSummary,
} from '@/types/memory-inspect'

export async function GET() {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const userId = session.user.email

  // ── 2. Read memory context ───────────────────────────────────────────────────
  // Non-fatal: empty context returned on any Supabase error.
  let context
  try {
    const supabase = createServerSupabaseClient()
    context = await readMemoryContext(supabase, userId)
  } catch (err) {
    console.error('[memory/inspect] readMemoryContext failed:', err)
    context = { persons: [], topics: [], buckets: [], decisions: [] }
  }

  // ── 3. Bucket week spine ─────────────────────────────────────────────────────
  // Union of all week_starts present in the last 12 weeks, sorted asc.
  // Used by the client as the x-axis for activity grids.
  const bucketWeeks = Array.from(new Set(context.buckets.map(b => b.weekStart))).sort()

  // ── 4. Person aggregation ────────────────────────────────────────────────────
  // Group bucket rows by person for O(1) lookup during person map.
  const bucketsByPerson = new Map<string, WeeklyBucketRecord[]>()
  for (const b of context.buckets) {
    const list = bucketsByPerson.get(b.personEmail) ?? []
    list.push(b)
    bucketsByPerson.set(b.personEmail, list)
  }

  const persons: PersonInspectRow[] = context.persons
    .sort((a, b) => b.avgScore - a.avgScore)
    .map(p => {
      const personWeeks: WeekSummary[] = (bucketsByPerson.get(p.personEmail) ?? [])
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        .map(b => ({
          weekStart:    b.weekStart,
          threadCount:  b.threadCount,
          messageCount: b.messageCount,
          twoWay:       b.twoWay,
        }))

      return {
        personEmail:      p.personEmail,
        personName:       p.personName,
        avgScore:         p.avgScore,
        lastScore:        p.lastScore,
        scoreSamples:     p.scoreSamples,
        scoresTrend:      computeTrend(p.scoreSamples),
        twoWayCount:      p.twoWayCount,
        totalThreads:     p.totalThreads,
        totalMessages:    p.totalMessages,
        confidence:       p.confidence,
        firstSeenAt:      p.firstSeenAt,
        lastSeenAt:       p.lastSeenAt,
        recentWeeks:      personWeeks,
        algorithmVersion: p.algorithmVersion,
      }
    })

  // ── 5. Topic aggregation ─────────────────────────────────────────────────────
  const topics: TopicInspectRow[] = context.topics
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
    .map(t => ({
      topicDisplay:     t.topicDisplay,
      topicKey:         t.topicKey,
      totalOccurrences: t.totalOccurrences,
      lastThreadCount:  t.lastThreadCount,
      firstSeenAt:      t.firstSeenAt,
      lastSeenAt:       t.lastSeenAt,
    }))

  // ── 6. Decision aggregation ──────────────────────────────────────────────────
  const decisions: DecisionInspectRow[] = context.decisions
    .sort((a, b) => b.timesSeen - a.timesSeen)
    .map(d => ({
      threadId:      d.threadId,
      threadSubject: d.threadSubject,
      fromName:      d.fromName,
      fromEmail:     d.fromEmail,
      timesSeen:     d.timesSeen,
      firstSeenAt:   d.firstSeenAt,
      lastSeenAt:    d.lastSeenAt,
    }))

  // ── 7. Health summary ────────────────────────────────────────────────────────
  // schemaVersion: sourced from the shared MEMORY_ALGORITHM_VERSION constant —
  // the same value the writer stamps on every row.
  const allFirstSeen = [
    ...context.persons.map(p => p.firstSeenAt),
    ...context.topics.map(t => t.firstSeenAt),
    ...context.decisions.map(d => d.firstSeenAt),
  ].filter(Boolean).sort()

  const allLastSeen = [
    ...context.persons.map(p => p.lastSeenAt),
    ...context.topics.map(t => t.lastSeenAt),
    ...context.decisions.map(d => d.lastSeenAt),
  ].filter(Boolean).sort()

  const lastMemoryUpdateAt = context.persons.length
    ? [...context.persons]
        .sort((a, b) => b.lastAnalysisAt.localeCompare(a.lastAnalysisAt))[0]
        .lastAnalysisAt
    : null

  const health: MemoryHealthSummary = {
    schemaVersion:           MEMORY_ALGORITHM_VERSION,
    totalPersonRecords:      context.persons.length,
    totalTopicRecords:       context.topics.length,
    unresolvedDecisionCount: context.decisions.length,
    totalBucketRecords:      context.buckets.length,
    oldestRecordAt:          allFirstSeen[0] ?? null,
    newestRecordAt:          allLastSeen[allLastSeen.length - 1] ?? null,
    lastMemoryUpdateAt,
  }

  // ── 8. Return ────────────────────────────────────────────────────────────────
  const response: MemoryInspectResponse = {
    persons,
    topics,
    decisions,
    bucketWeeks,
    health,
    generatedAt:    new Date().toISOString(),
    totalPersons:   persons.length,
    totalTopics:    topics.length,
    totalDecisions: decisions.length,
  }

  return NextResponse.json(response)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute score trend from the last N samples.
 * Compares the mean of the first half vs the second half.
 * Returns 'flat' when fewer than 4 samples are available.
 */
function computeTrend(samples: number[]): ScoreTrend {
  if (samples.length < 4) return 'flat'
  const mid     = Math.floor(samples.length / 2)
  const first   = samples.slice(0, mid)
  const last    = samples.slice(mid)
  const mean    = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const diff    = mean(last) - mean(first)
  if (diff >=  5) return 'up'
  if (diff <= -5) return 'down'
  return 'flat'
}
