# Uyra — MVP Product Specification
**Version 1.0**
**Status: Draft**

---

## Overview

Uyra V1 is a focused, single-purpose product. It does one thing well: it makes a user feel that someone genuinely understands their inbox.

Not search. Not filters. Not categories.
Understanding.

The success condition for V1 is simple: a user opens Uyra, looks at their inbox summary, and thinks — *"this is exactly what I needed to see."*

---

## Problem Statement

People with active inboxes face the same daily problem: too many emails, too little clarity. They know there are important things buried in there. They don't know exactly what, or where.

Existing tools help you manage email volume. None of them help you understand what's actually happening in your inbox — who matters, what's urgent, what needs a response, and what's just noise.

Uyra V1 solves that specific problem.

---

## Version 1 Goal

> Help users understand and manage their inbox.

Nothing else. No memory. No personality learning. No acting on your behalf beyond drafting replies. Just a clear, intelligent picture of what's happening in a user's email — and the ability to respond faster.

---

## User Journey

### Step 1 — Sign In
User visits uyra.ai and signs in with Google. No form. No password. One click.

### Step 2 — Connect Gmail
User grants Uyra read access to Gmail via OAuth. Uyra requests the minimum necessary permissions: read emails, send on behalf (for drafts only, pending approval).

### Step 3 — Inbox Analysis
Uyra analyzes the last 90 days of email in the background. This takes 10–30 seconds. A loading screen confirms progress with plain-language status updates:

- "Reading your inbox..."
- "Identifying important contacts..."
- "Detecting active threads..."
- "Building your overview..."

### Step 4 — Dashboard Presented
Uyra presents the Inbox Intelligence Dashboard. The user sees a structured, prioritized view of what's happening in their inbox — not a list of emails, but a model of their email life.

### Step 5 — Draft Replies
For emails identified as needing a response, Uyra generates a draft reply. The user reviews, edits if needed, and approves before anything is sent.

---

## Screens

### 1. Landing / Sign In
- Headline: "Understand your inbox."
- Subtext: "Uyra reads your email and tells you what actually matters."
- Single CTA: "Sign in with Google"
- No other content. No distractions.

### 2. Connecting Screen
- Progress indicator (animated)
- Plain-language status messages
- Estimated time remaining
- "Your data is read-only until you approve a reply."

### 3. Inbox Intelligence Dashboard

The core screen. Divided into four panels:

**Panel A — People**
The contacts that matter most right now. Ranked by recent activity, thread depth, and reply patterns.
- Name
- Last email date
- Thread count
- Whether they're waiting on a reply from you

**Panel B — Active Projects**
Threads grouped by inferred topic/project. Uyra clusters related emails and names each cluster.
- Project name (inferred)
- Number of threads
- Last activity
- Status: Active / Stalled / Waiting

**Panel C — Urgent**
Emails that require attention in the next 24–48 hours. Urgency is determined by language analysis, sender importance, and time-sensitivity signals.
- Sender
- Subject
- Why it's urgent (one line)
- Quick action: "Draft Reply" / "Mark Handled"

**Panel D — Needs Reply**
Emails where Uyra has identified that a response is expected or overdue.
- Sender
- Subject
- Days waiting
- "Draft Reply" button

### 4. Draft Reply Screen
- Original email displayed
- Uyra-generated draft below
- Editable text field
- "Send" and "Discard" buttons
- Note: "Uyra drafted this based on your email history. Edit before sending."

### 5. Settings
- Connected accounts
- Disconnect Gmail
- Delete account and data
- Analysis depth preference (Last 30 / 60 / 90 days)

---

## Features

### Core Features (V1)

| Feature | Description |
|---|---|
| Google Sign-In | OAuth 2.0 authentication via Google |
| Gmail Connection | Read access via Gmail API |
| Inbox Analysis | NLP-based analysis of email threads |
| Important People | Contact ranking by activity and importance signals |
| Project Clustering | Automatic grouping of related threads |
| Urgency Detection | Time-sensitivity and language-based urgency scoring |
| Reply Detection | Identification of emails awaiting a response |
| Dashboard | Structured visual overview of inbox state |
| Draft Replies | AI-generated draft responses per email |
| Approval Flow | User must approve before any email is sent |

### Deliberate Omissions (V1)

- No calendar integration
- No Slack or external tool connections
- No memory or personality learning
- No autonomous actions
- No mobile app
- No team or shared inbox support

---

## Technical Requirements

### Frontend
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- Animations: Framer Motion
- Deployment: Vercel

### Backend
- Runtime: Node.js via Next.js API Routes or Edge Functions
- Auth: NextAuth.js with Google OAuth provider
- Email Access: Gmail API (Google Cloud)
- Session Management: JWT or database sessions via NextAuth

### AI / NLP
- Model: OpenAI GPT-4o (primary) or Anthropic Claude via API
- Tasks:
  - Thread summarization
  - Urgency classification
  - Reply generation
  - Project/topic clustering
  - Contact importance scoring

### Database
- Provider: Supabase (PostgreSQL)
- Tables:
  - `users` — auth, preferences
  - `connections` — linked Gmail accounts, tokens
  - `analysis_runs` — per-user inbox analysis snapshots
  - `contacts` — ranked contacts extracted per user
  - `threads` — processed email thread summaries
  - `drafts` — AI-generated reply drafts

### Storage & Security
- OAuth tokens stored encrypted at rest
- Email content never persisted — processed in memory only
- Drafts stored temporarily until approved or discarded
- GDPR-aligned data deletion on account removal

### Infrastructure
- Vercel (frontend + API routes)
- Supabase (database + auth)
- Google Cloud (Gmail API credentials)
- OpenAI or Anthropic API (inference)

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| Inbox analysis time | Under 30 seconds for 90-day window |
| Dashboard load time | Under 2 seconds after analysis |
| Draft generation time | Under 5 seconds per reply |
| Uptime | 99.5% |
| Data privacy | No email content stored beyond session |

---

## Success Metrics

**Primary**
A user opens Uyra, reviews their Inbox Intelligence Dashboard, and rates the understanding accuracy as 4/5 or higher.

**Secondary**
- 60% of users approve and send at least one AI-generated draft in their first session
- 40% of users return within 3 days without prompting
- Average session length exceeds 4 minutes

---

## Out of Scope — Future Features

These are real product directions but explicitly excluded from V1.

| Feature | Why Deferred |
|---|---|
| Calendar integration | Increases scope significantly; not core to inbox understanding |
| Personality & tone learning | Requires more data and longer usage history |
| Autonomous email sending | Trust must be established first through approval flows |
| Mobile app | Web-first for V1; mobile after core loop is validated |
| Memory layer | Core to the Digital Self vision; V2+ |
| Multi-account support | Added complexity; V2 |
| Slack / Linear / Notion connectors | Expansion after inbox is proven |
| Team inboxes | Separate product surface; future |

---

## Open Questions

1. Should Uyra request read-only Gmail access at first, upgrading to send access only when the user requests draft approval?
2. What is the maximum number of emails to process per analysis run? (Suggested cap: 1,000 most recent threads)
3. How should Uyra handle users with extremely high email volume (10k+ unread)?
4. Should drafts expire automatically after a set period?
5. What is the minimum inbox size required for Uyra's analysis to be meaningful?

---

## Timeline Estimate (Rough)

| Phase | Duration | Deliverable |
|---|---|---|
| Auth + Gmail connection | 1 week | User can sign in and connect Gmail |
| Inbox analysis pipeline | 2 weeks | Analysis runs and returns structured data |
| Dashboard UI | 1 week | Dashboard renders with real data |
| Draft generation | 1 week | Drafts generated and editable |
| Approval + send flow | 3 days | User can approve and send |
| Testing + polish | 1 week | Production-ready V1 |
| **Total** | **~6 weeks** | **Shippable MVP** |

---

*Uyra V1 — Focus on one thing. Do it better than anyone.*
