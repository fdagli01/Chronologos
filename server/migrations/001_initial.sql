CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  birth_year INTEGER,
  death_year INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_year INTEGER,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS work_authors (
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
  PRIMARY KEY (work_id, author_id)
) STRICT;

CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  isbn TEXT,
  language TEXT,
  publisher TEXT,
  translator TEXT,
  page_count INTEGER CHECK (page_count IS NULL OR page_count > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS library_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE RESTRICT,
  edition_id TEXT REFERENCES editions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'read', 'paused')),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review TEXT,
  started_at TEXT,
  completed_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, work_id)
) STRICT;

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  library_entry_id TEXT NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS idx_library_entries_user_status
  ON library_entries(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_title ON works(title COLLATE NOCASE);
