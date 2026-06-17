import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

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
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token

        // Set gmailConnected only when the gmail.readonly scope is present.
        // Never reset to false — once granted it persists in the JWT cookie
        // until the user signs out.
        if (account.scope?.includes('https://www.googleapis.com/auth/gmail.readonly')) {
          token.gmailConnected = true
        }
      }
      return token
    },

    async session({ session, token }) {
      session.accessToken   = token.accessToken   as string | undefined
      session.gmailConnected = token.gmailConnected as boolean ?? false
      return session
    },
  },

  pages: {
    signIn: '/signin',
  },
}
