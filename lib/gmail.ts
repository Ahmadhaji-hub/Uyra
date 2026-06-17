import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import type { InboxAnalysis, Person, Topic, NeedsReplyItem } from '@/types/inbox'

// ─── Client ────────────────────────────────────────────────────────────────

export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

// ─── Fetch ──────────────────────────────────────────────────────────────────

export async function analyzeInbox(
  accessToken: string,
  userEmail: string
): Promise<InboxAnalysis> {
  const gmail = getGmailClient(accessToken)

  // 1. List up to 100 thread references
  const listRes = await gmail.users.threads.list({
    userId:     'me',
    maxResults: 100,
  })
  const refs = listRes.data.threads ?? []

  // 2. Fetch full thread metadata in batches of 25
  const threads = await fetchInBatches(gmail, refs, 25)

  // 3. Run algorithmic analysis
  return processThreads(threads, userEmail)
}

async function fetchInBatches(
  gmail:     gmail_v1.Gmail,
  refs:      gmail_v1.Schema$Thread[],
  batchSize: number
): Promise<gmail_v1.Schema$Thread[]> {
  const results: gmail_v1.Schema$Thread[] = []

  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = refs.slice(i, i + batchSize)
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

// ─── Analysis ───────────────────────────────────────────────────────────────

function processThreads(
  threads:   gmail_v1.Schema$Thread[],
  userEmail: string
): InboxAnalysis {
  // Maps for accumulating data
  const peopleMap = new Map<string, { name: string; count: number }>()
  const topicsMap = new Map<string, { display: string; count: number }>()
  const needsReply: NeedsReplyItem[] = []

  const normalizedUser = userEmail.toLowerCase()

  for (const thread of threads) {
    const messages = thread.messages ?? []
    if (messages.length === 0) continue

    // ── Important People ──────────────────────────────────────────────────
    // Count every sender that isn't the current user
    for (const msg of messages) {
      const fromRaw = getHeader(msg, 'From')
      if (!fromRaw) continue

      const { name, email } = parseFrom(fromRaw)
      if (email.toLowerCase() === normalizedUser) continue   // skip self

      const key = email.toLowerCase()
      const existing = peopleMap.get(key)
      if (existing) {
        existing.count++
      } else {
        peopleMap.set(key, { name, count: 1 })
      }
    }

    // ── Active Topics ─────────────────────────────────────────────────────
    // Normalize subject from the first message and group by cleaned string
    const firstMsg  = messages[0]
    const rawSubject = getHeader(firstMsg, 'Subject') ?? ''
    const cleaned    = cleanSubject(rawSubject)
    if (cleaned.length > 0) {
      const key = cleaned.toLowerCase()
      const existing = topicsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        topicsMap.set(key, { display: cleaned, count: 1 })
      }
    }

    // ── Needs Reply ───────────────────────────────────────────────────────
    // The last message in the thread is from someone else → user hasn't replied
    const lastMsg     = messages[messages.length - 1]
    const lastFromRaw = getHeader(lastMsg, 'From') ?? ''
    const { name: lastSender, email: lastEmail } = parseFrom(lastFromRaw)

    if (lastEmail.toLowerCase() !== normalizedUser) {
      const subject  = cleaned || rawSubject || '(no subject)'
      const lastDate = getHeader(lastMsg, 'Date') ?? ''
      needsReply.push({
        subject:  subject.slice(0, 80),
        from:     lastSender,
        lastDate: formatDate(lastDate),
      })
    }
  }

  // ── Sort and limit ────────────────────────────────────────────────────────

  const people: Person[] = Array.from(peopleMap.entries())
    .map(([email, { name, count }]) => ({ name, email, count }))
    .sort((a, b) => b.count - a.count)
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHeader(
  message: gmail_v1.Schema$Message,
  name:    string
): string | undefined {
  return message.payload?.headers?.find(
    h => h.name?.toLowerCase() === name.toLowerCase()
  )?.value ?? undefined
}

function parseFrom(raw: string): { name: string; email: string } {
  // "Display Name <email@example.com>"
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name:  match[1].trim().replace(/^"|"$/g, ''),
      email: match[2].trim(),
    }
  }
  // Plain email address
  const plain = raw.trim()
  return { name: plain, email: plain }
}

function cleanSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw|sv|aw)\s*:\s*/gi, '')  // strip Re:/Fwd: etc.
    .replace(/^\[.+?\]\s*/g, '')                   // strip [list] prefixes
    .trim()
    .slice(0, 60)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now  = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7)  return `${diff} days ago`
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`
    return `${Math.floor(diff / 30)} months ago`
  } catch {
    return dateStr
  }
}
