import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?:    string
    gmailConnected?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?:    string
    refreshToken?:   string
    gmailConnected?: boolean
  }
}
