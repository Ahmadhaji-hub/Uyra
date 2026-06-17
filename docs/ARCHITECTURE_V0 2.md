# Uyra V0 — Technical Architecture
**Based on MVP_V0.md**
**Stack: Next.js 14 · Supabase · Gmail API · OpenAI · Vercel**

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│           Next.js App (React, App Router)               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                  Vercel (hosting)                       │
│         Next.js API Routes (serverless functions)       │
└────┬──────────────────┬──────────────────┬──────────────┘
     │                  │                  │
┌────▼────┐      ┌──────▼──────┐    ┌──────▼──────┐
│Supabase │      │  Gmail API  │    │  OpenAI API │
│Postgres │      │(Google Cloud│    │  (GPT-4o)   │
│  Auth   │      │  Console)   │    │             │
└─────────┘      └─────────────┘    └─────────────┘
```

**Request path for first-time user:**
1. User signs in → Google OAuth via NextAuth
2. App calls `/api/analysis/run`
3. Server fetches Gmail threads (read-only)
4. Server sends thread data to OpenAI
5. OpenAI returns structured JSON
6. JSON saved to Supabase `analysis_runs`
7. Dashboard rendered from saved JSON

**Request path for returning user:**
1. User signs in
2. App calls `/api/analysis/latest`
3. Returns cached JSON from Supabase
4. Dashboard renders immediately
5. Optionally re-run analysis if > 24h old

---

## 2. Frontend Structure

### File Tree

```
app/
├── layout.tsx              # Root layout, fonts, globals
├── page.tsx                # Sign-in page (unauthenticated)
├── dashboard/
│   └── page.tsx            # Dashboard (authenticated)
├── connecting/
│   └── page.tsx            # Loading/analysis screen
└── api/
    ├── auth/
    │   └── [...nextauth]/
    │       └── route.ts    # NextAuth handler
    ├── analysis/
    │   ├── run/
    │   │   └── route.ts    # POST: trigger new analysis
    │   └── latest/
    │       └── route.ts    # GET: fetch latest result
    └── gmail/
        └── test/
            └── route.ts    # GET: verify Gmail connection

components/
├── SignInButton.tsx         # "Sign in with Google" button
├── LoadingScreen.tsx        # Animated analysis progress
├── Dashboard.tsx            # Parent dashboard layout
├── PeoplePanel.tsx          # Panel 1: Important People
├── ProjectsPanel.tsx        # Panel 2: Active Projects
├── NeedsReplyPanel.tsx      # Panel 3: Needs Reply
└── PanelCard.tsx            # Shared card wrapper

lib/
├── auth.ts                  # NextAuth config
├── supabase.ts              # Supabase client
├── gmail.ts                 # Gmail API helpers
├── openai.ts                # OpenAI client + prompt
└── analysis.ts              # Analysis pipeline orchestrator

types/
└── index.ts                 # Shared TypeScript types
```

### Pages

**`app/page.tsx` — Sign In**
- Rendered server-side
- Checks session via `getServerSession()`
- If authenticated → redirect to `/dashboard`
- If not → render `<SignInButton />`

**`app/connecting/page.tsx` — Loading**
- Client component (`'use client'`)
- On mount, calls `POST /api/analysis/run`
- Cycles through 4 status messages with a timer
- On success → `router.push('/dashboard')`
- On error → show plain error message + retry button

**`app/dashboard/page.tsx` — Dashboard**
- Server component
- Fetches latest analysis from `GET /api/analysis/latest`
- If no analysis exists → redirect to `/connecting`
- Passes data to `<Dashboard />` client component

### Components

**`Dashboard.tsx`**
```tsx
// Props: AnalysisResult
// Renders three panels in a responsive grid
// grid-cols-1 on mobile, grid-cols-3 on lg+
```

**`PeoplePanel.tsx`**
```tsx
// Props: Person[]
// Renders name, last contact date, thread count
// Sorted by thread_count desc
```

**`ProjectsPanel.tsx`**
```tsx
// Props: Project[]
// Renders project name, thread count, last activity, status badge
// Status badge: green = Active, gray = Stalled
```

**`NeedsReplyPanel.tsx`**
```tsx
// Props: NeedsReplyItem[]
// Renders sender, subject, days_waiting
// days_waiting > 7 shown in amber
```

### Data Flow (Frontend)

```
Dashboard page (server)
  → GET /api/analysis/latest
  → returns AnalysisResult JSON
  → passed as props to <Dashboard />
    → <PeoplePanel people={result.people} />
    → <ProjectsPanel projects={result.projects} />
    → <NeedsReplyPanel items={result.needs_reply} />
```

---

## 3. Backend Structure

### API Routes

**`POST /api/analysis/run`**
- Auth: requires valid session (check with `getServerSession`)
- Calls `runAnalysis(userId, accessToken)`
- Returns `{ success: true, result: AnalysisResult }`
- On failure returns `{ error: string }` with appropriate status code
- Timeout: set Vercel function timeout to 60s in `vercel.json`

**`GET /api/analysis/latest`**
- Auth: requires valid session
- Queries Supabase: `SELECT result FROM analysis_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
- Returns the stored `AnalysisResult` JSON
- Returns `{ result: null }` if no analysis exists yet

**`GET /api/gmail/test`**
- Auth: requires valid session
- Calls Gmail API: `users.getProfile({ userId: 'me' })`
- Returns `{ connected: true, email: string }` or `{ connected: false }`
- Used to verify OAuth scope was granted correctly

### Services

**`lib/gmail.ts`**

```ts
import { google } from 'googleapis'

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth })
}

export async function fetchRecentThreads(accessToken: string, maxResults = 100) {
  const gmail = getGmailClient(accessToken)
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  const after = Math.floor(cutoff / 1000)

  const list = await gmail.users.threads.list({
    userId: 'me',
    maxResults,
    q: `after:${after}`,
  })

  const threadIds = list.data.threads ?? []

  const threads = await Promise.all(
    threadIds.map((t) =>
      gmail.users.threads.get({
        userId: 'me',
        id: t.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })
    )
  )

  return threads.map((t) => t.data)
}
```

Key decisions:
- Use `format: 'metadata'` — fetches headers only, never message bodies
- `metadataHeaders` limits to exactly what's needed
- This keeps PII minimal and processing fast

**`lib/openai.ts`**

```ts
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function analyzeInbox(threadSummaries: ThreadSummary[]): Promise<AnalysisResult> {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: JSON.stringify(threadSummaries) },
    ],
    temperature: 0.2,
  })

  return JSON.parse(completion.choices[0].message.content!) as AnalysisResult
}

const SYSTEM_PROMPT = `
You are an inbox analysis engine. Given a list of email thread metadata (sender, subject, date), 
return a JSON object with exactly three keys: people, projects, needs_reply.

Rules:
- people: identify the 5-10 contacts the user communicates with most. 
  Each: { name, email, last_contact (ISO date), thread_count }
- projects: cluster threads into 3-7 meaningful topic groups and name each group clearly.
  Each: { name, thread_count, last_activity (ISO date), status ("Active" | "Stalled") }
  Active = activity in last 14 days. Stalled = no activity for 14+ days.
- needs_reply: threads where a response appears expected and hasn't happened.
  Look for: questions directed at the user, follow-ups, time-sensitive requests.
  Each: { sender, subject, days_waiting (integer) }
  Max 10 items, sorted by days_waiting desc.

Return only valid JSON. No explanation. No markdown.
`
```

**`lib/analysis.ts`**

```ts
export async function runAnalysis(userId: string, accessToken: string): Promise<AnalysisResult> {
  // 1. Fetch threads from Gmail
  const threads = await fetchRecentThreads(accessToken)

  // 2. Extract metadata into flat summaries
  const summaries = extractThreadSummaries(threads)

  // 3. Send to OpenAI
  const result = await analyzeInbox(summaries)

  // 4. Save to Supabase
  await supabase
    .from('analysis_runs')
    .insert({ user_id: userId, result })

  return result
}

function extractThreadSummaries(threads: GmailThread[]): ThreadSummary[] {
  return threads.map((thread) => {
    const messages = thread.messages ?? []
    const headers = messages[0]?.payload?.headers ?? []
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''

    return {
      subject:      get('Subject'),
      from:         get('From'),
      date:         get('Date'),
      message_count: messages.length,
    }
  })
}
```

---

## 4. Supabase Schema

```sql
-- Users table (mirrors NextAuth session data)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  google_id   TEXT UNIQUE NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis results
CREATE TABLE analysis_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  result      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast latest-run lookup
CREATE INDEX idx_analysis_runs_user_created
  ON analysis_runs (user_id, created_at DESC);
```

**Row Level Security**

```sql
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own row
CREATE POLICY "users_self" ON users
  FOR ALL USING (id = auth.uid());

-- Users can only access their own analysis runs
CREATE POLICY "analysis_runs_self" ON analysis_runs
  FOR ALL USING (user_id = auth.uid());
```

**Note on NextAuth + Supabase:** NextAuth manages sessions independently of Supabase Auth. The `users` table above is populated via the NextAuth `signIn` callback, not via Supabase's built-in auth system. Keep them separate — don't use `supabase.auth.signIn()` anywhere.

---

## 5. Google OAuth Flow

### Setup (Google Cloud Console)
1. Create project at console.cloud.google.com
2. Enable **Gmail API**
3. Create OAuth 2.0 credentials → Web Application
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)
5. OAuth consent screen → Scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly`

### NextAuth Config (`lib/auth.ts`)

```ts
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { supabaseAdmin } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',   // get refresh token
          prompt: 'consent',         // force consent screen (needed for refresh token)
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Upsert user into Supabase
      await supabaseAdmin.from('users').upsert(
        {
          email:     user.email!,
          google_id: account!.providerAccountId,
          name:      user.name,
        },
        { onConflict: 'google_id' }
      )
      return true
    },

    async jwt({ token, account }) {
      // Store access token in JWT for server-side Gmail API calls
      if (account) {
        token.accessToken  = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },

    async session({ session, token }) {
      // Expose access token to server components via getServerSession()
      session.accessToken = token.accessToken as string
      return session
    },
  },

  pages: {
    signIn: '/',
  },
}
```

**Extend NextAuth types** (`types/next-auth.d.ts`):

```ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
  }
}
```

---

## 6. Gmail API Flow

```
1. User completes OAuth
   → NextAuth stores access_token in JWT

2. POST /api/analysis/run is called
   → getServerSession() returns session with accessToken

3. getGmailClient(accessToken) creates authenticated Gmail client

4. gmail.users.threads.list()
   → params: maxResults=100, q="after:<90_days_ago_unix>"
   → returns array of { id, historyId }

5. For each thread ID → gmail.users.threads.get()
   → params: format="metadata", metadataHeaders=["From","To","Subject","Date"]
   → returns thread with message headers ONLY (no body content)

6. Extract into ThreadSummary[]
   → { subject, from, date, message_count }

7. Pass to OpenAI (see section 7)
```

**Batching note:** Gmail API allows 100 concurrent requests. Use `Promise.all()` for up to 100 threads. For users with more, process in batches of 100 with a short delay between batches.

**Token expiry:** Access tokens expire after 1 hour. For V0, if analysis fails with a 401, redirect the user to re-authenticate. Token refresh can be added in V1.

---

## 7. OpenAI Integration

### Input Format

Send a JSON array of thread summaries to the model:

```json
[
  {
    "subject": "Re: Q2 budget review",
    "from": "Sarah Kim <sarah@example.com>",
    "date": "Mon, 15 Jun 2026 09:22:00 +0000",
    "message_count": 6
  },
  ...
]
```

### Output Format (enforced via `response_format: { type: 'json_object' }`)

```json
{
  "people": [
    {
      "name": "Sarah Kim",
      "email": "sarah@example.com",
      "last_contact": "2026-06-15",
      "thread_count": 8
    }
  ],
  "projects": [
    {
      "name": "Q2 Budget Review",
      "thread_count": 6,
      "last_activity": "2026-06-15",
      "status": "Active"
    }
  ],
  "needs_reply": [
    {
      "sender": "James Moore",
      "subject": "Follow up on proposal",
      "days_waiting": 5
    }
  ]
}
```

### Cost Estimate

- 100 threads × ~80 tokens per summary = ~8,000 input tokens
- Output JSON ≈ 800 tokens
- GPT-4o pricing: ~$0.003 per analysis run
- Acceptable for V0. Optimize in V1 if needed.

### Error Handling

```ts
try {
  const result = await analyzeInbox(summaries)
  // validate result shape before saving
  if (!result.people || !result.projects || !result.needs_reply) {
    throw new Error('Invalid analysis result shape')
  }
  return result
} catch (err) {
  // log error, return generic error to client
  console.error('OpenAI analysis failed:', err)
  throw new Error('Analysis failed. Please try again.')
}
```

---

## 8. Analysis Pipeline

End-to-end sequence for `POST /api/analysis/run`:

```
Client calls POST /api/analysis/run
  │
  ├─ 1. Authenticate
  │     getServerSession(authOptions)
  │     → if no session: return 401
  │
  ├─ 2. Fetch Gmail threads
  │     fetchRecentThreads(session.accessToken)
  │     → gmail.users.threads.list (max 100)
  │     → gmail.users.threads.get × N (metadata only)
  │     → returns Thread[]
  │
  ├─ 3. Extract summaries
  │     extractThreadSummaries(threads)
  │     → returns ThreadSummary[]
  │     → if < 5 threads: return early with empty panels
  │
  ├─ 4. Analyze with OpenAI
  │     analyzeInbox(summaries)
  │     → sends ThreadSummary[] as JSON to GPT-4o
  │     → temperature: 0.2
  │     → response_format: json_object
  │     → returns AnalysisResult
  │
  ├─ 5. Save to Supabase
  │     analysis_runs.insert({ user_id, result })
  │     → if DB write fails: still return result to client
  │       (don't fail the whole request over a save error)
  │
  └─ 6. Return result
        → { success: true, result: AnalysisResult }
```

**Total expected time:** 15–30 seconds depending on inbox size.

---

## 9. Dashboard Rendering Flow

```
app/dashboard/page.tsx (server component)
  │
  ├─ 1. getServerSession() → check auth
  │     → if no session: redirect('/')
  │
  ├─ 2. GET /api/analysis/latest
  │     → query Supabase for latest analysis_run
  │     → if none found: redirect('/connecting')
  │
  ├─ 3. Pass result to client component
  │     return <Dashboard result={result} />
  │
  └─ Dashboard.tsx (client component)
        ├─ <PeoplePanel people={result.people} />
        ├─ <ProjectsPanel projects={result.projects} />
        └─ <NeedsReplyPanel items={result.needs_reply} />
```

**Re-analysis trigger:** Add a "Refresh" button to the dashboard that calls `POST /api/analysis/run` and reloads on completion. Only trigger if last analysis is > 24 hours old (check `created_at` from the latest run).

---

## 10. Deployment Architecture

### Vercel

```
vercel.json
{
  "functions": {
    "app/api/analysis/run/route.ts": {
      "maxDuration": 60
    }
  }
}
```

The analysis route needs a 60s timeout because Gmail + OpenAI can take 20–40s combined. All other routes use the default 10s.

### Supabase

- Use the **free tier** for V0
- Enable RLS (see Section 4)
- Use `supabaseAdmin` (service role key) only in server-side API routes, never in client code

### Google Cloud

- Create credentials under a dedicated project (e.g., `uyra-v0`)
- Set OAuth consent screen to "External" + Testing mode initially
- Add test users manually during development
- To accept all Google users: submit for verification (required for `gmail.readonly` scope in production)

### Domain / DNS

- Point domain to Vercel via A records or nameservers
- Add production OAuth redirect URI in Google Cloud Console before going live

---

## 11. Environment Variables

```bash
# .env.local (never commit this file)

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=<your_client_id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your_client_secret>

# Supabase (from Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # server-side only, never expose

# OpenAI
OPENAI_API_KEY=sk-...
```

**Vercel:** Add all of the above under Project Settings → Environment Variables. Set `NEXTAUTH_URL` to your production domain for the production environment.

**Rule:** Any variable prefixed with `NEXT_PUBLIC_` is exposed to the browser. Never put `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in a `NEXT_PUBLIC_` variable.

---

## 12. TypeScript Types

```ts
// types/index.ts

export interface Person {
  name:         string
  email:        string
  last_contact: string   // ISO date string
  thread_count: number
}

export interface Project {
  name:          string
  thread_count:  number
  last_activity: string   // ISO date string
  status:        'Active' | 'Stalled'
}

export interface NeedsReplyItem {
  sender:       string
  subject:      string
  days_waiting: number
}

export interface AnalysisResult {
  people:       Person[]
  projects:     Project[]
  needs_reply:  NeedsReplyItem[]
}

export interface ThreadSummary {
  subject:       string
  from:          string
  date:          string
  message_count: number
}
```

---

## 13. Development Milestones

Work in this order. Each milestone produces something that runs locally.

**Day 1–2: Auth**
- `npx create-next-app@latest uyra --typescript --tailwind --app`
- Install NextAuth: `npm install next-auth`
- Configure `lib/auth.ts` with GoogleProvider
- Create `app/api/auth/[...nextauth]/route.ts`
- Build sign-in page (`app/page.tsx`) with `<SignInButton />`
- Test: sign in with Google, session persists on page refresh

**Day 3–4: Supabase**
- Create Supabase project
- Run schema SQL (Section 4)
- Enable RLS, add policies
- Install client: `npm install @supabase/supabase-js`
- Configure `lib/supabase.ts` (anon client + admin client)
- Wire `signIn` callback in NextAuth to upsert user row
- Test: user row appears in Supabase after sign-in

**Day 5–6: Gmail API**
- Enable Gmail API in Google Cloud Console
- Install googleapis: `npm install googleapis`
- Write `lib/gmail.ts` (`getGmailClient`, `fetchRecentThreads`)
- Create `GET /api/gmail/test` route
- Test: sign in, call test route, confirm it returns your Gmail address

**Day 7–8: OpenAI Analysis**
- Install OpenAI: `npm install openai`
- Write `lib/openai.ts` with prompt and `analyzeInbox()`
- Write `lib/analysis.ts` with full `runAnalysis()` pipeline
- Create `POST /api/analysis/run` route
- Test with Postman or curl: trigger analysis, inspect returned JSON

**Day 9: Supabase Save/Load**
- Confirm `analysis_runs` insert works after a real analysis
- Build `GET /api/analysis/latest` route
- Test: run analysis, reload, confirm result is loaded from DB (not re-run)

**Day 10–12: Dashboard UI**
- Build `app/connecting/page.tsx` with loading states
- Build `app/dashboard/page.tsx` (server component, fetches + passes data)
- Build `Dashboard.tsx`, `PeoplePanel.tsx`, `ProjectsPanel.tsx`, `NeedsReplyPanel.tsx`
- Wire full flow: sign in → connecting → dashboard
- Test end-to-end with real Gmail data

**Day 13: Edge Cases + Hardening**
- Handle: no Gmail threads found
- Handle: OpenAI timeout or bad JSON response
- Handle: Supabase save failure (log, don't crash)
- Handle: expired access token (redirect to re-auth)
- Add "Refresh analysis" button on dashboard

**Day 14: Deploy**
- Push to GitHub
- Connect repo to Vercel
- Add all env vars in Vercel dashboard
- Add production redirect URI to Google Cloud Console
- Deploy and test with a real Google account on production URL

---

## Dependencies

```json
{
  "dependencies": {
    "next":            "14.x",
    "react":           "18.x",
    "react-dom":       "18.x",
    "next-auth":       "^4.24.0",
    "googleapis":      "^144.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "openai":          "^4.52.0"
  },
  "devDependencies": {
    "typescript":      "^5.0.0",
    "@types/node":     "^20.0.0",
    "@types/react":    "^18.0.0",
    "tailwindcss":     "^3.4.0",
    "autoprefixer":    "^10.0.0",
    "postcss":         "^8.0.0"
  }
}
```

Total dependencies: 4 runtime packages beyond Next.js itself. Keep it that way for V0.
