-- HIRECAR D1 Migration 004
-- PIFR admin editing + plan coverage metadata.
--
-- Run once:
--   wrangler d1 execute hirecar-db --file=./schema/004_pifr_plan_coverage.sql --remote

ALTER TABLE pifr_enrollments ADD COLUMN lane TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN primary_member TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN covered_members TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN plan_members TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN dependent_count INTEGER DEFAULT 0;
