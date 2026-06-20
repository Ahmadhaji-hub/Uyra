# Memory V1.5 — Post-Implementation Architecture Audit

**Phase:** Reply latency + inbound/outbound directionality (decision resolution deferred).
**State:** Implemented, validated, **not committed** (awaiting this audit's approval).
**Baseline:** commit `7b178bb`.

---

## 1. What was implemented

| File | Change |
|---|---|
| `supabase/migrations/003_memory_v15_signals.sql` | **New.** Additive columns: `person_memory` (+`inbound_count`, `outbound_count`, `reply_count`, `avg_reply_latency_sec`, `reply_latency_samples`); `relationship_weekly_buckets` (+`inbound_count`, `outbound_count`). Rollback block included. |
| `types/memory.ts` | New fields on `PersonMemoryRecord` / `WeeklyBucketRecord`; `MEMORY_ALGORITHM_VERSION` 1 → 2. |
| `types/inbox.ts` | `Person` gains run-level `inboundCount`, `outboundCount`, `replyLatenciesSec`. |
| `lib/gmail.ts` | `resolveOwnerIdentities()` via `sendAs.list` (fallback to primary); alias-aware direction + reply-latency pairing; V1 accumulation left on the **primary** identity. |
| `lib/memory-writer.ts` | Persists directionality snapshot, cumulative `reply_count`, reply-latency EMA (strict NULL discipline), samples; monotonic directional bucket counts; `median()` helper. |
| `lib/memory-reader.ts` | `mapPerson`/`mapBucket` read new columns, default-safe for legacy rows. |

Diff scope is exactly these files. **`lib/identity-compute.ts`, all routes, and `decision_memory` are untouched.**

---

## 2. Requirement-by-requirement audit

**Follow the approved architecture — ✅ (with two requirement-strengthening refinements).**
Columns, computation model, cadence touchpoints, and NULL contract match the approved `Memory_V1.5_Implementation_Architecture.md`. Two deliberate refinements that go *beyond* the doc in the conservative direction:
- *Split owner identity.* The doc used one owner set everywhere; the implementation uses the **primary address for all V1 accumulation** and the **alias set only for the new signals**. This guarantees V1 fields can't shift even for aliased owners (see next row).
- *Negative-latency handling.* Rather than clamp skewed deltas to 0, non-physical negatives are **discarded** (chronological sort makes them unreachable anyway), avoiding artificial zero-latency samples. Cap at 14 days retained.

**Preserve Memory V1 behavior — ✅ byte-identical.**
The V1 per-person loop runs on `normalizedUser` (primary) exactly as before; `twoWay`, `messageCount`, `threadIds`, `lastContactTimestamp`, `subjectSamples`, topics, and `needsReply` are unchanged. The one helper swap (`parseDateSafe` → `parseDateStrict(...) ?? Date.now()`) is provably equivalent (empty/NaN → `Date.now()` in both). New signals are computed in a separate additive pass that writes only new fields.

**Preserve Identity behavior — ✅ zero diff.** `lib/identity-compute.ts` has no changes; it reads none of the new columns.

**Keep Identity `source_signature` unchanged — ✅.** `computeSourceSignature` is untouched and still hashes only `avgScore/twoWayCount/totalThreads` (+ topic/bucket/decision/day terms). The identity recompute gate and every facet value are unaffected.

**Additive-only migration — ✅.** `ADD COLUMN IF NOT EXISTS` with defaults/NULL; no constraint, key, index, or RLS changes; `two_way` retained as a superset.

**Migration safety — ✅.** Forward-accruing (no backfill claimed); legacy `version=1` and new `version=2` rows coexist; reader is default-safe (`?? 0` / `?? []` / `?? null`); the `version` distinction separates "never measured" from "measured zero." Rollback is a clean column-drop, restoring exact V1.

**Recomputability — ✅.** New columns are Memory substrate; Identity/Intent remain recomputable from Memory. Not retroactively recomputable from raw mail — identical to every existing V1 accumulator, so no new violation.

**Existing bucket semantics — ✅.** New directional counts use the same in-app `Math.max(prev, current)` monotonic-within-week rule as `thread_count`/`message_count`; `two_way` OR-accumulation unchanged.

---

## 3. Verification performed

- **Type-safety (manual, exhaustive).** Every constructor of the changed types was located: only the reader and `gmail.ts` build them; all other sites (`app/api/memory/inspect`, `identity-compute`) *consume* `MemoryContext` and emit their own DTOs, so no literal is missing a new required field. Field names were cross-checked end-to-end (migration ↔ writer row keys ↔ reader maps ↔ TS records) — all align.
- **Deterministic logic test — 24/24 assertions pass.** A standalone harness mirroring the implemented pure logic validated: simple/owner-initiated/group latency pairing (nearest-preceding attribution), 14-day cap, invalid-`Date` guard, direction attribution, `median()` (incl. empty→null), EMA **NULL discipline** (no decay to 0 on a reply-less run), monotonic bucket `GREATEST`, and samples-only-on-pair-bearing-runs.
- **Identity inertness** confirmed by zero diff on `identity-compute.ts`.
- **Dead code** (`parseDateSafe`) removed; no dangling references repo-wide.

**Compiler gate — now executed (clean source install).** The in-place mount couldn't run the toolchain (unmaterialized `node_modules`, EAGAIN), so the source was copied to local disk and dependencies installed via `npm ci` (222 packages, locked). Results:

- **`npx tsc --noEmit` → PASS (exit 0, zero errors)** — after fixing two type errors found on the first run (see §3a).
- **`next build` → PASS** — `✓ Compiled successfully`, `Linting and checking validity of types` passed, `✓ Generating static pages (17/17)`, build finalized with full route table. No type or build errors.
- Only warning: `⚠ Failed to download the stylesheet for fonts.googleapis.com` — a sandbox network artifact (Google Fonts unreachable here); resolves on real CI/Vercel. Not code-related.

### 3a. Fixes applied during this gate

`tsc` initially reported two `TS2802` errors in `lib/gmail.ts` (320, 337): iterating a `Map` directly is disallowed at the repo's default TS target (no `target` set in `tsconfig.json`). Fixed by wrapping both iterations in `Array.from(...)` — matching the repo's existing convention (`for (… of Array.from(sendersInThread))`). No logic change; the deterministic test remains valid. Re-ran `tsc` → clean, then `next build` → clean.

---

## 4. New blockers and future-impact risks

**Blockers: none.**

**Risks (all non-blocking):**
- *Aliased-owner stray row.* For an owner with send-as aliases, the alias may still appear as a stray V1 `person_memory` row (V1 quirk, preserved) with 0 inbound/outbound. Harmless; affects only aliased owners.
- *`sendAs.list` runtime dependency.* Authorized by the existing `gmail.readonly` scope (verified). On API failure the code degrades to primary-only — aliased owners get a conservative outbound undercount, never a misclassification.
- *Clock skew.* Mitigated by discard-negative + 14-day cap; latencies are approximate by nature.
- *No backfill / sparse start.* New columns populate forward-only; Intent must treat NULL latency as unknown and low `reply_count` as low-confidence.
- *In-app `GREATEST` not race-proof under concurrent runs* — pre-existing; new columns inherit the same deferred DB-side-GREATEST concurrency item, no worse than today.
- *Inspector `schemaVersion`* now reports 2 (it sources `MEMORY_ALGORITHM_VERSION`) — display-only, expected.
- *Dependency advisory (future architecture):* `npm ci` flagged a **security advisory for `next@14.2.5`** (and deprecations for transitive `uuid`/`glob`). Unrelated to this change, but worth scheduling a patch-level Next upgrade.

---

## 5. Final verdict

# ✅ APPROVED WITH FIXES

Both required gates now pass: **`tsc --noEmit` clean (exit 0)** and **`next build` successful (types valid, 17/17 pages)**. The two fixes needed to get there — wrapping two `Map` iterations in `Array.from()` to satisfy the repo's TS target — were applied to the real source (`lib/gmail.ts`), re-verified green, and carry no logic change. The deterministic 24-assertion test still holds.

The implementation is faithful to the approved architecture, strictly additive, and **provably inert to Memory V1 and Identity** (zero `identity-compute` diff, unchanged `source_signature`, byte-identical V1 fields for all owners including aliased ones). Migration safety, recomputability, and bucket semantics are preserved.

**No outstanding fixes remain.** Per instruction, **nothing has been committed** — the code is commit-ready on your go-ahead. The only non-blocking follow-up is a future patch-level `next` upgrade (security advisory, unrelated to V1.5).
