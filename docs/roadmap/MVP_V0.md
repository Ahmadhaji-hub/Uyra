# Uyra — MVP V0 Product Specification
**Version 0.1**
**Status: Draft**

---

## The One Question

> Can Uyra understand a user's inbox?

That is the only question V0 exists to answer. Nothing is built, added, or designed that doesn't directly serve that question. If it doesn't help prove inbox understanding, it's out.

---

## What V0 Is Not

- Not an email client
- Not a reply tool
- Not a productivity app
- Not a full product

V0 is a proof of concept with a clean UI. Its job is to show a user their inbox in a way that makes them say: *"This gets me."*

---

## Success Condition

A user connects their Gmail, waits 30 seconds, and sees a dashboard that correctly reflects what's actually happening in their inbox — the people they're in contact with, the projects they're working on, and the threads that haven't been replied to.

If a user looks at the dashboard and says "yes, that's accurate," V0 has succeeded.

---

## User Journey

**Step 1 — Sign In**
User visits the app and clicks "Sign in with Google." One click. No form.

**Step 2 — Connect Gmail**
User grants Gmail read access via OAuth. Read-only. No send permissions requested.

**Step 3 — Analysis**
Uyra processes the last 90 days of email. Takes 15–30 seconds. A simple loading screen shows plain-language progress.

**Step 4 — Dashboard**
One screen. Three panels. Done.

---

## Screens

### 1. Sign In
- Logo
- One line of copy: "Understand your inbox."
- Button: "Sign in with Google"
- Nothing else.

### 2. Loading / Analysis
- Animated indicator
- Four sequential status messages:
  1. "Reading your inbox..."
  2. "Finding important people..."
  3. "Grouping active threads..."
  4. "Almost done..."
- No estimated time. No percentage. Keep it simple.

### 3. The Dashboard (core screen)

Three panels, vertically stacked on mobile, side-by-side on desktop.

---

**Panel 1 — Important People**

Who you actually talk to. Ranked by recent activity, thread count, and reply patterns.

Each person shows:
- Name
- Last email date
- Number of threads

Target: 5–10 people. No more.

---

**Panel 2 — Active Projects**

Threads grouped by inferred topic. Uyra clusters related emails and assigns a name to each cluster.

Each project shows:
- Project name (AI-inferred)
- Thread count
- Last activity date
- Status: Active / Stalled

Target: 3–7 projects. No more.

---

**Panel 3 — Needs Reply**

Threads where Uyra has determined a response is expected or overdue. Based on thread patterns and time elapsed.

Each item shows:
- Sender name
- Subject
- Days since last email

No actions. No buttons. Read-only.

Target: up to 10 items.

---

## Features

| Feature | In V0 |
|---|---|
| Google Sign-In | ✅ |
| Gmail read access (OAuth) | ✅ |
| Inbox analysis (90 days) | ✅ |
| Important People panel | ✅ |
| Active Projects panel | ✅ |
| Needs Reply panel | ✅ |
| Single dashboard screen | ✅ |
| Draft replies | ❌ |
| Sending emails | ❌ |
| Approval flows | ❌ |
| Urgency detection | ❌ |
| Settings screen | ❌ |
| Account management | ❌ |
| Mobile app | ❌ |
| Multi-account | ❌ |
| Notifications | ❌ |

---

## Technical Stack

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- Vercel

### Auth
- NextAuth.js with Google OAuth provider
- Scope: `gmail.readonly` only — no send, no modify

### Email Access
- Gmail API via Google Cloud Console
- Read the last 90 days, max 1,000 threads

### AI
- OpenAI GPT-4o (or Claude via API)
- Three tasks only:
  1. Contact importance scoring
  2. Thread topic clustering and naming
  3. Reply-needed detection

### Database
- Supabase
- Two tables:
  - `users` — id, email, google_id, created_at
  - `analysis_runs` — id, user_id, result (JSONB), created_at

The analysis result is a single JSON blob containing the three panels. No complex schema needed.

### Infrastructure
- Vercel (hosting + API routes)
- Supabase (auth + database)
- Google Cloud (Gmail OAuth credentials)
- OpenAI (inference)

---

## Data Flow

```
User signs in
  → Google OAuth (gmail.readonly scope)
  → Fetch last 1,000 threads via Gmail API
  → Send thread summaries to OpenAI
  → Receive structured JSON: { people, projects, needs_reply }
  → Save to Supabase (analysis_runs)
  → Render dashboard
```

Email content is never stored. The Gmail API response is processed in memory, sent to the AI, and the resulting structured summary is what gets saved.

---

## What "Understanding" Looks Like

The AI prompt must produce a JSON response in this exact shape:

```json
{
  "people": [
    { "name": "Sarah K.", "last_contact": "2026-06-14", "thread_count": 12 }
  ],
  "projects": [
    { "name": "Uyra Launch", "thread_count": 8, "last_activity": "2026-06-15", "status": "Active" }
  ],
  "needs_reply": [
    { "sender": "James M.", "subject": "Follow up on proposal", "days_waiting": 4 }
  ]
}
```

The dashboard renders directly from this JSON. No additional processing.

---

## Build Estimate

| Task | Time |
|---|---|
| Google OAuth + NextAuth setup | 2 days |
| Gmail API integration | 2 days |
| AI prompt + JSON output | 2 days |
| Dashboard UI (3 panels) | 3 days |
| Loading screen + polish | 1 day |
| Supabase schema + save/load | 1 day |
| Testing + deploy | 2 days |
| **Total** | **~2 weeks** |

---

## What Comes Next (V1)

Once V0 proves that inbox understanding is accurate and users find it useful, the natural next step is adding value on top of that understanding:

- Urgency detection
- Draft replies
- Approval flow before sending
- Settings and preferences

None of that belongs in V0. Build the understanding layer first. Everything else depends on it.

---

*V0 is a question. Ship it. Get an answer.*
