import { randomUUID } from 'node:crypto'

const noteSelect = `
  SELECT n.id, n.kind, n.title, n.content, n.commentary, n.source_locator AS sourceLocator,
    n.library_entry_id AS libraryEntryId, n.edition_id AS editionId, n.is_demo AS isDemo,
    n.created_at AS createdAt, n.updated_at AS updatedAt,
    w.title AS bookTitle, a.name AS author,
    (SELECT group_concat(nt.theme_id, ',') FROM note_themes nt WHERE nt.note_id = n.id) AS themeIds,
    (SELECT group_concat(t.name, ', ') FROM note_themes nt JOIN themes t ON t.id = nt.theme_id WHERE nt.note_id = n.id) AS themeNames
  FROM notes n
  LEFT JOIN library_entries e ON e.id = n.library_entry_id
  LEFT JOIN works w ON w.id = e.work_id
  LEFT JOIN work_authors wa ON wa.work_id = w.id
  LEFT JOIN authors a ON a.id = wa.author_id
`

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode })
}

function text(value, field, { required = false, max = 4000 } = {}) {
  if (value == null) {
    if (required) fail(`${field} alanı gerekli.`)
    return null
  }
  if (typeof value !== 'string') fail(`${field} metin olmalı.`)
  const result = value.trim()
  if (required && !result) fail(`${field} alanı gerekli.`)
  if (result.length > max) fail(`${field} en fazla ${max} karakter olabilir.`)
  return result || null
}

function selectedThemes(db, userId, values) {
  if (values == null) return []
  if (!Array.isArray(values) || values.length > 8) fail('En fazla 8 tema seçebilirsin.')
  const ids = [...new Set(values.map((id) => text(id, 'Tema kimliği', { required: true, max: 80 })))]
  const found = ids.length ? db.prepare(`SELECT id FROM themes WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`).all(userId, ...ids).map((row) => row.id) : []
  if (found.length !== ids.length) fail('Seçilen temalardan biri bulunamadı.', 404)
  return ids
}

function layout(db, userId, noteId, themeId) {
  const theme = themeId && db.prepare('SELECT center_x, center_y, center_z FROM themes WHERE id = ? AND user_id = ?').get(themeId, userId)
  const seed = [...noteId].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 2166136261)
  let state = seed || 1
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296)
  const center = theme ? [theme.center_x, theme.center_y, theme.center_z] : [random() - 0.5, random() - 0.5, random() - 0.5]
  let length = Math.hypot(...center) || 1
  const direction = center.map((value) => value / length)
  const tangent = [direction[2], 0, -direction[0]]
  length = Math.hypot(...tangent) || 1
  tangent.forEach((value, index) => { tangent[index] = value / length })
  const bitangent = [direction[1] * tangent[2] - direction[2] * tangent[1], direction[2] * tangent[0] - direction[0] * tangent[2], direction[0] * tangent[1] - direction[1] * tangent[0]]
  const spread = 0.16 + random() * 0.45
  const angle = random() * Math.PI * 2
  const position = direction.map((value, index) => value + Math.cos(angle) * spread * tangent[index] + Math.sin(angle) * spread * bitangent[index])
  length = Math.hypot(...position)
  return { x: position[0] / length * 21.5, y: position[1] / length * 21.5, z: position[2] / length * 21.5, phase: random() * Math.PI * 2, seed }
}

function writeEvent(db, userId, type, noteId, themeId) {
  db.prepare('INSERT INTO atlas_events (user_id, event_type, note_id, theme_id) VALUES (?, ?, ?, ?)').run(userId, type, noteId, themeId || null)
}

function replaceThemes(db, noteId, themeIds) {
  db.prepare('DELETE FROM note_themes WHERE note_id = ?').run(noteId)
  const insert = db.prepare('INSERT INTO note_themes (note_id, theme_id) VALUES (?, ?)')
  for (const themeId of themeIds) insert.run(noteId, themeId)
}

export function listThemes(db, userId) {
  return db.prepare(`SELECT id, slug, name, color FROM themes WHERE user_id = ?
    ORDER BY CASE slug WHEN 'will' THEN 0 WHEN 'memory' THEN 1 WHEN 'becoming' THEN 2 WHEN 'kinship' THEN 3 ELSE 4 END, created_at, name`).all(userId)
}

export function listNotes(db, userId, { bookId } = {}) {
  const filter = bookId ? ' AND n.library_entry_id = ?' : ''
  const params = bookId ? [userId, bookId] : [userId]
  return db.prepare(`${noteSelect} WHERE n.user_id = ?${filter} GROUP BY n.id ORDER BY n.updated_at DESC`).all(...params)
    .map((item) => ({ ...item, isDemo: Boolean(item.isDemo), themeIds: item.themeIds ? item.themeIds.split(',') : [] }))
}

export function getNote(db, userId, noteId) {
  const item = db.prepare(`${noteSelect} WHERE n.user_id = ? AND n.id = ? GROUP BY n.id`).get(userId, noteId)
  return item ? { ...item, isDemo: Boolean(item.isDemo), themeIds: item.themeIds ? item.themeIds.split(',') : [] } : null
}

function validateSource(db, userId, bookId, editionId) {
  if (bookId && !db.prepare('SELECT id, edition_id FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, userId)) fail('Kaynak kitap bulunamadı.', 404)
  if (editionId) {
    const edition = db.prepare('SELECT id, work_id FROM editions WHERE id = ?').get(editionId)
    const entry = bookId && db.prepare('SELECT work_id FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, userId)
    if (!edition || !entry || edition.work_id !== entry.work_id) fail('Baskı, seçilen kitapla eşleşmiyor.', 400)
  }
}

function insertNote(db, userId, payload) {
  const kind = payload.kind || 'thought'
  if (!['thought', 'quote'].includes(kind)) fail('Not türü geçersiz.')
  const title = text(payload.title, 'Başlık', { max: 180 })
  const content = text(payload.content, kind === 'quote' ? 'Alıntı' : 'Düşünce', { required: true, max: 12000 })
  const commentary = text(payload.commentary, 'Kişisel yorum', { max: 6000 })
  const sourceLocator = text(payload.sourceLocator, 'Kaynak konumu', { max: 240 })
  const libraryEntryId = text(payload.libraryEntryId, 'Kitap', { max: 80 })
  let editionId = text(payload.editionId, 'Baskı', { max: 80 })
  if (libraryEntryId && !editionId) editionId = db.prepare('SELECT edition_id FROM library_entries WHERE id = ? AND user_id = ?').get(libraryEntryId, userId)?.edition_id || null
  validateSource(db, userId, libraryEntryId, editionId)
  const themeIds = selectedThemes(db, userId, payload.themeIds)
  const noteId = payload.id || randomUUID()
  const coords = layout(db, userId, noteId, themeIds[0])
  db.prepare(`INSERT INTO notes (id, user_id, library_entry_id, edition_id, kind, title, content, commentary, source_locator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(noteId, userId, libraryEntryId, editionId, kind, title, content, commentary, sourceLocator)
  replaceThemes(db, noteId, themeIds)
  db.prepare(`INSERT INTO atlas_nodes (note_id, user_id, primary_theme_id, x, y, z, magnitude, phase, layout_seed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(noteId, userId, themeIds[0] || null, coords.x, coords.y, coords.z, kind === 'quote' ? 3.0 : 2.55, coords.phase, coords.seed)
  writeEvent(db, userId, 'note_created', noteId, themeIds[0])
  return noteId
}

export function createNote(db, userId, payload) {
  const noteId = randomUUID()
  db.exec('BEGIN')
  try {
    insertNote(db, userId, { ...payload, id: noteId })
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getNote(db, userId, noteId)
}

const draftSelect = `SELECT d.id, d.user_id AS userId, d.kind, d.title, d.content, d.commentary,
  d.library_entry_id AS libraryEntryId, d.edition_id AS editionId, d.source_locator AS sourceLocator,
  d.created_at AS createdAt, d.updated_at AS updatedAt, w.title AS bookTitle, a.name AS author,
  (SELECT group_concat(dt.theme_id, ',') FROM nebula_draft_themes dt WHERE dt.draft_id = d.id) AS themeIds,
  (SELECT group_concat(t.name, ', ') FROM nebula_draft_themes dt JOIN themes t ON t.id = dt.theme_id WHERE dt.draft_id = d.id) AS themeNames
  FROM nebula_drafts d LEFT JOIN library_entries e ON e.id = d.library_entry_id
  LEFT JOIN works w ON w.id = e.work_id LEFT JOIN work_authors wa ON wa.work_id = w.id LEFT JOIN authors a ON a.id = wa.author_id`

function normalizeDraft(item) {
  return item ? { ...item, themeIds: item.themeIds ? item.themeIds.split(',') : [] } : null
}

export function listDrafts(db, userId) {
  return db.prepare(`${draftSelect} WHERE d.user_id = ? GROUP BY d.id ORDER BY d.updated_at DESC`).all(userId).map(normalizeDraft)
}

export function getDraft(db, userId, draftId) {
  return normalizeDraft(db.prepare(`${draftSelect} WHERE d.user_id = ? AND d.id = ? GROUP BY d.id`).get(userId, draftId))
}

export function createDraft(db, userId, payload) {
  const kind = payload.kind || 'thought'
  if (!['thought', 'quote'].includes(kind)) fail('Taslak türü geçersiz.')
  const title = text(payload.title, 'Başlık', { max: 180 })
  const content = text(payload.content, kind === 'quote' ? 'Alıntı' : 'Düşünce', { required: true, max: 12000 })
  const commentary = text(payload.commentary, 'Kişisel yorum', { max: 6000 })
  const sourceLocator = text(payload.sourceLocator, 'Kaynak konumu', { max: 240 })
  const libraryEntryId = text(payload.libraryEntryId, 'Kitap', { max: 80 })
  let editionId = text(payload.editionId, 'Baskı', { max: 80 })
  if (libraryEntryId && !editionId) editionId = db.prepare('SELECT edition_id FROM library_entries WHERE id = ? AND user_id = ?').get(libraryEntryId, userId)?.edition_id || null
  validateSource(db, userId, libraryEntryId, editionId)
  const themeIds = selectedThemes(db, userId, payload.themeIds)
  const id = randomUUID()
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO nebula_drafts (id, user_id, kind, title, content, commentary, library_entry_id, edition_id, source_locator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, userId, kind, title, content, commentary, libraryEntryId, editionId, sourceLocator)
    const insert = db.prepare('INSERT INTO nebula_draft_themes (draft_id, theme_id) VALUES (?, ?)')
    for (const themeId of themeIds) insert.run(id, themeId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getDraft(db, userId, id)
}

export function updateDraft(db, userId, draftId, payload) {
  const current = db.prepare('SELECT * FROM nebula_drafts WHERE id = ? AND user_id = ?').get(draftId, userId)
  if (!current) return null
  const kind = payload.kind === undefined ? current.kind : payload.kind
  if (!['thought', 'quote'].includes(kind)) fail('Taslak türü geçersiz.')
  const title = payload.title === undefined ? current.title : text(payload.title, 'Başlık', { max: 180 })
  const content = payload.content === undefined ? current.content : text(payload.content, kind === 'quote' ? 'Alıntı' : 'Düşünce', { required: true, max: 12000 })
  const commentary = payload.commentary === undefined ? current.commentary : text(payload.commentary, 'Kişisel yorum', { max: 6000 })
  const sourceLocator = payload.sourceLocator === undefined ? current.source_locator : text(payload.sourceLocator, 'Kaynak konumu', { max: 240 })
  const libraryEntryId = payload.libraryEntryId === undefined ? current.library_entry_id : text(payload.libraryEntryId, 'Kitap', { max: 80 })
  let editionId = payload.editionId === undefined ? current.edition_id : text(payload.editionId, 'Baskı', { max: 80 })
  if (libraryEntryId && !editionId) editionId = db.prepare('SELECT edition_id FROM library_entries WHERE id = ? AND user_id = ?').get(libraryEntryId, userId)?.edition_id || null
  validateSource(db, userId, libraryEntryId, editionId)
  const themeIds = payload.themeIds === undefined ? db.prepare('SELECT theme_id AS id FROM nebula_draft_themes WHERE draft_id = ?').all(draftId).map((row) => row.id) : selectedThemes(db, userId, payload.themeIds)
  db.exec('BEGIN')
  try {
    db.prepare(`UPDATE nebula_drafts SET kind = ?, title = ?, content = ?, commentary = ?, source_locator = ?, library_entry_id = ?, edition_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .run(kind, title, content, commentary, sourceLocator, libraryEntryId, editionId, draftId, userId)
    db.prepare('DELETE FROM nebula_draft_themes WHERE draft_id = ?').run(draftId)
    const insert = db.prepare('INSERT INTO nebula_draft_themes (draft_id, theme_id) VALUES (?, ?)')
    for (const themeId of themeIds) insert.run(draftId, themeId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getDraft(db, userId, draftId)
}

export function deleteDraft(db, userId, draftId) {
  return Boolean(db.prepare('DELETE FROM nebula_drafts WHERE id = ? AND user_id = ?').run(draftId, userId).changes)
}

export function placeDraft(db, userId, draftId, payload = {}) {
  const current = getDraft(db, userId, draftId)
  if (!current) return null
  const finalDraft = { ...current, ...payload, themeIds: payload.themeIds === undefined ? current.themeIds : payload.themeIds }
  const noteId = randomUUID()
  db.exec('BEGIN')
  try {
    insertNote(db, userId, { ...finalDraft, id: noteId })
    db.prepare('DELETE FROM nebula_drafts WHERE id = ? AND user_id = ?').run(draftId, userId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getNote(db, userId, noteId)
}

export function updateNote(db, userId, noteId, payload) {
  const current = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId)
  if (!current) return null
  const kind = payload.kind === undefined ? current.kind : payload.kind
  if (!['thought', 'quote'].includes(kind)) fail('Not türü geçersiz.')
  const title = payload.title === undefined ? current.title : text(payload.title, 'Başlık', { max: 180 })
  const content = payload.content === undefined ? current.content : text(payload.content, kind === 'quote' ? 'Alıntı' : 'Düşünce', { required: true, max: 12000 })
  const commentary = payload.commentary === undefined ? current.commentary : text(payload.commentary, 'Kişisel yorum', { max: 6000 })
  const sourceLocator = payload.sourceLocator === undefined ? current.source_locator : text(payload.sourceLocator, 'Kaynak konumu', { max: 240 })
  const libraryEntryId = payload.libraryEntryId === undefined ? current.library_entry_id : text(payload.libraryEntryId, 'Kitap', { max: 80 })
  const editionId = payload.editionId === undefined ? current.edition_id : text(payload.editionId, 'Baskı', { max: 80 })
  validateSource(db, userId, libraryEntryId, editionId)
  const themeIds = payload.themeIds === undefined ? db.prepare('SELECT theme_id AS id FROM note_themes WHERE note_id = ?').all(noteId).map((row) => row.id) : selectedThemes(db, userId, payload.themeIds)
  db.exec('BEGIN')
  try {
    db.prepare(`UPDATE notes SET kind = ?, title = ?, content = ?, commentary = ?, source_locator = ?, library_entry_id = ?, edition_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .run(kind, title, content, commentary, sourceLocator, libraryEntryId, editionId, noteId, userId)
    replaceThemes(db, noteId, themeIds)
    db.prepare('UPDATE atlas_nodes SET primary_theme_id = ? WHERE note_id = ? AND user_id = ?').run(themeIds[0] || null, noteId, userId)
    writeEvent(db, userId, 'note_updated', noteId, themeIds[0])
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return getNote(db, userId, noteId)
}

export function deleteNote(db, userId, noteId) {
  const existing = db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId)
  if (!existing) return false
  db.exec('BEGIN')
  try {
    writeEvent(db, userId, 'note_deleted', noteId, null)
    db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(noteId, userId)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return true
}

export function atlasSnapshot(db, userId, after = 0) {
  const nodes = db.prepare(`SELECT n.id, n.kind, n.title, n.content, n.commentary, n.source_locator AS sourceLocator,
      n.library_entry_id AS libraryEntryId, n.edition_id AS editionId, n.created_at AS createdAt,
      node.x, node.y, node.z, node.magnitude, node.phase, node.primary_theme_id AS themeId,
      t.name AS themeName, t.color AS color,
      (SELECT group_concat(nt.theme_id, ',') FROM note_themes nt WHERE nt.note_id = n.id) AS themeIds,
      w.title AS bookTitle, a.name AS author
    FROM notes n JOIN atlas_nodes node ON node.note_id = n.id
    LEFT JOIN themes t ON t.id = node.primary_theme_id
    LEFT JOIN library_entries e ON e.id = n.library_entry_id LEFT JOIN works w ON w.id = e.work_id
    LEFT JOIN work_authors wa ON wa.work_id = w.id LEFT JOIN authors a ON a.id = wa.author_id
    WHERE n.user_id = ? GROUP BY n.id ORDER BY n.created_at`).all(userId).map((row) => ({
      ...row, position: [row.x, row.y, row.z], isNote: true, themeIds: row.themeIds ? row.themeIds.split(',') : [],
    }))
  const links = db.prepare(`SELECT id, source_note_id AS source, target_note_id AS target, relationship, rationale
    FROM note_links WHERE user_id = ? ORDER BY created_at`).all(userId)
  const themes = listThemes(db, userId)
  const revision = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM atlas_events WHERE user_id = ?').get(userId).seq
  const events = db.prepare(`SELECT seq, event_type AS type, note_id AS noteId, theme_id AS themeId, created_at AS createdAt
    FROM atlas_events WHERE user_id = ? AND seq > ? ORDER BY seq`).all(userId, after)
  return { nodes, links, themes, revision, events }
}

export function createNoteLink(db, userId, payload) {
  const source = text(payload.sourceNoteId, 'Kaynak not', { required: true, max: 80 })
  const target = text(payload.targetNoteId, 'Hedef not', { required: true, max: 80 })
  const relationship = payload.relationship
  if (!['supports', 'challenges', 'extends', 'echoes', 'contrasts'].includes(relationship)) fail('Bağlantı türü geçersiz.')
  if (source === target) fail('Bir not kendisine bağlanamaz.')
  const rationale = text(payload.rationale, 'Bağlantı açıklaması', { max: 1000 })
  const ids = db.prepare(`SELECT id FROM notes WHERE user_id = ? AND id IN (?, ?)`).all(userId, source, target)
  if (ids.length !== 2) fail('Notlardan biri bulunamadı.', 404)
  const id = randomUUID()
  db.exec('BEGIN')
  try {
    db.prepare(`INSERT INTO note_links (id, user_id, source_note_id, target_note_id, relationship, rationale)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, userId, source, target, relationship, rationale)
    writeEvent(db, userId, 'link_changed', source, null)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return db.prepare('SELECT id, source_note_id AS source, target_note_id AS target, relationship, rationale FROM note_links WHERE id = ?').get(id)
}

export function updateNoteLink(db, userId, linkId, payload) {
  const current = db.prepare('SELECT id, source_note_id AS source, target_note_id AS target, relationship, rationale FROM note_links WHERE id = ? AND user_id = ?').get(linkId, userId)
  if (!current) return null
  const source = payload.sourceNoteId === undefined ? current.source : text(payload.sourceNoteId, 'Kaynak not', { required: true, max: 80 })
  const target = payload.targetNoteId === undefined ? current.target : text(payload.targetNoteId, 'Hedef not', { required: true, max: 80 })
  const relationship = payload.relationship === undefined ? current.relationship : payload.relationship
  if (!['supports', 'challenges', 'extends', 'echoes', 'contrasts'].includes(relationship)) fail('Bağlantı türü geçersiz.')
  if (source === target) fail('Bir not kendisine bağlanamaz.')
  const rationale = payload.rationale === undefined ? current.rationale : text(payload.rationale, 'Bağlantı açıklaması', { max: 1000 })
  const ids = db.prepare('SELECT id FROM notes WHERE user_id = ? AND id IN (?, ?)').all(userId, source, target)
  if (ids.length !== 2) fail('Notlardan biri bulunamadı.', 404)
  db.exec('BEGIN')
  try {
    db.prepare(`UPDATE note_links SET source_note_id = ?, target_note_id = ?, relationship = ?, rationale = ? WHERE id = ? AND user_id = ?`)
      .run(source, target, relationship, rationale, linkId, userId)
    writeEvent(db, userId, 'link_changed', source, null)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return db.prepare('SELECT id, source_note_id AS source, target_note_id AS target, relationship, rationale FROM note_links WHERE id = ?').get(linkId)
}

export function setForgottenStarEnabled(db, userId, enabled) {
  db.prepare(`INSERT INTO note_memory_settings (user_id, enabled, enabled_at) VALUES (?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
    ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled,
      enabled_at = CASE WHEN excluded.enabled = 1 THEN COALESCE(note_memory_settings.enabled_at, CURRENT_TIMESTAMP) ELSE note_memory_settings.enabled_at END`)
    .run(userId, enabled ? 1 : 0, enabled ? 1 : 0)
  return getForgottenStarState(db, userId)
}

export function getForgottenStarState(db, userId) {
  const settings = db.prepare('SELECT enabled, enabled_at AS enabledAt FROM note_memory_settings WHERE user_id = ?').get(userId)
  return { enabled: Boolean(settings?.enabled), enabledAt: settings?.enabledAt || null }
}

export function markNoteOpened(db, userId, noteId) {
  if (!db.prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId)) return false
  if (!getForgottenStarState(db, userId).enabled) return false
  db.prepare(`INSERT INTO note_open_history (note_id, user_id, first_opened_at, last_opened_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(note_id) DO UPDATE SET last_opened_at = CURRENT_TIMESTAMP WHERE note_open_history.user_id = excluded.user_id`)
    .run(noteId, userId)
  return true
}

export function getForgottenStar(db, userId) {
  const settings = db.prepare('SELECT enabled, enabled_at AS enabledAt FROM note_memory_settings WHERE user_id = ?').get(userId)
  if (!settings?.enabled || !settings.enabledAt) return { enabled: false, enabledAt: settings?.enabledAt || null, candidate: null }
  const today = db.prepare("SELECT date('now', 'localtime') AS today").get().today
  let daily = db.prepare('SELECT note_id AS noteId FROM daily_note_candidates WHERE user_id = ? AND candidate_date = ?').get(userId, today)
  if (!daily) {
    const candidate = db.prepare(`SELECT note.id FROM notes note
      WHERE note.user_id = ? AND datetime(note.created_at) <= datetime('now', '-6 months')
        AND NOT EXISTS (SELECT 1 FROM note_open_history opened WHERE opened.note_id = note.id
          AND opened.user_id = note.user_id AND datetime(opened.last_opened_at) >= datetime(?))
      ORDER BY COALESCE((SELECT opened.last_opened_at FROM note_open_history opened WHERE opened.note_id = note.id), note.created_at), note.created_at, note.id
      LIMIT 1`).get(userId, settings.enabledAt)
    db.prepare('INSERT INTO daily_note_candidates (user_id, candidate_date, note_id) VALUES (?, ?, ?)').run(userId, today, candidate?.id || null)
    daily = { noteId: candidate?.id || null }
  }
  return { enabled: true, enabledAt: settings.enabledAt, date: today, candidate: daily.noteId ? getNote(db, userId, daily.noteId) : null }
}

export function deleteNoteLink(db, userId, linkId) {
  const link = db.prepare('SELECT id, source_note_id AS source FROM note_links WHERE id = ? AND user_id = ?').get(linkId, userId)
  if (!link) return false
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM note_links WHERE id = ? AND user_id = ?').run(linkId, userId)
    writeEvent(db, userId, 'link_changed', link.source, null)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return true
}
