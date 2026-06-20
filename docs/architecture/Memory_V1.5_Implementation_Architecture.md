# Memory V1.5 — Implementation-Ready Architecture

**Scope (strict):** two additive signals — (1) reply latency, (2) inbound/outbound directionality. **Decision resolution is explicitly deferred.**
**Status:** Final architecture review. No code, no implementation.
**Baseline:** commit `7b178bb`. Sources read: `001`/`002` migrations, `lib/gmail.ts`, `lib/memory-writer.ts`, `lib/memory-reader.ts`, `lib/identity-compute.ts`, `types/memory.ts`, `types/inbox.ts`.

---

## 0. Design principles (carried from V1)

V1.5 must preserve the four properties that make the stack safe: **additive-only** (no V1 column redesigned or re-keyed), **derived layers stay recomputable from Memory**, **service-role-only access**, and the existing **read-modify-write** writer pattern (the writer computes against the baseline `MemoryContext` read at the start of the run; no DB-side aggregate ops). Every choice below conforms to these.

The governing intent of V1.5: convert already-fetched-but-discarded Gmail data into stored substrate, **without touching Identity behavior at all** (§7), so the migration is inert to everything except the future Intent layer.

---

## 1. Exact schema changes

All additive, nullable or defaulted, no constraint/key/index churn. Delivered as migration `003_memory_v15_signals.sql`.

### `person_memory` — five new columns

| Column | Type | Default | Meaning |
|---|---|---|---|
| `inbound_count` | `integer` | `NOT NULL DEFAULT 0` | Messages person→owner, **latest-snapshot** (mirrors `total_messages`) |
| `outbound_count` | `integer` | `NOT NULL DEFAULT 0` | Messages owner→person, latest-snapshot |
| `reply_count` | `integer` | `NOT NULL DEFAULT 0` | Cumulative inbound→outbound reply pairs observed (sample size for confidence) |
| `avg_reply_latency_sec` | `real` | **NULL** | EMA (α=0.3) of reply latency. **NULL = unknown** (never 0) |
| `reply_latency_samples` | `integer[]` | `NOT NULL DEFAULT '{}'` | Last 10 per-run median latencies, for trend |

### `relationship_weekly_buckets` — two new columns

| Column | Type | Default | Meaning |
|---|---|---|---|
| `inbound_count` | `integer` | `NOT NULL DEFAULT 0` | Weekly inbound, monotonic-within-week |
| `outbound_count` | `integer` | `NOT NULL DEFAULT 0` | Weekly outbound, monotonic-within-week |

`two_way` is **kept unchanged** — directionality is a strict superset (`two_way ≡ inbound_count>0 AND outbound_count>0`), retained for compatibility and to avoid re-keying.

**Index posture:** no new indexes in V1.5. The new columns are read in the same per-owner scans Intent/readers already perform via existing `(user_id)`/`(owner_id)` indexes. Add indexes only if a future query plan needs them.

### Type + version changes (non-schema)

- `types/memory.ts`: extend `PersonMemoryRecord` and `WeeklyBucketRecord` with the new fields; bump `MEMORY_ALGORITHM_VERSION` `1 → 2`.
- `types/inbox.ts`: extend `Person` (run-level) with `inboundCount`, `outboundCount`, `replyLatencySamples` (this run's raw latencies).
- `lib/memory-reader.ts` uses `select('*')`, so columns flow automatically; only the `mapPerson`/`mapBucket` mappers need the new fields wired.

---

## 2. Migration plan

`003_memory_v15_signals.sql`, additive and idempotent, mirroring the `002` pattern:

1. `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` for all seven columns (defaults applied; existing rows get `0` / `'{}'` / `NULL` with no table rewrite beyond default backfill — all cheap, nullable/defaulted).
2. No data backfill — these signals are **forward-accruing and cannot be reconstructed** (the historical Gmail windows are gone). Existing rows legitimately carry `0`/`NULL` until the next run observes them.
3. No constraint, FK, or unique-key changes. RLS unchanged (enabled, no policies — service-role only).
4. Deploy order: **migration first, then the code that writes the columns.** Because columns are defaulted/nullable, the pre-code window is safe (writer simply doesn't populate them yet). The `gmail.ts` + `memory-writer.ts` changes ship next; `MEMORY_ALGORITHM_VERSION = 2` begins stamping new writes.
5. Mixed-version coexistence: V1 rows (`algorithm_version = 1`, new fields at default) and V1.5 rows (`= 2`) coexist indefinitely. All readers tolerate both via the NULL/0 = "not yet observed" contract.

---

## 3. Computation logic

Two stages, both deterministic given the fetched thread set, following the existing run→write flow.

### Stage A — extraction in `lib/gmail.ts` (per thread)

Today `gmail.ts` iterates a thread's messages, computes `userSentInThread`, and **`continue`s past owner messages**, keeping only `lastContactTimestamp` + `twoWay`. Change:

- Resolve **owner identity as a set** (`ownerIdentities: Set<string>`, §4), not a single address.
- Order the thread's messages chronologically by `Date`.
- **Directionality:** for each message, classify `outbound` if `parseFrom(From).email ∈ ownerIdentities`, else `inbound` attributed to that sender. Increment per-counterpart `inboundCount` / `outboundCount`. (Owner is still not created as a *person* row — only the counterpart accumulators gain counts.)
- **Reply latency:** single pass with a per-person "pending inbound timestamp." On an inbound from X, set/refresh X's pending timestamp. On an owner outbound, pair it with the **nearest preceding unmatched inbound** and attribute the latency to *that one person only* (avoids group-thread inflation); record `Δ = outboundTs − inboundTs`, **clamp ≥ 0**, **cap at a ceiling (e.g. 14 days)**, then clear that pending. Each inbound is matched at most once; unreplied inbounds are simply right-censored (produce no latency).
- Emit per-person, per-run: `inboundCount`, `outboundCount`, and the list of paired latencies → carried on `Person` into `InboxAnalysis`.

### Stage B — persistence in `lib/memory-writer.ts` (read-modify-write vs baseline `existingContext`)

**`person_memory` (latest-snapshot + EMA, mirroring `avg_score`):**
- `inbound_count` / `outbound_count` ← this run's snapshot value (like `total_messages`, not cumulative).
- `reply_count` ← `mem.replyCount + pairsThisRun` (cumulative; confidence basis).
- `avg_reply_latency_sec` ← EMA with **strict NULL discipline:**
  - run has pairs + prior exists → `prior*0.7 + runMedian*0.3`
  - run has pairs, no prior → `runMedian`
  - **run has no pairs → keep prior unchanged** (never decay toward 0; absence ≠ fast).
- `reply_latency_samples` ← `[...mem.samples, runMedian].slice(-10)` only when the run produced pairs.

**`relationship_weekly_buckets` (monotonic-within-week, identical to `thread_count`/`message_count`):**
- `inbound_count` / `outbound_count` ← `Math.max(prev?, current)` against `existingThisWeek`, because the 100-thread window slides and a later same-week run can legitimately see fewer. Consistent with the existing in-app GREATEST convention (§5).

---

## 4. Owner alias handling strategy

**Problem:** today `normalizedUser` is a *single* email. Directionality and latency both hinge on correctly identifying owner-outbound; any send-as alias, `+tag`, or delegated address would be misclassified as inbound — silently corrupting both signals.

**Strategy — resolve an owner-identity *set* per run:**

- **Primary (authoritative): Gmail `users.settings.sendAs.list`** → all verified send-as addresses for the account. Build `ownerIdentities = { primary, ...sendAs }`, lowercased. Cache per run (one API call; §8).
- **Normalization:** lowercase; optionally fold Gmail `+tag` and dot-variants for `@gmail.com` to canonical form.
- **Fallback (if the scope is unavailable):** degrade to the single primary address **and flag affected signals at reduced confidence** rather than asserting wrong direction. Direction for non-aliased owners (the common case) is unaffected.
- **Future (Digital Self):** promote `ownerIdentities` to a persisted `owner_identity` table keyed to `app_user`, so the owner's identity set becomes durable substrate the whole stack shares — not re-fetched per run. Deferred past V1.5.

**Dependency/blocker:** `sendAs.list` needs the `gmail.settings.basic` (readonly) OAuth scope, which the current scope set may not include. See §11 — this is the one true prerequisite.

---

## 5. Bucket update semantics

Preserve the existing **monotonic-within-week** invariant exactly. The current buckets keep `GREATEST(prev, current)` for counts and OR-accumulate `two_way`, computed in-app against the baseline buckets read this run (the code comments document why: the sliding 100-thread window means later same-week runs can report *fewer* threads, and a plain upsert would let that regression overwrite a higher earlier value, corrupting the decay time-series).

New directional counts adopt the **same rule**: `inbound_count`/`outbound_count` are `Math.max(prev, current)` within the `(user_id, person_email, week_start)` row. This keeps the weekly series non-decreasing and consistent with `thread_count`/`message_count`. **Do not** sum across same-week reruns (would double-count). The known caveat is inherited unchanged: in-app GREATEST is not fully race-proof under concurrent runs (a DB-side GREATEST upsert is the deferred concurrency fix; the new columns join that same future item, no worse than today).

---

## 6. Memory versioning impact

- `MEMORY_ALGORITHM_VERSION` `1 → 2`; every V1.5 write stamps `algorithm_version = 2`.
- Purpose is provenance/observability, not gating: it lets any consumer distinguish "row written before directionality/latency existed" from "row that had the chance to observe them." A `reply_count = 0` on a `version = 2` row means *genuinely no replies seen*; on a `version = 1` row it means *never measured*. This distinction matters for Intent confidence and should be respected by readers.
- No change to the identity recompute gate (§7).

---

## 7. Identity impact

**By design: zero behavioral change.** `lib/identity-compute.ts` does not read the new columns, and `computeSourceSignature` hashes only `personEmail : lastAnalysisAt : avgScore : twoWayCount : totalThreads` (+ topic/bucket/decision terms + UTC day). The new fields are **not** in that signature, so:

- No recompute storm — the skip-gate is unaffected; identity recomputes on exactly the same cadence as today (≤ once/UTC-day).
- No identity output drift — every facet value is byte-identical to pre-V1.5.

**Recommendation: keep it that way for V1.5.** Do **not** add directionality/responsiveness facets in this phase. When you later want Identity to expose them, do it as a separate `IDENTITY_ALGORITHM_VERSION` bump that (a) adds the new facet computations *and* (b) adds the consumed fields to `computeSourceSignature` so identity actually refreshes when they change. Keeping the two migrations isolated means each is independently reversible and neither can destabilize the other. V1.5 is a **Memory-only** phase; the new signals sit dormant until Intent (or a future Identity version) reads them.

---

## 8. Scalability analysis

- **Compute:** Stage A walks messages already fetched — the latency pairing and direction classification are O(messages/thread), a marginal pass over data the run already holds. No new fetches except one `sendAs.list` call per run (cacheable per owner; effectively free).
- **Storage:** five small columns on `person_memory` (one short array) + two integers on `relationship_weekly_buckets`. Per-owner footprint negligible; no new tables, no row fan-out, no new indexes.
- **Write path:** unchanged shape — same `Promise.allSettled` upserts on the same unique keys; the new fields ride existing upserts. No additional round-trips.
- **Scale to large user counts:** the per-run cost is dominated, as today, by the Gmail fetch and the per-owner analysis; V1.5 adds a constant-factor pass and a handful of columns. It does not change the scaling order of the cron or the read path.

---

## 9. Recomputability impact

- **Not retroactively recomputable from raw mail** (past windows gone) — identical property to every existing V1 accumulator (`avg_score`, `two_way_count`, …). Acceptable and consistent.
- **Once stored, fully recomputable downstream:** the new columns are ground-truth Memory substrate, so Identity and Intent remain recomputable *from Memory* — the contract that actually matters is preserved.
- **Forward-accrual:** columns start empty and populate going forward; the `version` distinction (§6) lets consumers tell "unmeasured" from "measured-zero."

---

## 10. Rollback plan

Fully reversible, V1-preserving, mirroring the `002` rollback block:

1. Revert the `gmail.ts` + `memory-writer.ts` + type changes (stop writing the columns).
2. `ALTER TABLE person_memory DROP COLUMN IF EXISTS inbound_count, outbound_count, reply_count, avg_reply_latency_sec, reply_latency_samples;`
   `ALTER TABLE relationship_weekly_buckets DROP COLUMN IF EXISTS inbound_count, outbound_count;`
3. Optionally revert `MEMORY_ALGORITHM_VERSION` to `1` (harmless to leave at `2`; `version=2` rows simply indicate the attempt).

Because the columns are additive, nullable/defaulted, and **unread by Identity**, dropping them restores the exact V1 schema and behavior with **zero loss to any V1 signal**. Mixed `version 1/2` rows require no cleanup. No derived-layer rebuild is needed (Identity never depended on them).

---

## 11. Risks and blockers

| # | Item | Severity | Mitigation |
|---|---|---|---|
| B1 | ~~**OAuth scope for `sendAs.list`** (`gmail.settings.basic`) may not be granted~~ **RESOLVED — not a blocker.** Verified against Google's API reference: `sendAs.list` is authorized by `gmail.readonly`, which Uyra already holds. See `Memory_V1.5_B1_Scope_Verification.md`. | ~~Blocker~~ Cleared | None needed. Owner-alias handling via `sendAs.list` is the authoritative primary path on the existing scope; keep single-address only as a runtime safety net. |
| R1 | `Date`-header clock skew / spoofing → bad latencies | Medium | Clamp ≥ 0, cap at ceiling, min-sample gating; treat latency as approximate. |
| R2 | Group/CC-thread reply attribution | Medium | Fixed rule: pair each owner-outbound to the **nearest preceding unmatched inbound**, one person only; each inbound matched once. |
| R3 | **NULL-EMA discipline** for `avg_reply_latency_sec` (folding "no reply" as 0) | Medium (most likely bug) | Absence keeps prior unchanged; NULL = unknown; never decay toward 0. |
| R4 | 100-thread, metadata-only fetch cap bounds all signals | Low (pre-existing) | Document; consider widening the window in a later phase. |
| R5 | In-app GREATEST not race-proof under concurrent runs | Low (pre-existing) | New columns inherit the existing deferred DB-side-GREATEST concurrency item; no worse than today. |
| R6 | Forward-accrual: signals thin for first weeks | Low | Intent must handle NULL/low-sample and `version` semantics; don't gate high-value intents on absent history. |

**Future architectural concerns (Digital Self):** persist `ownerIdentities` as a durable `owner_identity` table tied to `app_user` (shared identity substrate); widen the Gmail window and move latency/direction to a DB-side GREATEST upsert when concurrency is hardened; and, only as a deliberate separate version bump, surface responsiveness/initiation as Identity facets feeding `source_signature`.

---

## Verdict

V1.5 is a small, low-risk, additive Memory phase that converts already-fetched Gmail data into durable substrate, leaves Identity provably untouched, preserves recomputability and monotonic bucket semantics, and is fully reversible. It is **implementation-ready with no outstanding blockers** — B1 is resolved on verification: `sendAs.list` is authorized by the `gmail.readonly` scope Uyra already holds, so authoritative owner-alias resolution ships as the primary path with no scope, consent, or reconnect cost (see `Memory_V1.5_B1_Scope_Verification.md`). The deferred decision-resolution signal stays out of scope. Net effect: Intent Memory gains the two strongest *intent proxies* the email channel can yield — **initiation** (directionality) and **responsiveness** (latency) — accruing non-backfillable history from the moment V1.5 deploys.
