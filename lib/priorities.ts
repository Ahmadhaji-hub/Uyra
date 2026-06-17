/**
 * Milestone 4 — Priorities Engine
 *
 * Pure, deterministic function. No AI, no LLMs. All signals derived from
 * InboxAnalysis metadata already computed by lib/gmail.ts.
 *
 * Priority precedence (per thread): DECISION > OPPORTUNITY > NEEDS_REPLY
 * FOLLOW_UP and IMPORTANT_PERSON are relationship-based, never thread-based.
 *
 * Scoring formula per type:
 *   score = base
 *         + person.score × 0.25          (up to +25 — importance of the person)
 *         + twoWay bonus                 (+10 if bidirectional relationship)
 *         + relationship bonus            (+8 frequent, +4 active)
 *         + recency bonus                 (+20/15/10/5 for today/yesterday/≤3d/≤7d)
 *         + urgency bonus                 (+8 if subject matches urgent keywords)
 *         − unknown sender penalty        (−10 if sender not found in people list)
 *   clamped to [0, 100]
 */

import type { InboxAnalysis, Person } from '@/types/inbox'
import type { Priority, PriorityType } from '@/types/priorities'

// ─── Entry point ──────────────────────────────────────────────────────────────

export function generatePriorities(analysis: InboxAnalysis): Priority[] {
  const idx     = buildPersonIndex(analysis.people)
  const claimed = new Set<string>()    // subjects already assigned to a priority

  // Process in precedence order so each thread is typed exactly once
  const decisions     = genDecisions(analysis, idx, claimed)
  decisions.forEach(p => claimed.add(p.relatedThread ?? p.id))

  const opportunities = genOpportunities(analysis, idx, claimed)
  opportunities.forEach(p => claimed.add(p.relatedThread ?? p.id))

  const replies       = genNeedsReply(analysis, idx, claimed)
  replies.forEach(p => claimed.add(p.relatedThread ?? p.id))

  const followUps     = genFollowUps(analysis, idx)
  const important     = genImportantPersons(analysis)

  return [...decisions, ...opportunities, ...replies, ...followUps, ...important]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

// ─── Person index ─────────────────────────────────────────────────────────────

function buildPersonIndex(people: Person[]): Map<string, Person> {
  const idx = new Map<string, Person>()
  for (const p of people) {
    idx.set(p.name.toLowerCase().trim(), p)
    // Also index by first name for loose matching
    const first = p.name.split(/\s+/)[0].toLowerCase()
    if (!idx.has(first)) idx.set(first, p)
  }
  return idx
}

function findPerson(
  idx:    Map<string, Person>,
  people: Person[],
  name:   string,
): Person | undefined {
  const norm = name.toLowerCase().trim()
  if (idx.has(norm)) return idx.get(norm)
  return people.find(p => {
    const pn    = p.name.toLowerCase()
    const first = pn.split(/\s+/)[0]
    return pn.includes(norm) || norm.includes(first)
  })
}

// ─── DECISION (base 55) ───────────────────────────────────────────────────────
// Threads that may require approval, sign-off, or time-sensitive action.

const DECISION_RX =
  /\b(decision|approval|approve|review|sign.?off|confirm(?:ation)?|deadline|asap|action required|pending|needs your|requires your)\b/i

function genDecisions(
  a:       InboxAnalysis,
  idx:     Map<string, Person>,
  claimed: Set<string>,
): Priority[] {
  return a.needsReply
    .filter(item => DECISION_RX.test(item.subject) && !claimed.has(item.subject))
    .map(item => {
      const person = findPerson(idx, a.people, item.from)
      const days   = parseDaysAgo(item.lastDate)
      let   score  = 55
      score = applyPersonSignals(score, person)
      if      (days === 0) score += 15
      else if (days === 1) score += 12
      else if (days <=  3) score +=  8
      else if (days <=  7) score +=  4

      return mkPriority({
        type:        'DECISION',
        title:       `Decision: ${truncate(item.subject, 45)}`,
        description: 'May require your approval or confirmation',
        score:       clamp(score),
        person,
        nameStr:     item.from,
        subject:     item.subject,
        days,
      })
    })
}

// ─── OPPORTUNITY (base 52) ────────────────────────────────────────────────────
// Invitations, proposals, introductions, or partnership threads.

const OPPORTUNITY_RX =
  /\b(invite|invitation|proposal|offer|opportunity|introduction|intro|join|partnership|collaborat|would you|interested in|interview|speaking)\b/i

function genOpportunities(
  a:       InboxAnalysis,
  idx:     Map<string, Person>,
  claimed: Set<string>,
): Priority[] {
  return a.needsReply
    .filter(item => OPPORTUNITY_RX.test(item.subject) && !claimed.has(item.subject))
    .map(item => {
      const person = findPerson(idx, a.people, item.from)
      const days   = parseDaysAgo(item.lastDate)
      let   score  = 52
      score = applyPersonSignals(score, person)
      if      (days === 0) score += 15
      else if (days <=  3) score += 10
      else if (days <=  7) score +=  5

      return mkPriority({
        type:        'OPPORTUNITY',
        title:       `Review: ${truncate(item.subject, 50)}`,
        description: 'Potential opportunity detected',
        score:       clamp(score),
        person,
        nameStr:     item.from,
        subject:     item.subject,
        days,
      })
    })
}

// ─── NEEDS_REPLY (base 50) ────────────────────────────────────────────────────
// Any remaining unanswered thread not already claimed by DECISION / OPPORTUNITY.

const URGENT_RX =
  /\b(urgent|asap|critical|important|deadline|time.sensitive|action required)\b/i

function genNeedsReply(
  a:       InboxAnalysis,
  idx:     Map<string, Person>,
  claimed: Set<string>,
): Priority[] {
  return a.needsReply
    .filter(item => !claimed.has(item.subject))
    .map(item => {
      const person = findPerson(idx, a.people, item.from)
      const days   = parseDaysAgo(item.lastDate)

      // Skip: unknown sender + stale (no human signal, no urgency)
      if (!person && days > 14 && !URGENT_RX.test(item.subject)) return null

      let score = 50
      score = applyPersonSignals(score, person)
      if (!person)              score -= 10
      if      (days === 0) score += 20
      else if (days === 1) score += 15
      else if (days <=  3) score += 10
      else if (days <=  7) score +=  5
      if (URGENT_RX.test(item.subject)) score += 8

      const desc =
        days === 0 ? 'Sent today — waiting for your response' :
        days === 1 ? 'Sent yesterday — waiting for your response' :
                     `Waiting ${days} days for your response`

      return mkPriority({
        type:        'NEEDS_REPLY',
        title:       buildReplyTitle(item.from, person?.email),
        description: desc,
        score:       clamp(score),
        person,
        nameStr:     item.from,
        subject:     item.subject,
        days,
      })
    })
    .filter(Boolean) as Priority[]
}

// ─── FOLLOW_UP (base 40) ──────────────────────────────────────────────────────
// Important contacts who are NOT currently waiting on your reply.
// Surfaces "you should check in" signals.

function genFollowUps(
  a:   InboxAnalysis,
  idx: Map<string, Person>,
): Priority[] {
  return a.people
    .filter(p => {
      if (p.score < 45)                return false
      if (p.relationship === 'dormant') return false
      // Skip if they're already surfaced in needsReply
      return !a.needsReply.some(n =>
        n.from.toLowerCase().includes(p.name.split(/\s+/)[0].toLowerCase()),
      )
    })
    .slice(0, 3)
    .map(p => {
      let score = 40
      score += Math.round(p.score * 0.25)
      if (p.twoWay)                        score +=  8
      if (p.relationship === 'frequent')   score += 10
      else if (p.relationship === 'active') score +=  5
      if      (p.threadCount >= 10) score +=  8
      else if (p.threadCount >=  5) score +=  4

      const label = p.relationship === 'frequent' ? 'Frequent' : 'Active'
      return {
        id:           `follow-up:${p.email}`,
        type:         'FOLLOW_UP' as PriorityType,
        title:        `Follow up with ${p.name}`,
        description:  `${label} contact · ${p.threadCount} threads`,
        score:        clamp(score),
        relatedPerson: { name: p.name, email: p.email },
      }
    })
}

// ─── IMPORTANT_PERSON (base 35) ───────────────────────────────────────────────
// Top frequent contacts not already covered by thread-based priorities.
// Limit: 2 cards maximum.

function genImportantPersons(a: InboxAnalysis): Priority[] {
  return a.people
    .filter(p => p.score >= 65 && p.relationship === 'frequent')
    .slice(0, 2)
    .map(p => {
      const score = clamp(35 + Math.round(p.score * 0.45))
      return {
        id:           `important:${p.email}`,
        type:         'IMPORTANT_PERSON' as PriorityType,
        title:        `${p.name} is a key contact`,
        description:  `${p.threadCount} threads · ${p.relationship} relationship`,
        score,
        relatedPerson: { name: p.name, email: p.email },
      }
    })
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

interface MkInput {
  type:        PriorityType
  title:       string
  description: string
  score:       number
  person?:     Person
  nameStr:     string
  subject:     string
  days:        number
}

function mkPriority(i: MkInput): Priority {
  return {
    id:           `${i.type.toLowerCase()}:${i.subject.slice(0, 30)}`,
    type:         i.type,
    title:        i.title,
    description:  i.description,
    score:        i.score,
    relatedPerson: i.person
      ? { name: i.person.name, email: i.person.email }
      : { name: i.nameStr,     email: '' },
    relatedThread: i.subject,
    ageInDays:    i.days,
  }
}

/**
 * applyPersonSignals — shared scoring modifiers derived from Person metadata.
 * Called by all thread-based generators (DECISION, OPPORTUNITY, NEEDS_REPLY).
 *
 * +25 max  person.score × 0.25  (importance of the sender)
 * +10      twoWay               (you have also sent to them)
 * +8 / +4  relationship         (frequent / active)
 */
function applyPersonSignals(score: number, person: Person | undefined): number {
  if (!person) return score
  score += Math.round(person.score * 0.25)
  if (person.twoWay)                        score += 10
  if (person.relationship === 'frequent')   score +=  8
  else if (person.relationship === 'active') score +=  4
  return score
}

/**
 * buildReplyTitle — produces "Reply to Robert from Cloudbet" when the sender
 * has a known professional email domain, or "Reply to Robert" for personal email.
 */
function buildReplyTitle(nameStr: string, email?: string): string {
  const company = email ? domainToCompany(email) : null
  return company ? `Reply to ${nameStr} from ${company}` : `Reply to ${nameStr}`
}

/** Returns a capitalised company name from a professional email domain, or null. */
function domainToCompany(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  const host = domain.split('.')[0]
  const personal = [
    'gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'protonmail',
    'me', 'mac', 'aol', 'live', 'msn', 'googlemail', 'hey', 'fastmail',
  ]
  if (personal.includes(host)) return null
  return host.charAt(0).toUpperCase() + host.slice(1)
}

/**
 * parseDaysAgo — converts the formatted lastDate string from InboxAnalysis
 * back to a number of days for scoring calculations.
 *
 * Supported formats: "Today", "Yesterday", "N days ago", "N weeks ago", "N months ago"
 */
function parseDaysAgo(dateStr: string): number {
  if (!dateStr || dateStr === 'Today')    return 0
  if (dateStr === 'Yesterday')            return 1
  const d = dateStr.match(/^(\d+)\s+days?\s+ago$/i)
  if (d) return parseInt(d[1])
  const w = dateStr.match(/^(\d+)\s+weeks?\s+ago$/i)
  if (w) return parseInt(w[1]) * 7
  const m = dateStr.match(/^(\d+)\s+months?\s+ago$/i)
  if (m) return parseInt(m[1]) * 30
  return 0   // unknown format → treat as today
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
