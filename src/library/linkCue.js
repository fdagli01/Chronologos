export const LINK_CUE_STORAGE_KEY = 'chronologos:pending-link-cue'
export const LINK_CUE_MAX_AGE_MS = 120000

export function createLinkCue(savedLink, isEditing, now = Date.now()) {
  if (isEditing || !savedLink?.id || !savedLink.source || !savedLink.target) return null
  return { id: savedLink.id, source: savedLink.source, target: savedLink.target, createdAt: now }
}

export function readPendingLinkCue(storage, now = Date.now()) {
  let cue = null
  try { cue = JSON.parse(storage.getItem(LINK_CUE_STORAGE_KEY) || 'null') } catch { /* Ignore malformed or unavailable storage. */ }
  try { storage.removeItem(LINK_CUE_STORAGE_KEY) } catch { /* Consumption remains one-shot in this page. */ }
  if (!cue?.id || !cue.source || !cue.target || !Number.isFinite(cue.createdAt) || now - cue.createdAt < 0 || now - cue.createdAt > LINK_CUE_MAX_AGE_MS) return null
  return cue
}
