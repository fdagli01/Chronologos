import { randomUUID } from 'node:crypto'

export function collectionArchive(db, userId) {
  return {
    collections: db.prepare('SELECT id, name, created_at AS createdAt FROM collections WHERE user_id = ? ORDER BY name COLLATE NOCASE').all(userId),
    collectionBooks: db.prepare(`SELECT cb.collection_id AS collectionId, cb.library_entry_id AS libraryEntryId FROM collection_books cb
      JOIN collections c ON c.id = cb.collection_id JOIN library_entries e ON e.id = cb.library_entry_id
      WHERE c.user_id = ? AND e.user_id = ?`).all(userId, userId),
  }
}

export function handleCollections(db, userId, method, path, payload) {
  if (path !== '/api/collections' && !path.startsWith('/api/collections/')) return null
  const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }) }
  const name = () => {
    if (typeof payload?.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 80) fail('Koleksiyon adı 1–80 karakter olmalı.')
    return payload.name.trim()
  }
  if (path === '/api/collections') {
    if (method === 'GET') {
      const archive = collectionArchive(db, userId)
      return { items: archive.collections.map(c => ({ ...c, bookIds: archive.collectionBooks.filter(b => b.collectionId === c.id).map(b => b.libraryEntryId) })) }
    }
    if (method === 'POST') {
      const id = randomUUID()
      db.prepare('INSERT INTO collections(id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name())
      return { id }
    }
    fail('İşlem desteklenmiyor.', 405)
  }
  const match = path.match(/^\/api\/collections\/([^/]+)(?:\/books\/([^/]+))?$/)
  if (!match) fail('Koleksiyon bulunamadı.', 404)
  const id = decodeURIComponent(match[1])
  if (!db.prepare('SELECT 1 FROM collections WHERE id = ? AND user_id = ?').get(id, userId)) fail('Koleksiyon bulunamadı.', 404)
  if (match[2]) {
    const bookId = decodeURIComponent(match[2])
    if (!db.prepare('SELECT 1 FROM library_entries WHERE id = ? AND user_id = ?').get(bookId, userId)) fail('Kitap bulunamadı.', 404)
    if (method === 'PUT') db.prepare('INSERT OR IGNORE INTO collection_books VALUES (?, ?)').run(id, bookId)
    else if (method === 'DELETE') db.prepare('DELETE FROM collection_books WHERE collection_id = ? AND library_entry_id = ?').run(id, bookId)
    else fail('İşlem desteklenmiyor.', 405)
  } else if (method === 'PATCH') db.prepare('UPDATE collections SET name = ? WHERE id = ? AND user_id = ?').run(name(), id, userId)
  else if (method === 'DELETE') db.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').run(id, userId)
  else fail('İşlem desteklenmiyor.', 405)
  return { saved: true }
}
