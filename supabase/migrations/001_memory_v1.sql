-- ─────────────────────────────────────────────────────────────────────────────
-- Memory Layer V1
-- Migration: 001_memory_v1.sql
--
-- Tables
--   person_memory                — persistent per-person signal profile
--   topic_memory                 — recurring subjects across analysis runs
--   relationship_weekly_buckets  — weekly interaction time-series per person
--   decision_memory              — unresolved decisions / pending approvals
--
-- Design notes
--   · All writes use the server Supabase client (service role key).
--     Row Level Security is enabled as a safety net; no anon-key policies
--     are created — all access is service-role only.
--   · user_id is the user's email from NextAuth (session.user.email).
--   · algorithm_version lets future scoring changes be tracked per-row.
--   · first_seen_at uses DEFAULT now() — never overwritten on upsert.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto for gen_random_uuid() on older Supabase instances
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── person_memory ─────────────────────────────────────────────────────────────
-- One row per (user, person). Persists the running signal profile for each
-- human contact detected across analysis runs.
--
-- avg_score  — exponential moving average (α=0.3), updated in application layer
-- score_samples — last 10 raw scores, kept as context for trend detection
-- two_way_count — number of analysis runs where the relationship was bidirectional
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS person_memory (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL,
  person_email        text        NOT NULL,   -- lowercase, canonical
  person_name         text        NOT NULL,

  -- Interaction counters (latest snapshot — not cumulative sum)
  total_threads       integer     NOT NULL DEFAULT 0,
  total_messages      integer     NOT NULL DEFAULT 0,
  two_way_count       integer     NOT NULL DEFAULT 0,   -- incremented per run where twoWay=true

  -- Score history
  last_score          integer     NOT NULL DEFAULT 0,
  avg_score           real        NOT NULL DEFAULT 0,   -- EMA (α=0.3)
  score_samples       integer[]   NOT NULL DEFAULT '{}', -- last 10 scores

  -- Timestamps
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_analysis_at    timestamptz NOT NULL DEFAULT now(),

  -- Meta
  confidence          integer     NOT NULL DEFAULT 0,
  algorithm_version   integer     NOT NULL DEFAULT 1,

  CONSTRAINT person_memory_user_person_unique UNIQUE (user_id, person_email)
);

-- ── topic_memory ──────────────────────────────────────────────────────────────
-- One row per (user, normalized topic key). Tracks recurring subjects.
--
-- topic_key     — normalized lowercase (used as lookup key)
-- topic_display — prettified form as first seen (preserved on conflict)
-- total_occurrences — incremented each run the topic appears
-- last_thread_count — thread count from the most recent run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_memory (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL,
  topic_key           text        NOT NULL,   -- normalized lowercase
  topic_display       text        NOT NULL,   -- display name, first-write wins

  total_occurrences   integer     NOT NULL DEFAULT 0,
  last_thread_count   integer     NOT NULL DEFAULT 0,

  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),

  algorithm_version   integer     NOT NULL DEFAULT 1,

  CONSTRAINT topic_memory_user_key_unique UNIQUE (user_id, topic_key)
);

-- ── relationship_weekly_buckets ───────────────────────────────────────────────
-- One row per (user, person, ISO week). Weekly interaction time-series.
--
-- week_start — Monday of the ISO week (date, YYYY-MM-DD)
-- Upserts use GREATEST so later analyses in the same week only increase counts.
-- two_way is OR-accumulated within a week.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationship_weekly_buckets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL,
  person_email        text        NOT NULL,   -- lowercase, canonical
  week_start          date        NOT NULL,   -- Monday of ISO week

  thread_count        integer     NOT NULL DEFAULT 0,
  message_count       integer     NOT NULL DEFAULT 0,
  two_way             boolean     NOT NULL DEFAULT false,

  CONSTRAINT rwb_user_person_week_unique UNIQUE (user_id, person_email, week_start)
);

-- ── decision_memory ───────────────────────────────────────────────────────────
-- One row per (user, Gmail thread ID). Tracks decisions that keep surfacing
-- across analysis runs. Resolved decisions are retained for history.
--
-- thread_id      — stable Gmail thread ID (primary lookup key, collision-free)
-- thread_subject — normalised display subject (stored for readability, not keying)
-- times_seen     — incremented each run where this thread appears as a decision
-- is_resolved    — set by user action (not implemented in V1 UI, but persisted)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_memory (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL,
  thread_id           text        NOT NULL,   -- stable Gmail thread ID (primary key)
  thread_subject      text        NOT NULL DEFAULT '',  -- display only, not for keying

  from_name           text        NOT NULL DEFAULT '',
  from_email          text,                   -- null if not resolvable from people index

  times_seen          integer     NOT NULL DEFAULT 1,
  last_score          integer     NOT NULL DEFAULT 0,

  is_resolved         boolean     NOT NULL DEFAULT false,
  resolved_at         timestamptz,

  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),

  algorithm_version   integer     NOT NULL DEFAULT 1,

  CONSTRAINT decision_memory_user_thread_unique UNIQUE (user_id, thread_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_person_memory_user_id
  ON person_memory (user_id);

CREATE INDEX IF NOT EXISTS idx_topic_memory_user_id
  ON topic_memory (user_id);

CREATE INDEX IF NOT EXISTS idx_rwb_user_id
  ON relationship_weekly_buckets (user_id);

CREATE INDEX IF NOT EXISTS idx_rwb_user_person
  ON relationship_weekly_buckets (user_id, person_email);

CREATE INDEX IF NOT EXISTS idx_decision_memory_user_id
  ON decision_memory (user_id);

-- Fast lookup of a specific thread's decision record
CREATE INDEX IF NOT EXISTS idx_decision_memory_user_thread
  ON decision_memory (user_id, thread_id);

-- Partial index — fast lookup of unresolved decisions per user
CREATE INDEX IF NOT EXISTS idx_decision_memory_unresolved
  ON decision_memory (user_id)
  WHERE is_resolved = false;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Server client (service role key) bypasses RLS entirely.
-- RLS is enabled as a safety net against accidental anon-key exposure.
-- No SELECT/INSERT/UPDATE policies are created — service role only.

ALTER TABLE person_memory               ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_memory                ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_weekly_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_memory             ENABLE ROW LEVEL SECURITY;
