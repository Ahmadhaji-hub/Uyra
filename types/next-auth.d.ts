import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?:    string
    gmailConnected?: boolean
    /** Set to 'RefreshAccessTokenError' when silent refresh fails */
    error?:          string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?:        string
    refreshToken?:       string
    /** Unix timestamp (ms) when the access token expires */
    accessTokenExpires?: number
    gmailConnected?:     boolean
    /** Set to 'RefreshAccessTokenError' when silent refresh fails */
    error?:              string
  }
}
