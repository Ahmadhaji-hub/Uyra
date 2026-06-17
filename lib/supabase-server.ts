/**
 * Server-only Supabase client.
 *
 * Uses the service role key to bypass Row Level Security for server-side
 * memory operations in API routes.
 *
 * ⚠️  NEVER import this file from:
 *   - Client components ('use client')
 *   - lib/supabase.ts (browser client)
 *   - Any file that could be bundled into the browser build
 *
 * The service role key has full database access and must stay server-side.
 * All queries MUST be scoped by user_id derived from a verified NextAuth session.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a new Supabase client authenticated with the service role key.
 *
 * Returns a factory function (not a singleton) so each API route invocation
 * gets an independent client — important for concurrent serverless execution.
 *
 * Throws immediately if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
 * are missing, surfacing the config error at call time rather than at query time.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const url    = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const secret = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, secret, {
    auth: {
      // Service role clients must not persist or auto-refresh sessions.
      // Auth is handled by NextAuth; Supabase is used as a plain database.
      persistSession:  false,
      autoRefreshToken: false,
    },
  })
}

// ── Type alias ────────────────────────────────────────────────────────────────

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>
