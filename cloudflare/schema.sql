-- D1 Database Schema for SNS Publisher

CREATE TABLE IF NOT EXISTS publish_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  title TEXT,
  platforms TEXT,  -- JSON array
  results TEXT,    -- JSON object
  published_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_published_at ON publish_logs(published_at);
CREATE INDEX IF NOT EXISTS idx_path ON publish_logs(path);
