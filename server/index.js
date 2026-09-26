import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { openDatabase, LOCAL_USER_ID } from './database.js'
import { atlasSnapshot, createNote, createNoteLink, deleteNote, deleteNoteLink, getNote, listNotes, listThemes, updateNote } from './thoughts.js'

const host = process.env.API_HOST || '127.0.0.1'
const port = Number(process.env.API_PORT || 4178)
const database = await openDatabase()

const statuses = new Set(['to_read', 'reading', 'read', 'paused'])
const librarySelect = `
  SELECT
    entry.id,
    work.id AS workId,
    work.title,
    work.original_year AS originalYear,
    work.description,
    author.name AS author,
    edition.id AS editionId,
    edition.isbn,
    edition.language,
    edition.publisher,
    edition.translator,
    edition.page_count AS pageCount,
    entry.status,
    entry.rating,
    entry.review,
    entry.started_at AS startedAt,
    entry.completed_at AS completedAt,
    entry.is_demo AS isDemo,
    entry.created_at AS addedAt,
    entry.updated_at AS updatedAt
  FROM library_entries AS entry
  JOIN works AS work ON work.id = entry.work_id
  LEFT JOIN work_authors AS work_author ON work_author.work_id = work.id
  LEFT JOIN authors AS author ON author.id = work_author.author_id
  LEFT JOIN editions AS edition ON edition.id = entry.edition_id
`

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

function exportArchive() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: database.prepare('SELECT id, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?').get(LOCAL_USER_ID),
    library: database.prepare(`SELECT e.id AS entryId, e.status, e.rating, e.review, e.started_at AS startedAt, e.completed_at AS completedAt,
      e.created_at AS addedAt, e.updated_at AS updatedAt, w.id AS workId, w.title, w.original_year AS originalYear, w.description,
      (SELECT group_concat(a.name, ' | ') FROM work_authors wa JOIN authors a ON a.id = wa.author_id WHERE wa.work_id = w.id) AS authors,
      edition.id AS editionId, edition.isbn, edition.language, edition.publisher, edition.translator, edition.page_count AS pageCount,
      e.is_demo AS isDemo FROM library_entries e JOIN works w ON w.id = e.work_id LEFT JOIN editions edition ON edition.id = e.edition_id
      WHERE e.user_id = ? ORDER BY e.created_at`).all(LOCAL_USER_ID),
    readingSessions: database.prepare(`SELECT session.id, session.library_entry_id AS libraryEntryId,
      session.started_at AS startedAt, session.completed_at AS completedAt, session.created_at AS createdAt
      FROM reading_sessions session JOIN library_entries entry ON entry.id = session.library_entry_id
      WHERE entry.user_id = ? ORDER BY session.created_at`).all(LOCAL_USER_ID),
    notes: database.prepare(`SELECT id, kind, title, content, commentary, source_locator AS sourceLocator,
      library_entry_id AS libraryEntryId, edition_id AS editionId, created_at AS createdAt, updated_at AS updatedAt, is_demo AS isDemo
      FROM notes WHERE user_id = ? ORDER BY created_at`).all(LOCAL_USER_ID),
    themes: database.prepare('SELECT id, slug, name, color, center_x AS centerX, center_y AS centerY, center_z AS centerZ FROM themes WHERE user_id = ?').all(LOCAL_USER_ID),
    noteThemes: database.prepare(`SELECT nt.note_id AS noteId, nt.theme_id AS themeId FROM note_themes nt JOIN notes n ON n.id = nt.note_id WHERE n.user_id = ?`).all(LOCAL_USER_ID),
    atlasNodes: database.prepare(`SELECT note_id AS noteId, primary_theme_id AS primaryThemeId, x, y, z, magnitude, phase, layout_seed AS layoutSeed, layout_version AS layoutVersion FROM atlas_nodes WHERE user_id = ?`).all(LOCAL_USER_ID),
    links: database.prepare(`SELECT id, source_note_id AS sourceNoteId, target_note_id AS targetNoteId, relationship, rationale, origin, created_at AS createdAt FROM note_links WHERE user_id = ? ORDER BY created_at`).all(LOCAL_USER_ID),
  }
}

async function readJson(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('Content-Type must be application/json.'), { statusCode: 415 })
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1024 * 1024) throw Object.assign(new Error('Request body is too large.'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
      throw new Error('Request body must be a JSON object.')
    }
    return payload
  } catch {
    throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 })
  }
}

function cleanText(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw Object.assign(new Error(`${field} is required.`), { statusCode: 400 })
    return null
  }
  if (typeof value !== 'string') throw Object.assign(new Error(`${field} must be text.`), { statusCode: 400 })
  const clean = value.trim()
  if (required && !clean) throw Object.assign(new Error(`${field} is required.`), { statusCode: 400 })
  if (clean.length > max) throw Object.assign(new Error(`${field} must be ${max} characters or fewer.`), { statusCode: 400 })
  return clean || null
}

function optionalInteger(value, field, { min, max } = {}) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || (min !== undefined && number < min) || (max !== undefined && number > max)) {
    throw Object.assign(new Error(`${field} must be a whole number${min !== undefined ? ` between ${min} and ${max}` : ''}.`), { statusCode: 400 })
  }
  return number
}

function listLibrary(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120)
  const status = url.searchParams.get('status')
  const clauses = ['entry.user_id = ?']
  const params = [LOCAL_USER_ID]

  if (status && status !== 'all') {
    if (!statuses.has(status)) throw Object.assign(new Error('Unknown reading status.'), { statusCode: 400 })
    clauses.push('entry.status = ?')
    params.push(status)
  }
  if (query) {
    clauses.push('(work.title LIKE ? ESCAPE \'\\\' OR author.name LIKE ? ESCAPE \'\\\')')
    const escapedQuery = query.replace(/[\\%_]/g, '\\$&')
    params.push(`%${escapedQuery}%`, `%${escapedQuery}%`)
  }

  const items = database.prepare(`${librarySelect} WHERE ${clauses.join(' AND ')} ORDER BY entry.updated_at DESC, work.title COLLATE NOCASE`).all(...params)
  const counts = database.prepare(`
    SELECT entry.status, COUNT(*) AS count
    FROM library_entries AS entry
    WHERE entry.user_id = ?
    GROUP BY entry.status
  `).all(LOCAL_USER_ID)
  const summary = { all: 0, to_read: 0, reading: 0, read: 0, paused: 0 }
  for (const row of counts) {
    summary[row.status] = row.count
    summary.all += row.count
  }

  return { items, counts: summary }
}

function createLibraryEntry(payload) {
  const title = cleanText(payload.title, 'Title', { required: true, max: 240 })
  const authorName = cleanText(payload.author, 'Author', { required: true, max: 180 })
  const status = payload.status || 'to_read'
  if (!statuses.has(status)) throw Object.assign(new Error('Unknown reading status.'), { statusCode: 400 })

  const originalYear = optionalInteger(payload.originalYear, 'Original year', { min: 1, max: 3000 })
  const rating = optionalInteger(payload.rating, 'Rating', { min: 1, max: 5 })
  const pageCount = optionalInteger(payload.pageCount, 'Page count', { min: 1, max: 100000 })
  const description = cleanText(payload.description, 'Description', { max: 2000 })
  const review = cleanText(payload.review, 'Review', { max: 5000 })
  const isbn = cleanText(payload.isbn, 'ISBN', { max: 32 })
  const language = cleanText(payload.language, 'Language', { max: 80 })
  const publisher = cleanText(payload.publisher, 'Publisher', { max: 160 })
  const translator = cleanText(payload.translator, 'Translator', { max: 160 })

  const existingAuthor = database.prepare('SELECT id FROM authors WHERE name = ? COLLATE NOCASE').get(authorName)
  const authorId = existingAuthor?.id || randomUUID()
  let workId = null
  const entryId = randomUUID()
  const hasEdition = Boolean(isbn || language || publisher || translator || pageCount)
  const editionId = hasEdition ? randomUUID() : null

  database.exec('BEGIN')
  try {
    if (!existingAuthor) database.prepare('INSERT INTO authors (id, name) VALUES (?, ?)').run(authorId, authorName)
    const matchingWork = database.prepare(`
      SELECT work.id
      FROM works AS work
      JOIN work_authors AS work_author ON work_author.work_id = work.id
      WHERE work.title = ? COLLATE NOCASE
        AND work.original_year IS ?
        AND work_author.author_id = ?
      LIMIT 1
    `).get(title, originalYear, authorId)
    workId = matchingWork?.id || randomUUID()
    if (matchingWork) {
      const existingEntry = database.prepare('SELECT id FROM library_entries WHERE user_id = ? AND work_id = ?').get(LOCAL_USER_ID, workId)
      if (existingEntry) throw Object.assign(new Error('Bu eser kişisel kitaplığında zaten kayıtlı.'), { statusCode: 409 })
    } else {
      database.prepare('INSERT INTO works (id, title, original_year, description) VALUES (?, ?, ?, ?)')
        .run(workId, title, originalYear, description)
      database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)').run(workId, authorId)
    }

    if (hasEdition) {
      database.prepare(`
        INSERT INTO editions (id, work_id, isbn, language, publisher, translator, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(editionId, workId, isbn, language, publisher, translator, pageCount)
    }

    database.prepare(`
      INSERT INTO library_entries (id, user_id, work_id, edition_id, status, rating, review)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, LOCAL_USER_ID, workId, editionId, status, rating, review)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(entryId, LOCAL_USER_ID)
}

function updateLibraryEntry(entryId, payload) {
  const existing = database.prepare(`
    SELECT entry.id, entry.work_id AS workId, entry.edition_id AS editionId, entry.status, entry.rating, entry.review,
      work.title, work.original_year AS originalYear, work.description,
      author.id AS authorId, author.name AS author,
      edition.isbn, edition.language, edition.publisher, edition.translator, edition.page_count AS pageCount
    FROM library_entries AS entry
    JOIN works AS work ON work.id = entry.work_id
    LEFT JOIN work_authors AS work_author ON work_author.work_id = work.id
    LEFT JOIN authors AS author ON author.id = work_author.author_id
    LEFT JOIN editions AS edition ON edition.id = entry.edition_id
    WHERE entry.id = ? AND entry.user_id = ?
  `).get(entryId, LOCAL_USER_ID)
  if (!existing) return null

  const nextStatus = payload.status === undefined ? existing.status : payload.status
  if (!statuses.has(nextStatus)) throw Object.assign(new Error('Unknown reading status.'), { statusCode: 400 })
  const nextRating = payload.rating === undefined ? existing.rating : optionalInteger(payload.rating, 'Rating', { min: 1, max: 5 })
  const nextReview = payload.review === undefined ? existing.review : cleanText(payload.review, 'Review', { max: 5000 })
  const title = payload.title === undefined ? existing.title : cleanText(payload.title, 'Title', { required: true, max: 240 })
  const authorName = payload.author === undefined ? existing.author : cleanText(payload.author, 'Author', { required: true, max: 180 })
  const originalYear = payload.originalYear === undefined ? existing.originalYear : optionalInteger(payload.originalYear, 'Original year', { min: 1, max: 3000 })
  const description = payload.description === undefined ? existing.description : cleanText(payload.description, 'Description', { max: 2000 })
  const isbn = payload.isbn === undefined ? existing.isbn : cleanText(payload.isbn, 'ISBN', { max: 32 })
  const language = payload.language === undefined ? existing.language : cleanText(payload.language, 'Language', { max: 80 })
  const publisher = payload.publisher === undefined ? existing.publisher : cleanText(payload.publisher, 'Publisher', { max: 160 })
  const translator = payload.translator === undefined ? existing.translator : cleanText(payload.translator, 'Translator', { max: 160 })
  const pageCount = payload.pageCount === undefined ? existing.pageCount : optionalInteger(payload.pageCount, 'Page count', { min: 1, max: 100000 })
  const editionHasData = Boolean(isbn || language || publisher || translator || pageCount)
  const editionFieldsProvided = ['isbn', 'language', 'publisher', 'translator', 'pageCount'].some((field) => Object.hasOwn(payload, field))

  database.exec('BEGIN')
  try {
    database.prepare('UPDATE works SET title = ?, original_year = ?, description = ? WHERE id = ?')
      .run(title, originalYear, description, existing.workId)

    if (authorName && authorName !== existing.author) {
      const authorId = database.prepare('SELECT id FROM authors WHERE name = ? COLLATE NOCASE').get(authorName)?.id || randomUUID()
      const knownAuthor = database.prepare('SELECT id FROM authors WHERE id = ?').get(authorId)
      if (!knownAuthor) database.prepare('INSERT INTO authors (id, name) VALUES (?, ?)').run(authorId, authorName)
      database.prepare('DELETE FROM work_authors WHERE work_id = ?').run(existing.workId)
      database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)').run(existing.workId, authorId)
    }

    let editionId = existing.editionId
    if (editionFieldsProvided && editionHasData && editionId) {
      database.prepare(`
        UPDATE editions SET isbn = ?, language = ?, publisher = ?, translator = ?, page_count = ? WHERE id = ?
      `).run(isbn, language, publisher, translator, pageCount, editionId)
    } else if (editionFieldsProvided && editionHasData) {
      editionId = randomUUID()
      database.prepare(`
        INSERT INTO editions (id, work_id, isbn, language, publisher, translator, page_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(editionId, existing.workId, isbn, language, publisher, translator, pageCount)
    }

    if (editionFieldsProvided && !editionHasData && editionId) {
      database.prepare('UPDATE editions SET isbn = NULL, language = NULL, publisher = NULL, translator = NULL, page_count = NULL WHERE id = ?')
        .run(editionId)
    }

    database.prepare(`
      UPDATE library_entries
      SET edition_id = ?, status = ?, rating = ?, review = ?,
          started_at = CASE WHEN ? = 'reading' AND status <> 'reading' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
          completed_at = CASE WHEN ? = 'read' AND status <> 'read' AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(editionFieldsProvided ? editionId : existing.editionId, nextStatus, nextRating, nextReview, nextStatus, nextStatus, entryId, LOCAL_USER_ID)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(entryId, LOCAL_USER_ID)
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    const path = url.pathname.replace(/\/$/, '') || '/'

    if (['POST', 'PATCH', 'DELETE'].includes(request.method) && request.headers.origin) {
      const origin = new URL(request.headers.origin)
      if (!['localhost', '127.0.0.1', '::1'].includes(origin.hostname)) {
        return sendJson(response, 403, { error: 'Cross-origin changes are not allowed.' })
      }
    }

    if (request.method === 'GET' && path === '/api/health') {
      return sendJson(response, 200, { status: 'ok', database: 'connected' })
    }
    if (request.method === 'GET' && path === '/api/export') return sendJson(response, 200, exportArchive())
    if (request.method === 'GET' && path === '/api/themes') return sendJson(response, 200, { items: listThemes(database, LOCAL_USER_ID) })
    if (request.method === 'GET' && path === '/api/notes') return sendJson(response, 200, { items: listNotes(database, LOCAL_USER_ID, { bookId: url.searchParams.get('bookId') || undefined }) })
    if (request.method === 'POST' && path === '/api/notes') return sendJson(response, 201, createNote(database, LOCAL_USER_ID, await readJson(request)))
    if (request.method === 'GET' && path === '/api/atlas') {
      const after = Number(url.searchParams.get('after') || 0)
      if (!Number.isSafeInteger(after) || after < 0) throw Object.assign(new Error('Atlas cursor is invalid.'), { statusCode: 400 })
      return sendJson(response, 200, atlasSnapshot(database, LOCAL_USER_ID, after))
    }
    if (request.method === 'POST' && path === '/api/note-links') return sendJson(response, 201, createNoteLink(database, LOCAL_USER_ID, await readJson(request)))
    if (request.method === 'GET' && path === '/api/library') {
      return sendJson(response, 200, listLibrary(url))
    }
    if (request.method === 'POST' && path === '/api/library') {
      const item = createLibraryEntry(await readJson(request))
      return sendJson(response, 201, item)
    }

    const entryMatch = path.match(/^\/api\/library\/([^/]+)$/)
    if (entryMatch && request.method === 'GET') {
      const item = database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(decodeURIComponent(entryMatch[1]), LOCAL_USER_ID)
      return item ? sendJson(response, 200, item) : sendJson(response, 404, { error: 'Book not found.' })
    }
    if (entryMatch && request.method === 'PATCH') {
      const item = updateLibraryEntry(decodeURIComponent(entryMatch[1]), await readJson(request))
      return item ? sendJson(response, 200, item) : sendJson(response, 404, { error: 'Book not found.' })
    }
    if (entryMatch && request.method === 'DELETE') {
      const hasNotes = database.prepare('SELECT 1 FROM notes WHERE library_entry_id = ? LIMIT 1').get(decodeURIComponent(entryMatch[1]))
      if (hasNotes) return sendJson(response, 409, { error: 'Bu kitaba bağlı notlar var. Önce notları taşı veya sil.' })
      const result = database.prepare('DELETE FROM library_entries WHERE id = ? AND user_id = ?').run(decodeURIComponent(entryMatch[1]), LOCAL_USER_ID)
      return result.changes ? sendJson(response, 200, { deleted: true }) : sendJson(response, 404, { error: 'Book not found.' })
    }

    const bookNotesMatch = path.match(/^\/api\/library\/([^/]+)\/notes$/)
    if (bookNotesMatch && request.method === 'GET') {
      const bookId = decodeURIComponent(bookNotesMatch[1])
      if (!database.prepare('SELECT id FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, LOCAL_USER_ID)) return sendJson(response, 404, { error: 'Book not found.' })
      return sendJson(response, 200, { items: listNotes(database, LOCAL_USER_ID, { bookId }) })
    }
    if (bookNotesMatch && request.method === 'POST') {
      const bookId = decodeURIComponent(bookNotesMatch[1])
      if (!database.prepare('SELECT id FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, LOCAL_USER_ID)) return sendJson(response, 404, { error: 'Book not found.' })
      return sendJson(response, 201, createNote(database, LOCAL_USER_ID, { ...(await readJson(request)), libraryEntryId: bookId }))
    }
    const noteMatch = path.match(/^\/api\/notes\/([^/]+)$/)
    if (noteMatch && request.method === 'GET') {
      const note = getNote(database, LOCAL_USER_ID, decodeURIComponent(noteMatch[1]))
      return note ? sendJson(response, 200, note) : sendJson(response, 404, { error: 'Note not found.' })
    }
    if (noteMatch && request.method === 'PATCH') {
      const note = updateNote(database, LOCAL_USER_ID, decodeURIComponent(noteMatch[1]), await readJson(request))
      return note ? sendJson(response, 200, note) : sendJson(response, 404, { error: 'Note not found.' })
    }
    if (noteMatch && request.method === 'DELETE') {
      const deleted = deleteNote(database, LOCAL_USER_ID, decodeURIComponent(noteMatch[1]))
      return deleted ? sendJson(response, 200, { deleted: true }) : sendJson(response, 404, { error: 'Note not found.' })
    }
    const noteLinkMatch = path.match(/^\/api\/note-links\/([^/]+)$/)
    if (noteLinkMatch && request.method === 'DELETE') {
      const deleted = deleteNoteLink(database, LOCAL_USER_ID, decodeURIComponent(noteLinkMatch[1]))
      return deleted ? sendJson(response, 200, { deleted: true }) : sendJson(response, 404, { error: 'Link not found.' })
    }

    return sendJson(response, 404, { error: 'API route not found.' })
  } catch (error) {
    if (error instanceof TypeError && String(error.message).includes('Invalid URL')) {
      return sendJson(response, 400, { error: 'Invalid request URL.' })
    }
    const statusCode = error.statusCode || (String(error.message).includes('UNIQUE constraint failed') ? 409 : 500)
    if (statusCode >= 500) console.error(error)
    return sendJson(response, statusCode, { error: statusCode === 500 ? 'The request could not be completed.' : error.message })
  }
})

server.listen(port, host, () => {
  console.log(`Chronologos API listening at http://${host}:${port}`)
})

function shutdown() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
