const KEY = 'chronologos:author-compass'

function validCoordinate(value, limit) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
}

export function setAuthorCompassDestination(book) {
  if (!validCoordinate(book.latitude, 90) || !validCoordinate(book.longitude, 180)) return false
  const destination = {
    requestId: crypto.randomUUID(), bookId: book.id, title: book.title,
    author: book.author, latitude: book.latitude, longitude: book.longitude,
    label: book.locationLabel || '', kind: book.locationKind || 'associated',
  }
  try { sessionStorage.setItem(KEY, JSON.stringify(destination)); return true } catch { return false }
}

export function takeAuthorCompassDestination() {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return null
    const destination = JSON.parse(raw)
    if (!validCoordinate(destination.latitude, 90) || !validCoordinate(destination.longitude, 180)) return null
    return destination
  } catch { return null }
}
