/**
 * Shared utilities for the Memory Layer V1.
 *
 * Imported by both lib/memory-writer.ts and lib/priorities.ts so that subject
 * normalization is identical on write and read.
 *
 * NEVER import from client components.
 */

// ── Subject normalization ─────────────────────────────────────────────────────

/**
 * Produces the canonical key used to store and look up subjects in
 * decision_memory. Strips threading prefixes, lowercases, trims, and caps
 * at 200 characters so the key fits comfortably in a unique index.
 *
 * Must be identical in writer (when inserting) and reader (when looking up).
 */
export function normalizeSubjectKey(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw|sv|aw)\s*:\s*/gi, '')
    .replace(/^\[.+?\]\s*/g, '')
    .trim()
    .toLowerCase()
    .slice(0, 200)
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the ISO date string ('YYYY-MM-DD') for the Monday of the week
 * containing `date` (defaults to today). Uses UTC to avoid timezone drift
 * when the server runs in a different zone to the user.
 *
 * Sunday (getUTCDay() === 0) maps to the previous Monday (diff = -6).
 * All other days: diff = 1 - dayOfWeek  (e.g. Tuesday = 1 - 2 = -1).
 */
export function getISOWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day  = d.getUTCDay()                   // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day        // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().split('T')[0]          // 'YYYY-MM-DD'
}

/**
 * Returns the ISO date string for the Monday N weeks ago from today (UTC).
 * Used by the reader to build the `week_start >= cutoff` filter.
 */
export function getWeeksAgoDate(weeks: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - weeks * 7)
  return d.toISOString().split('T')[0]
}
