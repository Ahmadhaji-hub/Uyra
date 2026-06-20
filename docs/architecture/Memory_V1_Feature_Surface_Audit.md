# Memory V1 — Feature Surface Audit

**Purpose:** Inventory every structured signal currently exposed by Memory V1 + Identity Memory V1, assess each for deterministic Intent derivation, and decide what (if anything) Memory must add before Intent V1 is built.
**Scope:** Architecture audit only. No code, no implementation.
**Baseline:** Production commit `7b178bb`. Sources read: `001_memory_v1.sql`, `002_identity_memory.sql`, `lib/identity-compute.ts`, `lib/memory-writer.ts`, `lib/priorities.ts`, `lib/gmail.ts`.

---

## 0. The one fact that frames everything

**Every signal in Memory V1 is email-derived, and almost all of it is *volume/recency*, not *intent*.** There is no calendar, no documents, no tasks, no explicit goals, no message content, no sentiment, and no sub-weekly time resolution. The substrate measures *how much and how recently the owner interacts, and with whom* — it does not measure *what the owner wants*.

This is the central constraint on Intent V1: a deterministic intent can only be a function of interaction *patterns*. Inferring desire ("wants more of X") from volume ("emails X a lot") is a semantic leap the data does not directly support. The honest V1 framing is **"orientation revealed by behavior,"** not "stated or felt intent."

Two cross-cutting properties to keep in mind while reading the tables:

- **Run-frequency sensitivity.** The accumulators (`avg_score` EMA, `two_way_count`, `total_occurrences`, `times_seen`) increment *per analysis run*, not per unit of real time. Two identical inboxes analyzed a different number of times yield different memory. This does **not** break Intent determinism (Intent reads stored state deterministically) but it weakens cross-owner semantic comparability — flagged per-signal below.
- **"Recomputable" means recomputable from the Memory tables as they stand**, the same contract Identity already uses — *not* from raw Gmail. The accumulators are not reconstructable from a single inbox snapshot, but they are stable stored state. Where a signal is history/run-order-dependent (not snapshot-reconstructable), it is marked accordingly.

---

## 1. `person_memory` — per-contact running profile

| Signal | Meaning | Data quality | Stability | Recomputability | Suitable for deterministic Intent? |
|---|---|---|---|---|---|
| `person_email` | Canonical contact identity (lowercased) | High — canonical key | High | Yes (from inbox) | **Yes** — keying / per-relationship intents |
| `person_name` | Display name from headers | Medium — header-dependent, varies | Medium | Yes | Label only |
| `total_threads` | Thread count, **latest snapshot (not cumulative)** | Medium — snapshot semantics, resets per run | Medium | Snapshot-recomputable | **Yes** — relationship magnitude |
| `total_messages` | Message count, latest snapshot | Medium | Medium | Snapshot | **Yes** — with threads gives depth (msgs/thread) |
| `two_way_count` | # runs the relationship was bidirectional | Good reciprocity proxy | Monotonic ↑ | History/run-dependent | **Yes** — reciprocity orientation (caveat: run-sensitive) |
| `last_score` | Latest raw relationship-importance score 0–100 | Volatile single-run heuristic | Low | Snapshot | Weak alone — prefer `avg_score` |
| `avg_score` | EMA (α=0.3) of relationship importance | **Good** smoothed strength signal | Medium-high (smoothed) | History/run-order-dependent | **Yes (primary)** — relationship strength |
| `score_samples` | Last 10 raw scores | OK | Rolling | History-dependent | **Yes** — trend (up/down/flat) |
| `first_seen_at` | When the relationship first appeared | High | Immutable once set | History-dependent, stable | **Yes** — relationship tenure |
| `last_seen_at` / `last_analysis_at` | Most-recent interaction / analysis | High | Updates per run | Snapshot | **Yes** — recency / lapse detection |
| `confidence` | Heuristic certainty of the score | Medium | Medium | Snapshot | As a **gate/threshold** only |
| `algorithm_version` | Scoring version tag | n/a | n/a | n/a | Meta — versioning, not a feature |

*What `score` actually means (from `gmail.ts`):* a 0–100 composite of human-name, two-way, recency, thread count, reply depth, minus marketing/transactional penalties, scaled by confidence. It is a **relationship-importance** heuristic, not an intent or sentiment measure.

---

## 2. `topic_memory` — recurring subjects

| Signal | Meaning | Data quality | Stability | Recomputability | Suitable for deterministic Intent? |
|---|---|---|---|---|---|
| `topic_key` | Normalized lowercase subject key | **Low–Medium** — lexical/subject-line derived, semantically coarse | Medium | Snapshot per run | Yes, but **coarse** — keys ≠ concepts |
| `topic_display` | Pretty form, first-write wins | Medium | High | Snapshot | Label only |
| `total_occurrences` | # runs the topic appeared | Medium | Monotonic ↑ | History/run-dependent | **Yes** — focus persistence |
| `last_thread_count` | Thread volume in most recent run | Medium | Low | Snapshot | Weak |
| `first_seen_at` / `last_seen_at` | Topic tenure / recency | High | Stable / updates | Snapshot | **Yes** — sustained vs stale focus |

*Caveat:* topics are lexical clusters off subject lines, not entities or projects. "Sustained focus on a topic" is supportable; "the owner is raising a round" is **not** reliably detectable here.

---

## 3. `relationship_weekly_buckets` — weekly interaction time-series

| Signal | Meaning | Data quality | Stability | Recomputability | Suitable for deterministic Intent? |
|---|---|---|---|---|---|
| `week_start` | Monday of ISO week | High | Immutable | Yes | **Yes** — the only real time axis |
| `thread_count` | Threads with person that week (GREATEST upsert) | Medium — non-decreasing within week | Stable once week closes | History-accumulated | **Yes (best substrate)** — cadence/trend |
| `message_count` | Messages that week | Medium | Stable once closed | History-accumulated | **Yes** — volume rhythm |
| `two_way` | Any bidirectional exchange that week (OR-accumulated) | Good — boolean reciprocity | Stable once closed | History-accumulated | **Yes** — weekly reciprocity |

**This is the richest and cleanest deterministic substrate in the system** — a genuine per-person, per-week time-series. It is the right place for Intent to compute its *own* `as_of`-pinned temporal features (recency, regularity, decay, trend) rather than trusting time-relative values frozen into identity facets. **Limitation: weekly granularity only** — no day-of-week, no time-of-day.

---

## 4. `decision_memory` — recurring unresolved action threads

| Signal | Meaning | Data quality | Stability | Recomputability | Suitable for deterministic Intent? |
|---|---|---|---|---|---|
| `thread_id` | Stable Gmail thread key | High | Immutable | Yes | Yes — keying |
| `thread_subject` | Display subject | Medium | Stable | Snapshot | Label only |
| `from_name` | Sender name | Medium | Medium | Snapshot | Weak |
| `from_email` | Sender email — **nullable** | Medium (often null) | Medium | Snapshot | Weak |
| `times_seen` | # runs this thread surfaced as a "decision" | Medium — lingering proxy | Monotonic ↑ | History/run-dependent | **Yes** — backlog persistence |
| `last_score` | Latest urgency-ish score | Volatile | Low | Snapshot | Weak |
| `is_resolved` / `resolved_at` | Resolution state | **Effectively dead — "not implemented in V1 UI," always false** | n/a | n/a | **No** — no completion signal exists |
| `first_seen_at` / `last_seen_at` | Decision age | High | Stable | History-dependent | **Yes** — backlog age |

*Two important flags:* (1) `decision_memory` here is **not** the future Decisions architecture layer — it is "email threads whose subject matches a `DECISION_RX` keyword regex (decision/approval/deadline/asap…)." It is a coarse keyword-detected backlog signal, and is correctly **independent** from the planned Decisions layer (a naming collision worth tracking). (2) Because `is_resolved` is never set, this store can observe *accumulation* but never *closure* — any "follow-through" intent is impossible until resolution is wired.

---

## 5. `identity_profile` — denormalized per-owner snapshot

| Signal | Meaning | Data quality | Stability | Recomputability | Suitable for deterministic Intent? |
|---|---|---|---|---|---|
| `summary` (jsonb) | headline, top 3 relationships, top 3 topics, communication{}, decisionBehavior{}, engagement{}, facetCount | Good — deterministic rollup | Medium (daily refresh) | **Fully recomputable** (pure from V1) | Usable, but it is derived-of-derived — Intent should prefer facets/raw |
| `confidence` | Overall identity confidence | Medium | Medium | Recomputable | Gate only |
| `source_signature` | SHA-1 of V1 inputs **+ UTC day** | High | Changes ≥ daily | Deterministic | **Cadence anchor** for Intent (see §9) |
| `version` | `IDENTITY_ALGORITHM_VERSION` | n/a | n/a | n/a | Meta |

*Note:* `source_signature` deliberately includes the UTC day, so identity recomputes **at most once per day per owner** even on a quiet inbox. Intent's cadence should chain off this.

---

## 6. `identity_facet` — normalized derived substrate (the primary Intent input)

This is the cleanest, weighted, evidence-bearing layer — already a deterministic projection of V1. Five `facet_type`s exist today:

| `facet_type` | Grain | `value` fields | Suitability for Intent |
|---|---|---|---|
| `key_relationship` | per person | `avgScore, lastScore, twoWayCount, totalThreads, totalMessages, trend(up/down/flat), activeWeeks, decaying(bool)` | **Excellent** — relationship investment, cooling/lapse |
| `topic_affinity` | per topic | `totalOccurrences, lastThreadCount, recencyDays` | **Good** — focus/interest (bounded by topic quality) |
| `communication_pattern` | aggregate | `activeContacts, twoWayRatio, concentration, avgRelationshipDepth` | **Excellent** — interaction style |
| `decision_behavior` | aggregate | `openDecisionCount, avgTimesSeen, maxTimesSeen, oldestOpenDays, backlogPressure` | **Medium** — backlog only (no closure signal) |
| `engagement_rhythm` | aggregate | `weeksObserved, activeWeeksRatio, trend, latestWeekThreads` | **Good** — tempo/cadence |

Each facet also carries `weight` (0–1), `confidence`, `evidence` (provenance), `first_observed_at`, `last_computed_at`. **Determinism caveat:** the time-relative fields (`decaying`, `recencyDays`, `oldestOpenDays`, `trend`) are computed against wall-clock `now` at identity-compute time and *frozen* into the jsonb. Intent should treat these as valid **as-of identity's last compute**, or — preferably — recompute its own temporal features from `relationship_weekly_buckets` against an explicit pinned `as_of`. This keeps Intent's determinism crisp and independent of identity's refresh timing.

---

## Proposal 1 — Which features should feed Intent V1

Use the **facet layer as primary** (already clean, weighted, evidence-bearing) and **buckets as the time substrate**, with raw `person_memory`/`topic_memory` as supporting detail. Priority order:

1. **`relationship_weekly_buckets`** — compute Intent's own `as_of`-pinned temporal features: recency, regularity, decay, slope, per-person and aggregate. *The temporal backbone.*
2. **`identity_facet: key_relationship`** — `avgScore`, `twoWayCount`, `trend`, `decaying`, `activeWeeks`, depth → relationship orientation.
3. **`identity_facet: communication_pattern`** — `twoWayRatio`, `concentration`, `avgRelationshipDepth` → interaction style.
4. **`identity_facet: topic_affinity`** — `totalOccurrences`, `recencyDays` → focus persistence.
5. **`identity_facet: engagement_rhythm`** — `activeWeeksRatio`, `trend`, `latestWeekThreads` → tempo.
6. **`person_memory`** — `avg_score`, `score_samples`, `first_seen_at`, `last_seen_at` → tenure and smoothed strength (use raw if you want to bypass facet capping).
7. **`topic_memory`** — `total_occurrences`, `first/last_seen_at` → topic persistence.
8. **`decision_memory` / `decision_behavior`** — `times_seen`, `oldestOpenDays`, `backlogPressure` → backlog, **used cautiously** (no closure signal).

**Explicitly avoid as load-bearing inputs:** `last_score` alone (volatile), `is_resolved` (dead), topic semantics treated as precise, and any inference that volume == desire.

---

## Proposal 2 — Candidate intents supportable immediately

These are real, deterministic, and grounded in existing signals:

- **"Actively investing in relationship X"** *(toward)* — `key_relationship` high `avgScore` + `twoWayCount` + recent buckets. **Strong.**
- **"Relationship X is cooling / at risk of lapse"** *(attention/away)* — `decaying` flag or previously-high `avgScore` with no bucket activity in N weeks. **Strong — the standout V1 intent.**
- **"Reciprocity-oriented vs one-way communicator"** — `communication_pattern.twoWayRatio`. **Strong.**
- **"Attention concentrated on a few contacts vs distributed"** — `concentration`. **Strong.**
- **"Engagement ramping up / winding down"** *(tempo)* — `engagement_rhythm.trend` + `activeWeeksRatio`. **Strong.**
- **"Sustained focus on topic T"** *(toward)* — `topic_affinity` high `totalOccurrences` + low `recencyDays`. **Medium-strong** (bounded by topic quality).
- **"Tends toward deep vs transactional relationships"** — `avgRelationshipDepth` (messages/thread). **Medium.**
- **"Maintains long-tenured core relationships"** — `first_seen_at` tenure + sustained `avgScore`. **Medium.**
- **"Carrying a decision/response backlog"** *(away — pressure to clear)* — `backlogPressure` + `oldestOpenDays`. **Medium** (keyword-based, accumulation only).

A defensible **starter catalog of ~7 strong/medium intents** exists on the current surface — enough to ship a meaningful Intent V1.

---

## Proposal 3 — Candidate intents impossible or weak today

Blocked by missing signals — important to declare so the catalog isn't over-scoped:

- **Time-of-day / day-of-week intents** (e.g. *"protects deep-work mornings"*, the flagship example in the architecture docs) — **IMPOSSIBLE.** Buckets are weekly; there is no intra-week resolution and no calendar.
- **Explicit goals / projects / campaigns** (*"raising a seed round," "hiring"*) — **IMPOSSIBLE/WEAK.** Topics are lexical subject clusters; no entities, no project semantics.
- **Sentiment / tone / how the owner feels about a contact** — **IMPOSSIBLE.** No message content captured, only counts and scores.
- **Aversions** (*"wants fewer meetings," "reduce low-value commitments"*) — **WEAK/IMPOSSIBLE.** No meeting data, no record of what the owner declines, no value notion beyond score.
- **Responsiveness / turnaround** (*"replies fast to VIPs"*) — **WEAK.** No reply-latency is persisted; `two_way` is a weekly boolean with no timing.
- **Follow-through / closure behavior** (*"closes loops vs lets things linger"*) — **IMPOSSIBLE.** `is_resolved` is never set, so only accumulation is observable.
- **Initiation vs reactivity** (*"owner initiates with X"*) — **WEAK.** `two_way` is boolean; inbound/outbound magnitude isn't separated.
- **Goal/outcome orientation** — **IMPOSSIBLE.** No outcomes are recorded; the Memory→…→Memory loop isn't yet carrying results.
- **Anything beyond email** — **IMPOSSIBLE.** Single-channel.

**Deepest semantic limitation:** Memory captures *volume and recency*, not *desire or direction*. Every "toward/away" polarity in V1 is inferred from behavioral proxy, not stated intent — so V1 intents should be framed as *behaviorally-revealed orientation* and carry honest confidence.

---

## Proposal 4 — Does Memory V1 need additive enhancements before Intent?

**No enhancement is strictly required to start.** Intent V1 can ship on the existing surface with the ~7-intent starter catalog (Proposal 2). Recommendation: **build Intent V1 now on the current surface**, and queue the following **additive, deterministic, no-LLM** Memory enhancements to grow the catalog in V1.x without schema breakage (same additive pattern as the identity migration):

High-value additive signals, by leverage:

1. **Reply-latency / responsiveness per person** (median response time, reply rate). Unlocks responsiveness intents and is a strong, honest proxy for *prioritization* — closer to true intent than raw volume. Timestamps already exist in Gmail analysis; they're just not persisted.
2. **Inbound vs outbound counts per person/week** (directionality magnitude, not just boolean `two_way`). Unlocks *initiation vs reactive* intents.
3. **Wire `is_resolved` (+ resolution latency).** Brings `decision_memory` to life and unlocks *follow-through/closure* intents. Currently the cheapest dead signal to revive.
4. **Day-of-week (and, if feasible, time-of-day) granularity in buckets.** Unlocks rhythm / protect-time intents — the flagship example. Bigger lift; defer if costly.
5. **Topic↔person linkage / topic provenance.** Unlocks *"collaborates with X on T."*

None are blockers. All are additive and LLM-free, consistent with the deterministic V1 architecture.

Two non-schema prerequisites to document (not blockers):

- **Pin Intent's own `as_of` and compute temporal features from buckets**, rather than depending on facet-frozen `recencyDays`/`decaying`. Keeps Intent determinism independent of identity refresh timing.
- **Document run-frequency sensitivity** of the EMA/counter signals; prefer bucket-derived, time-pinned features where semantic clarity matters.

---

## Verdict

The deterministic Intent V1 architecture is **viable on the current Memory surface**, but its expressiveness is real and bounded: a credible **~7-intent starter catalog** (relationship investment, cooling/lapse, reciprocity, concentration, topic focus, tempo, backlog) is supportable today, all grounded in `identity_facet` + `relationship_weekly_buckets`. The most evocative intents from the architecture docs — protect-time, explicit goals, responsiveness, follow-through — are **not** supportable yet, and should be explicitly deferred rather than faked. The richest, cleanest substrate is the weekly buckets (true time-series) and the five identity facets (clean, weighted, evidence-bearing); the weakest are `topic_memory` semantics and the entirely-dead `decision_memory.is_resolved`.

**Recommended path:** ship Intent V1 on the existing surface with the bounded catalog, framed as behaviorally-revealed orientation with honest confidence; queue four/five additive, LLM-free Memory enhancements (responsiveness, in/out directionality, resolution capture, finer time granularity, topic↔person links) to expand the catalog in V1.x.

## Blockers / prerequisites before Intent implementation

1. **None hard.** Intent V1 can proceed on the current surface.
2. **Decide the catalog scope against this audit** — cap the V1 Intent Definition Registry to the supportable ~7; do not register protect-time / goal / follow-through intents yet.
3. **Pin Intent's `as_of`** and source temporal features from `relationship_weekly_buckets`, not from facet-frozen time fields.
4. **Acknowledge run-frequency sensitivity** of EMA/counter signals in the Registry's confidence model.
5. *(If responsiveness/closure intents are wanted in V1 rather than V1.x)* — wire the additive signals in Proposal 4 first; otherwise defer.
