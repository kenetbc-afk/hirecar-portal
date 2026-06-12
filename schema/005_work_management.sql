-- HIRECAR D1 Migration 005
-- Team task and project management for admin dashboard

CREATE TABLE IF NOT EXISTS admin_work_items (
  id              TEXT PRIMARY KEY,
  item_type       TEXT NOT NULL DEFAULT 'task' CHECK(item_type IN ('task','project')),
  title           TEXT NOT NULL,
  owner           TEXT DEFAULT '',
  coowner         TEXT DEFAULT '',
  client_id       TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'Not Started',
  priority        TEXT NOT NULL DEFAULT 'Medium',
  value_cents     INTEGER NOT NULL DEFAULT 0,
  deadline        TEXT,
  source_alias    TEXT DEFAULT '',
  source_from     TEXT DEFAULT '',
  source_subject  TEXT DEFAULT '',
  template        TEXT DEFAULT '',
  expectations    TEXT DEFAULT '',
  checklist_json  TEXT DEFAULT '[]',
  notes           TEXT DEFAULT '',
  created_by      TEXT DEFAULT 'admin',
  updated_by      TEXT DEFAULT 'admin',
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_owner ON admin_work_items(owner);
CREATE INDEX IF NOT EXISTS idx_work_coowner ON admin_work_items(coowner);
CREATE INDEX IF NOT EXISTS idx_work_type ON admin_work_items(item_type);
CREATE INDEX IF NOT EXISTS idx_work_status ON admin_work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_deadline ON admin_work_items(deadline);
CREATE INDEX IF NOT EXISTS idx_work_client ON admin_work_items(client_id);

CREATE TABLE IF NOT EXISTS admin_work_activity (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id         TEXT NOT NULL,
  actor           TEXT DEFAULT 'system',
  action          TEXT NOT NULL,
  details         TEXT DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_activity_work ON admin_work_activity(work_id);
CREATE INDEX IF NOT EXISTS idx_work_activity_created ON admin_work_activity(created_at);
