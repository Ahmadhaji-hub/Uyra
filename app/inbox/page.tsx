'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { InboxAnalysis, Person, RelationshipStatus } from '@/types/inbox'
import type { Priority, PriorityType } from '@/types/priorities'
import { generatePriorities } from '@/lib/priorities'

const STATUS_MESSAGES = [
  'Reading your inbox…',
  'Finding important people…',
  'Grouping active threads…',
  'Almost done…',
]

export default function InboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [analysis,   setAnalysis]   = useState<InboxAnalysis | null>(null)
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [statusIdx,  setStatusIdx]  = useState(0)

  // Cycle loading messages
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => {
      setStatusIdx(i => (i + 1) % STATUS_MESSAGES.length)
    }, 1400)
    return () => clearInterval(id)
  }, [loading])

  // Fetch analysis once session is ready
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/signin'); return }
    if (!session.gmailConnected) { router.push('/connect'); return }

    async function fetchAnalysis() {
      try {
        const res  = await fetch('/api/inbox/analyze')
        const data = await res.json()

        if (!res.ok) {
          if (data.code === 'TOKEN_EXPIRED') {
            // Access token hard-expired and no refresh token — full re-auth
            await signIn('google', { callbackUrl: '/inbox' })
            return
          }
          if (data.code === 'REFRESH_ERROR') {
            // Refresh token revoked (user revoked app access in Google settings,
            // or token was invalidated). Send back through Gmail connect flow.
            router.push('/connect')
            return
          }
          throw new Error(data.error ?? 'Analysis failed')
        }

        const inbox = data as InboxAnalysis
        setAnalysis(inbox)
        setPriorities(generatePriorities(inbox))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [session, status, router])

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#f8f8f8] opacity-40 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-[#555] text-sm tracking-wide">
          {STATUS_MESSAGES[statusIdx]}
        </p>
      </main>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-[#f8f8f8] font-medium">Something went wrong</p>
        <p className="text-[#555] text-sm text-center max-w-xs">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); setStatusIdx(0); setPriorities([]) }}
          className="mt-2 px-6 py-2.5 text-sm rounded-full border border-white/12 text-[#f8f8f8] hover:bg-white/6 transition-all duration-200"
        >
          Try again
        </button>
      </main>
    )
  }

  if (!analysis) return null

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-[#f8f8f8] text-xl font-semibold tracking-tight">Inbox Analysis</p>
          <p className="text-[#555] text-sm">
            {analysis.threadCount} threads · analysed just now
          </p>
        </div>

        {/* Today's Priorities */}
        {priorities.length > 0 && (
          <section>
            <SectionHeader
              label="Today's Priorities"
              description="Ranked actions derived from your inbox — deterministic, no AI"
            />
            <ul className="space-y-2">
              {priorities.map(p => (
                <PriorityCard key={p.id} priority={p} />
              ))}
            </ul>
          </section>
        )}

        {/* Important People */}
        <section>
          <SectionHeader
            label="Important People"
            description="Ranked by human signal — two-way conversations, recency, and interaction depth"
          />
          {analysis.people.length === 0 ? (
            <Empty text="No human contacts detected in the last 100 threads" />
          ) : (
            <ul className="space-y-2">
              {analysis.people.map((p, i) => (
                <PersonRow key={p.email} person={p} rank={i + 1} />
              ))}
            </ul>
          )}
        </section>

        {/* Active Topics */}
        <section>
          <SectionHeader
            label="Active Topics"
            description="Recurring subjects grouped by theme"
          />
          {analysis.topics.length === 0 ? (
            <Empty text="No recurring topics found" />
          ) : (
            <ul className="space-y-2">
              {analysis.topics.map((t, i) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between border border-white/8 rounded-xl px-5 py-3.5 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#333] text-xs w-4 shrink-0 text-right">{i + 1}</span>
                    <p className="text-[#f8f8f8] text-sm font-medium truncate">{t.name}</p>
                  </div>
                  <span className="text-[#555] text-xs shrink-0">
                    {t.threadCount} {t.threadCount === 1 ? 'thread' : 'threads'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Needs Reply */}
        <section>
          <SectionHeader
            label="Needs Reply"
            description="Conversations where you haven't replied yet"
          />
          {analysis.needsReply.length === 0 ? (
            <Empty text="You're all caught up" />
          ) : (
            <ul className="space-y-2">
              {analysis.needsReply.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border border-white/8 rounded-xl px-5 py-3.5 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-[#f8f8f8] text-sm font-medium truncate">{item.subject}</p>
                    <p className="text-[#555] text-xs truncate">from {item.from}</p>
                  </div>
                  <span className="text-[#555] text-xs shrink-0 whitespace-nowrap">{item.lastDate}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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

// ── Priority Card ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<PriorityType, string> = {
  NEEDS_REPLY:      'bg-red-400/10 text-red-400 border border-red-400/20',
  FOLLOW_UP:        'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  IMPORTANT_PERSON: 'bg-[#9b8fff]/10 text-[#9b8fff] border border-[#9b8fff]/20',
  OPPORTUNITY:      'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
  DECISION:         'bg-blue-400/10 text-blue-400 border border-blue-400/20',
}

const TYPE_LABELS: Record<PriorityType, string> = {
  NEEDS_REPLY:      'Reply',
  FOLLOW_UP:        'Follow Up',
  IMPORTANT_PERSON: 'Key Contact',
  OPPORTUNITY:      'Opportunity',
  DECISION:         'Decision',
}

function PriorityCard({ priority: p }: { priority: Priority }) {
  const hasEmail = Boolean(p.relatedPerson?.email)

  return (
    <li className="border border-white/8 rounded-xl px-5 py-4">
      <div className="flex items-start justify-between gap-4">

        {/* Left: badge + title + description + email */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <span
            className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full tracking-wide uppercase ${TYPE_STYLES[p.type]}`}
          >
            {TYPE_LABELS[p.type]}
          </span>
          <p className="text-[#f8f8f8] text-sm font-medium leading-snug">{p.title}</p>
          <p className="text-[#555] text-xs">{p.description}</p>
          {hasEmail && (
            <p className="text-[#333] text-xs">{p.relatedPerson!.email}</p>
          )}
        </div>

        {/* Right: score + age */}
        <div className="shrink-0 text-right pt-0.5">
          <p className="text-[#f8f8f8] text-sm font-medium tabular-nums">
            {p.score}<span className="text-[#444] text-xs font-normal">/100</span>
          </p>
          {p.ageInDays !== undefined && p.ageInDays > 0 && (
            <p className="text-[#333] text-xs mt-0.5 whitespace-nowrap">
              {p.ageInDays === 1 ? '1 day ago' : `${p.ageInDays}d ago`}
            </p>
          )}
        </div>

      </div>
    </li>
  )
}

// ── Person Row ────────────────────────────────────────────────────────────────

function PersonRow({ person, rank }: { person: Person; rank: number }) {
  return (
    <li className="border border-white/8 rounded-xl px-5 py-4 gap-4 space-y-2.5">
      {/* Top row: rank + name + relationship badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[#333] text-xs w-4 shrink-0 text-right">{rank}</span>
          <div className="min-w-0">
            <p className="text-[#f8f8f8] text-sm font-medium truncate">{person.name}</p>
            <p className="text-[#555] text-xs truncate">{person.email}</p>
          </div>
        </div>
        <RelationshipBadge status={person.relationship} twoWay={person.twoWay} />
      </div>

      {/* Score bar + confidence */}
      <div className="pl-7 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[#444] text-xs">Human signal</span>
          <span className="text-[#f8f8f8] text-xs font-medium tabular-nums">
            {person.score}
            <span className="text-[#444]">/100</span>
          </span>
        </div>
        <div className="h-px bg-white/6 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${person.score}%`,
              background: scoreColor(person.score),
            }}
          />
        </div>
        <p className="text-[#333] text-xs">
          {person.threadCount} {person.threadCount === 1 ? 'thread' : 'threads'} ·{' '}
          {person.messageCount} {person.messageCount === 1 ? 'message' : 'messages'} ·{' '}
          {person.confidence}% confidence
        </p>
      </div>
    </li>
  )
}

// ── Relationship Badge ────────────────────────────────────────────────────────

const BADGE_STYLES: Record<RelationshipStatus, string> = {
  frequent: 'bg-[#f8f8f8]/8 text-[#f8f8f8] border border-white/12',
  active:   'bg-emerald-400/8 text-emerald-400 border border-emerald-400/20',
  dormant:  'bg-white/3 text-[#444] border border-white/6',
}

const BADGE_LABELS: Record<RelationshipStatus, string> = {
  frequent: 'Frequent',
  active:   'Active',
  dormant:  'Dormant',
}

function RelationshipBadge({
  status,
  twoWay,
}: {
  status: RelationshipStatus
  twoWay: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {twoWay && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#9b8fff]/10 text-[#9b8fff] border border-[#9b8fff]/20 tracking-wide uppercase">
          2-way
        </span>
      )}
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full tracking-wide uppercase ${BADGE_STYLES[status]}`}
      >
        {BADGE_LABELS[status]}
      </span>
    </div>
  )
}

// ── Score color (green → amber → muted) ──────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'rgba(52,211,153,0.7)'   // emerald
  if (score >= 45) return 'rgba(251,191,36,0.6)'    // amber
  return 'rgba(255,255,255,0.15)'                    // muted
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader({ label, description }: { label: string; description: string }) {
  return (
    <div className="mb-4 space-y-0.5">
      <p className="text-[#f8f8f8] text-sm font-semibold tracking-tight">{label}</p>
      <p className="text-[#555] text-xs">{description}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="border border-white/8 rounded-xl px-5 py-4 text-center">
      <p className="text-[#555] text-sm">{text}</p>
    </div>
  )
}
