import { randomUUID } from 'node:crypto'

const entryRow = `SELECT id, status, started_at AS startedAt, completed_at AS completedAt,
  current_reading_session_id AS sessionId FROM library_entries WHERE id = ?`

// Called inside the same transaction as the library change.
export function recordReadingChange(db, before, entryId) {
  const after = db.prepare(entryRow).get(entryId)
  const current = after.sessionId ? db.prepare('SELECT id, is_completed AS isCompleted FROM reading_sessions WHERE id = ? AND library_entry_id = ?').get(after.sessionId, entryId) : null
  let sessionId = current?.id || null
  if (after.status === 'read') {
    if (current && (!current.isCompleted || before?.status === 'read')) {
      db.prepare('UPDATE reading_sessions SET completed_at = ?, is_completed = 1 WHERE id = ?').run(after.completedAt, current.id)
    } else {
      sessionId = randomUUID()
      db.prepare('INSERT INTO reading_sessions(id, library_entry_id, started_at, completed_at, is_completed) VALUES (?, ?, ?, ?, 1)').run(sessionId, entryId, after.startedAt, after.completedAt)
    }
  } else if (['reading', 'paused'].includes(after.status)) {
    if (!current || current.isCompleted) {
      sessionId = randomUUID()
      db.prepare('INSERT INTO reading_sessions(id, library_entry_id, started_at) VALUES (?, ?, ?)').run(sessionId, entryId, after.startedAt)
    } else if (after.startedAt) {
      db.prepare('UPDATE reading_sessions SET started_at = COALESCE(started_at, ?) WHERE id = ?').run(after.startedAt, current.id)
    }
  } else sessionId = null
  db.prepare('UPDATE library_entries SET current_reading_session_id = ? WHERE id = ?').run(sessionId, entryId)
}

export function readingHistory(db, userId, bookId) {
  if (!db.prepare('SELECT 1 FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, userId)) throw Object.assign(new Error('Kitap bulunamadı.'), { statusCode: 404 })
  return db.prepare(`SELECT s.id, s.started_at AS startedAt, s.completed_at AS completedAt, s.is_completed AS isCompleted
    FROM reading_sessions s JOIN library_entries e ON e.id = s.library_entry_id
    WHERE e.user_id = ? AND e.id = ? ORDER BY s.completed_at IS NULL, s.completed_at, s.created_at, s.id`).all(userId, bookId)
}

export function recordImportedReading(db, entryId) {
  const entry = db.prepare(entryRow).get(entryId)
  const current = entry.sessionId && db.prepare('SELECT id, is_completed AS isCompleted, completed_at AS completedAt FROM reading_sessions WHERE id = ?').get(entry.sessionId)
  if (current?.isCompleted && entry.completedAt && !current.completedAt) {
    db.prepare('UPDATE reading_sessions SET completed_at = ? WHERE id = ?').run(entry.completedAt, current.id)
  } else if (entry.completedAt || entry.status === 'read') {
    let saved = db.prepare('SELECT id FROM reading_sessions WHERE library_entry_id = ? AND is_completed = 1 AND completed_at IS ? LIMIT 1').get(entryId, entry.completedAt)
    if (!saved) {
      saved = { id: randomUUID() }
      db.prepare('INSERT INTO reading_sessions(id, library_entry_id, started_at, completed_at, is_completed) VALUES (?, ?, ?, ?, 1)').run(saved.id, entryId, entry.startedAt, entry.completedAt)
    }
    if (entry.status === 'read') db.prepare('UPDATE library_entries SET current_reading_session_id = ? WHERE id = ?').run(saved.id, entryId)
  }
  if (['reading', 'paused'].includes(entry.status)) recordReadingChange(db, null, entryId)
}

export function updateHistoryDate(db, userId, sessionId, completedAt) {
  const session = db.prepare(`SELECT s.id, e.id AS bookId, e.status, e.current_reading_session_id AS currentId
    FROM reading_sessions s JOIN library_entries e ON e.id = s.library_entry_id
    WHERE s.id = ? AND s.is_completed = 1 AND e.user_id = ?`).get(sessionId, userId)
  if (!session) throw Object.assign(new Error('Okuma kaydı bulunamadı.'), { statusCode: 404 })
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE reading_sessions SET completed_at = ? WHERE id = ?').run(completedAt, sessionId)
    if (session.status === 'read' && session.currentId === session.id) db.prepare('UPDATE library_entries SET completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(completedAt, session.bookId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return { saved: true }
}

export function knownDay(value) {
  if (typeof value !== 'string') return null
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(day + 'T12:00:00Z')
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : day
}

export function readingTimeline(db, userId, url) {
  const author = `(SELECT group_concat(a.name, ', ') FROM work_authors wa JOIN authors a ON a.id = wa.author_id WHERE wa.work_id = w.id)`
  const books = db.prepare(`SELECT s.id AS sessionId, e.id AS bookId, w.title, ${author} AS author,
    s.completed_at AS recordedAt, s.created_at AS recordedOrder, COALESCE(ed.cover_id, w.cover_id) AS coverId, e.is_demo AS isDemo
    FROM reading_sessions s JOIN library_entries e ON e.id = s.library_entry_id JOIN works w ON w.id = e.work_id
    LEFT JOIN editions ed ON ed.id = e.edition_id WHERE e.user_id = ? AND s.is_completed = 1`).all(userId)
  // Determine reread order from the complete history, before any year filter.
  books.sort((a, b) => (knownDay(a.recordedAt) || '9999').localeCompare(knownDay(b.recordedAt) || '9999') || a.recordedOrder.localeCompare(b.recordedOrder) || a.sessionId.localeCompare(b.sessionId))
  const readings = new Map()
  const totals = new Map()
  for (const b of books) totals.set(b.bookId, (totals.get(b.bookId) || 0) + 1)
  const events = books.map(b => {
    const sequence = (readings.get(b.bookId) || 0) + 1; readings.set(b.bookId, sequence)
    const date = knownDay(b.recordedAt)
    return { ...b, id: `reading:${b.sessionId}`, kind: 'book', date, sequence: date ? sequence : null, readingCount: totals.get(b.bookId), isDemo: Boolean(b.isDemo), themes: [] }
  })
  const notes = db.prepare(`SELECT n.id AS noteId, n.kind, n.title, substr(n.content, 1, 180) AS excerpt,
    n.created_at AS recordedAt, n.updated_at AS updatedAt, n.library_entry_id AS bookId, n.source_locator AS sourceLocator, n.is_demo AS isDemo,
    w.title AS bookTitle, ${author} AS author,
    (SELECT json_group_array(t.name) FROM note_themes nt JOIN themes t ON t.id = nt.theme_id WHERE nt.note_id = n.id AND t.user_id = n.user_id) AS themesJson
    FROM notes n LEFT JOIN library_entries e ON e.id = n.library_entry_id AND e.user_id = n.user_id
    LEFT JOIN works w ON w.id = e.work_id WHERE n.user_id = ?`).all(userId)
  for (const n of notes) {
    events.push({ ...n, id: `note:${n.noteId}`, date: knownDay(n.recordedAt), title: n.title || n.excerpt.slice(0, 80) || 'Başlıksız düşünce', themes: JSON.parse(n.themesJson || '[]'), themesJson: undefined, isDemo: Boolean(n.isDemo) })
  }
  const year = url.searchParams.get('year') || String(new Date().getFullYear())
  if (year !== 'all' && !/^\d{4}$/.test(year)) throw Object.assign(new Error('Geçerli bir yıl seç.'), { statusCode: 400 })
  const dated = events.filter(e => e.date)
  const years = [...new Set([new Date().getFullYear(), ...dated.map(e => Number(e.date.slice(0, 4)))])].sort((a, b) => b - a)
  const items = dated.filter(e => year === 'all' || e.date.startsWith(year + '-')).sort((a, b) => a.date.localeCompare(b.date) || (a.recordedAt || '').localeCompare(b.recordedAt || '') || a.id.localeCompare(b.id))
  const personal = items.filter(e => !e.isDemo)
  const themeCounts = new Map()
  for (const e of personal) for (const theme of e.themes) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1)
  return {
    year, years, items,
    undated: events.filter(e => !e.date).sort((a, b) => a.title.localeCompare(b.title, 'tr')),
    summary: {
      completions: personal.filter(e => e.kind === 'book').length,
      uniqueBooks: new Set(personal.filter(e => e.kind === 'book').map(e => e.bookId)).size,
      rereads: personal.filter(e => e.kind === 'book' && e.sequence > 1).length,
      thoughts: personal.filter(e => e.kind === 'thought').length,
      quotes: personal.filter(e => e.kind === 'quote').length,
      activeMonths: new Set(personal.map(e => e.date.slice(0, 7))).size,
      themes: [...themeCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr')).slice(0, 3),
    },
    months: Array.from({ length: 12 }, (_, month) => ({ month: month + 1, books: personal.filter(e => e.kind === 'book' && Number(e.date.slice(5, 7)) === month + 1).length, notes: personal.filter(e => e.kind !== 'book' && Number(e.date.slice(5, 7)) === month + 1).length })),
  }
}
