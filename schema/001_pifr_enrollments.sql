-- ═══════════════════════════════════════════════════════════════
-- HIRECAR D1 Database — PIFR Enrollments + Activity Log
-- Migration 001: pifr_enrollments + pifr_activity_log
-- ═══════════════════════════════════════════════════════════════
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/001_pifr_enrollments.sql --remote
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
-- 1. PIFR_ENROLLMENTS
-- The single row per member_id. POSTs to /api/pifr-enroll upsert here.
-- in_progress rows surface in admin as "incomplete"; complete rows
-- carry the full enrollment payload.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pifr_enrollments (
  id              TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL UNIQUE,
  fname           TEXT DEFAULT '',
  lname           TEXT DEFAULT '',
  email           TEXT NOT NULL,
  phone           TEXT DEFAULT '',
  plan            TEXT DEFAULT '',
  plan_price      TEXT DEFAULT '',
  score_range     TEXT DEFAULT '',
  issues          TEXT DEFAULT '',
  goal            TEXT DEFAULT '',
  timeline        TEXT DEFAULT '',
  bureaus         TEXT DEFAULT '',
  channels        TEXT DEFAULT '',
  profile_score   INTEGER DEFAULT 0,
  xp              INTEGER DEFAULT 0,
  level           TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new',
  cal_date        TEXT,
  cal_time        TEXT,
  cal_month       INTEGER,
  cal_year        INTEGER,
  state           TEXT DEFAULT '',
  zip             TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  assigned_to     TEXT,
  email_day0_sent INTEGER DEFAULT 0,
  email_day0_opened INTEGER DEFAULT 0,
  email_day1_sent INTEGER DEFAULT 0,
  email_day1_opened INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pifr_enrollments_member_id ON pifr_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_pifr_enrollments_status ON pifr_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_pifr_enrollments_email ON pifr_enrollments(email);
CREATE INDEX IF NOT EXISTS idx_pifr_enrollments_created_at ON pifr_enrollments(created_at);


-- ───────────────────────────────────────────────────────────────
-- 2. PIFR_ACTIVITY_LOG
-- Append-only event stream per enrollment. Every progress upsert,
-- status change, email open, and admin note (action='admin_note')
-- gets a row here.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pifr_activity_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id   TEXT NOT NULL,
  action          TEXT NOT NULL,
  actor           TEXT DEFAULT 'system',
  details         TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_enrollment ON pifr_activity_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON pifr_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON pifr_activity_log(created_at);
