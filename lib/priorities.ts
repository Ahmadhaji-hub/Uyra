/**
 * Milestone 4 — Priorities Engine  (Memory-aware V2)
 *
 * Pure, deterministic function. No AI, no LLMs. All signals derived from
 * InboxAnalysis metadata computed by lib/gmail.ts, optionally enriched by
 * MemoryContext from the memory layer (Phase 1).
 *
 * Priority precedence (per thread): DECISION > OPPORTUNITY > NEEDS_REPLY
 * FOLLOW_UP and IMPORTANT_PERSON are relationship-based, never thread-based.
 *
 * Base scoring formula per type:
 *   score = base
 *         + person.score × 0.25          (up to +25 — importance of the person)
 *         + twoWay bonus                 (+10 if bidirectional relationship)
 *         + relationship bonus            (+8 frequent, +4 active)
 *         + recency bonus                 (+20/15/10/5 for today/yesterday/≤3d/≤7d)
 *         + urgency bonus                 (+8 if subject matches urgent keywords)
 *         − unknown sender penalty        (−10 if sender not found in people list)
 *   clamped to [0, 100]
 *
 * Memory-layer additions (Phase 1):
 *   applyPersonSignals:
 *     + historical avg boost  (+0…+8 when avg_score > current by >10, ≥3 samples)
 *   genDecisions:
 *     + persistence boost     (+0…+15 based on times_seen in decision_memory)
 *
 * Bugs fixed (v2):
 *   #1  buildReplyTitle — skip "from Company" suffix if company already in sender name
 *   #2  isAutomatedSender — filter automated/system senders before generating priorities
 *   #3  buildImportantPersonTitle — contextual insight titles instead of generic label
 */

import type { InboxAnalysis, Person } from '@/types/inbox'
import type { Priority, PriorityType } from '@/types/priorities'
import type { MemoryContext, PersonMemoryRecord, DecisionMemoryRecord } from '@/types/memory'

// ─── Automated-sender detection ───────────────────────────────────────────────
//
// lib/gmail.ts already filters score=0 senders out of analysis.people.
// However, analysis.needsReply is built from ALL unanswered threads and can
// contain automated senders whose display name is the only signal available.
//
// Strategy:
//   1. If sender IS in the people index → they passed gmail.ts scoring (score > 0)
//      → treat as human; no automated check needed.
//   2. If sender is NOT in the people index → apply name-based heuristics below.

/** Matches common automated-sender display names. */
const AUTOMATED_NAME_RX =
  /\b(no[._-]?reply|do[._-]?not[._-]?reply|noreply|donotreply|notification|notifications|automated|mailer[._-]?daemon|postmaster|bounce|delivery[._-]?subsystem|unsubscribe|newsletter|alert|alerts|updates)\b/i

/**
 * Well-known services that send system/transactional mail under their brand name.
 * Only exact full-name matches are tested (not partial) to avoid collateral damage.
 */
const WELL_KNOWN_SYSTEM_NAMES = new Set([
  'google', 'gmail', 'youtube', 'google security', 'google workspace',
  'microsoft', 'outlook', 'onedrive', 'office 365',
  'linkedin', 'linkedin notifications',
  'twitter', 'x', 'instagram', 'facebook', 'tiktok',
  'amazon', 'amazon web services', 'aws',
  'paypal', 'stripe', 'shopify',
  'github', 'github notifications',
  'slack', 'zoom', 'dropbox', 'notion',
  'apple', 'icloud',
  'spotify', 'netflix', 'uber', 'airbnb',
])

/**
 * Returns true if this sender should be excluded from priorities.
 *
 * @param from    Display name from the email (NeedsReplyItem.from)
 * @param person  Resolved Person from the people index, or undefined if not found
 *
 * Key invariant: if `person` is defined, they passed gmail.ts's score > 0 filter
 * and are therefore a real human sender — no further checking needed.
 * Only unknown (person === undefined) senders require name heuristics.
 */
function isAutomatedSender(from: string, person: Person | undefined): boolean {
  // Known human from gmail.ts scoring — always allow
  if (person !== undefined) return false
  const norm = from.toLowerCase().trim()
  if (AUTOMATED_NAME_RX.test(norm)) return true
  if (WELL_KNOWN_SYSTEM_NAMES.has(norm)) return true
  return false
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Generate memory-aware priorities from an InboxAnalysis.
 *
 * @param analysis       Current inbox analysis
 * @param memoryContext  Optional — enriches scoring when present. First run
 *                       will have no memory; subsequent runs benefit from history.
 */
export function generatePriorities(
  analysis:       InboxAnalysis,
  memoryContext?: MemoryContext,
): Priority[] {
  const idx     = buildPersonIndex(analysis.people)
  const claimed = new Set<string>()    // subjects already assigned to a priority

  // Build memory lookup maps (empty Maps when no context available)
  const personMemMap:   Map<string, PersonMemoryRecord>   = new Map(
    (memoryContext?.persons ?? []).map(p => [p.personEmail.toLowerCase(), p])
  )
  const decisionMemMap: Map<string, DecisionMemoryRecord> = new Map(
    (memoryContext?.decisions ?? []).map(d => [d.threadId, d])
  )

  // Process in precedence order so each thread is typed exactly once
  const decisions     = genDecisions(analysis, idx, claimed, personMemMap, decisionMemMap)
  decisions.forEach(p => claimed.add(p.relatedThread ?? p.id))

  const opportunities = genOpportunities(analysis, idx, claimed, personMemMap)
  opportunities.forEach(p => claimed.add(p.relatedThread ?? p.id))

  const replies       = genNeedsReply(analysis, idx, claimed, personMemMap)
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
  a:             InboxAnalysis,
  idx:           Map<string, Person>,
  claimed:       Set<string>,
  personMemMap:  Map<string, PersonMemoryRecord>,
  decisionMemMap: Map<string, DecisionMemoryRecord>,
): Priority[] {
  return a.needsReply
    .map(item => {
      if (!DECISION_RX.test(item.subject))  return null
      if (claimed.has(item.subject))        return null
      const person = findPerson(idx, a.people, item.from)
      if (isAutomatedSender(item.from, person)) return null  // Fix #2

      const days  = parseDaysAgo(item.lastDate)
      let   score = 55
      score = applyPersonSignals(score, person, personMemMap)
      if      (days === 0) score += 15
      else if (days === 1) score += 12
      else if (days <=  3) score +=  8
      else if (days <=  7) score +=  4

      // Memory: persistence boost — decisions that keep surfacing are more urgent
      // Keyed by stable thread_id, not normalized subject
      const decisionMem = decisionMemMap.get(item.threadId)
      if (decisionMem && !decisionMem.isResolved) {
        score += Math.min(decisionMem.timesSeen * 3, 15)
      }

      return mkPriority({
        type:        'DECISION',
        title:       `Decision: ${truncate(item.subject, 45)}`,
        description: buildDecisionDescription(decisionMem),
        score:       clamp(score),
        person,
        nameStr:     item.from,
        subject:     item.subject,
        days,
      })
    })
    .filter(Boolean) as Priority[]
}

function buildDecisionDescription(mem: DecisionMemoryRecord | undefined): string {
  if (!mem || mem.timesSeen <= 1) return 'May require your approval or confirmation'
  return `Seen ${mem.timesSeen} times — still waiting on your action`
}

// ─── OPPORTUNITY (base 52) ────────────────────────────────────────────────────
// Invitations, proposals, introductions, or partnership threads.

const OPPORTUNITY_RX =
  /\b(invite|invitation|proposal|offer|opportunity|introduction|intro|join|partnership|collaborat|would you|interested in|interview|speaking)\b/i

function genOpportunities(
  a:            InboxAnalysis,
  idx:          Map<string, Person>,
  claimed:      Set<string>,
  personMemMap: Map<string, PersonMemoryRecord>,
): Priority[] {
  return a.needsReply
    .map(item => {
      if (!OPPORTUNITY_RX.test(item.subject)) return null
      if (claimed.has(item.subject))          return null
      const person = findPerson(idx, a.people, item.from)
      if (isAutomatedSender(item.from, person)) return null  // Fix #2

      const days  = parseDaysAgo(item.lastDate)
      let   score = 52
      score = applyPersonSignals(score, person, personMemMap)
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
    .filter(Boolean) as Priority[]
}

// ─── NEEDS_REPLY (base 50) ────────────────────────────────────────────────────
// Any remaining unanswered thread not already claimed by DECISION / OPPORTUNITY.

const URGENT_RX =
  /\b(urgent|asap|critical|important|deadline|time.sensitive|action required)\b/i

function genNeedsReply(
  a:            InboxAnalysis,
  idx:          Map<string, Person>,
  claimed:      Set<string>,
  personMemMap: Map<string, PersonMemoryRecord>,
): Priority[] {
  return a.needsReply
    .map(item => {
      if (claimed.has(item.subject)) return null
      const person = findPerson(idx, a.people, item.from)

      // Fix #2: skip automated senders entirely
      if (isAutomatedSender(item.from, person)) return null

      const days  = parseDaysAgo(item.lastDate)

      // Skip: unknown sender + stale + no urgency
      if (!person && days > 14 && !URGENT_RX.test(item.subject)) return null

      let score = 50
      score = applyPersonSignals(score, person, personMemMap)
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
        title:       buildReplyTitle(item.from, person?.email),  // Fix #1 applied here
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

function genFollowUps(
  a:   InboxAnalysis,
  idx: Map<string, Person>,
): Priority[] {
  return a.people
    .filter(p => {
      if (p.score < 45)                return false
      if (p.relationship === 'dormant') return false
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
// Top frequent contacts. Title explains WHY they matter (Fix #3).

function genImportantPersons(a: InboxAnalysis): Priority[] {
  return a.people
    .filter(p => p.score >= 65 && p.relationship === 'frequent')
    .slice(0, 2)
    .map(p => {
      const score = clamp(35 + Math.round(p.score * 0.45))
      return {
        id:           `important:${p.email}`,
        type:         'IMPORTANT_PERSON' as PriorityType,
        title:        buildImportantPersonTitle(p),        // Fix #3
        description:  buildImportantPersonDescription(p),  // Fix #3
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
 * applyPersonSignals — shared scoring modifiers from Person metadata + memory.
 *
 * From live data:
 *   +25 max  person.score × 0.25  (importance of the sender)
 *   +10      twoWay               (user has also sent to them)
 *   +8 / +4  relationship         (frequent / active)
 *
 * From memory (Phase 1):
 *   +0…+8    historical avg > current by >10, with ≥3 samples
 *            Stabilises high-importance contacts whose current score dipped
 *            due to a quieter week in the sampled 100 threads.
 */
function applyPersonSignals(
  score:        number,
  person:       Person | undefined,
  personMemMap: Map<string, PersonMemoryRecord>,
): number {
  if (!person) return score
  score += Math.round(person.score * 0.25)
  if (person.twoWay)                        score += 10
  if (person.relationship === 'frequent')   score +=  8
  else if (person.relationship === 'active') score +=  4

  // Memory stabilization: boost contacts whose historical avg is higher than
  // their current score (e.g. a key contact who was quieter this week).
  const mem = personMemMap.get(person.email.toLowerCase())
  if (mem && mem.scoreSamples.length >= 3) {
    const historicalLift = mem.avgScore - person.score
    if (historicalLift > 10) {
      score += Math.min(Math.round(historicalLift * 0.3), 8)
    }
  }

  return score
}

/**
 * buildReplyTitle — Fix #1
 *
 * Produces "Reply to Sam from Lovable" when the sender has a professional
 * email domain. Skips the "from Company" suffix if the company name is already
 * present in the sender's display name to prevent "Reply to Sam from Lovable
 * from Lovable".
 */
function buildReplyTitle(nameStr: string, email?: string): string {
  const company = email ? domainToCompany(email) : null
  if (!company) return `Reply to ${nameStr}`
  // Fix #1: don't append company if it's already in the sender name
  if (nameStr.toLowerCase().includes(company.toLowerCase())) return `Reply to ${nameStr}`
  return `Reply to ${nameStr} from ${company}`
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
 * buildImportantPersonTitle — Fix #3
 *
 * Generates a contextual insight title instead of a generic "is a key contact"
 * label. Uses score + twoWay + relationship + threadCount to pick the most
 * relevant framing.
 */
function buildImportantPersonTitle(p: Person): string {
  const first = firstNameOf(p.name)

  // Highest-quality signal: strong score, two-way, frequent contact
  if (p.score >= 80 && p.twoWay) {
    return `${first} remains one of your strongest contacts`
  }
  // One-sided: person reaches out but user never replied
  if (!p.twoWay && p.relationship === 'frequent') {
    return `You haven't been responding to ${first} lately`
  }
  // Score approaching the threshold — relationship weakening
  if (p.score < 70 && p.relationship === 'frequent') {
    return `Relationship with ${first} is becoming less active`
  }
  // Good two-way relationship with strong thread depth
  if (p.twoWay && p.threadCount >= 8) {
    return `Strong two-way relationship with ${first}`
  }
  // General importance signal
  return `${first} is an important contact`
}

/** Supporting description for IMPORTANT_PERSON — always shows factual thread context. */
function buildImportantPersonDescription(p: Person): string {
  const parts: string[] = [`${p.threadCount} threads`]
  if (p.twoWay) parts.push('two-way')
  parts.push(p.relationship)
  return parts.join(' · ')
}

/** Returns the first word of a display name (first name). */
function firstNameOf(name: string): string {
  return name.split(/\s+/)[0]
}

/**
 * parseDaysAgo — converts InboxAnalysis lastDate strings back to day counts.
 * Supported: "Today", "Yesterday", "N days ago", "N weeks ago", "N months ago"
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
  return 0
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
