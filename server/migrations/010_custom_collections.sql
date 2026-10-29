CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name COLLATE NOCASE)
) STRICT;
CREATE TABLE collection_books (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  library_entry_id TEXT NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  PRIMARY KEY(collection_id, library_entry_id)
) STRICT;
CREATE INDEX collection_books_entry ON collection_books(library_entry_id);
