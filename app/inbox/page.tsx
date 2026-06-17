'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { InboxAnalysis } from '@/types/inbox'

const STATUS_MESSAGES = [
  'Reading your inbox…',
  'Finding important people…',
  'Grouping active threads…',
  'Almost done…',
]

export default function InboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [analysis, setAnalysis]   = useState<InboxAnalysis | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)
  const [statusIdx, setStatusIdx] = useState(0)

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
            await signIn('google', { callbackUrl: '/inbox' })
            return
          }
          throw new Error(data.error ?? 'Analysis failed')
        }

        setAnalysis(data as InboxAnalysis)
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
        <p className="text-[#555] text-sm tracking-wide transition-all duration-500">
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
          onClick={() => { setError(null); setLoading(true); setStatusIdx(0) }}
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

        {/* Important People */}
        <section>
          <SectionHeader
            label="Important People"
            description="Ranked by how often they appear in your inbox"
          />
          {analysis.people.length === 0 ? (
            <Empty text="No senders found" />
          ) : (
            <ul className="space-y-2">
              {analysis.people.map((p, i) => (
                <li
                  key={p.email}
                  className="flex items-center justify-between border border-white/8 rounded-xl px-5 py-3.5 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#333] text-xs w-4 shrink-0 text-right">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[#f8f8f8] text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[#555] text-xs truncate">{p.email}</p>
                    </div>
                  </div>
                  <span className="text-[#555] text-xs shrink-0">
                    {p.count} {p.count === 1 ? 'email' : 'emails'}
                  </span>
                </li>
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
