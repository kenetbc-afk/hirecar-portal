-- PayPal route event log + reconciliation support
-- Run with:
--   npx wrangler d1 execute hirecar-db --file=./schema/008_paypal_route_events.sql --remote

CREATE TABLE IF NOT EXISTS paypal_route_events (
  id                TEXT PRIMARY KEY,
  client_id         TEXT DEFAULT '',
  quote_id          TEXT DEFAULT '',
  invoice_id        TEXT DEFAULT '',
  event_type        TEXT DEFAULT '',
  event_status      TEXT DEFAULT '',
  paypal_event_id   TEXT DEFAULT '',
  paypal_order_id   TEXT DEFAULT '',
  paypal_invoice_id TEXT DEFAULT '',
  payer_email       TEXT DEFAULT '',
  amount_cents      INTEGER DEFAULT 0,
  currency_code     TEXT DEFAULT '',
  source_ref        TEXT DEFAULT '',
  matched_by        TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  payload_json      TEXT DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_paypal_route_client ON paypal_route_events(client_id);
CREATE INDEX IF NOT EXISTS idx_paypal_route_quote ON paypal_route_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_paypal_route_invoice ON paypal_route_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_paypal_route_event ON paypal_route_events(paypal_event_id);
