CREATE TABLE IF NOT EXISTS nebula_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'thought' CHECK (kind IN ('thought', 'quote')),
  title TEXT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  commentary TEXT,
  library_entry_id TEXT REFERENCES library_entries(id) ON DELETE SET NULL,
  edition_id TEXT REFERENCES editions(id) ON DELETE SET NULL,
  source_locator TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS nebula_draft_themes (
  draft_id TEXT NOT NULL REFERENCES nebula_drafts(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (draft_id, theme_id)
) STRICT;

CREATE TABLE IF NOT EXISTS note_memory_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  enabled_at TEXT,
  CHECK ((enabled = 0) OR enabled_at IS NOT NULL)
) STRICT;

CREATE TABLE IF NOT EXISTS note_open_history (
  note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS daily_note_candidates (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_date TEXT NOT NULL,
  note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, candidate_date)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_nebula_drafts_user_updated
  ON nebula_drafts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_open_history_user_last_opened
  ON note_open_history(user_id, last_opened_at);
