# Memory V1.5 — Additive Signals Design Review

**Purpose:** Evaluate three candidate additive signals — reply latency, inbound/outbound directionality, decision resolution/latency — before Intent Memory is built.
**Scope:** Architecture review only. No code, no implementation.
**Baseline:** commit `7b178bb`. Sources read: `001`/`002` migrations, `lib/gmail.ts`, `lib/memory-writer.ts`, `lib/priorities.ts`, `types/inbox.ts`.

---

## 0. Two facts that bound all three signals

**A. The raw material already exists in the fetched payload — it's just discarded.** `gmail.ts` fetches each thread's messages with `From / To / Subject / Date` headers and already computes `userSentInThread` (whether a message's `From` equals the owner). So per-message direction and timestamp are *available at run time*; today the writer keeps only `lastContactTimestamp` and a `twoWay` boolean, and **skips owner-outbound messages entirely** during per-person accumulation. Signals 1 and 2 are extraction-and-retention changes, not new data acquisition.

**B. A hard sampling boundary sits under everything.** `threads.list` uses `maxResults: 100`, metadata-only. Analysis only ever sees the ~100 most recent threads. Every V1.5 signal inherits this cap: latency only for recent threads, directionality only within the window, resolution detection confounded by threads aging out. This is pre-existing and not introduced by V1.5, but it caps the ceiling of all three.

**C. Forward-accrual, no backfill.** These signals are computed from live Gmail at run time and cannot be reconstructed for past periods. Every column starts empty and populates *going forward only*. This single property drives the sequencing recommendation (§7).

---

## 1. Reply latency

**What it measures:** time between an inbound message from person X and the owner's next outbound message in that thread — a per-person responsiveness metric.

**Exact schema changes (additive, on `person_memory`):**
- `reply_count        integer  NOT NULL DEFAULT 0` — # inbound→outbound pairs observed
- `avg_reply_latency_sec real   NULL` — EMA of latency (mirrors the `avg_score` EMA pattern)
- `reply_latency_samples integer[] NOT NULL DEFAULT '{}'` — last N raw latencies for trend
- `last_reply_latency_sec integer NULL`

All nullable/defaulted; no constraint, key, or index changes. **Not placed in `relationship_weekly_buckets`** — buckets use a GREATEST/non-decreasing-within-week upsert that doesn't fit latency aggregation; an EMA on `person_memory` is the clean home.

**Additive?** **Yes, fully.** New nullable/defaulted columns only; existing readers/writers untouched.

**Computation model:** at run time, per thread, order messages by `Date`; for each owner-outbound message, pair it with the nearest *preceding* inbound from the target person; latency = Δtimestamp, clamped ≥ 0 and capped at an outlier ceiling. Count only the first reply per inbound. Aggregate per person via EMA. Deterministic given the message set — but the message set is live Gmail, so the *metric* is forward-accruing (consistent with how all V1 signals already work).

**Data integrity risks:**
- `Date` is a sender-supplied wall clock → skew/timezone/spoofing can yield negative or absurd latencies → **clamp + cap + min-sample gating** required.
- Multi-party / CC threads make inbound→outbound attribution ambiguous → need an explicit "nearest preceding inbound from this person" pairing rule.
- Right-censoring: unreplied inbounds produce no latency; excluding them biases the average toward "things the owner answered." Acceptable if documented.

**Migration risks:** Low. The one real hazard is the **NULL contract**: `avg_reply_latency_sec` is NULL until the first forward observation, and consumers must treat NULL as *"unknown,"* never as `0` (zero latency is a strong, wrong signal). Identity/Intent readers must encode this.

**Scalability impact:** Negligible — walks already-fetched messages; a few columns + a small array per person. No new tables, no fan-out.

**Recomputability impact:** Not retroactively recomputable from raw mail (past windows are gone) — same as every V1 accumulator. Once stored, it is ground-truth substrate, so **Identity/Intent remain fully recomputable from it.** Derived-layer contract preserved.

**How it improves Intent:** Unlocks *responsiveness/prioritization* intents — "prioritizes fast replies to X," "responsive communicator," and **responsiveness asymmetry** (fast to some, slow to others). Reply speed is a far better *desire/priority* proxy than raw volume — a meaningful step from "behavioral volume" toward true intent.

---

## 2. Inbound vs outbound directionality

**What it measures:** counts of messages owner→person (outbound) vs person→owner (inbound), upgrading the existing `two_way` boolean to a magnitude/ratio.

**Exact schema changes (additive):**
- On `person_memory`: `inbound_count integer NOT NULL DEFAULT 0`, `outbound_count integer NOT NULL DEFAULT 0` (latest snapshot, mirroring `total_messages`).
- On `relationship_weekly_buckets`: `inbound_count integer NOT NULL DEFAULT 0`, `outbound_count integer NOT NULL DEFAULT 0` — directional **time-series**, the better home for trend ("owner increasingly initiates with X").

**Additive?** **Yes.** Keep `two_way` untouched (it equals `inbound>0 AND outbound>0`); the counts are a strict superset adding nuance. Defaulted columns, no constraint changes.

**Computation model:** stop skipping owner-outbound messages; per message compare `From` to the owner identity → outbound if owner, inbound otherwise; count per person and per week. Initiation ratio = `outbound / (inbound + outbound)`. Deterministic from the fetched set.

**Data integrity risks:** **Lowest of the three.** Main hazard is **owner-identity resolution**: `normalizedUser` is a single email; send-as aliases, `+tag` addresses, or delegated identities would misclassify outbound as inbound. The owner-identity *set* must be resolved before direction is trusted. CC/automated inflation is a minor secondary concern.

**Migration risks:** Low. One design decision to lock: within-week reruns must respect the existing bucket convention. The current buckets are **non-decreasing within a week (GREATEST)**; directional counts must follow the same rule (or an explicit additive convention) to avoid double-counting on same-week re-analysis.

**Scalability impact:** Negligible — counts already derivable, simply retained.

**Recomputability impact:** Same as §1 — forward-accruing substrate; derived layers recompute cleanly from stored state. Note `0` is a *valid* starting value here (unlike latency's NULL), so cold-start handling is simpler.

**How it improves Intent:** Unlocks *initiation vs reactivity* — "owner proactively initiates with X" *(toward)* vs "only responds." Initiation is one of the strongest *desire* proxies the email channel can yield, and it refines communication-style intents (broadcaster vs responder). **Highest value-to-cost of the three.**

---

## 3. Decision resolution / resolution latency

**What it measures:** whether a surfaced decision thread was handled, and how long it took.

**Exact schema changes:** the columns largely **already exist** (`is_resolved`, `resolved_at`); resolution latency would add `resolution_latency_sec integer NULL` and optionally `resolution_source text` (`user | inferred`). Schema-wise additive — **but the schema is not the problem; the signal is.**

**Additive?** Column-wise yes. **Semantically NO — and this is the landmine.** `is_resolved` is *already a consumed signal*: the identity reader filters `is_resolved = false`, and the `decision_behavior` facet's `openDecisionCount`/`backlogPressure` depend on it. Beginning to *write* `is_resolved` (especially via inference) silently changes existing Identity output. Any resolution work must be **versioned/gated behind `algorithm_version`**, not flipped in place.

**Computation model — two sources, both problematic:**
- **(a) Explicit user action** — the clean signal, but it requires a UI/product surface. That is a *feature*, not a Memory-phase schema change, and is out of scope for V1.5.
- **(b) Inferred resolution** — deterministic-ish heuristic. Best available: "the last message in the decision thread is now from the owner" (ball out of the owner's court) → resolved; `resolved_at` ≈ that outbound timestamp; latency = `resolved_at − first_seen_at`. Weaker alternative: "thread no longer surfaces as a decision."

**Data integrity risks (highest of the three):**
- Inference ≠ truth: "owner sent last message" may be a follow-up question, not a resolution → false positives.
- **Windowing confound:** a decision can "disappear" because it aged out of the 100-thread cap, not because it resolved → disappearance-based resolution is unreliable; the "last message from owner" variant requires the thread still be in-window.
- **Run-frequency quantization:** resolution detection and latency are quantized to whenever a run happened to catch the resolving message — latency precision is poor and run-cadence-dependent.
- Re-open problem: a later reply invalidates a prior inferred-resolved → needs un-resolve logic or accepted staleness.

**Migration risks:** Highest. As above, it mutates an already-consumed column. Without versioning, deploying it would retroactively shrink `openDecisionCount` and shift `identity_profile`/`decision_behavior` for every owner — a silent behavioral migration.

**Scalability impact:** Moderate. "Last message from owner" detection requires re-inspecting previously-flagged open threads even after they stop being decisions → per-run work proportional to the open-decision backlog (small per owner, but non-zero and unbounded if backlogs grow).

**Recomputability impact:** **Worst of the three.** Resolution is an event inferred from *run history*, not snapshot-reconstructable; resolution latency is essentially non-recomputable (depends on when runs fired). This weakens the determinism story relative to signals 1 and 2.

**How it improves Intent:** Unlocks *follow-through/closure* intents — "owner closes loops" vs "lets things linger." Genuinely valuable, but the enabling signal is inferred, heuristic, and run-quantized, so any such intent would carry **low confidence** — the weakest quality of the three.

---

## Recommended V1.5 scope

**Ship signals 1 + 2 only — reply latency and inbound/outbound directionality. Exclude decision-resolution inference.**

- Additive nullable/defaulted columns on `person_memory` (latency EMA + reply count; inbound/outbound snapshot counts) and directional counts on `relationship_weekly_buckets`.
- Preserve `two_way` for compatibility; counts are a superset.
- Establish the **NULL = unknown** contract for latency, and resolve the **owner-identity set** (aliases/send-as) before trusting direction.
- Preserve the **non-decreasing-within-week** bucket convention for the new directional counts.
- Bump `MEMORY_ALGORITHM_VERSION`.

Defer decision resolution. If closure intents are wanted, implement them *properly* via an explicit user-action UI in a separate product phase — version-gated so `decision_behavior` doesn't silently shift — rather than as an inferred Memory signal.

## Should V1.5 be completed before Intent Memory?

**Yes — the two-signal V1.5 should land immediately before Intent, specifically because of the no-backfill property.** Intent V1 is *not strictly blocked* on V1.5 (the prior audit showed a ~7-intent catalog is supportable on the current surface). But:

- Signals 1+2 are cheap, additive, semantically inert (unlike signal 3), and they raise Intent's substrate from *"behavioral volume"* to *"intent proxy"* — initiation and responsiveness are the closest thing to **desire** the email channel can produce.
- They **cannot be backfilled.** Every week they aren't deployed is permanently lost history. That asymmetry is the whole argument: deploy them *before* Intent so history starts accruing, even though Intent doesn't need them on day one.

**Recommendation:** land V1.5 (signals 1+2) first to start accruing non-backfillable history — but design Intent V1 to **degrade gracefully** while those columns are still sparse (NULL/low-sample for the first several weeks), and do not gate any high-value Intent on data that won't exist yet.

## Blockers and future architectural concerns

1. **Owner-identity set (aliases / send-as / delegated):** directionality and latency both depend on correctly identifying the owner's outbound. Resolve the full sending-identity set before relying on either. *(Closest thing to a hard blocker.)*
2. **100-thread, metadata-only fetch cap:** bounds the ceiling of all three signals. Pre-existing; document, and consider widening before these signals are leaned on heavily.
3. **`Date`-header clock skew:** clamp/cap latency; treat as approximate, never exact.
4. **No-backfill / forward-accrual:** columns start sparse; Intent must handle NULL/low-sample and not block high-value intents on absent history.
5. **`is_resolved` is a consumed column:** any future resolution work must be version-gated, never flipped in place, to avoid a silent migration of `decision_behavior` / `identity_profile` output.
6. **Bucket upsert semantics:** new directional counts must preserve the existing non-decreasing-within-week convention to avoid same-week double counting.

**Verdict:** V1.5 is a small, low-risk, high-leverage phase if scoped to signals 1+2. Those two are additive, semantically inert, cheaply computed from already-fetched data, and meaningfully upgrade Intent quality — and their no-backfill nature makes deploying them *before* Intent the right sequencing. Signal 3 is the outlier on every axis (integrity, migration safety, recomputability, intent quality) and should be deferred to a proper, version-gated, UI-driven resolution phase.
