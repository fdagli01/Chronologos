import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { LibraryApp } from './library/LibraryApp.jsx'
import { NotesApp } from './library/NotesApp.jsx'
import { readPortalArrival } from './navigation/portalTransition.js'

const AtlasApp = lazy(() => import('./scene/AtlasApp.jsx'))
// Consume the handoff once, including when React replays mount effects.
const initialArrival = readPortalArrival()

export default function App() {
  const [arrival, setArrival] = useState(initialArrival)
  const [atlasReady, setAtlasReady] = useState(!initialArrival?.note)
  const onAtlasReady = useCallback(() => setAtlasReady(true), [])
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (!arrival) return undefined
    if (!atlasReady) {
      const fallback = window.setTimeout(() => setAtlasReady(true), 6000)
      return () => window.clearTimeout(fallback)
    }
    const timer = window.setTimeout(() => setArrival(null), reducedMotion ? 0 : arrival.note ? 1400 : 820)
    return () => window.clearTimeout(timer)
  }, [arrival, atlasReady, reducedMotion])

  let page
  if (window.location.pathname.startsWith('/notes')) page = <NotesApp />
  else if (window.location.pathname.startsWith('/library')) page = <LibraryApp />
  else page = <Suspense fallback={<main className="painting" aria-label="Chronologos yükleniyor" />}><AtlasApp revealRequest={initialArrival?.note} onArrivalReady={onAtlasReady} /></Suspense>

  return <>{page}{arrival && !reducedMotion && (arrival.note
    ? <div className={`note-arrival${atlasReady ? ' note-arrival--ready' : ''}`} aria-hidden="true"><span className="note-arrival__halo" /><span className="note-arrival__caption">Düşüncen Atlas’ta</span></div>
    : <div className="portal-transition portal-transition--in" aria-hidden="true" style={{ '--portal-x': `${arrival.x}px`, '--portal-y': `${arrival.y}px` }} />)}</>
}
