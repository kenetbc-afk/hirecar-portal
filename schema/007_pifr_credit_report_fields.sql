-- ═══════════════════════════════════════════════════════════════
-- HIRECAR D1 Database — PIFR Credit Report + Source Match Fields
-- Migration 007: additional report and validation fields
-- ═══════════════════════════════════════════════════════════════
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/007_pifr_credit_report_fields.sql --remote
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE pifr_enrollments ADD COLUMN source_validation_status TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN source_validation_matched_by TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN source_validation_reason TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN source_validation_at TEXT;
ALTER TABLE pifr_enrollments ADD COLUMN report_access_status TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN report_access_details TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN score_model TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN report_last_updated TEXT;
ALTER TABLE pifr_enrollments ADD COLUMN equifax_score INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN experian_score INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN transunion_score INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN fico_scores TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN fico_auto_score_average INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN fico_score_8 INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN fico_real_estate_rental_score INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN ssn_funding_status TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN bnpl_status TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN bnpl_approved_amount INTEGER DEFAULT 0;
ALTER TABLE pifr_enrollments ADD COLUMN client_review_status TEXT DEFAULT '';
