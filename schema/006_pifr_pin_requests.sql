-- ═══════════════════════════════════════════════════════════════
-- HIRECAR D1 Database — PIFR PIN Request Queue
-- Migration 006: pifr_pin_requests
-- ═══════════════════════════════════════════════════════════════
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/006_pifr_pin_requests.sql --remote
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
-- PIFR_PIN_REQUESTS
-- Queue for access-pin requests so admins can review, issue, and
-- release PINs from the portal.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pifr_pin_requests (
  id                TEXT PRIMARY KEY,
  request_source_id  TEXT,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT DEFAULT '',
  reason            TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  source            TEXT DEFAULT '',
  user_agent        TEXT DEFAULT '',
  ip                TEXT DEFAULT '',
  email_consent     INTEGER DEFAULT 0,
  sms_consent       INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending',
  pin               TEXT DEFAULT '',
  pin_sent_at       TEXT,
  released_at       TEXT,
  issued_by         TEXT DEFAULT '',
  released_by       TEXT DEFAULT '',
  email_sent        INTEGER DEFAULT 0,
  email_error       TEXT DEFAULT '',
  email_message_id  TEXT DEFAULT '',
  admin_note        TEXT DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pifr_pin_requests_source_id ON pifr_pin_requests(request_source_id);
CREATE INDEX IF NOT EXISTS idx_pifr_pin_requests_status ON pifr_pin_requests(status);
CREATE INDEX IF NOT EXISTS idx_pifr_pin_requests_email ON pifr_pin_requests(email);
CREATE INDEX IF NOT EXISTS idx_pifr_pin_requests_created_at ON pifr_pin_requests(created_at);
