import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { openDatabase, LOCAL_USER_ID } from './database.js'
import { atlasSnapshot, createDraft, createNote, createNoteLink, deleteDraft, deleteNote, deleteNoteLink, getDraft, getForgottenStar, getForgottenStarState, getNote, listDrafts, listNotes, listThemes, markNoteOpened, placeDraft, setForgottenStarEnabled, updateDraft, updateNote, updateNoteLink } from './thoughts.js'
import { localAiStatus, suggestLocalConnections } from './local-ai.js'

const host = process.env.API_HOST || '127.0.0.1'
const port = Number(process.env.API_PORT || 4178)
const database = await openDatabase()

const statuses = new Set(['to_read', 'reading', 'read', 'paused'])
const resonanceTags = new Set(['transformative', 'cornerstone', 'questioning', 'catalyst'])
const librarySelect = `
  SELECT
    entry.id,
    work.id AS workId,
    work.title,
    work.original_year AS originalYear,
    work.description,
    (SELECT json_group_array(author.name) FROM work_authors wa JOIN authors author ON author.id = wa.author_id WHERE wa.work_id = work.id) AS authorsJson,
    work.openlibrary_work_key AS openLibraryWorkKey,
    work.cover_id AS workCoverId,
    edition.id AS editionId,
    edition.isbn,
    edition.language,
    edition.publisher,
    edition.translator,
    edition.page_count AS pageCount,
    edition.openlibrary_edition_key AS openLibraryEditionKey,
    edition.cover_id AS editionCoverId,
    COALESCE(edition.cover_id, work.cover_id) AS coverId,
    (SELECT json_group_array(er.resonance) FROM library_entry_resonances er WHERE er.library_entry_id = entry.id) AS resonanceTagsJson,
    (SELECT COUNT(*) FROM notes n WHERE n.library_entry_id = entry.id) AS noteCount,
    entry.status,
    entry.rating,
    entry.review,
    entry.started_at AS startedAt,
    entry.completed_at AS completedAt,
    entry.current_page AS currentPage,
    entry.progress_percent AS progressPercent,
    entry.latitude,
    entry.longitude,
    entry.location_label AS locationLabel,
    entry.location_kind AS locationKind,
    entry.setting_latitude AS settingLatitude,
    entry.setting_longitude AS settingLongitude,
    entry.setting_label AS settingLabel,
    entry.setting_source AS settingSource,
    entry.setting_confidence AS settingConfidence,
    entry.setting_status AS settingStatus,
    entry.setting_basis AS settingBasis,
    entry.setting_note AS settingNote,
    entry.is_demo AS isDemo,
    entry.created_at AS addedAt,
    entry.updated_at AS updatedAt
  FROM library_entries AS entry
  JOIN works AS work ON work.id = entry.work_id
  LEFT JOIN editions AS edition ON edition.id = entry.edition_id
`

function normalizeLibraryItem(item) {
  if (!item) return null
  const authors = JSON.parse(item.authorsJson || '[]')
  const resonanceTags = JSON.parse(item.resonanceTagsJson || '[]')
  const { authorsJson, resonanceTagsJson, ...fields } = item
  return {
    ...fields,
    authors,
    author: authors.join(', '),
    resonanceTags,
    noteCount: Number(item.noteCount || 0),
    coverUrl: item.coverId ? `https://covers.openlibrary.org/b/id/${item.coverId}-M.jpg?default=false` : null,
    isDemo: Boolean(item.isDemo),
  }
}

function normalizeAuthors(payload) {
  const candidates = Array.isArray(payload.authors) ? payload.authors : [payload.author]
  const authors = [...new Set(candidates.map((name) => typeof name === 'string' ? name.trim() : '').filter(Boolean))]
  if (!authors.length) throw Object.assign(new Error('At least one author is required.'), { statusCode: 400 })
  if (authors.some((name) => name.length > 180)) throw Object.assign(new Error('Author names must be 180 characters or fewer.'), { statusCode: 400 })
  return authors
}

function ensureAuthor(name) {
  const existing = database.prepare('SELECT id FROM authors WHERE name = ? COLLATE NOCASE').get(name)
  if (existing) return existing.id
  const id = randomUUID()
  database.prepare('INSERT INTO authors (id, name) VALUES (?, ?)').run(id, name)
  return id
}

function compassFields(payload, existing = {}) {
  const rawLatitude = payload.latitude === undefined ? existing.latitude ?? null : payload.latitude
  const rawLongitude = payload.longitude === undefined ? existing.longitude ?? null : payload.longitude
  const empty = (value) => value === null || value === ''
  if (empty(rawLatitude) !== empty(rawLongitude)) throw Object.assign(new Error('Enlem ve boylam birlikte girilmeli.'), { statusCode: 400 })
  const latitude = empty(rawLatitude) ? null : Number(rawLatitude)
  const longitude = empty(rawLongitude) ? null : Number(rawLongitude)
  if (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
    throw Object.assign(new Error('Koordinatlar geçerli aralıkta olmalı.'), { statusCode: 400 })
  }
  const locationLabel = payload.locationLabel === undefined ? existing.locationLabel ?? null : cleanText(payload.locationLabel, 'Yer adı', { max: 120 })
  const locationKind = payload.locationKind === undefined ? existing.locationKind ?? 'associated' : payload.locationKind
  if (!['birthplace', 'associated'].includes(locationKind)) throw Object.assign(new Error('Konum türü geçersiz.'), { statusCode: 400 })
  return { latitude, longitude, locationLabel: latitude === null ? null : locationLabel, locationKind: latitude === null ? null : locationKind }
}

function normalizeResonances(value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => !resonanceTags.has(item))) {
    throw Object.assign(new Error('Resonance tags are invalid.'), { statusCode: 400 })
  }
  return [...new Set(value)]
}

function saveResonances(entryId, values) {
  if (values === undefined) return
  database.prepare('DELETE FROM library_entry_resonances WHERE library_entry_id = ?').run(entryId)
  const insert = database.prepare('INSERT INTO library_entry_resonances (library_entry_id, resonance) VALUES (?, ?)')
  for (const value of values) insert.run(entryId, value)
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

function exportArchive() {
  const archive = {
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    user: database.prepare('SELECT id, display_name AS displayName, created_at AS createdAt FROM users WHERE id = ?').get(LOCAL_USER_ID),
    library: database.prepare(`SELECT e.id AS entryId, e.status, e.rating, e.review, e.started_at AS startedAt, e.completed_at AS completedAt,
      e.current_page AS currentPage, e.progress_percent AS progressPercent,
      e.latitude, e.longitude, e.location_label AS locationLabel, e.location_kind AS locationKind,
      e.setting_latitude AS settingLatitude, e.setting_longitude AS settingLongitude, e.setting_label AS settingLabel,
      e.setting_source AS settingSource, e.setting_confidence AS settingConfidence, e.setting_status AS settingStatus,
      e.setting_basis AS settingBasis, e.setting_note AS settingNote,
      e.created_at AS addedAt, e.updated_at AS updatedAt, w.id AS workId, w.title, w.original_year AS originalYear, w.description,
      (SELECT json_group_array(a.name) FROM work_authors wa JOIN authors a ON a.id = wa.author_id WHERE wa.work_id = w.id) AS authors,
      edition.id AS editionId, edition.isbn, edition.language, edition.publisher, edition.translator, edition.page_count AS pageCount,
      w.openlibrary_work_key AS openLibraryWorkKey, w.cover_id AS workCoverId, edition.openlibrary_edition_key AS openLibraryEditionKey, edition.cover_id AS coverId,
      e.is_demo AS isDemo FROM library_entries e JOIN works w ON w.id = e.work_id LEFT JOIN editions edition ON edition.id = e.edition_id
      WHERE e.user_id = ? ORDER BY e.created_at`).all(LOCAL_USER_ID),
    goodreadsImports: database.prepare(`SELECT source, external_id AS externalId, library_entry_id AS libraryEntryId, row_data AS rowData, imported_at AS importedAt
      FROM goodreads_import_records WHERE user_id = ? ORDER BY external_id`).all(LOCAL_USER_ID),
    editions: database.prepare(`SELECT DISTINCT edition.id, edition.work_id AS workId, edition.isbn, edition.language, edition.publisher,
      edition.translator, edition.page_count AS pageCount, edition.openlibrary_edition_key AS openLibraryEditionKey, edition.cover_id AS coverId
      FROM editions edition JOIN works work ON work.id = edition.work_id
      WHERE EXISTS (SELECT 1 FROM library_entries entry WHERE entry.work_id = work.id AND entry.user_id = ?)
         OR EXISTS (SELECT 1 FROM notes note WHERE note.edition_id = edition.id AND note.user_id = ?)
      ORDER BY edition.id`).all(LOCAL_USER_ID, LOCAL_USER_ID),
    libraryEntryResonances: database.prepare(`SELECT resonance.library_entry_id AS libraryEntryId, resonance.resonance
      FROM library_entry_resonances resonance JOIN library_entries entry ON entry.id = resonance.library_entry_id
      WHERE entry.user_id = ? ORDER BY resonance.created_at`).all(LOCAL_USER_ID),
    readingSessions: database.prepare(`SELECT session.id, session.library_entry_id AS libraryEntryId,
      session.started_at AS startedAt, session.completed_at AS completedAt, session.created_at AS createdAt
      FROM reading_sessions session JOIN library_entries entry ON entry.id = session.library_entry_id
      WHERE entry.user_id = ? ORDER BY session.created_at`).all(LOCAL_USER_ID),
    readingGoals: database.prepare(`SELECT year, target, updated_at AS updatedAt FROM reading_goals
      WHERE user_id = ? ORDER BY year`).all(LOCAL_USER_ID),
    notes: database.prepare(`SELECT id, kind, title, content, commentary, source_locator AS sourceLocator,
      library_entry_id AS libraryEntryId, edition_id AS editionId, created_at AS createdAt, updated_at AS updatedAt, is_demo AS isDemo
      FROM notes WHERE user_id = ? ORDER BY created_at`).all(LOCAL_USER_ID),
    nebulaDrafts: database.prepare(`SELECT id, kind, title, content, commentary, library_entry_id AS libraryEntryId,
      edition_id AS editionId, source_locator AS sourceLocator, created_at AS createdAt, updated_at AS updatedAt
      FROM nebula_drafts WHERE user_id = ? ORDER BY created_at`).all(LOCAL_USER_ID),
    nebulaDraftThemes: database.prepare(`SELECT themes.draft_id AS draftId, themes.theme_id AS themeId FROM nebula_draft_themes themes
      JOIN nebula_drafts draft ON draft.id = themes.draft_id WHERE draft.user_id = ?`).all(LOCAL_USER_ID),
    forgottenStar: database.prepare('SELECT enabled, enabled_at AS enabledAt FROM note_memory_settings WHERE user_id = ?').get(LOCAL_USER_ID) || { enabled: 0, enabledAt: null },
    noteOpenHistory: database.prepare(`SELECT note_id AS noteId, first_opened_at AS firstOpenedAt, last_opened_at AS lastOpenedAt
      FROM note_open_history WHERE user_id = ?`).all(LOCAL_USER_ID),
    dailyNoteCandidates: database.prepare(`SELECT candidate_date AS candidateDate, note_id AS noteId, created_at AS createdAt
      FROM daily_note_candidates WHERE user_id = ? ORDER BY candidate_date`).all(LOCAL_USER_ID),
    themes: database.prepare('SELECT id, slug, name, color, center_x AS centerX, center_y AS centerY, center_z AS centerZ FROM themes WHERE user_id = ?').all(LOCAL_USER_ID),
    noteThemes: database.prepare(`SELECT nt.note_id AS noteId, nt.theme_id AS themeId FROM note_themes nt JOIN notes n ON n.id = nt.note_id WHERE n.user_id = ?`).all(LOCAL_USER_ID),
    atlasNodes: database.prepare(`SELECT note_id AS noteId, primary_theme_id AS primaryThemeId, x, y, z, magnitude, phase, layout_seed AS layoutSeed, layout_version AS layoutVersion FROM atlas_nodes WHERE user_id = ?`).all(LOCAL_USER_ID),
    links: database.prepare(`SELECT id, source_note_id AS sourceNoteId, target_note_id AS targetNoteId, relationship, rationale, origin, created_at AS createdAt FROM note_links WHERE user_id = ? ORDER BY created_at`).all(LOCAL_USER_ID),
  }
  archive.library = archive.library.map((item) => ({ ...item, authors: JSON.parse(item.authors || '[]') }))
  return archive
}

const catalogCache = new Map()
const catalogCacheTtl = 10 * 60 * 1000
const placeCache = new Map()
const placeCacheTtl = 24 * 60 * 60 * 1000
let lastPlaceLookupAt = 0

async function catalogFetch(url) {
  const cacheKey = url.toString()
  const cached = catalogCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.payload
  const response = await fetch(url, { headers: { 'user-agent': 'Chronologos/0.1 (personal library lookup)', accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw Object.assign(new Error('Open Library is unavailable right now.'), { statusCode: 502 })
  const payload = await response.json()
  catalogCache.set(cacheKey, { payload, expiresAt: Date.now() + catalogCacheTtl })
  if (catalogCache.size > 100) catalogCache.delete(catalogCache.keys().next().value)
  return payload
}

async function searchCatalog(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120)
  if (!query) throw Object.assign(new Error('Enter an ISBN or book title.'), { statusCode: 400 })
  const isbn = /^[0-9Xx-]{10,17}$/.test(query.replace(/\s/g, ''))
  const providerUrl = new URL('https://openlibrary.org/search.json')
  providerUrl.searchParams.set(isbn ? 'isbn' : 'title', query)
  providerUrl.searchParams.set('limit', '8')
  providerUrl.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,edition_count')
  const result = await catalogFetch(providerUrl)
  return { items: (result.docs || []).map((book) => ({
    workKey: String(book.key || '').replace(/^\/works\//, ''), title: book.title || '', authors: book.author_name || [],
    originalYear: book.first_publish_year || null, coverId: book.cover_i || null, editionCount: book.edition_count || 0,
    coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg?default=false` : null,
  })).filter((book) => /^OL\d+W$/.test(book.workKey)) }
}

async function searchPlaces(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 120)
  if (query.length < 2) throw Object.assign(new Error('Yer aramak için en az iki harf yaz.'), { statusCode: 400 })
  const cacheKey = query.toLocaleLowerCase('tr')
  const cached = placeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.payload
  const delay = 1000 - (Date.now() - lastPlaceLookupAt)
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  lastPlaceLookupAt = Date.now()
  const providerUrl = new URL(process.env.CHRONOLOGOS_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search')
  providerUrl.searchParams.set('q', query)
  providerUrl.searchParams.set('format', 'jsonv2')
  providerUrl.searchParams.set('limit', '6')
  providerUrl.searchParams.set('addressdetails', '1')
  providerUrl.searchParams.set('accept-language', 'tr,en')
  const response = await fetch(providerUrl, {
    headers: { 'user-agent': 'Chronologos/0.1 (personal reading atlas)', accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw Object.assign(new Error('Yer araması şu anda kullanılamıyor. Koordinatları elle girebilirsin.'), { statusCode: 502 })
  const places = await response.json()
  const payload = { items: places.map((place) => ({
    id: `${place.osm_type || 'place'}:${place.osm_id || place.place_id}`,
    label: place.name || place.display_name?.split(',')[0] || query,
    displayName: place.display_name || place.name || query,
    latitude: Number(place.lat), longitude: Number(place.lon),
  })).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) }
  placeCache.set(cacheKey, { payload, expiresAt: Date.now() + placeCacheTtl })
  if (placeCache.size > 200) placeCache.delete(placeCache.keys().next().value)
  return payload
}

async function catalogEditions(workKey) {
  if (!/^OL\d+W$/.test(workKey)) throw Object.assign(new Error('Open Library work ID is invalid.'), { statusCode: 400 })
  const providerUrl = new URL(`https://openlibrary.org/works/${workKey}/editions.json`)
  providerUrl.searchParams.set('limit', '30')
  const result = await catalogFetch(providerUrl)
  return { items: (result.entries || []).map((edition) => ({
    editionKey: String(edition.key || '').replace(/^\/books\//, ''), title: edition.title || '',
    isbn: edition.isbn_13?.[0] || edition.isbn_10?.[0] || '', publisher: edition.publishers?.[0] || '',
    language: edition.languages?.[0]?.key?.replace(/^\/languages\//, '') || '', pageCount: edition.number_of_pages || null,
    publishDate: edition.publish_date || '', coverId: edition.covers?.[0] || null,
  })).filter((edition) => /^OL\d+M$/.test(edition.editionKey)) }
}

function libraryInsights() {
  const notesThisMonth = database.prepare(`SELECT COUNT(*) AS count FROM notes WHERE user_id = ? AND created_at >= datetime('now', 'start of month')`).get(LOCAL_USER_ID).count
  const crossBookLinks = database.prepare(`SELECT COUNT(*) AS count FROM note_links link
    JOIN notes source ON source.id = link.source_note_id JOIN notes target ON target.id = link.target_note_id
    WHERE link.user_id = ? AND source.library_entry_id IS NOT NULL AND target.library_entry_id IS NOT NULL
      AND source.library_entry_id <> target.library_entry_id`).get(LOCAL_USER_ID).count
  const topTheme = database.prepare(`SELECT theme.name, COUNT(*) AS count FROM note_themes nt JOIN notes note ON note.id = nt.note_id
    JOIN themes theme ON theme.id = nt.theme_id WHERE note.user_id = ? GROUP BY theme.id ORDER BY count DESC, theme.name LIMIT 1`).get(LOCAL_USER_ID)
  return { notesThisMonth, crossBookLinks, topTheme: topTheme?.name || null }
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

async function readCsv(request) {
  if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('text/csv')) {
    throw Object.assign(new Error('Content-Type must be text/csv.'), { statusCode: 415 })
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 5 * 1024 * 1024) throw Object.assign(new Error('CSV dosyası 5 MB sınırını aşıyor.'), { statusCode: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '')
}

function parseCsv(text) {
  const rows = []
  let row = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (character === '"') quoted = false
      else field += character
    } else if (character === '"' && field === '') quoted = true
    else if (character === ',') { row.push(field); field = '' }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else field += character
  }
  if (quoted) throw Object.assign(new Error('CSV dosyasında kapanmamış tırnak var.'), { statusCode: 400 })
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  if (rows.length < 2) throw Object.assign(new Error('CSV içinde aktarılacak kitap bulunamadı.'), { statusCode: 400 })
  const headers = rows.shift().map((value) => value.trim())
  const required = ['Book Id', 'Title', 'Author', 'Exclusive Shelf']
  if (required.some((header) => !headers.includes(header))) throw Object.assign(new Error('Bu dosya Goodreads kitaplık dışa aktarımı gibi görünmüyor.'), { statusCode: 400 })
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function cleanIsbn(value) {
  return String(value || '').replace(/^\s*=\s*"(.*)"\s*$/, '$1').replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 32) || null
}

function importGoodreadsCsv(text) {
  const rows = parseCsv(text)
  const counts = { imported: 0, matched: 0, skipped: 0, invalid: 0 }
  const hasRecord = database.prepare('SELECT library_entry_id AS entryId FROM goodreads_import_records WHERE user_id = ? AND source = ? AND external_id = ?')
  const exactMatch = database.prepare(`SELECT entry.id FROM library_entries entry JOIN works work ON work.id = entry.work_id
    WHERE entry.user_id = ? AND work.title = ? COLLATE NOCASE AND EXISTS (
      SELECT 1 FROM work_authors wa JOIN authors author ON author.id = wa.author_id
      WHERE wa.work_id = work.id AND author.name = ? COLLATE NOCASE
    ) LIMIT 1`)
  const insertRecord = database.prepare('INSERT INTO goodreads_import_records (user_id, source, external_id, library_entry_id, row_data) VALUES (?, ?, ?, ?, ?)')
  const insertWork = database.prepare('INSERT INTO works (id, title, original_year) VALUES (?, ?, ?)')
  const insertAuthor = database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)')
  const insertEdition = database.prepare('INSERT INTO editions (id, work_id, isbn, publisher, page_count) VALUES (?, ?, ?, ?, ?)')
  const insertEntry = database.prepare('INSERT INTO library_entries (id, user_id, work_id, edition_id, status, rating, review, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const updateMissing = database.prepare(`UPDATE editions SET isbn = COALESCE(isbn, ?), publisher = COALESCE(publisher, ?), page_count = COALESCE(page_count, ?) WHERE id = ?`)

  database.exec('BEGIN')
  try {
    for (const row of rows) {
      const externalId = String(row['Book Id'] || '').trim()
      const title = String(row.Title || '').trim().slice(0, 240)
      const author = String(row.Author || '').trim().slice(0, 180)
      if (!externalId || !title || !author) { counts.invalid += 1; continue }
      if (hasRecord.get(LOCAL_USER_ID, 'goodreads', externalId)) { counts.skipped += 1; continue }

      const yearValue = Number.parseInt(row['Original Publication Year'], 10)
      const year = Number.isInteger(yearValue) && yearValue >= 1 && yearValue <= 3000 ? yearValue : null
      const pageValue = Number.parseInt(row['Number of Pages'], 10)
      const pages = Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : null
      const ratingValue = Number.parseInt(row['My Rating'], 10)
      const rating = ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null
      const shelf = row['Exclusive Shelf']
      const status = shelf === 'read' ? 'read' : shelf === 'currently-reading' ? 'reading' : 'to_read'
      const dateMatch = String(row['Date Read'] || '').match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
      const completedAt = status === 'read' && dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} 00:00:00` : null
      const isbn = cleanIsbn(row.ISBN13) || cleanIsbn(row.ISBN)
      const publisher = String(row.Publisher || '').trim().slice(0, 160) || null

      let entry = exactMatch.get(LOCAL_USER_ID, title, author)
      if (entry) {
        const record = database.prepare('SELECT edition_id AS editionId FROM library_entries WHERE id = ?').get(entry.id)
        if (record?.editionId) updateMissing.run(isbn, publisher, pages, record.editionId)
        if (completedAt) database.prepare('UPDATE library_entries SET completed_at = COALESCE(completed_at, ?) WHERE id = ?').run(completedAt, entry.id)
        counts.matched += 1
      } else {
        const workId = randomUUID(); const entryId = randomUUID(); const editionId = isbn || publisher || pages ? randomUUID() : null
        insertWork.run(workId, title, year)
        insertAuthor.run(workId, ensureAuthor(author))
        if (editionId) insertEdition.run(editionId, workId, isbn, publisher, pages)
        insertEntry.run(entryId, LOCAL_USER_ID, workId, editionId, status, rating, String(row['My Review'] || '').trim() || null, completedAt)
        entry = { id: entryId }
        counts.imported += 1
      }
      insertRecord.run(LOCAL_USER_ID, 'goodreads', externalId, entry.id, JSON.stringify(row))
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { ...counts, total: rows.length }
}

function previewGoodreadsCsv(text) {
  const rows = parseCsv(text)
  const shelves = { read: 0, 'to-read': 0, 'currently-reading': 0, other: 0 }
  for (const row of rows) shelves[Object.hasOwn(shelves, row['Exclusive Shelf']) ? row['Exclusive Shelf'] : 'other'] += 1
  return { total: rows.length, shelves, rated: rows.filter((row) => Number(row['My Rating']) > 0).length, dated: rows.filter((row) => row['Date Read']).length }
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
  const shelf = url.searchParams.get('shelf')
  const clauses = ['entry.user_id = ?']
  const params = [LOCAL_USER_ID]

  if (status && status !== 'all') {
    if (!statuses.has(status)) throw Object.assign(new Error('Unknown reading status.'), { statusCode: 400 })
    clauses.push('entry.status = ?')
    params.push(status)
  }
  if (query) {
    clauses.push(`(work.title LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM work_authors wa JOIN authors author ON author.id = wa.author_id
      WHERE wa.work_id = work.id AND author.name LIKE ? ESCAPE '\\'
    ))`)
    const escapedQuery = query.replace(/[\\%_]/g, '\\$&')
    params.push(`%${escapedQuery}%`, `%${escapedQuery}%`)
  }

  const hasNotes = 'EXISTS (SELECT 1 FROM notes n WHERE n.library_entry_id = entry.id)'
  if (shelf === 'discover') clauses.push(`NOT ${hasNotes}`)
  else if (shelf === 'working') clauses.push(`entry.status = 'reading' AND ${hasNotes}`)
  else if (shelf === 'atlas') clauses.push(hasNotes)
  else if (shelf && shelf !== 'all') throw Object.assign(new Error('Unknown thinking shelf.'), { statusCode: 400 })

  const items = database.prepare(`${librarySelect} WHERE ${clauses.join(' AND ')} ORDER BY entry.updated_at DESC, work.title COLLATE NOCASE`).all(...params).map(normalizeLibraryItem)
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

  const thinkingShelves = database.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM notes n WHERE n.library_entry_id = entry.id) THEN 1 ELSE 0 END), 0) AS discover,
      COALESCE(SUM(CASE WHEN entry.status = 'reading' AND EXISTS (SELECT 1 FROM notes n WHERE n.library_entry_id = entry.id) THEN 1 ELSE 0 END), 0) AS working,
      COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM notes n WHERE n.library_entry_id = entry.id) THEN 1 ELSE 0 END), 0) AS atlas
    FROM library_entries entry WHERE entry.user_id = ?
  `).get(LOCAL_USER_ID)

  return { items, counts: { ...summary, ...thinkingShelves } }
}

function readingOrbit(year) {
  const goal = database.prepare('SELECT target FROM reading_goals WHERE user_id = ? AND year = ?').get(LOCAL_USER_ID, year)
  const books = database.prepare(`SELECT entry.id, work.title, entry.completed_at AS completedAt
    FROM library_entries entry JOIN works work ON work.id = entry.work_id
    WHERE entry.user_id = ? AND entry.is_demo = 0 AND entry.completed_at LIKE ?
    ORDER BY entry.completed_at, entry.id`).all(LOCAL_USER_ID, `${year}-%`)
  return { year, target: goal?.target ?? null, books, completed: books.length }
}

function completionDate(value) {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error('Bitiş tarihi geçerli bir gün olmalı.'), { statusCode: 400 })
  }
  return `${value} 00:00:00`
}

function createLibraryEntry(payload) {
  const title = cleanText(payload.title, 'Title', { required: true, max: 240 })
  const authors = normalizeAuthors(payload)
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
  const openLibraryWorkKey = cleanText(payload.openLibraryWorkKey, 'Open Library work ID', { max: 80 })
  const openLibraryEditionKey = cleanText(payload.openLibraryEditionKey, 'Open Library edition ID', { max: 80 })
  const coverId = optionalInteger(payload.coverId, 'Cover ID', { min: 1, max: 2147483647 })
  const workCoverId = optionalInteger(payload.workCoverId, 'Work cover ID', { min: 1, max: 2147483647 })
  const compass = compassFields(payload)
  const resonances = normalizeResonances(payload.resonanceTags)
  const catalogWork = openLibraryWorkKey ? database.prepare('SELECT id FROM works WHERE openlibrary_work_key = ?').get(openLibraryWorkKey) : null
  let workId = catalogWork?.id || null
  const entryId = randomUUID()
  const hasEdition = Boolean(isbn || language || publisher || translator || pageCount || openLibraryEditionKey || coverId)
  const editionId = hasEdition ? randomUUID() : null

  database.exec('BEGIN')
  try {
    workId ||= randomUUID()
    const existingEntry = database.prepare('SELECT id FROM library_entries WHERE user_id = ? AND work_id = ?').get(LOCAL_USER_ID, workId)
    if (existingEntry) throw Object.assign(new Error('Bu eser kişisel kitaplığında zaten kayıtlı.'), { statusCode: 409 })
    if (catalogWork) {
      database.prepare('UPDATE works SET title = ?, original_year = COALESCE(original_year, ?), description = COALESCE(description, ?), cover_id = COALESCE(cover_id, ?) WHERE id = ?')
        .run(title, originalYear, description, workCoverId, workId)
      const hasAuthors = database.prepare('SELECT 1 FROM work_authors WHERE work_id = ? LIMIT 1').get(workId)
      if (!hasAuthors) {
        const linkAuthor = database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)')
        for (const name of authors) linkAuthor.run(workId, ensureAuthor(name))
      }
    } else {
      database.prepare('INSERT INTO works (id, title, original_year, description, openlibrary_work_key, cover_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(workId, title, originalYear, description, openLibraryWorkKey, workCoverId)
      const linkAuthor = database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)')
      for (const name of authors) linkAuthor.run(workId, ensureAuthor(name))
    }

    if (hasEdition) {
      database.prepare(`
        INSERT INTO editions (id, work_id, isbn, language, publisher, translator, page_count, openlibrary_edition_key, cover_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(editionId, workId, isbn, language, publisher, translator, pageCount, openLibraryEditionKey, coverId)
    }

    database.prepare(`
      INSERT INTO library_entries (id, user_id, work_id, edition_id, status, rating, review, started_at, completed_at, current_page, progress_percent, latitude, longitude, location_label, location_kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entryId, LOCAL_USER_ID, workId, editionId, status, rating, review,
      status === 'reading' ? new Date().toISOString().slice(0, 10) + ' 00:00:00' : null,
      status === 'read' ? completionDate(payload.completedAt) || new Date().toISOString().slice(0, 10) + ' 00:00:00' : null,
      status === 'read' ? pageCount : null, status === 'read' ? 100 : null,
      compass.latitude, compass.longitude, compass.locationLabel, compass.locationKind)
    saveResonances(entryId, resonances)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return normalizeLibraryItem(database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(entryId, LOCAL_USER_ID))
}

function updateLibraryEntry(entryId, payload) {
  const existing = database.prepare(`
    SELECT entry.id, entry.work_id AS workId, entry.edition_id AS editionId, entry.status, entry.rating, entry.review,
      entry.completed_at AS completedAt, entry.current_page AS currentPage, entry.progress_percent AS progressPercent,
      entry.latitude, entry.longitude, entry.location_label AS locationLabel, entry.location_kind AS locationKind,
      work.title, work.original_year AS originalYear, work.description, work.cover_id AS workCoverId,
      edition.isbn, edition.language, edition.publisher, edition.translator, edition.page_count AS pageCount,
      edition.openlibrary_edition_key AS openLibraryEditionKey, edition.cover_id AS coverId,
      work.openlibrary_work_key AS openLibraryWorkKey
    FROM library_entries AS entry
    JOIN works AS work ON work.id = entry.work_id
    LEFT JOIN editions AS edition ON edition.id = entry.edition_id
    WHERE entry.id = ? AND entry.user_id = ?
  `).get(entryId, LOCAL_USER_ID)
  if (!existing) return null
  const existingAuthors = database.prepare('SELECT a.name FROM work_authors wa JOIN authors a ON a.id = wa.author_id WHERE wa.work_id = ? ORDER BY a.name').all(existing.workId).map((row) => row.name)

  const nextStatus = payload.status === undefined ? existing.status : payload.status
  if (!statuses.has(nextStatus)) throw Object.assign(new Error('Unknown reading status.'), { statusCode: 400 })
  const nextRating = payload.rating === undefined ? existing.rating : optionalInteger(payload.rating, 'Rating', { min: 1, max: 5 })
  const nextReview = payload.review === undefined ? existing.review : cleanText(payload.review, 'Review', { max: 5000 })
  const title = payload.title === undefined ? existing.title : cleanText(payload.title, 'Title', { required: true, max: 240 })
  const authors = payload.authors !== undefined || payload.author !== undefined ? normalizeAuthors(payload) : existingAuthors
  const originalYear = payload.originalYear === undefined ? existing.originalYear : optionalInteger(payload.originalYear, 'Original year', { min: 1, max: 3000 })
  const description = payload.description === undefined ? existing.description : cleanText(payload.description, 'Description', { max: 2000 })
  const isbn = payload.isbn === undefined ? existing.isbn : cleanText(payload.isbn, 'ISBN', { max: 32 })
  const language = payload.language === undefined ? existing.language : cleanText(payload.language, 'Language', { max: 80 })
  const publisher = payload.publisher === undefined ? existing.publisher : cleanText(payload.publisher, 'Publisher', { max: 160 })
  const translator = payload.translator === undefined ? existing.translator : cleanText(payload.translator, 'Translator', { max: 160 })
  const pageCount = payload.pageCount === undefined ? existing.pageCount : optionalInteger(payload.pageCount, 'Page count', { min: 1, max: 100000 })
  const currentPage = payload.currentPage === undefined ? existing.currentPage : optionalInteger(payload.currentPage, 'Current page', { min: 0, max: 100000 })
  if (pageCount && currentPage !== null && currentPage > pageCount) throw Object.assign(new Error('Kaldığın sayfa toplam sayfayı geçemez.'), { statusCode: 400 })
  const progressPercent = payload.progressPercent === undefined ? existing.progressPercent : optionalInteger(payload.progressPercent, 'Progress percent', { min: 0, max: 100 })
  const nextCurrentPage = nextStatus === 'read' && pageCount ? pageCount : currentPage
  const nextProgressPercent = nextStatus === 'read' ? 100 : progressPercent
  const nextCompletedAt = payload.completedAt === undefined
    ? (existing.completedAt || (nextStatus === 'read' && existing.status !== 'read' ? new Date().toISOString().slice(0, 10) + ' 00:00:00' : null))
    : completionDate(payload.completedAt)
  const openLibraryWorkKey = payload.openLibraryWorkKey === undefined ? existing.openLibraryWorkKey : cleanText(payload.openLibraryWorkKey, 'Open Library work ID', { max: 80 })
  const openLibraryEditionKey = payload.openLibraryEditionKey === undefined ? existing.openLibraryEditionKey : cleanText(payload.openLibraryEditionKey, 'Open Library edition ID', { max: 80 })
  const coverId = payload.coverId === undefined ? existing.coverId : optionalInteger(payload.coverId, 'Cover ID', { min: 1, max: 2147483647 })
  const workCoverId = payload.workCoverId === undefined ? existing.workCoverId : optionalInteger(payload.workCoverId, 'Work cover ID', { min: 1, max: 2147483647 })
  const compass = compassFields(payload, existing)
  const resonances = normalizeResonances(payload.resonanceTags)
  const editionHasData = Boolean(isbn || language || publisher || translator || pageCount || openLibraryEditionKey || coverId)
  const editionFieldsProvided = ['isbn', 'language', 'publisher', 'translator', 'pageCount', 'openLibraryEditionKey', 'coverId'].some((field) => Object.hasOwn(payload, field))
  const editionIdentityChanged = Boolean(existing.editionId && (
    (payload.openLibraryEditionKey !== undefined && openLibraryEditionKey !== existing.openLibraryEditionKey) ||
    (payload.isbn !== undefined && isbn !== existing.isbn)
  ))

  database.exec('BEGIN')
  try {
    database.prepare('UPDATE works SET title = ?, original_year = ?, description = ? WHERE id = ?')
      .run(title, originalYear, description, existing.workId)

    if (openLibraryWorkKey !== existing.openLibraryWorkKey) {
      database.prepare('UPDATE works SET openlibrary_work_key = ? WHERE id = ?').run(openLibraryWorkKey, existing.workId)
    }
    if (workCoverId !== existing.workCoverId) database.prepare('UPDATE works SET cover_id = ? WHERE id = ?').run(workCoverId, existing.workId)
    if (payload.authors !== undefined || payload.author !== undefined) {
      database.prepare('DELETE FROM work_authors WHERE work_id = ?').run(existing.workId)
      const linkAuthor = database.prepare('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)')
      for (const name of authors) linkAuthor.run(existing.workId, ensureAuthor(name))
    }

    let editionId = existing.editionId
    if (editionFieldsProvided && editionHasData && editionId && !editionIdentityChanged) {
      database.prepare(`
        UPDATE editions SET isbn = ?, language = ?, publisher = ?, translator = ?, page_count = ?, openlibrary_edition_key = ?, cover_id = ? WHERE id = ?
      `).run(isbn, language, publisher, translator, pageCount, openLibraryEditionKey, coverId, editionId)
    } else if (editionFieldsProvided && editionHasData && (!editionId || editionIdentityChanged)) {
      editionId = randomUUID()
      database.prepare(`
        INSERT INTO editions (id, work_id, isbn, language, publisher, translator, page_count, openlibrary_edition_key, cover_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(editionId, existing.workId, isbn, language, publisher, translator, pageCount, openLibraryEditionKey, coverId)
    }

    if (editionFieldsProvided && !editionHasData) editionId = null

    database.prepare(`
      UPDATE library_entries
      SET edition_id = ?, status = ?, rating = ?, review = ?,
          started_at = CASE WHEN ? = 'reading' AND status <> 'reading' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
          completed_at = ?, current_page = ?, progress_percent = ?,
          latitude = ?, longitude = ?, location_label = ?, location_kind = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(editionFieldsProvided ? editionId : existing.editionId, nextStatus, nextRating, nextReview, nextStatus, nextCompletedAt, nextCurrentPage, nextProgressPercent,
      compass.latitude, compass.longitude, compass.locationLabel, compass.locationKind, entryId, LOCAL_USER_ID)
    saveResonances(entryId, resonances)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return normalizeLibraryItem(database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(entryId, LOCAL_USER_ID))
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
    if (request.method === 'GET' && path === '/api/local-ai/status') return sendJson(response, 200, await localAiStatus())
    if (request.method === 'POST' && path === '/api/local-ai/suggestions') {
      const payload = await readJson(request)
      const noteId = cleanText(payload.noteId, 'Not kimliği', { required: true, max: 80 })
      const source = getNote(database, LOCAL_USER_ID, noteId)
      if (!source) throw Object.assign(new Error('Not bulunamadı.'), { statusCode: 404 })
      const notes = listNotes(database, LOCAL_USER_ID)
      const links = database.prepare('SELECT source_note_id AS source, target_note_id AS target FROM note_links WHERE user_id = ?').all(LOCAL_USER_ID)
      return sendJson(response, 200, await suggestLocalConnections(source, notes, links))
    }
    if (request.method === 'GET' && path === '/api/export') return sendJson(response, 200, exportArchive())
    if (request.method === 'GET' && path === '/api/library/insights') return sendJson(response, 200, libraryInsights())
    if (request.method === 'GET' && path === '/api/catalog/search') return sendJson(response, 200, await searchCatalog(url))
    if (request.method === 'GET' && path === '/api/places/search') return sendJson(response, 200, await searchPlaces(url))
    const catalogEditionsMatch = path.match(/^\/api\/catalog\/works\/([^/]+)\/editions$/)
    if (request.method === 'GET' && catalogEditionsMatch) return sendJson(response, 200, await catalogEditions(decodeURIComponent(catalogEditionsMatch[1])))
    if (request.method === 'GET' && path === '/api/themes') return sendJson(response, 200, { items: listThemes(database, LOCAL_USER_ID) })
    if (request.method === 'GET' && path === '/api/notes') return sendJson(response, 200, { items: listNotes(database, LOCAL_USER_ID, { bookId: url.searchParams.get('bookId') || undefined }) })
    if (request.method === 'POST' && path === '/api/notes') return sendJson(response, 201, createNote(database, LOCAL_USER_ID, await readJson(request)))
    if (request.method === 'GET' && path === '/api/notes/drafts') return sendJson(response, 200, { items: listDrafts(database, LOCAL_USER_ID) })
    if (request.method === 'POST' && path === '/api/notes/drafts') return sendJson(response, 201, createDraft(database, LOCAL_USER_ID, await readJson(request)))
    const draftMatch = path.match(/^\/api\/notes\/drafts\/([^/]+)$/)
    if (draftMatch && request.method === 'PATCH') return sendJson(response, 200, updateDraft(database, LOCAL_USER_ID, decodeURIComponent(draftMatch[1]), await readJson(request)))
    if (draftMatch && request.method === 'DELETE') return sendJson(response, 200, { deleted: deleteDraft(database, LOCAL_USER_ID, decodeURIComponent(draftMatch[1])) })
    const placeDraftMatch = path.match(/^\/api\/notes\/drafts\/([^/]+)\/place$/)
    if (placeDraftMatch && request.method === 'POST') {
      const note = placeDraft(database, LOCAL_USER_ID, decodeURIComponent(placeDraftMatch[1]), await readJson(request))
      return note ? sendJson(response, 201, note) : sendJson(response, 404, { error: 'Taslak bulunamadı.' })
    }
    if (request.method === 'GET' && path === '/api/notes/reminder') return sendJson(response, 200, getForgottenStarState(database, LOCAL_USER_ID))
    if (request.method === 'PATCH' && path === '/api/notes/reminder') {
      const payload = await readJson(request)
      if (typeof payload.enabled !== 'boolean') throw Object.assign(new Error('Hatırlatma tercihi geçersiz.'), { statusCode: 400 })
      return sendJson(response, 200, setForgottenStarEnabled(database, LOCAL_USER_ID, payload.enabled))
    }
    if (request.method === 'GET' && path === '/api/notes/forgotten-star') return sendJson(response, 200, getForgottenStar(database, LOCAL_USER_ID))
    if (request.method === 'GET' && path === '/api/atlas') {
      const after = Number(url.searchParams.get('after') || 0)
      if (!Number.isSafeInteger(after) || after < 0) throw Object.assign(new Error('Atlas cursor is invalid.'), { statusCode: 400 })
      return sendJson(response, 200, atlasSnapshot(database, LOCAL_USER_ID, after))
    }
    if (request.method === 'POST' && path === '/api/note-links') return sendJson(response, 201, createNoteLink(database, LOCAL_USER_ID, await readJson(request)))
    const noteLinkUpdateMatch = path.match(/^\/api\/note-links\/([^/]+)$/)
    if (noteLinkUpdateMatch && request.method === 'PATCH') {
      const link = updateNoteLink(database, LOCAL_USER_ID, decodeURIComponent(noteLinkUpdateMatch[1]), await readJson(request))
      return link ? sendJson(response, 200, link) : sendJson(response, 404, { error: 'Bağlantı bulunamadı.' })
    }
    if (path === '/api/library/orbit' && (request.method === 'GET' || request.method === 'PUT')) {
      const year = optionalInteger(url.searchParams.get('year'), 'Year', { min: 1900, max: 3000 }) || new Date().getFullYear()
      if (request.method === 'PUT') {
        const body = await readJson(request)
        const target = optionalInteger(body.target, 'Target', { min: 1, max: 500 })
        if (target === null) throw Object.assign(new Error('Yıllık hedef için 1–500 arası bir sayı gir.'), { statusCode: 400 })
        database.prepare(`INSERT INTO reading_goals (user_id, year, target) VALUES (?, ?, ?)
          ON CONFLICT(user_id, year) DO UPDATE SET target = excluded.target, updated_at = CURRENT_TIMESTAMP`)
          .run(LOCAL_USER_ID, year, target)
      }
      return sendJson(response, 200, readingOrbit(year))
    }
    if (request.method === 'GET' && path === '/api/library') {
      return sendJson(response, 200, listLibrary(url))
    }
    if (request.method === 'POST' && path === '/api/library') {
      const item = createLibraryEntry(await readJson(request))
      return sendJson(response, 201, item)
    }
    if (request.method === 'POST' && path === '/api/library/import/goodreads') {
      return sendJson(response, 200, importGoodreadsCsv(await readCsv(request)))
    }
    if (request.method === 'POST' && path === '/api/library/import/goodreads/preview') {
      return sendJson(response, 200, previewGoodreadsCsv(await readCsv(request)))
    }

    const entryMatch = path.match(/^\/api\/library\/([^/]+)$/)
    if (entryMatch && request.method === 'GET') {
      const item = database.prepare(`${librarySelect} WHERE entry.id = ? AND entry.user_id = ?`).get(decodeURIComponent(entryMatch[1]), LOCAL_USER_ID)
      return item ? sendJson(response, 200, normalizeLibraryItem(item)) : sendJson(response, 404, { error: 'Book not found.' })
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
    const noteOpenMatch = path.match(/^\/api\/notes\/([^/]+)\/open$/)
    if (noteOpenMatch && request.method === 'POST') {
      const opened = markNoteOpened(database, LOCAL_USER_ID, decodeURIComponent(noteOpenMatch[1]))
      return opened ? sendJson(response, 200, { opened: true }) : sendJson(response, 404, { opened: false })
    }
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
