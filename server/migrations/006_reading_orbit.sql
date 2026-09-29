ALTER TABLE library_entries ADD COLUMN current_page INTEGER CHECK (current_page IS NULL OR current_page >= 0);
ALTER TABLE library_entries ADD COLUMN progress_percent INTEGER CHECK (progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100);

CREATE TABLE reading_goals (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 3000),
  target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 500),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, year)
) STRICT;
