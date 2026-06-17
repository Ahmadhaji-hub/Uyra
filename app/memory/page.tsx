'use client'

/**
 * Memory Inspector Page — /memory
 *
 * Read-only view of what the system has learned across analysis runs.
 * Data is fetched from GET /api/memory/inspect — no writes from this page.
 *
 * Sections:
 *   · System Health card  — always visible above tabs
 *   · People tab          — per-person profiles, sparklines, activity grids
 *   · Topics tab          — recurring subjects sorted by occurrence count
 *   · Decisions tab       — unresolved pending decisions sorted by times seen
 */

import { useState, useEffect }  from 'react'
import { useSession }            from 'next-auth/react'
import { useRouter }             from 'next/navigation'
import type {
  MemoryInspectResponse,
  PersonInspectRow,
  TopicInspectRow,
  DecisionInspectRow,
  MemoryHealthSummary,
  ScoreTrend,
} from '@/types/memory-inspect'

type Tab = 'people' | 'topics' | 'decisions'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data,    setData]    = useState<MemoryInspectResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>('people')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/signin'); return }

    let cancelled = false

    async function fetchInspect() {
      try {
        const res  = await fetch('/api/memory/inspect')
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(json.error ?? 'Failed to load memory')
        setData(json as MemoryInspectResponse)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInspect()
    return () => { cancelled = true }
  }, [session, status, router])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#f8f8f8] opacity-40 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </main>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[#f8f8f8] font-medium">Could not load memory</p>
        <p className="text-[#555] text-sm text-center max-w-xs">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true) }}
          className="mt-2 px-6 py-2.5 text-sm rounded-full border border-white/12 text-[#f8f8f8] hover:bg-white/6 transition-all duration-200"
        >
          Try again
        </button>
      </main>
    )
  }

  if (!data) return null

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-[#f8f8f8] text-xl font-semibold tracking-tight">Memory Inspector</p>
          <p className="text-[#555] text-sm">
            {data.totalPersons} {data.totalPersons === 1 ? 'person' : 'people'} tracked · read-only
          </p>
        </div>

        {/* System Health — always visible */}
        <HealthCard health={data.health} />

        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {(['people', 'topics', 'decisions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-colors duration-200 border-b-2 -mb-px ${
                tab === t
                  ? 'border-[#f8f8f8] text-[#f8f8f8]'
                  : 'border-transparent text-[#555] hover:text-[#888]'
              }`}
            >
              {t === 'people'
                ? `People (${data.totalPersons})`
                : t === 'topics'
                ? `Topics (${data.totalTopics})`
                : `Decisions (${data.totalDecisions})`}
            </button>
          ))}
        </div>

        {/* People tab */}
        {tab === 'people' && (
          <section className="space-y-3">
            {data.persons.length === 0
              ? <Empty text="No person memory yet — run inbox analysis to build it" />
              : data.persons.map(p => (
                  <PersonCard key={p.personEmail} person={p} bucketWeeks={data.bucketWeeks} />
                ))
            }
          </section>
        )}

        {/* Topics tab */}
        {tab === 'topics' && (
          <section className="space-y-2">
            {data.topics.length === 0
              ? <Empty text="No topic memory yet" />
              : data.topics.map((t, i) => (
                  <TopicRow key={t.topicKey} topic={t} rank={i + 1} />
                ))
            }
          </section>
        )}

        {/* Decisions tab */}
        {tab === 'decisions' && (
          <section className="space-y-2">
            {data.decisions.length === 0
              ? <Empty text="No pending decisions tracked" />
              : data.decisions.map(d => (
                  <DecisionRow key={d.threadId} decision={d} />
                ))
            }
          </section>
        )}

        {/* Back */}
        <div className="pt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#555] text-sm hover:text-[#f8f8f8] transition-colors duration-200"
          >
            ← Back to Dashboard
          </button>
        </div>

      </div>
    </main>
  )
}

// ── Health Card ───────────────────────────────────────────────────────────────

function HealthCard({ health }: { health: MemoryHealthSummary }) {
  const staleness = health.lastMemoryUpdateAt
    ? Date.now() - new Date(health.lastMemoryUpdateAt).getTime()
    : Infinity
  const isStale = staleness > 24 * 60 * 60 * 1000  // > 24 hours since last analysis run

  return (
    <div className="border border-white/8 rounded-2xl p-6">
      <p className="text-[#f8f8f8] text-xs font-semibold tracking-widest uppercase mb-5">
        System Health
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <HealthStat label="Schema version"    value={`v${health.schemaVersion}`} />
        <HealthStat label="People tracked"    value={String(health.totalPersonRecords)} />
        <HealthStat label="Topics tracked"    value={String(health.totalTopicRecords)} />
        <HealthStat
          label="Pending decisions"
          value={String(health.unresolvedDecisionCount)}
          highlight={health.unresolvedDecisionCount >= 3 ? 'amber' : undefined}
        />
        <HealthStat
          label="Oldest record"
          value={health.oldestRecordAt ? timeAgo(health.oldestRecordAt) : '—'}
        />
        <HealthStat
          label="Newest record"
          value={health.newestRecordAt ? timeAgo(health.newestRecordAt) : '—'}
        />
        <HealthStat
          label="Last memory update"
          value={health.lastMemoryUpdateAt ? timeAgo(health.lastMemoryUpdateAt) : 'Never'}
          highlight={isStale ? 'red' : undefined}
        />
      </div>
    </div>
  )
}

function HealthStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'amber' | 'red'
}) {
  const valueColor =
    highlight === 'red'   ? 'text-red-400' :
    highlight === 'amber' ? 'text-amber-400' :
    'text-[#f8f8f8]'
  return (
    <div>
      <p className="text-[#555] text-xs mb-0.5">{label}</p>
      <p className={`text-sm font-medium tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}

// ── Person Card ───────────────────────────────────────────────────────────────

function PersonCard({
  person: p,
  bucketWeeks,
}: {
  person: PersonInspectRow
  bucketWeeks: string[]
}) {
  const weekMap = new Map(p.recentWeeks.map(w => [w.weekStart, w]))

  return (
    <div className="border border-white/8 rounded-xl px-5 py-4 space-y-3.5">

      {/* Top row: name + email + score badge + trend */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[#f8f8f8] text-sm font-medium truncate">{p.personName}</p>
          <p className="text-[#555] text-xs truncate">{p.personEmail}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <TrendIcon trend={p.scoresTrend} />
          <ScoreBadge score={p.avgScore} />
        </div>
      </div>

      {/* Sparkline + stats */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <Sparkline samples={p.scoreSamples} />
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          <p className="text-[#555] text-xs">
            {p.totalThreads} {p.totalThreads === 1 ? 'thread' : 'threads'} ·{' '}
            {p.totalMessages} {p.totalMessages === 1 ? 'msg' : 'msgs'}
          </p>
          <p className="text-[#555] text-xs">
            {p.twoWayCount} two-way · {p.confidence}% conf
          </p>
        </div>
      </div>

      {/* Activity grid */}
      {bucketWeeks.length > 0 && (
        <div>
          <p className="text-[#333] text-xs mb-2">Activity — last 12 weeks</p>
          <div className="flex gap-1 flex-wrap">
            {bucketWeeks.map(week => {
              const bucket = weekMap.get(week)
              return (
                <div
                  key={week}
                  title={
                    bucket
                      ? `${week} · ${bucket.threadCount}t ${bucket.messageCount}m${bucket.twoWay ? ' · two-way' : ''}`
                      : `${week} · no contact`
                  }
                  className={`w-4 h-4 rounded-sm ${
                    bucket
                      ? bucket.twoWay
                        ? 'bg-[#9b8fff]/60'
                        : 'bg-white/20'
                      : 'bg-white/4'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[#333] text-[10px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#9b8fff]/60 inline-block" />
              two-way
            </span>
            <span className="flex items-center gap-1 text-[#333] text-[10px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-white/20 inline-block" />
              one-way
            </span>
            <span className="flex items-center gap-1 text-[#333] text-[10px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-white/4 border border-white/8 inline-block" />
              none
            </span>
          </div>
        </div>
      )}

      {/* Timestamps + algorithm version */}
      <div className="flex items-center justify-between pt-0.5">
        <p className="text-[#333] text-xs">
          First seen {timeAgo(p.firstSeenAt)} · last {timeAgo(p.lastSeenAt)}
        </p>
        <span className="text-[#333] text-[10px] px-1.5 py-0.5 rounded border border-white/6">
          v{p.algorithmVersion}
        </span>
      </div>

    </div>
  )
}

// ── Score Badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 60 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
    score >= 40 ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                  'bg-white/4 text-[#555] border-white/8'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border tabular-nums ${color}`}>
      {score}
    </span>
  )
}

// ── Trend Icon ────────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: ScoreTrend }) {
  if (trend === 'up')   return <span className="text-emerald-400 text-sm leading-none">↑</span>
  if (trend === 'down') return <span className="text-red-400/80 text-sm leading-none">↓</span>
  return <span className="text-[#444] text-sm leading-none">→</span>
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) {
    return (
      <div className="h-6 flex items-center">
        <span className="text-[#333] text-xs">no history</span>
      </div>
    )
  }

  const W = 100, H = 24
  const min   = Math.min(...samples)
  const max   = Math.max(...samples)
  const range = max - min || 1

  const points = samples
    .map((s, i) => {
      const x = (i / (samples.length - 1)) * W
      const y = H - ((s - min) / range) * (H - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="block"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="rgba(248,248,248,0.18)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Topic Row ─────────────────────────────────────────────────────────────────

function TopicRow({ topic: t, rank }: { topic: TopicInspectRow; rank: number }) {
  return (
    <div className="flex items-center justify-between border border-white/8 rounded-xl px-5 py-3.5 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[#333] text-xs w-4 shrink-0 text-right">{rank}</span>
        <div className="min-w-0">
          <p className="text-[#f8f8f8] text-sm font-medium truncate">{t.topicDisplay}</p>
          <p className="text-[#333] text-xs truncate">{t.topicKey}</p>
        </div>
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <p className="text-[#f8f8f8] text-sm font-medium tabular-nums">{t.totalOccurrences}×</p>
        <p className="text-[#555] text-xs whitespace-nowrap">
          {t.lastThreadCount} {t.lastThreadCount === 1 ? 'thread' : 'threads'} last
        </p>
      </div>
    </div>
  )
}

// ── Decision Row ──────────────────────────────────────────────────────────────

function DecisionRow({ decision: d }: { decision: DecisionInspectRow }) {
  const isPersistent = d.timesSeen >= 3
  return (
    <div
      className={`border rounded-xl px-5 py-3.5 space-y-1.5 ${
        isPersistent ? 'border-amber-400/20' : 'border-white/8'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[#f8f8f8] text-sm font-medium truncate">
            {d.threadSubject || '(no subject)'}
          </p>
          <p className="text-[#555] text-xs truncate">
            {d.fromName}{d.fromEmail ? ` · ${d.fromEmail}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border tabular-nums ${
            isPersistent
              ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
              : 'bg-white/4 text-[#555] border-white/8'
          }`}
        >
          {d.timesSeen}×
        </span>
      </div>
      <p className="text-[#333] text-xs">
        Pending since {timeAgo(d.firstSeenAt)} · last seen {timeAgo(d.lastSeenAt)}
      </p>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="border border-white/8 rounded-xl px-5 py-4 text-center">
      <p className="text-[#555] text-sm">{text}</p>
    </div>
  )
}

// ── timeAgo ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 2)   return 'just now'
  if (minutes < 60)  return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)     return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12)   return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
