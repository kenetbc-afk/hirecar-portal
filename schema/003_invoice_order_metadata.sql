-- ═══════════════════════════════════════════════════════════════
-- HIRECAR D1 Database — Invoice Order Metadata Migration
-- Adds parent number, SKU, and order detail mapping to invoices
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE admin_invoices ADD COLUMN parent_number TEXT DEFAULT '';
ALTER TABLE admin_invoices ADD COLUMN sku TEXT DEFAULT '';
ALTER TABLE admin_invoices ADD COLUMN order_details TEXT DEFAULT '';
ALTER TABLE admin_invoices ADD COLUMN paypal_invoice_id TEXT DEFAULT '';
ALTER TABLE admin_invoices ADD COLUMN paypal_share_link TEXT DEFAULT '';
