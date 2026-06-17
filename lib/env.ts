/**
 * Environment variable validation.
 *
 * Import validateServerEnv() at the top of any API route that depends on
 * server-side secrets. It throws at call time with a clear message rather
 * than surfacing a cryptic runtime error deep in the request handler.
 *
 * NEVER import this file from client components — it references server-only
 * env vars that must not be bundled into the browser build.
 */

// ── Required server-side variables ───────────────────────────────────────────

const SERVER_VARS = [
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

// ── Required public variables (safe for browser) ─────────────────────────────

const PUBLIC_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * Validate all required server-side environment variables.
 * Throws with a list of every missing key so the developer can fix them
 * all at once rather than hunting for them one by one.
 */
export function validateServerEnv(): void {
  const missing = SERVER_VARS.filter(key => !process.env[key])
  if (missing.length === 0) return

  throw new Error(
    `[env] Missing required environment variables:\n` +
    missing.map(k => `  · ${k}`).join('\n') + '\n\n' +
    'Add the above to .env.local and restart the dev server.\n' +
    'Never commit .env.local to version control.'
  )
}

/**
 * Validate public environment variables (called at module init in browser-safe code).
 * These should be present in both development and production.
 */
export function validatePublicEnv(): void {
  const missing = PUBLIC_VARS.filter(key => !process.env[key])
  if (missing.length === 0) return

  throw new Error(
    `[env] Missing required public environment variables:\n` +
    missing.map(k => `  · ${k}`).join('\n')
  )
}

/**
 * Get a required environment variable or throw.
 * Useful for one-off checks without importing the full list.
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `[env] Required environment variable "${key}" is not set.\n` +
      'Add it to .env.local and restart the dev server.'
    )
  }
  return value
}
