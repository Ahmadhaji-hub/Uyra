# Intent Memory V1 — Architecture Proposal

**Status:** Architecture review only. No code, no implementation, no migrations.
**Baseline:** Production commit `7b178bb`.
**Layer position:** Memory → Identity → **Intent** → Decisions → Agent → Digital Self.
**Author context:** Owner-level, deterministic, derived, recomputable, off the hot path — consistent with the Identity Memory V1 pattern.

---

## 0. Design stance

Intent Memory must be the *directional* projection of the owner. It inherits every invariant that made Identity V1 safe — derived, deterministic, recomputable, owner-scoped, off the hot path — and adds one new architectural obligation: it is the **interface the future Decisions layer will consume**, so its output contract must be designed now to survive untouched into the Decisions and Agent eras.

The single most important invariant in this whole proposal: **the loop closes only through Memory.** Decisions and Agent never write Intent. They write Memory. Intent re-derives from Memory. This is what keeps the entire stack acyclic, deterministic, and recomputable even after the system becomes a full feedback loop.

---

## 1. What Intent actually represents in Uyra

Identity answers **"who is the owner"** — stable, descriptive, slow-moving traits and attributes.
Intent answers **"toward what is the owner oriented"** — the persistent, derived directional model of what the owner wants, avoids, optimizes for, and is pulling toward.

Intent is **standing disposition-to-act**, not action. Concretely, an Intent object is a derived statement like:

- *"Protects deep-work mornings; resists meetings before noon."* (enduring preference)
- *"Is actively raising a seed round."* (bounded active campaign)
- *"Optimizes long-term relationships over transactional wins."* (value-like orientation)
- *"Wants to reduce low-signal commitments."* (aversion / directional pressure)

Each Intent is latent and inferred — never a task the owner typed, never a row in a tracker. It is the motivational substrate that *explains and constrains* future Decisions without being a Decision itself.

Intent has internal temporal structure:

- **Enduring** — value-like, slow, decays very slowly. Closest neighbor to Identity.
- **Active** — bounded campaigns with a horizon; decay meaningfully once evidence stops.
- **Situational** — short-lived directional pressure. *(Deferred to V2 — see §10.)*

---

## 2. Relationship between Memory, Identity, and Intent

```
Memory     = substrate   → "what happened"     (events, facts, episodes, interactions)
Identity   = derived self → "who"              (traits, attributes, relationships, descriptors)
Intent     = derived dir. → "toward what"      (wants, aversions, orientations, campaigns)
```

**Derivation is strictly downward and acyclic:**

```
Memory ──▶ Identity ──▶ Intent
   │                       ▲
   └───────────────────────┘   (Intent also reads Memory directly as evidence)
```

- **Memory** is the evidence of direction (what the owner actually did, said, chose).
- **Identity** is a *stabilizing prior* — it constrains the plausible space of intents (e.g. an identity facet "founder, early-stage" makes "raising a round" a high-prior intent).
- **Intent** is a pure function of the two. It **never writes back** into Memory or Identity. No cycles. This is the precondition for recomputability.

Intent sits off the hot path, exactly as Identity does. It is a materialized projection, refreshed asynchronously, served read-only.

---

## 3. Schema proposal

Three logical stores, mirroring the derived-projection pattern: a materialized current view, an append-only version history (migration safety + audit + explainability), and a provenance/evidence link layer.

### 3.1 `intent_current` — materialized current state (one active row per intent per owner)

| Field | Purpose |
|---|---|
| `intent_id` | Stable surrogate key. |
| `owner_uuid` | Owner scope (partition key). |
| `intent_key` | **Canonical semantic slug** — deterministic identity of the *concept*, so the same underlying orientation maps to the same row across recomputes. Stability of this key is the crux of the whole design (see §9). |
| `type` | `enduring` \| `active` \| `situational(V2)`. |
| `statement` | Human-readable, explainable description. |
| `polarity` | `toward` \| `away`. |
| `salience` | Confidence-weighted strength `[0..1]`, time-decayed (computed against a pinned `as_of`). |
| `confidence` | Evidence-backed certainty `[0..1]`. |
| `horizon` | `persistent` \| `bounded(valid_to)` \| `episodic`. |
| `status` | `active` \| `dormant` \| `retired` \| `superseded`. |
| `evidence_window` | Time range of Memory considered. |
| `derivation_version` | Computation/version that produced this row. |
| `extraction_version` | Version of the (cached) signal-extraction stage. |
| `content_hash` | Hash of the semantic payload — idempotency + change detection. |
| `as_of` | Pinned timestamp the salience/decay was computed against. |
| `valid_from` / `valid_to` | Temporal validity. |
| `supersedes` / `superseded_by` | Lineage across recomputes. |
| `created_at` / `last_recomputed_at` | Bookkeeping. |

### 3.2 `intent_versions` — append-only history

Immutable snapshots of every materialization, keyed by `(intent_id, derivation_version, as_of)`. Enables: recompute-and-compare migrations, point-in-time explainability, and rollback without destructive overwrite.

### 3.3 `intent_evidence` — provenance link layer

`(intent_id, source_type, source_id, weight)` where `source_type ∈ {memory, identity_facet, signal}`. This is what makes Intent **explainable** ("this intent exists because of memories X, Y and identity facet Z") and what enables **targeted invalidation** on Memory deletion / right-to-be-forgotten.

---

## 4. Computation model

Intent is a **pure function**:

```
Intent_state = f(Memory_snapshot, Identity_snapshot, derivation_version, params, as_of)
```

Determinism requires no wall-clock nondeterminism, no random sampling, stable ordering, and stable tie-breaking inside `f`. The hard tension is that high-quality intent inference wants an LLM, and LLMs are nondeterministic. **Resolution: split computation into two stages and make only the cheap stage live in the deterministic core.**

### Stage A — Signal Extraction (nondeterministic, cached, versioned)

From Memory + Identity, produce **intent-signals**: candidate directional observations. May use a model. Output is **content-addressed and cached**, tagged with `extraction_version`. Recompute *replays the cached extraction* rather than re-calling the model — so recompute is deterministic even though extraction itself was not. Re-extraction happens only on (a) new Memory deltas, or (b) an `extraction_version` bump.

### Stage B — Intent Synthesis (pure, deterministic, replayable)

Deterministic aggregation of signals into Intent objects: cluster signals by `intent_key`, score salience/confidence, apply decay against pinned `as_of`, resolve conflicts, assign status. Same inputs + same versions → byte-identical output.

**Recomputability guarantees:**

- **Full recompute** from Memory + Identity reproduces the identical Intent set (given pinned versions).
- **Incremental recompute** on a Memory delta must converge to the *same* state a full recompute would produce — i.e. Stage B aggregation is **order-independent and idempotent**. This is a design constraint, not a hope: salience/clustering must be commutative over evidence.

**Decay is time-dependent**, so it is the one thing that changes without new evidence. It is kept deterministic by always computing against an explicit pinned `as_of`, never continuous wall-clock.

---

## 5. Update cadence

Off the hot path, hybrid trigger model:

1. **Event-debounced recompute** — on Memory/Identity change events, per owner, debounced (e.g. coalesce a burst into one job). Keeps Intent fresh after meaningful new evidence.
2. **Scheduled batch refresh** — periodic (e.g. nightly) full/partial materialization to apply time-decay and retire stale active intents, since decay is time-driven and won't be triggered by new evidence.
3. **Version-migration recompute** — on `derivation_version` / `extraction_version` bump, recompute and compare (shadow) before cutover.

**Optimization:** materialize *structure* on cadence, but compute salience-decay **lazily at retrieval** from `(last snapshot, as_of)`. This avoids re-materializing every owner nightly just to bump a decay number — important at scale (§9).

---

## 6. Retrieval model

Consumers: the future Decisions layer, the future Agent, explainability/UI, and the owner. Retrieval is **read-side serving** and is deliberately allowed to use heuristics/embeddings *without* contaminating the deterministic core — the stored Intent state is deterministic; ranking for a given query is a serving concern.

Conceptual surface:

- `get_active_intents(owner, as_of, filters)` → salience-ranked intent set, lazy-decayed to `as_of`.
- `get_intent(intent_id, with_provenance=true)` → intent + evidence + scoring breakdown (explainability).
- `match_intents(owner, context)` → intents relevant to a given context/decision. The context→relevance function (e.g. embedding similarity over `statement`) lives **only here**, in the read layer — never in the deterministic synthesis core.

Hard rules: owner-scoped isolation, no cross-owner leakage, provenance available on demand.

---

## 7. How Intent differs from Tasks, Goals, Identity, and Decisions

| Concept | What it is | Relationship to Intent |
|---|---|---|
| **Task** | Concrete, bounded, externally-tracked action item with a completion state. Imperative. | Intent *explains why a task exists* but is never a task. Tasks live in the app/agent domain, not in Intent. |
| **Goal** | An explicit, user-*declared* target, often with a metric/deadline. | A Goal may be the crystallization of an Intent, but Intent is **derived and latent** — it can exist with no declared goal at all. |
| **Identity** | Stable, descriptive "who." Non-directional, slow. | Identity *constrains* Intent (prior). Intent is faster, directional, motivational. |
| **Decision** | A point-in-time choice/judgment (next layer). Situational, instantaneous. | A Decision *consumes* Intent (+ Identity + context) to produce a choice. Intent is **standing**; Decision is **momentary**. Intent must not depend on decision outcomes — that would create a cycle. |

The one-line discriminator: **Identity = who, Intent = toward what, Goal = declared target, Decision = chosen now, Task = doing.**

---

## 8. Future evolution path toward Decisions and Agent

Intent's `intent_current` output schema **is the contract** the Decisions engine will read. Design it stable now.

- **V1 (this proposal):** Intent derived, materialized, served read-only. No live downstream consumer except UI/explainability. Enduring + active types only.
- **Decisions layer:** `decide(context, Identity, Intent) → choice + rationale` where the rationale references specific `intent_id`s. Decisions are situational and never persist into Intent.
- **Agent layer:** executes Decisions, produces actions/outcomes.
- **Closing the loop — the critical invariant:** Decision and Agent outcomes are written **back into Memory as new events**, *not* into Intent. Intent then **re-derives** from the enriched Memory. So the full Digital Self loop —

  ```
  Memory ▶ Identity ▶ Intent ▶ Decisions ▶ Agent ▶ (actions) ▶ Memory ▶ …
  ```

  closes **only through Memory**, keeping every projection (Identity, Intent) a pure derived function forever. The system becomes a feedback loop without any layer ever losing determinism or recomputability.

Later natural extensions: expressed-vs-predicted intent, intent conflict surfacing for Decisions, multi-horizon planning, an intent graph.

---

## 9. Risks, blockers, and migration concerns

**R1 — Determinism vs LLM extraction (highest risk).** If extraction is in the recompute path, recompute is nondeterministic. *Mitigation:* two-stage model (§4) with content-addressed extraction cache + `extraction_version`; recompute replays cache.

**R2 — Intent identity churn.** If extraction wording drifts, the same orientation splits into duplicate intents or merges wrongly across recomputes. This is the subtlest threat to recomputability. *Mitigation:* a rigorously specified canonical `intent_key` / clustering-stability rule, plus supersession lineage. **This needs its own spec before build.**

**R3 — Time-dependence breaking determinism.** Decay changes output without new evidence. *Mitigation:* always pin `as_of`; never use continuous wall-clock inside `f`.

**R4 — Scale.** Per-owner recompute × large user counts, with LLM extraction as the cost driver. *Mitigation:* partition by `owner_uuid`; incremental + debounced recompute; aggressive extraction caching (re-extract only on deltas); lazy decay at read instead of nightly full re-materialization.

**R5 — Over-derivation / hallucinated intent.** Model infers wants that aren't there. *Mitigation:* confidence thresholds, minimum-evidence requirements, conservative defaults, owner-visible explainability, and an owner-correction channel — where corrections enter **as Memory** (or a pinned override layer), never as direct Intent edits, to preserve recomputability.

**R6 — Privacy / forgetting.** Intent is highly sensitive inferred data. *Mitigation:* strict owner isolation; deletion of a Memory must propagate via `intent_evidence` to targeted re-derivation; right-to-be-forgotten verified end-to-end.

**R7 — Coupling pressure.** Future temptation to let Decisions write Intent directly "for speed." *Mitigation:* enforce the acyclic invariant architecturally; the only write-back path is through Memory.

**Migration concerns:** `derivation_version` + append-only `intent_versions` + shadow-recompute-and-compare before cutover; never destructive overwrite; the Intent output schema must be frozen as the Decisions-facing contract before it has any consumer.

---

## Architecture verdict

**Greenlight the design**, contingent on one resolved precondition: the determinism-of-extraction problem must be solved by the two-stage, cache-replayed computation model (§4). With that in place, Intent Memory V1 is fully consistent with the Memory/Identity derived-projection pattern, preserves every existing invariant (deterministic, recomputable, owner-level, off the hot path, migration-safe), and correctly positions Intent as the stable contract for the future Decisions and Agent layers. The acyclic "loop closes only through Memory" principle is the load-bearing idea and it holds.

## Recommended V1 scope

- Owner-level derived Intent, **enduring + active** types only.
- Two-stage computation: cached/versioned signal extraction + pure deterministic synthesis.
- Three-store schema: `intent_current` + append-only `intent_versions` + `intent_evidence` provenance.
- Cadence: event-debounced recompute + nightly decay refresh; **lazy decay at read**.
- Read-only retrieval API (`get_active_intents`, `get_intent` w/ provenance, `match_intents`).
- Full recomputability + explainability (provenance + scoring breakdown).
- **No** Decisions/Agent consumers wired yet — UI/explainability only.

## Intentionally deferred to V2+

- Situational / ephemeral intents.
- Semantic/embedding relevance retrieval tuned for the Decisions engine.
- Intent conflict-resolution engine.
- Expressed-vs-predicted intent distinction.
- Owner override layer (beyond correction-via-Memory).
- Cross-intent graph and multi-horizon planning.
- Real-time / hot-path intent.

## Blockers before implementation

1. **Pin the extraction strategy + caching contract** (model, versioning, content-addressing). Resolves R1.
2. **Specify the canonical `intent_key` / clustering-stability rule.** Resolves R2 — the biggest correctness risk.
3. **Lock the `as_of` / decay determinism rule.** Resolves R3.
4. **Confirm deletion / forgetting propagation** through `intent_evidence`. Resolves R6.
5. **Freeze the `intent_current` output schema** as the Decisions-facing contract before any consumer exists.
