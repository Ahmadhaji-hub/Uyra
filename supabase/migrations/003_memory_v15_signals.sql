-- ─────────────────────────────────────────────────────────────────────────────
-- Memory V1.5 — Reply latency + Inbound/Outbound directionality
-- Migration: 003_memory_v15_signals.sql
--
-- ADDITIVE ONLY. No existing Memory V1 / Identity table is redesigned or re-keyed.
--   · person_memory gains five nullable/defaulted columns (directionality
--     snapshot counts + reply-latency EMA, sample array, and reply pair count).
--   · relationship_weekly_buckets gains two defaulted directional counters,
--     kept monotonic-within-week by the writer (same GREATEST rule as
--     thread_count / message_count).
--
-- These signals are FORWARD-ACCRUING and cannot be backfilled (past Gmail
-- windows are gone). Existing rows therefore legitimately carry 0 / '{}' / NULL
-- until the next analysis run observes them.
--
-- Identity is untouched: identity-compute does not read these columns and
-- computeSourceSignature does not hash them, so the identity recompute gate and
-- every facet value are byte-identical to pre-V1.5. This migration is inert to
-- everything except the future Intent layer.
--
-- NULL contract: avg_reply_latency_sec is NULL = "unknown / never measured",
-- never 0. Readers must not coerce NULL to 0.
--
-- Design notes
--   · All access is service-role only. RLS already enabled on both tables; no
--     policy changes.
--   · No new indexes — new columns are read in existing per-owner scans.
--   · MEMORY_ALGORITHM_VERSION bumps 1 → 2 in app code; version=2 rows are the
--     ones that had the chance to observe these signals.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── person_memory · directionality (latest snapshot) + reply latency ──────────

ALTER TABLE person_memory
  ADD COLUMN IF NOT EXISTS inbound_count          integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_count         integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count            integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_reply_latency_sec  real,                       -- NULL = unknown (never 0)
  ADD COLUMN IF NOT EXISTS reply_latency_samples  integer[] NOT NULL DEFAULT '{}';

-- inbound_count   — messages person→owner, latest-snapshot (mirrors total_messages)
-- outbound_count  — messages owner→person, latest-snapshot
-- reply_count     — cumulative inbound→outbound reply pairs observed (confidence basis)
-- avg_reply_latency_sec — EMA (α=0.3) of reply latency in seconds; NULL until first pair
-- reply_latency_samples — last 10 per-run median latencies (seconds), for trend

-- ── relationship_weekly_buckets · weekly directional time-series ──────────────

ALTER TABLE relationship_weekly_buckets
  ADD COLUMN IF NOT EXISTS inbound_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_count  integer NOT NULL DEFAULT 0;

-- inbound_count / outbound_count — weekly counts, kept non-decreasing within a
-- week by the writer's in-app GREATEST (same convention as thread_count /
-- message_count; the sliding 100-thread window can report fewer on a later
-- same-week run, so counts must never regress).

-- two_way is intentionally LEFT UNCHANGED: directionality is a strict superset
-- (two_way ≡ inbound_count > 0 AND outbound_count > 0), retained for
-- compatibility with every existing reader/writer.

-- ── Rollback (manual) ─────────────────────────────────────────────────────────
-- Fully reversible; restores the exact pre-V1.5 schema with zero loss to any V1
-- signal (the dropped columns are unread by Identity). Mixed version 1/2 rows
-- need no cleanup.
--
--   ALTER TABLE person_memory
--     DROP COLUMN IF EXISTS inbound_count,
--     DROP COLUMN IF EXISTS outbound_count,
--     DROP COLUMN IF EXISTS reply_count,
--     DROP COLUMN IF EXISTS avg_reply_latency_sec,
--     DROP COLUMN IF EXISTS reply_latency_samples;
--
--   ALTER TABLE relationship_weekly_buckets
--     DROP COLUMN IF EXISTS inbound_count,
--     DROP COLUMN IF EXISTS outbound_count;
