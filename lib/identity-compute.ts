/**
 * Identity Memory — deterministic computation engine.
 *
 * Pure function. No AI, no LLM, no I/O. Given a MemoryContext assembled from the
 * four Memory V1 tables, it derives the owner's identity model (facets + summary
 * + confidence + a stable source signature). Same inputs always produce the same
 * output, so the result is fully reconstructable and offline-testable.
 *
 * NEVER import from client components.
 */

import { createHash } from 'crypto'
import type { MemoryContext, WeeklyBucketRecord } from '@/types/memory'
import type { FacetDraft, IdentityDraft, IdentitySummary, SummaryRef } from '@/types/identity'
import { AGGREGATE_FACET_KEY, IDENTITY_ALGORITHM_VERSION } from '@/types/identity'

// ── Tunables ──────────────────────────────────────────────────────────────────

const MAX_RELATIONSHIP_FACETS = 8
const MAX_TOPIC_FACETS        = 10
const MIN_TOPIC_OCCURRENCES   = 2   // filters singleton-subject noise from topic_memory
const RELATIONSHIP_MIN_THREADS = 2  // minimum evidence to be an identity-level relationship
const WEEKS_WINDOW            = 12
const RECENT_DECAY_WEEKS      = 4   // no activity within this many weeks ⇒ "cooling"

// ── Entry point ───────────────────────────────────────────────────────────────

export function computeIdentity(context: MemoryContext): IdentityDraft {
  const bucketsByPerson = groupBucketsByPerson(context.buckets)

  const relationshipFacets = computeRelationshipFacets(context, bucketsByPerson)
  const topicFacets        = computeTopicFacets(context)
  const communicationFacet = computeCommunicationFacet(context)
  const decisionFacet      = computeDecisionFacet(context)
  const engagementFacet    = computeEngagementFacet(context.buckets)

  const facets: FacetDraft[] = [
    ...relationshipFacets,
    ...topicFacets,
    communicationFacet,
    decisionFacet,
    engagementFacet,
  ]

  const confidence = computeOverallConfidence(context)
  const summary    = buildSummary(
    relationshipFacets, topicFacets, communicationFacet, decisionFacet, engagementFacet, facets.length,
  )
  const sourceSignature = computeSourceSignature(context)

  return { summary, confidence, sourceSignature, facets }
}

// ── key_relationship facets ───────────────────────────────────────────────────

function computeRelationshipFacets(
  context:         MemoryContext,
  bucketsByPerson: Map<string, WeeklyBucketRecord[]>,
): FacetDraft[] {
  const eligible = context.persons.filter(
    p => p.totalThreads >= RELATIONSHIP_MIN_THREADS || p.twoWayCount > 0,
  )

  const sorted = [...eligible].sort((a, b) => b.avgScore - a.avgScore)
  const top    = sorted.slice(0, MAX_RELATIONSHIP_FACETS)

  return top.map(p => {
    const weeks       = bucketsByPerson.get(p.personEmail.toLowerCase()) ?? []
    const activeWeeks = weeks.length
    const trend       = computeTrend(p.scoreSamples)
    const decaying    = p.avgScore >= 50 && !hasRecentActivity(weeks)

    return {
      facetType:  'key_relationship' as const,
      facetKey:   p.personEmail.toLowerCase(),
      label:      p.personName || p.personEmail,
      weight:     clamp01(p.avgScore / 100),
      confidence: p.confidence,
      value: {
        avgScore:     Math.round(p.avgScore),
        lastScore:    p.lastScore,
        twoWayCount:  p.twoWayCount,
        totalThreads: p.totalThreads,
        totalMessages: p.totalMessages,
        trend,
        activeWeeks,
        decaying,
      },
      evidence: {
        scoreSamples: p.scoreSamples.length,
        totalThreads: p.totalThreads,
        bucketWeeks:  activeWeeks,
      },
    }
  })
}

// ── topic_affinity facets ─────────────────────────────────────────────────────

function computeTopicFacets(context: MemoryContext): FacetDraft[] {
  const eligible = context.topics.filter(t => t.totalOccurrences >= MIN_TOPIC_OCCURRENCES)
  if (eligible.length === 0) return []

  const maxOcc = Math.max(...eligible.map(t => t.totalOccurrences))
  const now    = Date.now()

  const ranked = [...eligible].sort((a, b) => {
    // occurrences primary, recency tiebreak
    if (b.totalOccurrences !== a.totalOccurrences) return b.totalOccurrences - a.totalOccurrences
    return b.lastSeenAt.localeCompare(a.lastSeenAt)
  }).slice(0, MAX_TOPIC_FACETS)

  return ranked.map(t => {
    const recencyDays = daysBetween(t.lastSeenAt, now)
    return {
      facetType:  'topic_affinity' as const,
      facetKey:   t.topicKey,
      label:      t.topicDisplay || t.topicKey,
      weight:     clamp01(maxOcc > 0 ? t.totalOccurrences / maxOcc : 0),
      confidence: Math.min(t.totalOccurrences * 20, 90),
      value: {
        totalOccurrences: t.totalOccurrences,
        lastThreadCount:  t.lastThreadCount,
        recencyDays,
      },
      evidence: { totalOccurrences: t.totalOccurrences },
    }
  })
}

// ── communication_pattern facet (aggregate) ───────────────────────────────────

function computeCommunicationFacet(context: MemoryContext): FacetDraft {
  const persons = context.persons
  const n       = persons.length

  const twoWayPersons = persons.filter(p => p.twoWayCount > 0).length
  const twoWayRatio   = n > 0 ? round2(twoWayPersons / n) : 0

  // Attention concentration: share of total avgScore held by the top 3 contacts.
  const scores      = persons.map(p => Math.max(0, p.avgScore)).sort((a, b) => b - a)
  const totalScore  = scores.reduce((a, b) => a + b, 0)
  const top3        = scores.slice(0, 3).reduce((a, b) => a + b, 0)
  const concentration = totalScore > 0 ? round2(top3 / totalScore) : 0

  const depths = persons
    .filter(p => p.totalThreads > 0)
    .map(p => p.totalMessages / p.totalThreads)
  const avgRelationshipDepth = depths.length > 0
    ? round2(depths.reduce((a, b) => a + b, 0) / depths.length)
    : 0

  return {
    facetType:  'communication_pattern',
    facetKey:   AGGREGATE_FACET_KEY,
    label:      'Communication pattern',
    weight:     1,
    confidence: Math.min(n * 10, 90),
    value: {
      activeContacts:       n,
      twoWayRatio,
      concentration,
      avgRelationshipDepth,
    },
    evidence: { personCount: n },
  }
}

// ── decision_behavior facet (aggregate) ───────────────────────────────────────
// context.decisions are UNRESOLVED only (the reader filters is_resolved=false).

function computeDecisionFacet(context: MemoryContext): FacetDraft {
  const decisions = context.decisions
  const openCount = decisions.length
  const now       = Date.now()

  const timesSeen    = decisions.map(d => d.timesSeen)
  const avgTimesSeen = openCount > 0 ? round2(timesSeen.reduce((a, b) => a + b, 0) / openCount) : 0
  const maxTimesSeen = openCount > 0 ? Math.max(...timesSeen) : 0
  const oldestOpenDays = openCount > 0
    ? Math.max(...decisions.map(d => daysBetween(d.firstSeenAt, now)))
    : 0

  // Backlog pressure: open count weighted by how long things have lingered.
  const backlogPressure = round2(openCount * (1 + Math.min(avgTimesSeen, 10) / 10))

  return {
    facetType:  'decision_behavior',
    facetKey:   AGGREGATE_FACET_KEY,
    label:      'Decision behavior',
    weight:     1,
    confidence: openCount > 0 ? Math.min(openCount * 25, 90) : 40,
    value: {
      openDecisionCount: openCount,
      avgTimesSeen,
      maxTimesSeen,
      oldestOpenDays,
      backlogPressure,
    },
    evidence: { openDecisionCount: openCount },
  }
}

// ── engagement_rhythm facet (aggregate) ───────────────────────────────────────

function computeEngagementFacet(buckets: WeeklyBucketRecord[]): FacetDraft {
  // Aggregate weekly totals across all people.
  const byWeek = new Map<string, { threads: number; messages: number }>()
  for (const b of buckets) {
    const w = byWeek.get(b.weekStart) ?? { threads: 0, messages: 0 }
    w.threads  += b.threadCount
    w.messages += b.messageCount
    byWeek.set(b.weekStart, w)
  }

  const weeks = Array.from(byWeek.keys()).sort()
  const weeklyThreads = weeks.map(w => byWeek.get(w)!.threads)

  const activeWeeksRatio = round2(weeks.length / WEEKS_WINDOW)
  const trend            = computeNumericTrend(weeklyThreads)

  return {
    facetType:  'engagement_rhythm',
    facetKey:   AGGREGATE_FACET_KEY,
    label:      'Engagement rhythm',
    weight:     1,
    confidence: Math.min(weeks.length * 8, 90),
    value: {
      weeksObserved:    weeks.length,
      activeWeeksRatio,
      trend,
      latestWeekThreads: weeklyThreads.length > 0 ? weeklyThreads[weeklyThreads.length - 1] : 0,
    },
    evidence: { weeksObserved: weeks.length },
  }
}

// ── Summary + overall confidence ──────────────────────────────────────────────

function buildSummary(
  relationships: FacetDraft[],
  topics:        FacetDraft[],
  communication: FacetDraft,
  decision:      FacetDraft,
  engagement:    FacetDraft,
  facetCount:    number,
): IdentitySummary {
  const toRef = (f: FacetDraft): SummaryRef => ({ key: f.facetKey, label: f.label, weight: round2(f.weight) })

  return {
    headline:         buildHeadline(relationships, topics, decision),
    topRelationships: relationships.slice(0, 3).map(toRef),
    topTopics:        topics.slice(0, 3).map(toRef),
    communication:    communication.value as Record<string, number>,
    decisionBehavior: decision.value as Record<string, number>,
    engagement:       engagement.value as Record<string, number>,
    facetCount,
  }
}

/** Deterministic, evidence-grounded one-liner — no generative text. */
function buildHeadline(
  relationships: FacetDraft[],
  topics:        FacetDraft[],
  decision:      FacetDraft,
): string {
  const topContact = relationships[0]?.label
  const topTopic   = topics[0]?.label
  const openCount  = Number((decision.value as Record<string, number>).openDecisionCount ?? 0)

  if (topContact && topTopic) {
    return `Most engaged with ${topContact}; recurring focus on "${topTopic}"`
  }
  if (topContact) return `Most engaged with ${topContact}`
  if (openCount > 0) return `${openCount} open decision${openCount === 1 ? '' : 's'} awaiting action`
  return 'Building identity — not enough signal yet'
}

function computeOverallConfidence(context: MemoryContext): number {
  const persons = context.persons.length
  const weeks   = new Set(context.buckets.map(b => b.weekStart)).size
  const topics  = context.topics.filter(t => t.totalOccurrences >= MIN_TOPIC_OCCURRENCES).length
  return Math.min(90, persons * 5 + weeks * 3 + topics * 2)
}

// ── Source signature ──────────────────────────────────────────────────────────
// A stable hash of the V1 inputs PLUS the current UTC day. When this and the
// algorithm version are unchanged, the writer skips recompute. Deterministic
// ordering is essential.
//
// The UTC-day term (`now`) is deliberate: several facet values are time-relative
// (relationship `decaying`, `recencyDays`, decision `oldestOpenDays`). Without a
// time term, a quiet inbox (no V1 change) would freeze those values because the
// skip-gate would keep skipping. Including the day forces at most one recompute
// per UTC day per owner so time-based facets stay fresh, while still skipping
// the (cheap) intra-day re-runs.

export function computeSourceSignature(
  context: MemoryContext,
  now:     Date = new Date(),
): string {
  const utcDay = now.toISOString().slice(0, 10)   // 'YYYY-MM-DD' (UTC)
  const persons = [...context.persons]
    .sort((a, b) => a.personEmail.localeCompare(b.personEmail))
    .map(p => `${p.personEmail.toLowerCase()}:${p.lastAnalysisAt}:${Math.round(p.avgScore)}:${p.twoWayCount}:${p.totalThreads}`)

  const topics = [...context.topics]
    .sort((a, b) => a.topicKey.localeCompare(b.topicKey))
    .map(t => `${t.topicKey}:${t.totalOccurrences}:${t.lastThreadCount}`)

  const buckets = [...context.buckets]
    .sort((a, b) => (a.personEmail + a.weekStart).localeCompare(b.personEmail + b.weekStart))
    .map(b => `${b.personEmail.toLowerCase()}:${b.weekStart}:${b.threadCount}:${b.messageCount}:${b.twoWay ? 1 : 0}`)

  const decisions = [...context.decisions]
    .sort((a, b) => a.threadId.localeCompare(b.threadId))
    .map(d => `${d.threadId}:${d.timesSeen}`)

  const payload = `v${IDENTITY_ALGORITHM_VERSION}|day|${utcDay}|P|${persons.join(',')}|T|${topics.join(',')}|B|${buckets.join(',')}|D|${decisions.join(',')}`
  return createHash('sha1').update(payload).digest('hex')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupBucketsByPerson(buckets: WeeklyBucketRecord[]): Map<string, WeeklyBucketRecord[]> {
  const m = new Map<string, WeeklyBucketRecord[]>()
  for (const b of buckets) {
    const key  = b.personEmail.toLowerCase()
    const list = m.get(key) ?? []
    list.push(b)
    m.set(key, list)
  }
  return m
}

function hasRecentActivity(weeks: WeeklyBucketRecord[]): boolean {
  if (weeks.length === 0) return false
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_DECAY_WEEKS * 7)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return weeks.some(w => w.weekStart >= cutoffStr)
}

/** Categorical trend over score samples (mirrors the inspector's logic). */
function computeTrend(samples: number[]): 'up' | 'down' | 'flat' {
  if (samples.length < 4) return 'flat'
  const mid   = Math.floor(samples.length / 2)
  const mean  = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const diff  = mean(samples.slice(mid)) - mean(samples.slice(0, mid))
  if (diff >=  5) return 'up'
  if (diff <= -5) return 'down'
  return 'flat'
}

/** Trend over an arbitrary numeric series (e.g. weekly activity). */
function computeNumericTrend(series: number[]): 'up' | 'down' | 'flat' {
  if (series.length < 4) return 'flat'
  const mid  = Math.floor(series.length / 2)
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const first = mean(series.slice(0, mid))
  const last  = mean(series.slice(mid))
  const rel   = first > 0 ? (last - first) / first : 0
  if (rel >=  0.15) return 'up'
  if (rel <= -0.15) return 'down'
  return 'flat'
}

function daysBetween(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 0
  return Math.max(0, Math.floor((nowMs - t) / (1000 * 60 * 60 * 24)))
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
