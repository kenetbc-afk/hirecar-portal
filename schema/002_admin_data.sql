-- ═══════════════════════════════════════════════════════════════
-- HIRECAR D1 Database — Admin Data Migration
-- Migration 002: Quotes, Invoices, Billing, Documents,
--                Commitments, Funding, PIFR Status
-- ═══════════════════════════════════════════════════════════════
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/002_admin_data.sql --remote
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
-- 1. ADMIN_QUOTES
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_quotes (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  quote_number    TEXT NOT NULL,
  service         TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','declined','expired')),
  expires_at      TEXT,
  sent_at         TEXT,
  accepted_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quotes_client ON admin_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON admin_quotes(status);


-- ───────────────────────────────────────────────────────────────
-- 2. ADMIN_INVOICES
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_invoices (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  description     TEXT DEFAULT '',
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
  due_date        TEXT,
  sent_at         TEXT,
  paid_at         TEXT,
  payment_method  TEXT DEFAULT '',
  quote_id        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON admin_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON admin_invoices(status);


-- ───────────────────────────────────────────────────────────────
-- 3. ADMIN_BILLING
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_billing (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  entry_type      TEXT NOT NULL DEFAULT 'charge' CHECK(entry_type IN ('charge','payment','credit','refund','adjustment')),
  description     TEXT DEFAULT '',
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  balance_cents   INTEGER DEFAULT 0,
  reference_id    TEXT,
  reference_type  TEXT DEFAULT '',
  payment_method  TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_client ON admin_billing(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_type ON admin_billing(entry_type);


-- ───────────────────────────────────────────────────────────────
-- 4. ADMIN_DOCUMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_documents (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  doc_type        TEXT DEFAULT 'general' CHECK(doc_type IN ('id-front','id-back','credit-report','dispute-doc','contract','agreement','compliance','general')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')),
  r2_key          TEXT,
  file_name       TEXT DEFAULT '',
  file_size       INTEGER DEFAULT 0,
  mime_type       TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  uploaded_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_client ON admin_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON admin_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_status ON admin_documents(status);


-- ───────────────────────────────────────────────────────────────
-- 5. ADMIN_COMMITMENTS (Payment Commitments)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_commitments (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  description     TEXT DEFAULT '',
  amount_cents    INTEGER NOT NULL DEFAULT 0,
  due_date        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','kept','failed','cancelled')),
  payment_method  TEXT DEFAULT '',
  invoice_id      TEXT,
  kept_at         TEXT,
  failed_at       TEXT,
  notes           TEXT DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commit_client ON admin_commitments(client_id);
CREATE INDEX IF NOT EXISTS idx_commit_status ON admin_commitments(status);
CREATE INDEX IF NOT EXISTS idx_commit_due ON admin_commitments(due_date);


-- ───────────────────────────────────────────────────────────────
-- 6. ADMIN_FUNDING_REQUESTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_funding_requests (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  funding_type    TEXT DEFAULT 'general',
  amount_requested_cents INTEGER DEFAULT 0,
  amount_approved_cents  INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','approved','denied','funded','cancelled')),
  notes           TEXT DEFAULT '',
  reviewed_by     TEXT,
  reviewed_at     TEXT,
  funded_at       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_funding_client ON admin_funding_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_funding_status ON admin_funding_requests(status);


-- ───────────────────────────────────────────────────────────────
-- 7. PIFR_ENROLLMENTS (persistent, replaces KV-only storage)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pifr_enrollments (
  id              TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL,
  fname           TEXT DEFAULT '',
  lname           TEXT DEFAULT '',
  email           TEXT DEFAULT '',
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
  status          TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','intake','in_progress','pending_review','approved','active','completed','cancelled')),
  assigned_to     TEXT DEFAULT '',
  cal_date        TEXT,
  cal_time        TEXT,
  cal_month       INTEGER,
  cal_year        INTEGER,
  state           TEXT DEFAULT '',
  zip             TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  email_day0_sent INTEGER DEFAULT 0,
  email_day0_opened INTEGER DEFAULT 0,
  email_day1_sent INTEGER DEFAULT 0,
  email_day1_opened INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pifr_member ON pifr_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_pifr_status ON pifr_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_pifr_email ON pifr_enrollments(email);


-- ───────────────────────────────────────────────────────────────
-- 8. PIFR_ACTIVITY_LOG
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pifr_activity_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id   TEXT NOT NULL,
  action          TEXT NOT NULL,
  actor           TEXT DEFAULT 'system',
  details         TEXT DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pifr_log_enroll ON pifr_activity_log(enrollment_id);


-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Client financial summary
CREATE VIEW IF NOT EXISTS v_client_financials AS
SELECT
  q.client_id,
  COUNT(DISTINCT q.id) AS total_quotes,
  SUM(CASE WHEN q.status = 'sent' THEN 1 ELSE 0 END) AS pending_quotes,
  COUNT(DISTINCT i.id) AS total_invoices,
  SUM(CASE WHEN i.status IN ('sent','overdue') THEN i.amount_cents ELSE 0 END) AS outstanding_cents,
  SUM(CASE WHEN i.status = 'paid' THEN i.amount_cents ELSE 0 END) AS paid_cents
FROM admin_quotes q
LEFT JOIN admin_invoices i ON i.client_id = q.client_id
GROUP BY q.client_id;

-- PIFR enrollment pipeline
CREATE VIEW IF NOT EXISTS v_pifr_pipeline AS
SELECT
  status,
  COUNT(*) AS enrollment_count,
  AVG(profile_score) AS avg_profile_score
FROM pifr_enrollments
GROUP BY status
ORDER BY
  CASE status
    WHEN 'new' THEN 1
    WHEN 'intake' THEN 2
    WHEN 'in_progress' THEN 3
    WHEN 'pending_review' THEN 4
    WHEN 'approved' THEN 5
    WHEN 'active' THEN 6
    WHEN 'completed' THEN 7
    WHEN 'cancelled' THEN 8
  END;
