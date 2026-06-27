-- HIRECAR D1 Database — PIFR enrollment address + archive fields
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/009_pifr_enrollment_extended_fields.sql --remote

ALTER TABLE pifr_enrollments ADD COLUMN address1 TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN address2 TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN city TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN region TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN postal_code TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN country TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN entry_point TEXT DEFAULT '';
ALTER TABLE pifr_enrollments ADD COLUMN archived_at TEXT;
