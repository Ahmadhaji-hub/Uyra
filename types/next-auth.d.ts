import type { DefaultSession } from 'next-auth'

/** Three-state Gmail connection model.
 *  disconnected    — user has never connected Gmail, or was signed out
 *  connected       — Gmail access is valid (token present and refreshable)
 *  needs_reconnect — refresh token revoked / scopes changed; user must re-grant
 */
export type GmailStatus = 'disconnected' | 'connected' | 'needs_reconnect'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?: string
    gmailStatus:  GmailStatus
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?:        string
    refreshToken?:       string
    /** Unix timestamp (ms) when the access token expires */
    accessTokenExpires?: number
    gmailStatus?:        GmailStatus
  }
}
