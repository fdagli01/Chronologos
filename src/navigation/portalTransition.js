import './noteTransition.css'

const ARRIVAL_KEY = 'chronologos:portal-arrival'
const TRANSITION_MS = 780
let navigating = false

function portalOrigin(element) {
  const rect = element?.getBoundingClientRect()
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth * 0.24, y: window.innerHeight * 0.3 }
}

export function navigateThroughPortal(path, originElement, note = null) {
  if (navigating) return
  navigating = true
  const origin = portalOrigin(originElement)
  const arrival = { ...origin, destination: path, note, createdAt: Date.now() }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) {
    try { sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival)) } catch { /* The note URL still identifies the saved note. */ }
    window.location.assign(path)
    return
  }
  try { sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival)) } catch { /* Navigation still works without a stored arrival effect. */ }

  const overlay = document.createElement('div')
  overlay.className = note ? 'note-departure' : 'portal-transition portal-transition--out'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.setProperty('--portal-x', `${origin.x}px`)
  overlay.style.setProperty('--portal-y', `${origin.y}px`)
  if (note) {
    for (const className of ['veil', 'orbit', 'light', 'caption']) {
      const part = document.createElement('span')
      part.className = `note-departure__${className}`
      if (className === 'caption') part.textContent = 'Düşüncen gökyüzünde yerini alıyor'
      overlay.append(part)
    }
  }
  document.body.append(overlay)
  window.setTimeout(() => window.location.assign(path), note ? 1300 : TRANSITION_MS)
}

export function carryNoteToAtlas(note, originElement) {
  navigateThroughPortal(`/atlas?note=${encodeURIComponent(note.id)}`, originElement, {
    id: crypto.randomUUID(), noteId: note.id, themeId: note.themeIds?.[0] || 'unplaced', kind: 'note-created',
  })
}

export function readPortalArrival() {
  try {
    const value = sessionStorage.getItem(ARRIVAL_KEY)
    sessionStorage.removeItem(ARRIVAL_KEY)
    const arrival = value ? JSON.parse(value) : null
    return arrival?.destination === `${window.location.pathname}${window.location.search}` && Date.now() - arrival.createdAt < 60000 ? arrival : null
  } catch { return null }
}
