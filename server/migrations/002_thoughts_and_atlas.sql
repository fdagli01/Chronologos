CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  center_x REAL NOT NULL,
  center_y REAL NOT NULL,
  center_z REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, slug)
) STRICT;

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_entry_id TEXT REFERENCES library_entries(id) ON DELETE RESTRICT,
  edition_id TEXT REFERENCES editions(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('thought', 'quote')),
  title TEXT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  commentary TEXT,
  source_locator TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS note_themes (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, theme_id)
) STRICT;

CREATE TABLE IF NOT EXISTS atlas_nodes (
  note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  magnitude REAL NOT NULL DEFAULT 2.65,
  phase REAL NOT NULL,
  layout_seed INTEGER NOT NULL,
  layout_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS note_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('supports', 'challenges', 'extends', 'echoes', 'contrasts')),
  rationale TEXT,
  origin TEXT NOT NULL DEFAULT 'user' CHECK (origin IN ('user', 'suggested')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_note_id <> target_note_id),
  UNIQUE (user_id, source_note_id, target_note_id)
) STRICT;

CREATE TABLE IF NOT EXISTS atlas_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('note_created', 'note_updated', 'note_deleted', 'link_changed')),
  note_id TEXT,
  theme_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_source
  ON notes(library_entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_nodes_user_theme
  ON atlas_nodes(user_id, primary_theme_id);
CREATE INDEX IF NOT EXISTS idx_atlas_events_user_seq
  ON atlas_events(user_id, seq);
CREATE INDEX IF NOT EXISTS idx_note_links_user
  ON note_links(user_id, source_note_id, target_note_id);
