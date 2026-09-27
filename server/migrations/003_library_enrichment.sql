ALTER TABLE works ADD COLUMN openlibrary_work_key TEXT;
ALTER TABLE works ADD COLUMN cover_id INTEGER;

ALTER TABLE editions ADD COLUMN openlibrary_edition_key TEXT;
ALTER TABLE editions ADD COLUMN cover_id INTEGER;

CREATE UNIQUE INDEX idx_works_openlibrary_key
  ON works(openlibrary_work_key)
  WHERE openlibrary_work_key IS NOT NULL;

CREATE TABLE library_entry_resonances (
  library_entry_id TEXT NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
  resonance TEXT NOT NULL CHECK (resonance IN ('transformative', 'cornerstone', 'questioning', 'catalyst')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (library_entry_id, resonance)
) STRICT;
