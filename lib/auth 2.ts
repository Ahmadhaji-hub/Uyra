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
      // account is only present on the first sign-in
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },

    async session({ session, token }) {
      // expose accessToken to server components via getServerSession()
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },

  pages: {
    signIn: '/signin',
  },
}
