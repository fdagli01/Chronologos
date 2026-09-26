import { lazy, Suspense, useEffect, useState } from 'react'
import { LibraryApp } from './library/LibraryApp.jsx'
import { NotesApp } from './library/NotesApp.jsx'
import { readPortalArrival } from './navigation/portalTransition.js'

const AtlasApp = lazy(() => import('./scene/AtlasApp.jsx'))

export default function App() {
  const [arrival, setArrival] = useState(null)
  useEffect(() => {
    const next = readPortalArrival()
    if (!next || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    setArrival(next)
    const timer = window.setTimeout(() => setArrival(null), 820)
    return () => window.clearTimeout(timer)
  }, [])

  let page
  if (window.location.pathname.startsWith('/notes')) page = <NotesApp />
  else if (window.location.pathname.startsWith('/library')) page = <LibraryApp />
  else page = <Suspense fallback={<main className="painting" aria-label="Chronologos yükleniyor" />}><AtlasApp /></Suspense>

  return <>{page}{arrival && <div className="portal-transition portal-transition--in" aria-hidden="true" style={{ '--portal-x': `${arrival.x}px`, '--portal-y': `${arrival.y}px` }} />}</>
}
