import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import GoogleProvider from 'next-auth/providers/google'

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Exchange a stored refresh token for a fresh access token by calling
 * Google's token endpoint directly.
 *
 * Returns the updated token on success.
 * On failure, returns the original token with error = 'RefreshAccessTokenError'
 * so callers can surface a reconnect prompt rather than silently failing.
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
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error:        undefined,
    }
  } catch (err) {
    console.error('[auth] Token refresh failed:', err)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
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
      // ── First sign-in OR Gmail connect ────────────────────────────────────
      // `account` is only populated on the initial OAuth callback for each
      // sign-in / incremental-auth flow.
      if (account) {
        return {
          ...token,
          accessToken:    account.access_token,
          // Keep the old refresh token if Google didn't issue a new one
          refreshToken:   account.refresh_token ?? token.refreshToken,
          // Google's expires_at is in UNIX seconds — convert to ms
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,   // fallback: 1 hour
          // Once gmailConnected is true it stays true until sign-out
          gmailConnected: account.scope?.includes(
            'https://www.googleapis.com/auth/gmail.readonly'
          )
            ? true
            : (token.gmailConnected ?? false),
        }
      }

      // ── Subsequent requests: token still valid ────────────────────────────
      // Refresh 60 s before the real expiry so the token is always fresh
      // when it reaches the Gmail API.
      if (Date.now() < (token.accessTokenExpires ?? 0) - 60_000) {
        return token
      }

      // ── Access token expired — attempt silent refresh ─────────────────────
      return refreshAccessToken(token)
    },

    async session({ session, token }) {
      session.accessToken    = token.accessToken    as string | undefined
      session.gmailConnected = token.gmailConnected as boolean ?? false
      // Propagate any refresh error so the API route can surface it
      session.error          = token.error          as string | undefined
      return session
    },
  },

  pages: {
    signIn: '/signin',
  },
}
