-- Site visit tracking — public traffic to hirecar.la/training and other surfaces.
-- One row per page load. Aggregates computed at query time.

CREATE TABLE IF NOT EXISTS site_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  visitor_id TEXT,
  site TEXT,
  page TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_visits_at ON site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_site ON site_visits(site);
