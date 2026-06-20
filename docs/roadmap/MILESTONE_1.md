# Uyra — Milestone 1: Google Authentication
**Goal:** A user can sign in with Google and land on a protected dashboard page.
**Scope:** NextAuth + Google OAuth only. No Gmail API. No Supabase yet.

---

## Note on Project Structure

The existing `/Users/ahmadhaji/Desktop/UYRA/Uyra` project is the marketing site (uyra.ai). We are adding the product app into the same Next.js project. The sign-in page lives at `/signin`, not `/` — the landing page stays untouched.

```
/          → existing landing page (unchanged)
/manifest  → existing manifest page (unchanged)
/signin    → NEW: product sign-in (this milestone)
/connecting → NEW: analysis loading screen (stub this milestone, real in M3)
/dashboard → NEW: protected dashboard (stub this milestone, real in M4)
```

---

## Step 1 — Install Package

Run this in the project root (`/Users/ahmadhaji/Desktop/UYRA/Uyra`):

```bash
npm install next-auth
```

That's the only new dependency for this milestone.

---

## Step 2 — Google Cloud Console Setup

Do this once before running the app locally.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one named `uyra`)
3. Left sidebar → **APIs & Services → Enabled APIs**
   - No new APIs needed for M1. Gmail API is added in M2.
4. Left sidebar → **APIs & Services → Credentials**
5. Click **+ CREATE CREDENTIALS → OAuth 2.0 Client ID**
6. Application type: **Web application**
7. Name: `Uyra Local`
8. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
9. Click **Create**
10. Copy the **Client ID** and **Client Secret** — you'll need them in Step 3

**For production (Vercel), add a second redirect URI:**
```
https://yourdomain.com/api/auth/callback/google
```

---

## Step 3 — Environment Variables

Add these to your existing `.env.local` file:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Google OAuth (from Cloud Console)
GOOGLE_CLIENT_ID=<your_client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your_client_secret>
```

Generate `NEXTAUTH_SECRET` by running in terminal:
```bash
openssl rand -base64 32
```

---

## Step 4 — Folder Structure After This Milestone

```
app/
├── api/
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts        ← NEW
├── signin/
│   └── page.tsx                ← NEW
├── connecting/
│   └── page.tsx                ← NEW (stub)
├── dashboard/
│   └── page.tsx                ← NEW (stub)
├── layout.tsx                  (unchanged)
├── page.tsx                    (unchanged — landing page)
└── manifest/
    └── page.tsx                (unchanged)

components/
├── SignInButton.tsx             ← NEW
└── ... (existing components unchanged)

lib/
└── auth.ts                     ← NEW

types/
└── next-auth.d.ts              ← NEW

middleware.ts                   ← NEW (project root)
```

---

## Step 5 — Files to Create

### `lib/auth.ts`

NextAuth configuration. Scope is `openid email profile` only — no Gmail scope yet (added in M2).

```ts
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
      // Persist tokens on first sign-in (account is only set then)
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },

    async session({ session, token }) {
      // Expose access token to server components via getServerSession()
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },

  pages: {
    signIn: '/signin',
  },
}
```

---

### `app/api/auth/[...nextauth]/route.ts`

The catch-all NextAuth API handler. This file must exist at exactly this path.

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

---

### `types/next-auth.d.ts`

Extends the NextAuth `Session` and `JWT` types so TypeScript knows about `accessToken`.

```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?:  string
    refreshToken?: string
  }
}
```

---

### `middleware.ts`

Protects `/dashboard` and `/connecting`. Any unauthenticated request to these routes is redirected to `/signin`.

```ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/connecting/:path*'],
}
```

Place this file in the **project root** (same level as `package.json`), not inside `app/`.

---

### `components/SignInButton.tsx`

Client component. Calls `signIn('google')` on click and redirects to `/connecting` on success.

```tsx
'use client'

import { signIn } from 'next-auth/react'

export default function SignInButton() {
  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/connecting' })}
      className="flex items-center gap-3 px-7 py-3.5 bg-[#f8f8f8] text-[#050505] rounded-full text-sm font-medium hover:bg-white transition-colors duration-200"
    >
      <GoogleIcon />
      Sign in with Google
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"
      />
      <path
        fill="#EA4335"
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"
      />
    </svg>
  )
}
```

---

### `app/signin/page.tsx`

Server component. Redirects to `/dashboard` if the user is already authenticated. Otherwise renders the sign-in screen.

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SignInButton from '@/components/SignInButton'

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6">

      {/* Wordmark */}
      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight mb-12">
        Uyra
      </p>

      {/* Headline */}
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.04em] text-[#f8f8f8] text-center leading-tight mb-4">
        Understand your inbox.
      </h1>

      <p className="text-[#555] text-base text-center mb-12 max-w-xs">
        Sign in to connect your Gmail and see what actually matters.
      </p>

      <SignInButton />

      <p className="mt-8 text-xs text-[#333] text-center max-w-xs">
        Uyra requests read-only access to your Gmail.
        <br />Your emails are never stored.
      </p>

    </main>
  )
}
```

---

### `app/connecting/page.tsx` (Milestone 1 stub)

Redirects to dashboard for now. Will be replaced with the analysis loading screen in M3.

```tsx
import { redirect } from 'next/navigation'

export default function ConnectingPage() {
  redirect('/dashboard')
}
```

---

### `app/dashboard/page.tsx` (Milestone 1 stub)

Protected server component. Reads the session and displays user info to confirm auth works. Will be replaced with the real dashboard in M4.

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')

  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 gap-6">

      <p className="text-[#f8f8f8] text-lg font-semibold tracking-tight">Uyra</p>

      <div className="border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center space-y-3">
        <p className="text-xs tracking-widest uppercase text-[#555]">Signed in as</p>
        <p className="text-[#f8f8f8] font-medium">{session.user?.name}</p>
        <p className="text-[#555] text-sm">{session.user?.email}</p>
      </div>

      <p className="text-[#333] text-sm">
        ✓ Auth working — Gmail integration coming in Milestone 2
      </p>

      <SignOutButton />

    </main>
  )
}
```

---

### `components/SignOutButton.tsx`

Needed by the dashboard stub above.

```tsx
'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/signin' })}
      className="text-sm text-[#444] hover:text-[#f8f8f8] transition-colors duration-200"
    >
      Sign out
    </button>
  )
}
```

---

## Step 6 — Local Testing

```bash
# Start the dev server
npm run dev
```

**Test flow:**

1. Open `http://localhost:3000/signin`
   - Should see the "Understand your inbox" screen with the Google button

2. Click "Sign in with Google"
   - Should redirect to Google's OAuth consent screen
   - Select your account and approve

3. After approval, should land on `http://localhost:3000/dashboard`
   - Should see your name and email from Google

4. Copy the dashboard URL and open it in a private/incognito window
   - Should redirect to `/signin` (middleware protection working)

5. Click "Sign out" on the dashboard
   - Should return to `/signin`
   - Trying to visit `/dashboard` again should redirect to `/signin`

---

## Checklist

- [ ] `npm install next-auth` completed
- [ ] Google Cloud OAuth credentials created
- [ ] `.env.local` has all 4 NextAuth variables
- [ ] `lib/auth.ts` created
- [ ] `app/api/auth/[...nextauth]/route.ts` created
- [ ] `types/next-auth.d.ts` created
- [ ] `middleware.ts` created in project root
- [ ] `components/SignInButton.tsx` created
- [ ] `components/SignOutButton.tsx` created
- [ ] `app/signin/page.tsx` created
- [ ] `app/connecting/page.tsx` stub created
- [ ] `app/dashboard/page.tsx` stub created
- [ ] Sign-in flow works end-to-end locally
- [ ] Dashboard is protected (unauthenticated access redirects to /signin)

---

## What's NOT in This Milestone

- No Gmail API calls
- No Supabase
- No inbox analysis
- No real dashboard

Those come in M2 (Supabase), M3 (Gmail + Analysis), M4 (Dashboard UI).

---

*Milestone 1 complete when: sign in → dashboard works. Dashboard shows your Google name and email.*
