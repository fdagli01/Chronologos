ALTER TABLE reading_sessions ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1));
ALTER TABLE library_entries ADD COLUMN current_reading_session_id TEXT REFERENCES reading_sessions(id) ON DELETE SET NULL;
UPDATE reading_sessions SET is_completed = 1 WHERE completed_at IS NOT NULL;

-- Preserve the known completion, including read books whose completion date is absent.
INSERT INTO reading_sessions (id, library_entry_id, started_at, completed_at, is_completed)
SELECT lower(hex(randomblob(16))), e.id, e.started_at, e.completed_at, 1
FROM library_entries e
WHERE (e.status = 'read' OR e.completed_at IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM reading_sessions s WHERE s.library_entry_id = e.id AND s.is_completed = 1 AND s.completed_at IS e.completed_at);

INSERT INTO reading_sessions (id, library_entry_id, started_at, is_completed)
SELECT lower(hex(randomblob(16))), e.id, e.started_at, 0
FROM library_entries e WHERE e.status IN ('reading', 'paused')
  AND NOT EXISTS (SELECT 1 FROM reading_sessions s WHERE s.library_entry_id = e.id AND s.is_completed = 0);

UPDATE library_entries SET current_reading_session_id = (
  SELECT s.id FROM reading_sessions s WHERE s.library_entry_id = library_entries.id
    AND s.is_completed = CASE WHEN library_entries.status = 'read' THEN 1 ELSE 0 END
  ORDER BY s.completed_at DESC, s.created_at DESC, s.id DESC LIMIT 1
) WHERE status IN ('read', 'reading', 'paused');
CREATE INDEX reading_history_entry ON reading_sessions(library_entry_id, is_completed, completed_at);
