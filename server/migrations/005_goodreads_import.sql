CREATE TABLE IF NOT EXISTS goodreads_import_records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  library_entry_id TEXT NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  row_data TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, source, external_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_goodreads_import_entry
  ON goodreads_import_records(library_entry_id);
