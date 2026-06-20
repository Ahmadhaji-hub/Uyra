-- ─────────────────────────────────────────────────────────────────────────────
-- Identity Memory  (Digital Self — Layer 1)
-- Migration: 002_identity_memory.sql
--
-- ADDITIVE ONLY. No existing Memory V1 table is redesigned or re-keyed.
--   · New owner-identity table (app_user) with a stable UUID.
--   · Nullable owner_id columns added to the four V1 tables + backfilled
--     (Part B) — purely additive: existing unique constraints, indexes, and
--     queries are unchanged. owner_id stays NULLABLE with no FK enforced yet so
--     V1 writers/readers are unaffected; the cron job keeps it populated.
--   · Two new derived tables: identity_profile (denormalised snapshot per owner)
--     and identity_facet (normalised, queryable substrate).
--
-- Identity Memory is a DERIVED layer. It never writes back to V1 tables (except
-- the additive owner_id backfill) and is always reconstructable from them, so a
-- failed/stale recompute is never data loss.
--
-- Design notes
--   · All access is service-role only. RLS is enabled with no policies as a
--     safety net, identical to Memory V1.
--   · app_user.email is the SAME string V1 stores as user_id, but lowercased —
--     this also resolves the V1 email-casing inconsistency for the owner layer.
--   · identity_facet.facet_type + value(jsonb) is the evolution seam: new
--     dimensions of the digital self are new facet_type values + new jsonb
--     shapes, never new columns.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Part A · app_user (owner identity) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_user (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,    -- canonical, lowercased
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_user_email_unique UNIQUE (email)
);

-- Backfill owners from existing V1 user_id values. INSERT-only and idempotent
-- (ON CONFLICT DO NOTHING) — safe to re-run.
INSERT INTO app_user (email)
SELECT DISTINCT lower(user_id)
FROM (
  SELECT user_id FROM person_memory
  UNION SELECT user_id FROM topic_memory
  UNION SELECT user_id FROM relationship_weekly_buckets
  UNION SELECT user_id FROM decision_memory
) AS owners
WHERE user_id IS NOT NULL AND length(trim(user_id)) > 0
ON CONFLICT (email) DO NOTHING;

-- ── Part B · additive owner_id on V1 tables ───────────────────────────────────
-- Nullable, no FK, no constraint changes. Existing access paths are untouched.
-- The cron job keeps these populated for new rows (eventually consistent);
-- a future migration may add a FK + NOT NULL once all writers populate them.

ALTER TABLE person_memory               ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE topic_memory                ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE relationship_weekly_buckets ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE decision_memory             ADD COLUMN IF NOT EXISTS owner_id uuid;

UPDATE person_memory pm
  SET owner_id = au.id
  FROM app_user au
  WHERE au.email = lower(pm.user_id) AND pm.owner_id IS NULL;

UPDATE topic_memory tm
  SET owner_id = au.id
  FROM app_user au
  WHERE au.email = lower(tm.user_id) AND tm.owner_id IS NULL;

UPDATE relationship_weekly_buckets rwb
  SET owner_id = au.id
  FROM app_user au
  WHERE au.email = lower(rwb.user_id) AND rwb.owner_id IS NULL;

UPDATE decision_memory dm
  SET owner_id = au.id
  FROM app_user au
  WHERE au.email = lower(dm.user_id) AND dm.owner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_person_memory_owner ON person_memory (owner_id);
CREATE INDEX IF NOT EXISTS idx_topic_memory_owner  ON topic_memory (owner_id);
CREATE INDEX IF NOT EXISTS idx_rwb_owner            ON relationship_weekly_buckets (owner_id);
CREATE INDEX IF NOT EXISTS idx_decision_memory_owner ON decision_memory (owner_id);

-- ── identity_profile ──────────────────────────────────────────────────────────
-- One row per owner. Denormalised snapshot of the digital self for fast reads.

CREATE TABLE IF NOT EXISTS identity_profile (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,

  version          integer     NOT NULL DEFAULT 1,   -- IDENTITY_ALGORITHM_VERSION
  summary          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confidence       integer     NOT NULL DEFAULT 0,

  -- Hash of the V1 inputs this profile was built from. Recompute is skipped
  -- when the signature and version are unchanged.
  source_signature text        NOT NULL DEFAULT '',

  generated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT identity_profile_owner_unique UNIQUE (owner_id)
);

-- ── identity_facet ────────────────────────────────────────────────────────────
-- Normalised, queryable substrate. One row per (owner, facet_type, facet_key).
-- facet_type is text (not an enum) so new dimensions are additive.

CREATE TABLE IF NOT EXISTS identity_facet (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,

  facet_type        text        NOT NULL,   -- key_relationship | topic_affinity | …
  facet_key         text        NOT NULL,   -- stable key within type
  label             text        NOT NULL DEFAULT '',

  value             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  weight            real        NOT NULL DEFAULT 0,   -- relative importance 0..1
  confidence        integer     NOT NULL DEFAULT 0,
  evidence          jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- provenance

  first_observed_at timestamptz NOT NULL DEFAULT now(),  -- preserved on conflict
  last_computed_at  timestamptz NOT NULL DEFAULT now(),
  algorithm_version integer     NOT NULL DEFAULT 1,

  CONSTRAINT identity_facet_unique UNIQUE (owner_id, facet_type, facet_key)
);

CREATE INDEX IF NOT EXISTS idx_identity_facet_owner
  ON identity_facet (owner_id);

CREATE INDEX IF NOT EXISTS idx_identity_facet_owner_type
  ON identity_facet (owner_id, facet_type);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Service-role only. No policies — anon/auth keys are denied by default.

ALTER TABLE app_user         ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_facet   ENABLE ROW LEVEL SECURITY;

-- ── Rollback (manual) ─────────────────────────────────────────────────────────
-- This migration is fully reversible and leaves Memory V1 intact. To roll back,
-- run the statements below. Dropping the identity tables and the additive
-- owner_id columns restores the exact V1 schema; no V1 signal data is affected.
--
--   DROP TABLE IF EXISTS identity_facet;
--   DROP TABLE IF EXISTS identity_profile;
--   ALTER TABLE person_memory               DROP COLUMN IF EXISTS owner_id;
--   ALTER TABLE topic_memory                DROP COLUMN IF EXISTS owner_id;
--   ALTER TABLE relationship_weekly_buckets DROP COLUMN IF EXISTS owner_id;
--   ALTER TABLE decision_memory             DROP COLUMN IF EXISTS owner_id;
--   DROP TABLE IF EXISTS app_user;
--
-- (The owner_id index drops happen automatically with the columns. app_user is
-- dropped last because identity_profile/identity_facet reference it.)
