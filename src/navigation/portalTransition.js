import './noteTransition.css'
import { t } from '../i18n/index.js'
import { markPortalRouteHandler, startPortalBenchmark } from './portalBenchmark.js'

const ARRIVAL_KEY = 'chronologos:portal-arrival'
const TRANSITION_MS = 360
let navigating = false
let routeHandler = null
let prepareRoute = null

export function registerPortalRouter(handler, prepare) {
  routeHandler = handler
  prepareRoute = prepare
  return () => { routeHandler = null; prepareRoute = null }
}

// Archive pages share the document without playing an Atlas departure effect.
export async function navigateInArchive(path) {
  const destination = new URL(path, window.location.href)
  if (navigating || destination.origin !== window.location.origin || destination.href === window.location.href) return false
  path = `${destination.pathname}${destination.search}${destination.hash}`
  navigating = true
  try {
    if (routeHandler) {
      await prepareRoute?.(path)
      routeHandler(path, null)
    } else window.location.assign(path)
    return true
  } catch {
    window.location.assign(path)
    return true
  } finally { navigating = false }
}

export function handleArchiveLink(event) {
  const link = event.currentTarget
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
  const destination = new URL(link.href, window.location.href)
  if (destination.origin !== window.location.origin || !['/', '/atlas', '/library', '/notes'].includes(destination.pathname)) return
  event.preventDefault()
  const path = `${destination.pathname}${destination.search}${destination.hash}`
  if (destination.pathname === '/' || destination.pathname === '/atlas' || window.location.pathname === '/' || window.location.pathname === '/atlas') navigateThroughPortal(path, link)
  else navigateInArchive(path)
}

function portalOrigin(element) {
  const rect = element?.getBoundingClientRect()
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth * 0.24, y: window.innerHeight * 0.3 }
}

export async function navigateThroughPortal(path, originElement, note = null) {
  if (navigating) return
  const destination = new URL(path, window.location.href)
  if (destination.origin !== window.location.origin || destination.href === window.location.href) return
  path = `${destination.pathname}${destination.search}${destination.hash}`
  navigating = true
  const origin = portalOrigin(originElement)
  const arrival = { ...origin, destination: path, note, createdAt: Date.now() }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) {
    if (routeHandler) {
      try { await prepareRoute?.(path); routeHandler(path, null) }
      catch { window.location.assign(path) }
      finally { navigating = false }
      return
    }
    try { sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival)) } catch { /* The note URL still identifies the saved note. */ }
    window.location.assign(path)
    return
  }
  startPortalBenchmark()
  if (!routeHandler) {
    try { sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival)) } catch { /* Navigation still works without a stored arrival effect. */ }
  }

  const overlay = document.createElement('div')
  overlay.className = note ? 'note-departure' : 'portal-transition portal-transition--out'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.setProperty('--portal-x', `${origin.x}px`)
  overlay.style.setProperty('--portal-y', `${origin.y}px`)
  overlay.style.setProperty('--portal-dx', `${window.innerWidth * .5 - origin.x}px`)
  overlay.style.setProperty('--portal-dy', `${window.innerHeight * .44 - origin.y}px`)
  if (note) {
    for (const className of ['veil', 'orbit', 'light', 'caption']) {
      const part = document.createElement('span')
      part.className = `note-departure__${className}`
      if (className === 'caption') part.textContent = t('Düşüncen gökyüzünde yerini alıyor')
      overlay.append(part)
    }
  }
  document.body.append(overlay)
  // Fetch the lazy scene while the departure plays; do not reload the document.
  try {
    await Promise.all([
      prepareRoute?.(path),
      new Promise((resolve) => window.setTimeout(resolve, note ? 640 : TRANSITION_MS)),
    ])
    if (!routeHandler) { window.location.assign(path); return }
    markPortalRouteHandler()
    routeHandler(path, arrival)
    // React's arrival cover takes over before removing the departure layer.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      overlay.remove()
      navigating = false
    }))
  } catch {
    window.location.assign(path)
  }
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
