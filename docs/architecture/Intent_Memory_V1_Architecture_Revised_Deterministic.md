# Intent Memory V1 — Revised Architecture (Fully Deterministic, No LLM)

**Status:** Redesign review. Architecture only — no implementation.
**Supersedes (for V1 scope):** `Intent_Memory_V1_Architecture.md` §4, §3, §9 where they assumed an LLM extraction stage.
**Baseline:** Production commit `7b178bb`.
**Layer position (unchanged):** Memory → Identity → **Intent** → Decisions → Agent → Digital Self.

---

## 0. What changed and why

The first proposal carried an LLM signal-extraction stage and absorbed its risk through a content-addressed cache and version pinning. That bought open-vocabulary expressiveness at the cost of: a nondeterministic stage in the core, an extraction cache as critical infra, an `extraction_version` axis, and — the worst of it — **intent-identity churn (R2)**, where emergent clusters split or merge across recomputes and quietly break recomputability.

This revision removes the LLM from V1 entirely. Intents become a **closed, registered catalog** derived from Memory + Identity by **deterministic computation only**. The single biggest consequence: the hardest correctness risk in the original (R2) **disappears**, because intent identities are now constants from a versioned registry rather than emergent clusters.

The long-term Digital Self path is fully preserved — the LLM doesn't vanish from the vision, it moves to V2+ as an *additive* stage that writes through the *same* contract (§8).

---

## 1. The core shift: open-vocabulary → registered catalog

Without an LLM you cannot freely discover arbitrary natural-language intents. So Intent V1 supports a **closed vocabulary of intent definitions** — a curated catalog where each intent concept is a registered, inspectable, deterministic detector.

This introduces one new system-level (not per-owner) artifact:

### The Intent Definition Registry

A versioned, code/config-level catalog — shared across all owners — that **replaces the LLM**. Each entry:

| Field | Purpose |
|---|---|
| `intent_key` | Stable constant identity of the concept (e.g. `protect_deep_work_mornings`). |
| `type` | `enduring` \| `active`. |
| `feature_inputs` | Which deterministic features from Memory + Identity this intent reads. |
| `predicate` | Deterministic activation rule over features → active? |
| `salience_fn` | Deterministic salience `[0..1]` from features + pinned `as_of` (includes decay). |
| `confidence_fn` | Deterministic certainty from evidence count/coverage. |
| `horizon` | `persistent` \| `bounded`. |
| `definition_version` | Registry version that introduced/changed this definition. |

The Registry is the entire "intelligence" of V1: deterministic, human-readable, auditable, version-pinned, identical for every owner. `intent_key` is now a registry constant — **R2 is structurally eliminated.**

---

## 2. Relationship between Memory, Identity, and Intent (unchanged, now sharper)

```
Memory   → "what happened"   (substrate; ideally carries structured features)
Identity → "who"             (derived, recomputable facets)
Intent   → "toward what"     (deterministic projection of features over the Registry)
```

Derivation stays strictly downward and acyclic. Intent reads Identity as a stabilizing prior and Memory as evidence, and **never writes back**. The new dependency to make explicit: **deterministic detection quality is bounded by how structured Memory's feature surface is** (§9, B2). Free-text-only memories yield weak signals; structured tags/events/relationships yield strong ones.

---

## 3. Schema proposal (simplified: three stores → two)

Constraint #4 asked whether `intent_versions` is truly needed in V1. **Conclusion: it is not. Drop it.** `intent_current` + `intent_evidence` is sufficient. Reasoning in §3.3.

### 3.1 `intent_current` — materialized current state (one active row per intent per owner)

| Field | Purpose |
|---|---|
| `intent_id` | Surrogate key. |
| `owner_uuid` | Owner scope (partition key). |
| `intent_key` | **Registry constant** — deterministic concept identity. No clustering, no churn. |
| `type` | `enduring` \| `active`. |
| `statement` | Human-readable description (templated from the definition + features — deterministic). |
| `polarity` | `toward` \| `away`. |
| `salience` | Deterministic, decayed against pinned `as_of`. |
| `confidence` | Deterministic from evidence. |
| `horizon` | `persistent` \| `bounded(valid_to)`. |
| `status` | `active` \| `dormant` \| `retired`. |
| `definition_version` | Registry version used. |
| `derivation_version` | Computation engine version. |
| `content_hash` | Drift detection + idempotency. |
| `as_of` | Pinned timestamp salience/decay computed against. |
| `valid_from` / `valid_to` | Temporal validity. |
| `last_recomputed_at` | Bookkeeping. |

Note what's gone vs the original: no `extraction_version`, no `supersedes`/`superseded_by` lineage (lineage existed to track cluster drift, which no longer happens).

### 3.2 `intent_evidence` — provenance link layer (kept)

`(intent_id, source_type, source_id, contribution)` where `source_type ∈ {memory, identity_facet, feature}`. This is the explainability backbone: every intent traces to explicit features and the registry rule that fired. Also drives **targeted invalidation** on Memory deletion / right-to-be-forgotten.

### 3.3 Why `intent_versions` is removed in V1

`intent_versions` existed to do two jobs. Both are now served more cheaply:

1. **Migration safety (shadow recompute-and-compare).** Because Intent is now a *pure function* of `(Memory, Identity, Registry_version, as_of)` with **no nondeterministic stage**, you don't compare against stored history — you compare a fresh recompute under the new `definition_version` against a fresh recompute under the retained old one. The old definitions are version-pinned in the Registry; reproduction is exact. Stored history is redundant.

2. **Point-in-time "what did we believe on date X."** Reconstructable by recomputing with `as_of = X`, *provided* Memory is retained (it is — substrate) and Identity is recomputable to `as_of` (it is — Identity V1 is deterministic/recomputable). So history is *derivable*, not something that must be *stored*.

**What you give up by dropping it:** cheap point-in-time reconstruction *without* a recompute, and a tamper-evident immutable audit log. Neither is a V1 requirement. Mitigation already in `intent_current`: `content_hash` + `definition_version` + `derivation_version` + `last_recomputed_at` give drift detection and provenance without history. If compliance later demands an immutable trail, reintroduce a lean append-only `intent_audit` in V2 — additively, no schema break.

---

## 4. Computation model (single deterministic stage)

Intent is one pure function:

```
Intent_state = g(Memory_snapshot, Identity_snapshot, Registry_version, as_of)
```

No model, no temperature/seed, no cache to replay, no pinning gymnastics. Two conceptual sub-steps, both deterministic:

**Step 1 — Feature derivation.** Aggregate Memory + Identity into an owner **feature vector**: counts, frequencies, recencies, ratios, presence of structured tags/event-types, identity facets, relationship metrics. Aggregation is **order-independent** (sums, maxes, recency) so incremental and batch converge identically.

**Step 2 — Intent evaluation.** For each definition in `Registry@version`: evaluate `predicate(features)` → active?, `salience_fn(features, as_of)`, `confidence_fn(evidence)`. Emit `intent_current` rows + `intent_evidence` links.

**Guarantees:**
- **Fully deterministic.** Same inputs + versions → byte-identical output. No exceptions, no extraction layer to qualify.
- **Recomputable.** Full recompute reproduces state exactly; no cache dependency.
- **Incremental == batch.** Order-independent feature aggregation guarantees convergence.
- **Decay** stays deterministic by always computing against an explicit pinned `as_of`.

---

## 5. Update cadence

Same hybrid as before — event-debounced recompute + nightly decay refresh, with **lazy decay computed at read** from `(snapshot, as_of)`. But because recompute is now *cheap* (no LLM cost), the scaling and migration stories improve sharply: you can recompute aggressively, even on-read for thin owners, and shadow-recompute whole cohorts during migration without cost concern.

---

## 6. Retrieval model

Read-only serving surface unchanged in shape:

- `get_active_intents(owner, as_of, filters)` → salience-ranked set, lazy-decayed.
- `get_intent(intent_id, with_provenance=true)` → intent + evidence + which predicate fired (explainability).
- `match_intents(owner, context)` → relevant intents for a context.

New simplification: because the vocabulary is closed, `match_intents` in V1 can be a **static, deterministic mapping** (context-type → relevant `intent_key`s) rather than embeddings. So even retrieval relevance is deterministic in V1. Embedding-based relevance is deferred to V2.

---

## 7. How Intent differs from Tasks, Goals, Identity, Decisions (unchanged)

Identity = who · **Intent = toward what** · Goal = declared target · Decision = chosen now · Task = doing. Intent remains derived/latent/standing; Decisions consume it; the acyclic ordering holds. (Full table in the original doc, §7 — still valid.)

---

## 8. Future evolution toward Decisions and Agent (preserved)

The long-term architecture is intact, and the removal of the LLM costs it nothing:

- **The Decisions-facing contract is `intent_current`, and it is identical** whether an intent was produced by a registry rule today or by a model later. Decisions read intents; they don't care how they were derived.
- **Loop still closes only through Memory.** Decisions/Agent write Memory; Intent re-derives. Acyclic, deterministic, recomputable — unchanged invariant.
- **The LLM returns additively in V2+,** not as a replacement for the deterministic core but as an *optional enrichment stage* that proposes new candidate intent definitions (offline, into the Registry) or populates open-vocabulary intents **through the same two stores**. The deterministic engine stays the floor; the model becomes a ceiling you raise later without a migration break.

So V1 ships the contract and the loop; V2 raises expressiveness behind the same interface.

---

## 9. Risks, blockers, migration concerns (re-evaluated)

**Eliminated:** R1 (determinism vs LLM) — gone, no LLM. R2 (intent-key churn) — gone, keys are registry constants. Extraction-cache infra and `extraction_version` — gone.

**Remaining / new:**

- **B1 — Coverage is bounded by the catalog.** Only intents someone has defined can exist. *Mitigation:* treat the Registry as a curated, governed, evolvable asset; ship a deliberate starter catalog; expand over time / via V2 LLM proposals.
- **B2 — Detection quality is bounded by Memory's structured surface.** Deterministic rules can't read unstructured nuance. *Mitigation / gating dependency:* audit what structured features Memory V1 actually exposes *before* scoping the catalog — this is the real gate on V1 ambition.
- **R3 — Time-dependence (decay).** Unchanged: pin `as_of`, never wall-clock.
- **R5 — Authoring burden / catalog governance.** Humans now own taxonomy and threshold tuning. *Mitigation:* registry versioning + governance process; thresholds are inspectable and testable (a determinism upside).
- **R6 — Privacy / forgetting.** *Improved:* no owner Memory leaves the system to a model; deletion propagates via `intent_evidence` to targeted re-derivation.
- **R7 — Coupling pressure** (Decisions writing Intent). Unchanged: enforce write-back only through Memory.

**Migration concerns:** simpler than before. Pure function + version-pinned Registry = exact reproducibility, which is precisely what justifies dropping `intent_versions`. Migrate by shadow-recompute-and-compare across `definition_version`/`derivation_version`; cut over on match.

---

## What is gained by removing the LLM extraction stage

- **Total determinism** — no model pinning, no temperature/seed fragility, no extraction cache, no replay semantics.
- **The hardest risk (R2 intent-identity churn) is structurally eliminated** — keys are constants.
- **Simplification** — one pure stage instead of two; two stores instead of three; no content-addressed cache as critical infra.
- **Cheap recompute** — better scale to large user counts, trivial migrations, lower cost.
- **Stronger explainability** — "why" is a human-readable predicate over explicit features, not a model's latent judgment.
- **Better privacy** — no Memory sent to an external model.
- **Migration safety** — exact reproducibility justifies dropping stored history.

## What is lost

- **Expressiveness / coverage** — only pre-defined intents can exist; no open-vocabulary discovery of novel or idiosyncratic intents. The system can't surprise you.
- **Nuance** — rules over structured features are coarser than an LLM reading sentiment, implication, and context.
- **Hard dependency on Memory structure** — quality is capped by how feature-rich Memory is; free text alone yields weak intents.
- **Human authoring burden** — someone must design, tune, and maintain the catalog; taxonomy curation is ongoing.
- **Catalog cold-start** — early V1 may recognize only a handful of intent types until the Registry grows.

**Net:** for V1, determinism + simplicity + explainability + migration safety clearly outweigh expressiveness — and because the Decisions-facing contract is unchanged, the LLM can be reintroduced additively in V2 with zero architectural debt. Removing it now is the right call.

---

## Architecture verdict

**Stronger greenlight than the original.** Removing the LLM converts Intent V1 from "deterministic *if* we carefully cache a nondeterministic stage" into "deterministic by construction." Every original invariant holds, the worst risk is gone, the schema shrinks, and the long-term Digital Self path is fully preserved behind an unchanged contract. Proceed.

## Recommended V1 scope

- Owner-level Intent, **enduring + active** types only.
- **Single deterministic computation stage** over a versioned **Intent Definition Registry** (no LLM).
- **Two stores:** `intent_current` + `intent_evidence`. **No `intent_versions`.**
- Cadence: event-debounced recompute + nightly decay; **lazy decay at read**.
- Read-only retrieval; `match_intents` via static deterministic mapping.
- Full recomputability + explainability (predicate + evidence).
- No Decisions/Agent consumers wired — UI/explainability only.

## Intentionally deferred to V2+

- LLM-based enrichment / open-vocabulary intent discovery (additive, same contract).
- `intent_audit` immutable log (only if compliance requires).
- Situational / ephemeral intents.
- Embedding-based `match_intents` relevance.
- Intent conflict-resolution engine; expressed-vs-predicted; intent graph; multi-horizon planning.

## Blockers before implementation

1. **Audit Memory V1's structured feature surface** — this gates how expressive the deterministic catalog can be (B2). Likely the real critical-path item.
2. **Define the Intent Definition Registry** — schema, versioning, authoring/governance, threshold-tuning process (replaces the old "pin extraction" blocker).
3. **Confirm Identity V1 recomputes to an `as_of`** — required to justify dropping `intent_versions` and to support point-in-time recompute.
4. **Lock the `as_of` / decay determinism rule.**
5. **Freeze `intent_current` as the Decisions-facing contract** and confirm it is identical to the would-be LLM-era schema (it is).
