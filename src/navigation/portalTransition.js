const ARRIVAL_KEY = 'chronologos:portal-arrival'
const TRANSITION_MS = 780

function portalOrigin(element) {
  const rect = element?.getBoundingClientRect()
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth * 0.24, y: window.innerHeight * 0.3 }
}

export function navigateThroughPortal(path, originElement) {
  const origin = portalOrigin(originElement)
  const arrival = { ...origin, destination: path }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) {
    try { sessionStorage.removeItem(ARRIVAL_KEY) } catch { /* Navigation still works without stored transition state. */ }
    window.location.assign(path)
    return
  }
  try { sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrival)) } catch { /* Navigation still works without a stored arrival effect. */ }

  const overlay = document.createElement('div')
  overlay.className = 'portal-transition portal-transition--out'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.setProperty('--portal-x', `${origin.x}px`)
  overlay.style.setProperty('--portal-y', `${origin.y}px`)
  document.body.append(overlay)
  window.setTimeout(() => window.location.assign(path), TRANSITION_MS)
}

export function readPortalArrival() {
  try {
    const value = sessionStorage.getItem(ARRIVAL_KEY)
    sessionStorage.removeItem(ARRIVAL_KEY)
    return value ? JSON.parse(value) : null
  } catch { return null }
}
