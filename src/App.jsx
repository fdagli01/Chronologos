import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { LibraryApp } from './library/LibraryApp.jsx'
import { NotesApp } from './library/NotesApp.jsx'
import { readPortalArrival, registerPortalRouter } from './navigation/portalTransition.js'
import { finishPortalBenchmark, markPortalReady, subscribePortalBenchmark } from './navigation/portalBenchmark.js'
import { t, useLanguage } from './i18n/index.js'

const loadAtlas = () => import('./scene/AtlasApp.jsx')
const AtlasApp = lazy(loadAtlas)
const initialArrival = readPortalArrival()
const currentRoute = () => `${window.location.pathname}${window.location.search}${window.location.hash}`
const isAtlas = (route) => !route.startsWith('/notes') && !route.startsWith('/library')

export default function App() {
  useLanguage()
  const [route, setRoute] = useState(currentRoute)
  const [navigationId, setNavigationId] = useState(0)
  const [arrival, setArrival] = useState(initialArrival)
  const [atlasReady, setAtlasReady] = useState(false)
  const [portalReport, setPortalReport] = useState(null)
  const onAtlasReady = useCallback(() => setAtlasReady(true), [])
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ready = !isAtlas(route) || atlasReady

  useEffect(() => subscribePortalBenchmark(setPortalReport), [])

  useEffect(() => {
    if (arrival && ready) markPortalReady()
  }, [arrival, ready])

  useEffect(() => {
    const unregister = registerPortalRouter((path, nextArrival) => {
      window.history.pushState({}, '', path)
      setAtlasReady(false)
      setArrival(nextArrival)
      setRoute(path)
      setNavigationId((value) => value + 1)
      window.scrollTo(0, 0)
    }, (path) => isAtlas(path) ? loadAtlas() : undefined)
    const back = () => { setArrival(null); setAtlasReady(false); setRoute(currentRoute()); setNavigationId((value) => value + 1) }
    window.addEventListener('popstate', back)
    return () => { unregister(); window.removeEventListener('popstate', back) }
  }, [])

  useEffect(() => {
    if (!arrival) return undefined
    // A failed API or WebGL startup must never trap the user behind a cover.
    const timedOut = !ready
    const timer = window.setTimeout(() => { finishPortalBenchmark(timedOut); setArrival(null) }, ready ? reducedMotion ? 0 : arrival.note ? 600 : 420 : 6000)
    return () => window.clearTimeout(timer)
  }, [arrival, ready, reducedMotion])

  let page
  const pageKey = `${navigationId}:${route}`
  if (route.startsWith('/notes')) page = <NotesApp key={pageKey} />
  else if (route.startsWith('/library')) page = <LibraryApp key={pageKey} />
  else page = <Suspense fallback={<main className="painting" aria-label={t('Chronologos yükleniyor')} />}><AtlasApp key={pageKey} revealRequest={arrival?.note} onArrivalReady={onAtlasReady} /></Suspense>

  return <>{page}{portalReport && <aside aria-label="Portal benchmark" style={{ position: 'fixed', zIndex: 10000, left: 12, bottom: 12, padding: '10px 12px', color: '#fff', background: 'rgba(10, 15, 28, .92)', font: '12px/1.5 monospace', border: '1px solid rgba(255,255,255,.35)', borderRadius: 6 }}><strong>Portal benchmark</strong><div>{portalReport.phase} · route {portalReport.route ?? '—'} ms · ready {portalReport.ready ?? '—'} ms</div><div>elapsed {portalReport.elapsed} ms · frames {portalReport.frames.count} · p50 {portalReport.frames.p50 ?? '—'} · p95 {portalReport.frames.p95 ?? '—'} · max {portalReport.frames.max ?? '—'} ms</div></aside>}{arrival && !reducedMotion && (arrival.note
    ? <div className={`note-arrival${ready ? ' note-arrival--ready' : ''}`} aria-hidden="true"><span className="note-arrival__halo" /><span className="note-arrival__caption">{t('Düşüncen Atlas’ta')}</span></div>
    : <div className={`portal-transition portal-transition--in${ready ? ' portal-transition--ready' : ''}`} aria-hidden="true" style={{ '--portal-x': `${arrival.x}px`, '--portal-y': `${arrival.y}px` }} />)}</>
}
