import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import type { InboxAnalysis, Person, Topic, NeedsReplyItem, RelationshipStatus } from '@/types/inbox'

// ─── Gmail Client ─────────────────────────────────────────────────────────────

export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

// ─── Public Entry Point ───────────────────────────────────────────────────────

export async function analyzeInbox(
  accessToken: string,
  userEmail:   string
): Promise<InboxAnalysis> {
  const gmail = getGmailClient(accessToken)

  // Resolve the owner's full sending-identity set (primary + send-as aliases)
  // BEFORE classifying message direction. Authorized by gmail.readonly (V1.5).
  const ownerIdentities = await resolveOwnerIdentities(gmail, userEmail)

  const listRes = await gmail.users.threads.list({ userId: 'me', maxResults: 100 })
  const refs    = listRes.data.threads ?? []
  const threads = await fetchInBatches(gmail, refs, 25)

  return processThreads(threads, userEmail, ownerIdentities)
}

// ─── Owner identity resolution (Memory V1.5) ──────────────────────────────────

/**
 * Build the set of email addresses that count as "the owner" for direction
 * classification: the primary address plus every verified send-as alias.
 *
 * `users.settings.sendAs.list` is authorized by the gmail.readonly scope the
 * app already holds (verified against Google's API reference). On any failure
 * (missing scope at runtime, transient error) we degrade gracefully to the
 * primary address only — directionality/latency for non-aliased owners (the
 * common case) is unaffected; aliased owners get a conservative undercount of
 * their own outbound rather than a misclassification.
 */
async function resolveOwnerIdentities(
  gmail:     gmail_v1.Gmail,
  userEmail: string,
): Promise<Set<string>> {
  const identities = new Set<string>([userEmail.toLowerCase()])
  try {
    const res = await gmail.users.settings.sendAs.list({ userId: 'me' })
    for (const alias of res.data.sendAs ?? []) {
      const email = alias.sendAsEmail?.toLowerCase()
      if (email) identities.add(email)
    }
  } catch (err) {
    console.warn(
      '[gmail] sendAs.list failed; owner-identity set falls back to primary address only:',
      (err as Error)?.message,
    )
  }
  return identities
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchInBatches(
  gmail:     gmail_v1.Gmail,
  refs:      gmail_v1.Schema$Thread[],
  batchSize: number
): Promise<gmail_v1.Schema$Thread[]> {
  const results: gmail_v1.Schema$Thread[] = []

  for (let i = 0; i < refs.length; i += batchSize) {
    const batch   = refs.slice(i, i + batchSize)
    const fetched = await Promise.all(
      batch.map(ref =>
        gmail.users.threads.get({
          userId:          'me',
          id:              ref.id!,
          format:          'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        })
      )
    )
    results.push(...fetched.map(r => r.data))
  }

  return results
}

// ─── Memory V1.5 Constants ────────────────────────────────────────────────────

/** Outlier ceiling for a single reply-latency sample (14 days, in seconds). */
const MAX_REPLY_LATENCY_SEC = 14 * 24 * 60 * 60

// ─── Scoring Constants ────────────────────────────────────────────────────────

/**
 * Email address patterns that are never real humans.
 * Match against the full email address string.
 */
const BLOCKED_EMAIL_PATTERNS: RegExp[] = [
  /mailer-daemon/i,
  /postmaster@/i,
  /no[._-]?reply/i,
  /do[._-]?not[._-]?reply/i,
  /donotreply/i,
  /noreply/i,
  /newsletter@/i,
  /notifications?@/i,
  /notify@/i,
  /alerts?@/i,
  /unsubscribe@/i,
  /bounces?@/i,
  /automated@/i,
  /daemon@/i,
  /robot@/i,
  /\bbot@/i,
  /^auto@/i,
  /bulk@/i,
  /devnull@/i,
  /blackhole@/i,
]

/**
 * Known bulk / transactional sending infrastructure.
 * Exact domain or any subdomain (e.g. em12.mailchimp.com).
 */
const AUTOMATED_DOMAINS: string[] = [
  'mailchimp.com',
  'list-manage.com',
  'sendgrid.net',
  'sendgrid.com',
  'mandrillapp.com',
  'klaviyo.com',
  'hubspot.com',
  'hubspotemail.net',
  'hs-email.net',
  'constantcontact.com',
  'mailgun.org',
  'ses.amazonaws.com',
  'amazonses.com',
  'mcsv.net',
  'exacttarget.com',
  'salesforce.com',
  'marketo.com',
  'pardot.com',
  'intercom-mail.com',
  'customer.io',
  'iterable.com',
  'drip.com',
  'activecampaign.com',
  'mailerlite.com',
  'brevo.com',
  'sendinblue.com',
  'campaignmonitor.com',
  'createsend.com',
  'bounce.linkedin.com',
  'facebookmail.com',
  'email.twitter.com',
  'notifications.google.com',
  'accounts.google.com',
]

/** Subject patterns that strongly indicate marketing / promotional emails. */
const MARKETING_PATTERNS: RegExp[] = [
  /\d+\s*%\s*off/i,
  /\bsale\b/i,
  /\bdiscount\b/i,
  /\bdeals?\b/i,
  /limited[- ]time/i,
  /\bpromo\b/i,
  /\bcoupon\b/i,
  /free\s+shipping/i,
  /shop\s+now/i,
  /buy\s+now/i,
  /last\s+chance/i,
  /exclusive\s+(deal|offer|access|discount)/i,
  /\bunsubscribe\b/i,
  /\bnewsletter\b/i,
  /black\s+friday/i,
  /cyber\s+monday/i,
  /flash\s+sale/i,
  /don't\s+miss\s+(this|out)/i,
]

/** Subject patterns that strongly indicate transactional / automated emails. */
const TRANSACTIONAL_PATTERNS: RegExp[] = [
  /order\s*(confirmation|#|number|\d)/i,
  /your\s+(order|purchase|subscription)/i,
  /\breceipt\b/i,
  /\binvoice\b/i,
  /payment\s+(received|confirmed|processed|failed)/i,
  /shipping\s+confirmation/i,
  /tracking\s+(number|info)/i,
  /has\s+been\s+(shipped|delivered|dispatched)/i,
  /verify\s+(your|this)\s+(email|account)/i,
  /confirm\s+(your|this)\s+(email|account)/i,
  /password\s*(reset|changed)/i,
  /security\s+(code|alert|notice|warning)/i,
  /two[- ]factor/i,
  /\botp\b/i,
  /sign[- ]in\s+(attempt|code|link)/i,
  /statement\s+(is\s+)?ready/i,
]

// ─── Per-person accumulator ───────────────────────────────────────────────────

interface PersonAccumulator {
  name:                 string
  email:                string
  messageCount:         number
  threadIds:            Set<string>
  twoWay:               boolean
  lastContactTimestamp: number      // Unix ms of the most recent message from this sender
  subjectSamples:       string[]    // raw subjects from threads they appear in (capped at 20)
  threadMessageCounts:  number[]    // message count per thread (one entry per thread)

  // ── Memory V1.5 ──
  inboundCount:         number      // messages person→owner (this run)
  outboundCount:        number      // owner→person, attributed per thread (this run)
  replyLatenciesSec:    number[]    // inbound→outbound latencies paired this run (seconds)
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function processThreads(
  threads:         gmail_v1.Schema$Thread[],
  primaryEmail:    string,
  ownerIdentities: Set<string>,
): InboxAnalysis {
  const peopleMap = new Map<string, PersonAccumulator>()
  const topicsMap = new Map<string, { display: string; count: number }>()
  const needsReply: NeedsReplyItem[] = []

  // V1 identity (single primary address) — drives ALL existing accumulation so
  // V1 fields stay byte-identical. The alias-aware owner set is used ONLY for
  // the new additive V1.5 signals below.
  const normalizedUser = primaryEmail.toLowerCase()
  const isOwner = (email: string): boolean => ownerIdentities.has(email.toLowerCase())

  for (const thread of threads) {
    const messages = thread.messages ?? []
    if (messages.length === 0) continue

    const threadId = thread.id ?? String(Math.random())

    // ── V1 per-person accumulation — PRIMARY identity only (unchanged) ───────
    const userSentInThread = messages.some(msg => {
      const fromRaw = getHeader(msg, 'From') ?? ''
      return parseFrom(fromRaw).email.toLowerCase() === normalizedUser
    })

    const sendersInThread = new Set<string>()
    for (const msg of messages) {
      const fromRaw         = getHeader(msg, 'From') ?? ''
      const { name, email } = parseFrom(fromRaw)
      if (email.toLowerCase() === normalizedUser) continue

      const key       = email.toLowerCase()
      const timestamp = parseDateStrict(getHeader(msg, 'Date') ?? '') ?? Date.now()
      sendersInThread.add(key)

      const existing = peopleMap.get(key)
      if (existing) {
        existing.messageCount++
        existing.threadIds.add(threadId)
        if (userSentInThread) existing.twoWay = true
        if (timestamp > existing.lastContactTimestamp) existing.lastContactTimestamp = timestamp
      } else {
        peopleMap.set(key, {
          name,
          email,
          messageCount:         1,
          threadIds:            new Set([threadId]),
          twoWay:               userSentInThread,
          lastContactTimestamp: timestamp,
          subjectSamples:       [],
          threadMessageCounts:  [],
          inboundCount:         0,
          outboundCount:        0,
          replyLatenciesSec:    [],
        })
      }
    }

    // Record subject and thread depth once per thread for each sender in it
    const rawSubject = getHeader(messages[0], 'Subject') ?? ''
    const cleaned    = cleanSubject(rawSubject)

    for (const senderKey of Array.from(sendersInThread)) {
      const acc = peopleMap.get(senderKey)
      if (!acc) continue
      if (acc.subjectSamples.length < 20) acc.subjectSamples.push(rawSubject)
      acc.threadMessageCounts.push(messages.length)
    }

    // ── V1.5 directionality + reply latency — ADDITIVE, alias-aware ──────────
    // Computed independently of the V1 accumulation so no V1 field is touched.
    // `owner` here is alias-aware (primary + send-as), so an owner-sent alias
    // counts as outbound, not as a contact's inbound. `tsValid` gates latency
    // pairing so an unparseable Date never fabricates a latency.
    const classified = messages.map(msg => {
      const { email } = parseFrom(getHeader(msg, 'From') ?? '')
      const key    = email.toLowerCase()
      const strict = parseDateStrict(getHeader(msg, 'Date') ?? '')
      return { key, owner: isOwner(key), ts: strict ?? Date.now(), tsValid: strict !== null }
    })
    const ownerMsgCount = classified.filter(m => m.owner).length

    // inbound (person→owner) per counterpart; outbound (owner→person) credited
    // to each counterpart in the thread (exact 1:1; group threads credit each —
    // the documented V1.5 attribution rule). Attributed only to persons the V1
    // accumulation already tracks.
    const inboundByPerson = new Map<string, number>()
    for (const m of classified) {
      if (!m.owner) inboundByPerson.set(m.key, (inboundByPerson.get(m.key) ?? 0) + 1)
    }
    for (const [key, inbound] of Array.from(inboundByPerson)) {
      const acc = peopleMap.get(key)
      if (!acc) continue
      acc.inboundCount  += inbound
      acc.outboundCount += ownerMsgCount
    }

    // Reply latency: walk chronologically; pair each owner message with the
    // single most-recent unmatched inbound (nearest preceding) → one person,
    // avoiding group-thread inflation. Each inbound matched once; deltas capped.
    const ordered = [...classified].sort((a, b) => a.ts - b.ts)
    const pending = new Map<string, number>()   // personKey → unmatched inbound ts (ms)
    for (const m of ordered) {
      if (m.owner) {
        if (!m.tsValid) continue
        let bestKey: string | null = null
        let bestTs  = -Infinity
        for (const [k, ts] of Array.from(pending)) {
          if (ts <= m.ts && ts > bestTs) { bestTs = ts; bestKey = k }
        }
        if (bestKey !== null) {
          const rawSec = (m.ts - bestTs) / 1000
          if (rawSec >= 0) {
            const acc = peopleMap.get(bestKey)
            if (acc) acc.replyLatenciesSec.push(Math.round(Math.min(rawSec, MAX_REPLY_LATENCY_SEC)))
          }
          pending.delete(bestKey)
        }
      } else if (m.tsValid) {
        pending.set(m.key, m.ts)   // refresh latest unmatched inbound for this person
      }
    }

    // ── Active Topics ──────────────────────────────────────────────────────
    if (cleaned.length > 0) {
      const key      = cleaned.toLowerCase()
      const existing = topicsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        topicsMap.set(key, { display: cleaned, count: 1 })
      }
    }

    // ── Needs Reply ────────────────────────────────────────────────────────
    const lastMsg     = messages[messages.length - 1]
    const lastFromRaw = getHeader(lastMsg, 'From') ?? ''
    const { name: lastSender, email: lastEmail } = parseFrom(lastFromRaw)

    if (lastEmail.toLowerCase() !== normalizedUser) {
      needsReply.push({
        threadId:  threadId,
        subject:   (cleaned || rawSubject || '(no subject)').slice(0, 80),
        from:      lastSender,
        fromEmail: lastEmail,
        lastDate:  formatDate(getHeader(lastMsg, 'Date') ?? ''),
      })
    }
  }

  // ── Score, filter, and sort ───────────────────────────────────────────────
  const people: Person[] = Array.from(peopleMap.entries())
    .map(([, acc]) => {
      const { score, confidence, relationship } = computePersonScore(acc)
      return {
        name:              acc.name,
        email:             acc.email,
        messageCount:      acc.messageCount,
        threadCount:       acc.threadIds.size,
        score,
        confidence,
        relationship,
        twoWay:            acc.twoWay,
        inboundCount:      acc.inboundCount,
        outboundCount:     acc.outboundCount,
        replyLatenciesSec: acc.replyLatenciesSec,
      }
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const topics: Topic[] = Array.from(topicsMap.values())
    .map(({ display, count }) => ({ name: display, threadCount: count }))
    .sort((a, b) => b.threadCount - a.threadCount)
    .slice(0, 10)

  return {
    people,
    topics,
    needsReply:  needsReply.slice(0, 10),
    threadCount: threads.length,
    processedAt: new Date().toISOString(),
  }
}

// ─── Human Signal Scoring ─────────────────────────────────────────────────────

function computePersonScore(acc: PersonAccumulator): {
  score:        number
  confidence:   number
  relationship: RelationshipStatus
} {
  const email = acc.email.toLowerCase()

  // Hard block — definitively not a human
  if (isBlockedSender(email)) {
    return { score: 0, confidence: 100, relationship: 'dormant' }
  }

  let score = 30 // neutral baseline

  // Automated infrastructure domain → strong downgrade
  if (isAutomatedDomain(email)) score -= 30

  // Real human name present → boost
  if (hasRealHumanName(acc.name, acc.email)) score += 20

  // Two-way conversation → strongest human signal
  if (acc.twoWay) score += 25

  // Recency of last contact
  const daysSince = (Date.now() - acc.lastContactTimestamp) / (1000 * 60 * 60 * 24)
  if      (daysSince <=  7) score += 20
  else if (daysSince <= 30) score += 12
  else if (daysSince <= 90) score +=  5

  // Number of distinct threads
  const threadCount = acc.threadIds.size
  if      (threadCount >= 10) score += 15
  else if (threadCount >=  5) score += 10
  else if (threadCount >=  2) score +=  5

  // Average thread depth — back-and-forth indicates real conversation
  const avgDepth = acc.threadMessageCounts.length > 0
    ? acc.threadMessageCounts.reduce((a, b) => a + b, 0) / acc.threadMessageCounts.length
    : 1
  if      (avgDepth > 6) score += 15
  else if (avgDepth > 3) score +=  8

  // Marketing subject penalty
  const marketingHits = acc.subjectSamples.filter(s =>
    MARKETING_PATTERNS.some(p => p.test(s))
  ).length
  score -= Math.min(marketingHits * 8, 25)

  // Transactional subject penalty
  const transactionalHits = acc.subjectSamples.filter(s =>
    TRANSACTIONAL_PATTERNS.some(p => p.test(s))
  ).length
  score -= Math.min(transactionalHits * 5, 15)

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score))

  // Confidence: proportional to amount of data we have
  let confidence: number
  if      (threadCount >= 10) confidence = 90
  else if (threadCount >=  5) confidence = 78
  else if (threadCount >=  3) confidence = 62
  else if (threadCount >=  2) confidence = 48
  else                        confidence = 30

  // ── Confidence coupling ────────────────────────────────────────────────────
  // Prevents low-data contacts from dominating the ranking.
  // At confidence=90%: multiplier = 0.93  (high-confidence barely penalised)
  // At confidence=78%: multiplier = 0.85
  // At confidence=30%: multiplier = 0.51  (1-thread contacts cut nearly in half)
  score = Math.round(score * (0.3 + 0.7 * confidence / 100))

  // ── Relationship signal ────────────────────────────────────────────────────
  // Derived from the FINAL effective score so displayed score, confidence,
  // and relationship label always tell the same story.
  //
  //   frequent  score ≥ 65  AND  5+ threads  AND  last contact ≤ 90 days
  //   active    score ≥ 35  AND  last contact ≤ 30 days
  //   dormant   everything else
  let relationship: RelationshipStatus
  if (score >= 65 && threadCount >= 5 && daysSince <= 90) {
    relationship = 'frequent'
  } else if (score >= 35 && daysSince <= 30) {
    relationship = 'active'
  } else {
    relationship = 'dormant'
  }

  return { score, confidence, relationship }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBlockedSender(email: string): boolean {
  return BLOCKED_EMAIL_PATTERNS.some(p => p.test(email))
}

function isAutomatedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return AUTOMATED_DOMAINS.some(
    d => domain === d || domain.endsWith('.' + d)
  )
}

/**
 * Returns true when the display name looks like a real person:
 *  - At least two words (first + last name pattern)
 *  - Does not contain obvious service / role keywords
 */
function hasRealHumanName(name: string, email: string): boolean {
  if (!name || name.trim() === '' || name.toLowerCase() === email.toLowerCase()) return false
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return false

  const SERVICE_TERMS =
    /\b(team|support|service|admin|info|help|alert|update|bot|system|notification|news|billing|sales|marketing|subscribe|auto|daemon|robot|security|verify|confirm|account|noreply|no.reply)\b/i
  return !SERVICE_TERMS.test(name)
}

function getHeader(
  message: gmail_v1.Schema$Message,
  name:    string
): string | undefined {
  return message.payload?.headers?.find(
    h => h.name?.toLowerCase() === name.toLowerCase()
  )?.value ?? undefined
}

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name:  match[1].trim().replace(/^"|"$/g, ''),
      email: match[2].trim(),
    }
  }
  const plain = raw.trim()
  return { name: plain, email: plain }
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw|sv|aw)\s*:\s*/gi, '')
    .replace(/^\[.+?\]\s*/g, '')
    .trim()
    .slice(0, 60)
}

/**
 * Strict Date-header parse: returns null (not now()) when the header is missing
 * or unparseable. Used for the message timestamp everywhere — callers apply a
 * `?? Date.now()` fallback for ordering/recency fields, while latency pairing
 * uses the null directly so an unknown timestamp never fabricates a latency.
 */
function parseDateStrict(dateStr: string): number | null {
  if (!dateStr) return null
  const ts = new Date(dateStr).getTime()
  return isNaN(ts) ? null : ts
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff <  7)  return `${diff} days ago`
    if (diff < 30)  return `${Math.floor(diff / 7)} weeks ago`
    return `${Math.floor(diff / 30)} months ago`
  } catch {
    return dateStr
  }
}
