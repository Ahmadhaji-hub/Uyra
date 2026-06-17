import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'
import type { GmailStatus } from '@/types/next-auth'

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Exchange a stored refresh token for a fresh access token by calling
 * Google's token endpoint directly.
 *
 * On success  → returns updated token with gmailStatus: 'connected'
 * On failure  → returns token with gmailStatus: 'needs_reconnect'
 *               (refresh token revoked, scopes changed, or network error)
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refreshToken!,
      }),
    })

    const refreshed = await response.json()
    if (!response.ok) throw refreshed

    return {
      ...token,
      accessToken:        refreshed.access_token,
      // expires_in is in seconds; store as Unix ms for easy comparison
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google only rotates the refresh token occasionally — keep the old one
      // if no new one was issued
      refreshToken:  refreshed.refresh_token ?? token.refreshToken,
      gmailStatus:   'connected' as GmailStatus,
    }
  } catch (err) {
    console.error('[auth] Token refresh failed:', err)
    // Signal to the session that the user must re-grant Gmail access.
    // The connect page will render a "reconnect" variant for this state.
    return {
      ...token,
      gmailStatus: 'needs_reconnect' as GmailStatus,
    }
  }
}

// ── Auth options ──────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:       'openid email profile',
          access_type: 'offline',
          prompt:      'consent',
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // ── First sign-in OR Gmail connect callback ───────────────────────────
      // `account` is populated only on the initial OAuth callback for each
      // sign-in / incremental-auth flow. Derive gmailStatus from the scopes
      // returned — don't preserve the previous value, because the new tokens
      // may cover different scopes than the previous session.
      if (account) {
        const hasGmail = account.scope?.includes(GMAIL_SCOPE) ?? false
        return {
          ...token,
          accessToken:        account.access_token,
          refreshToken:       account.refresh_token ?? token.refreshToken,
          // Google's expires_at is in UNIX seconds — convert to ms
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          gmailStatus: (hasGmail ? 'connected' : 'disconnected') as GmailStatus,
        }
      }

      // ── Subsequent requests: token still valid ────────────────────────────
      // Refresh 60 s before the real expiry so the token is always fresh
      // when it reaches the Gmail API.
      if (Date.now() < (token.accessTokenExpires ?? 0) - 60_000) {
        return token
      }

      // ── Access token expired — attempt silent refresh ─────────────────────
      // refreshAccessToken sets gmailStatus: 'needs_reconnect' on failure.
      return refreshAccessToken(token)
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      session.gmailStatus = (token.gmailStatus ?? 'disconnected') as GmailStatus
      return session
    },
  },

  pages: {
    signIn: '/signin',
  },
}
