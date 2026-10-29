import { t, useLanguage } from '../i18n/index.js'
import { LanguageSelector } from '../i18n/LanguageSelector.jsx'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ACESFilmicToneMapping, Ray, Sphere, SRGBColorSpace, Vector3 } from 'three'
import { Planetarium } from './Planetarium.jsx'
import { ArchivePortal } from './ArchivePortal.jsx'
import { handleArchiveLink } from '../navigation/portalTransition.js'
import { takeAuthorCompassDestination } from '../navigation/authorCompass.js'
import { clusterBookPlaces, groupBookPlaces, hasBookCoordinates } from './bookPlaces.js'
import { AtlasPerformance } from './AtlasPerformance.jsx'
import { LINK_CUE_MAX_AGE_MS, LINK_CUE_STORAGE_KEY, readPendingLinkCue } from '../library/linkCue.js'

const memoryEarth = new Sphere(new Vector3(), 2.56)
const memoryCamera = new Vector3(0, 0.12, 10.7)
const displayPlaceLabel = (place) => place?.isCluster ? t(place.label) : place?.label
const atlasBenchmarkEnabled = new URLSearchParams(window.location.search).get('atlasBench') === '1'

function SceneReady({ onReady }) {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) onReady()
  })
  return null
}

function starIsVisible(node) {
  const point = new Vector3(...node.position)
  const ray = new Ray(memoryCamera, point.clone().sub(memoryCamera).normalize())
  const hit = ray.intersectSphere(memoryEarth, new Vector3())
  return !hit || memoryCamera.distanceTo(hit) >= memoryCamera.distanceTo(point) - 0.02
}

export default function AtlasApp({ revealRequest, onArrivalReady }) {
  useLanguage()
  const [compassDestination, setCompassDestination] = useState(takeAuthorCompassDestination)
  const [libraryBooks, setLibraryBooks] = useState([])
  const [booksPanelOpen, setBooksPanelOpen] = useState(false)
  const [bookSearch, setBookSearch] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [selectedAtlasBookId, setSelectedAtlasBookId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bookMarkersEnabled, setBookMarkersEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:atlas-book-markers') !== 'off' } catch { return true }
  })
  const [atlasData, setAtlasData] = useState({ nodes: [], links: [], themes: [], revision: 0, events: [] })
  const [linkCreationCue, setLinkCreationCue] = useState(null)
  const [visibleLinkCueId, setVisibleLinkCueId] = useState(null)
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('note'))
  const [presentationMode, setPresentationMode] = useState(() => new URLSearchParams(window.location.search).has('note') ? 'manual' : null)
  const [tableauMode, setTableauMode] = useState(() => Boolean(document.fullscreenElement))
  const [tableauResting, setTableauResting] = useState(false)
  const [memoriesEnabled, setMemoriesEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:memories') !== 'off' } catch { return true }
  })
  const [memoryClosing, setMemoryClosing] = useState(false)
  const [sceneReveal, setSceneReveal] = useState(revealRequest || null)
  const [sceneReady, setSceneReady] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const markSceneReady = useCallback(() => setSceneReady(true), [])
  const revision = useRef(0)
  const firstSnapshot = useRef(true)
  const fetching = useRef(false)
  const acceptedLinkCue = useRef(null)
  const selectedLineRef = useRef(null)
  const selectedPointRef = useRef(null)
  const selectedCardRef = useRef(null)
  const portalElementRef = useRef(null)
  const initialRouteNote = useRef(new URLSearchParams(window.location.search).get('note'))
  const selectedNote = atlasData.nodes.find((node) => node.id === selectedId)
  useEffect(() => {
    if (sceneReady && dataReady) onArrivalReady?.()
  }, [sceneReady, dataReady, onArrivalReady])
  const selectedLinks = selectedNote ? atlasData.links.filter((link) => link.source === selectedNote.id || link.target === selectedNote.id) : []
  const memoryNoteSignature = atlasData.nodes.map((note) => `${note.id}:${note.createdAt}`).join('|')
  const bookPlaces = useMemo(() => groupBookPlaces(libraryBooks), [libraryBooks])
  const bookMarkerGroups = useMemo(() => clusterBookPlaces(bookPlaces), [bookPlaces])
  const selectedPlace = bookMarkerGroups.find((place) => place.id === selectedPlaceId) || null
  const selectedAtlasBook = libraryBooks.find((book) => book.id === selectedAtlasBookId) || null
  const visibleBooks = useMemo(() => {
    const candidates = selectedPlace ? selectedPlace.books : libraryBooks
    const query = bookSearch.trim().toLocaleLowerCase('tr')
    return candidates.filter((book) => !query || `${book.title} ${book.author}`.toLocaleLowerCase('tr').includes(query))
      .sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  }, [bookSearch, libraryBooks, selectedPlace])

  const refreshLibrary = useCallback(async () => {
    try {
      const response = await fetch('/api/library', { cache: 'no-store' })
      if (!response.ok) return
      const result = await response.json()
      setLibraryBooks((result.items || []).filter((book) => book.status === 'read'))
    } catch { /* Book discovery stays available when the local API reconnects. */ }
  }, [])

  useEffect(() => {
    refreshLibrary()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refreshLibrary() }, 60000)
    window.addEventListener('focus', refreshLibrary)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refreshLibrary) }
  }, [refreshLibrary])

  useEffect(() => {
    const syncFullscreen = () => setTableauMode(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    if (!tableauMode) { setTableauResting(false); return undefined }
    let timer
    const revealControls = () => {
      setTableauResting(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setTableauResting(true), 8000)
    }
    revealControls()
    window.addEventListener('pointermove', revealControls, { passive: true })
    window.addEventListener('pointerdown', revealControls, { passive: true })
    window.addEventListener('keydown', revealControls)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', revealControls)
      window.removeEventListener('pointerdown', revealControls)
      window.removeEventListener('keydown', revealControls)
    }
  }, [tableauMode])

  const toggleTableauMode = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // Keep the atlas usable if the host window does not allow fullscreen requests.
    }
  }, [])

  const refresh = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    try {
      const response = await fetch(`/api/atlas?after=${revision.current}`, { cache: 'no-store' })
      if (!response.ok) return
      const next = await response.json()
      if (!firstSnapshot.current && next.revision === revision.current) return
      const newNotes = firstSnapshot.current ? [] : next.events?.filter((event) => event.type === 'note_created') || []
      if (newNotes.length) {
        const last = newNotes.at(-1)
        if (next.nodes.some((node) => node.id === last.noteId)) setSceneReveal({ id: `${last.noteId}-${last.seq}`, noteId: last.noteId, themeId: last.themeId })
      }
      revision.current = next.revision
      firstSnapshot.current = false
      setAtlasData(next)
    } catch { /* Atlas remains ambient while the local API is offline. */ }
    finally { fetching.current = false; setDataReady(true) }
  }, [])

  useEffect(() => {
    const acceptCue = (cue) => {
      const age = Date.now() - cue?.createdAt
      if (!cue?.id || !cue.source || !cue.target || !Number.isFinite(age) || age < 0 || age > LINK_CUE_MAX_AGE_MS || acceptedLinkCue.current === cue.id) return
      acceptedLinkCue.current = cue.id
      setLinkCreationCue(cue)
      refresh()
    }
    try { acceptCue(readPendingLinkCue(window.localStorage)) } catch { /* Storage can be unavailable in private browsing. */ }
    refresh()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 18000)
    const onFocus = () => refresh()
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    let channel
    try {
      channel = new BroadcastChannel('chronologos-notes')
      channel.onmessage = (event) => {
        if (event.data?.type === 'changed') refresh()
        if (event.data?.type === 'link-created') {
          try { localStorage.removeItem(LINK_CUE_STORAGE_KEY) } catch { /* The live signal remains usable. */ }
          acceptCue(event.data)
        }
        if (event.data?.type === 'memories') setMemoriesEnabled(Boolean(event.data.enabled))
      }
    } catch { /* Focus and polling still keep the two views in sync. */ }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      channel?.close()
    }
  }, [refresh])

  useEffect(() => {
    if (!linkCreationCue) return undefined
    if (Date.now() - linkCreationCue.createdAt > LINK_CUE_MAX_AGE_MS) { setLinkCreationCue(null); return undefined }
    const hasEndpoints = atlasData.nodes.some((node) => node.id === linkCreationCue.source) && atlasData.nodes.some((node) => node.id === linkCreationCue.target)
    if (!sceneReady || !dataReady || !hasEndpoints || !atlasData.links.some((link) => link.id === linkCreationCue.id)) return undefined
    const timer = window.setTimeout(() => {
      const stillFresh = Date.now() - linkCreationCue.createdAt <= LINK_CUE_MAX_AGE_MS
      const endpointsRemain = atlasData.nodes.some((node) => node.id === linkCreationCue.source) && atlasData.nodes.some((node) => node.id === linkCreationCue.target)
      if (stillFresh && endpointsRemain) setVisibleLinkCueId(linkCreationCue.id)
      else setLinkCreationCue(null)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [linkCreationCue, sceneReady, dataReady, atlasData.links, atlasData.nodes])

  useEffect(() => {
    if (!visibleLinkCueId) return undefined
    const timer = window.setTimeout(() => { setVisibleLinkCueId(null); setLinkCreationCue(null) }, 650)
    return () => window.clearTimeout(timer)
  }, [visibleLinkCueId])

  const selectNote = useCallback((id) => {
    setMemoryClosing(false)
    setSelectedId(id)
    setPresentationMode('manual')
    fetch(`/api/notes/${encodeURIComponent(id)}/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
    const url = new URL(window.location.href)
    url.searchParams.set('note', id)
    window.history.replaceState({}, '', url)
  }, [])

  useEffect(() => {
    const noteId = initialRouteNote.current
    if (!noteId || firstSnapshot.current || !atlasData.nodes.some((note) => note.id === noteId)) return
    initialRouteNote.current = null
    fetch(`/api/notes/${encodeURIComponent(noteId)}/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
  }, [atlasData.nodes])

  const closeNote = useCallback(() => {
    setMemoryClosing(false)
    setSelectedId(null)
    setPresentationMode(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('note')
    window.history.replaceState({}, '', url)
  }, [])

  useEffect(() => {
    if (!compassDestination) return
    setBooksPanelOpen(true)
    if (compassDestination.bookId) setSelectedAtlasBookId(compassDestination.bookId)
  }, [compassDestination?.requestId])

  const selectBookPlace = useCallback((place) => {
    setBooksPanelOpen(true)
    setSettingsOpen(false)
    setSelectedPlaceId(place.id)
    setSelectedAtlasBookId(null)
    setBookSearch('')
    closeNote()
  }, [closeNote])

  const openAtlasBook = useCallback((book) => {
    setBooksPanelOpen(true)
    setSettingsOpen(false)
    setSelectedAtlasBookId(book.id)
    closeNote()
    if (hasBookCoordinates(book)) {
      setCompassDestination({
        requestId: crypto.randomUUID(), bookId: book.id, title: book.title, author: book.author,
        latitude: Number(book.settingLatitude), longitude: Number(book.settingLongitude),
        label: book.settingLabel || '', kind: 'setting',
      })
    }
  }, [closeNote])

  const setBookMarkerPreference = useCallback((enabled) => {
    setBookMarkersEnabled(enabled)
    try { localStorage.setItem('chronologos:atlas-book-markers', enabled ? 'on' : 'off') } catch { /* The current session still uses the selected setting. */ }
  }, [])

  const setMemoryPreference = useCallback((enabled) => {
    setMemoriesEnabled(enabled)
    try { localStorage.setItem('chronologos:memories', enabled ? 'on' : 'off') } catch { /* Preference is still active for this tab. */ }
    try { const channel = new BroadcastChannel('chronologos-notes'); channel.postMessage({ type: 'memories', enabled }); channel.close() } catch { /* Preference remains local to this tab. */ }
    if (!enabled && presentationMode === 'memory') {
      setSelectedId(null)
      setPresentationMode(null)
    }
  }, [presentationMode])

  useEffect(() => {
    if (!memoriesEnabled || presentationMode || selectedId || compassDestination || booksPanelOpen || settingsOpen || atlasData.nodes.length < 2) return undefined
    let timer
    const arm = () => {
      window.clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      timer = window.setTimeout(() => {
        const byAge = [...atlasData.nodes].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        let candidates = byAge.filter((note) => Date.parse(note.createdAt) < cutoff && starIsVisible(note))
        if (!candidates.length) candidates = byAge.filter((note) => note.id !== byAge.at(-1)?.id && starIsVisible(note))
        if (!candidates.length) { arm(); return }
        let history = []
        try { const stored = JSON.parse(localStorage.getItem('chronologos:memory-history') || '[]'); history = Array.isArray(stored) ? stored : [] } catch { history = [] }
        const fresh = candidates.filter((note) => !history.includes(note.id))
        const pool = fresh.length ? fresh : candidates
        const note = pool[Math.floor(Math.random() * pool.length)]
        try { localStorage.setItem('chronologos:memory-history', JSON.stringify([...history.slice(-11), note.id])) } catch { /* Rotation still works in memory. */ }
        setMemoryClosing(false)
        setSelectedId(note.id)
        setPresentationMode('memory')
        setSceneReveal({ id: `memory-${note.id}-${Date.now()}`, noteId: note.id, themeId: note.themeId })
      }, 180000 + Math.random() * 120000)
    }
    const onActivity = () => arm()
    const onVisibility = () => arm()
    for (const eventName of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(eventName, onActivity, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    arm()
    return () => {
      window.clearTimeout(timer)
      for (const eventName of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.removeEventListener(eventName, onActivity)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [memoryNoteSignature, memoriesEnabled, presentationMode, selectedId, compassDestination, booksPanelOpen, settingsOpen])

  useEffect(() => {
    if (presentationMode !== 'memory' || !selectedId) return undefined
    const note = selectedNote
    const readingTime = Math.min(28000, 15000 + (note?.content?.length || 0) * 48)
    const closingTimer = window.setTimeout(() => setMemoryClosing(true), Math.max(9000, readingTime - 1700))
    const timer = window.setTimeout(() => {
      setSelectedId(null)
      setPresentationMode(null)
    }, readingTime)
    return () => { window.clearTimeout(closingTimer); window.clearTimeout(timer) }
  }, [presentationMode, selectedId, selectedNote?.content])

  useEffect(() => {
    if (firstSnapshot.current || !selectedId || selectedNote) return
    setSelectedId(null)
    setPresentationMode(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('note')
    window.history.replaceState({}, '', url)
  }, [selectedId, selectedNote])

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape' && selectedId) closeNote() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, closeNote])

  return (
    <main className={`painting${tableauMode ? ' painting--tableau' : ''}${tableauResting ? ' painting--resting' : ''}${booksPanelOpen || settingsOpen ? ' painting--panel-open' : ''}`} aria-label={t("Chronologos: a living atlas of thought")}>
      <Canvas
        className="painting__canvas"
        camera={{ position: [0, 0.12, 10.7], fov: 42, near: 0.1, far: 180 }}
        dpr={tableauMode ? [1, 1.5] : [1, 1.65]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.3
        }}
      >
        <Suspense fallback={null}>
          <SceneReady onReady={markSceneReady} />
          {atlasBenchmarkEnabled && <AtlasPerformance sceneReady={sceneReady} dataReady={dataReady} noteCount={atlasData.nodes.length} linkCount={atlasData.links.length} />}
          <Planetarium revealRequest={sceneReveal} linkCreationRequest={linkCreationCue && visibleLinkCueId === linkCreationCue.id ? linkCreationCue : null} compassDestination={compassDestination} bookPlaces={bookMarkerGroups} showBookMarkers={bookMarkersEnabled} onSelectBookPlace={selectBookPlace} atlasData={atlasData} selectedNoteId={selectedId} selectedLineRef={selectedLineRef} selectedPointRef={selectedPointRef} selectedCardRef={selectedCardRef} portalElementRef={portalElementRef} onSelectNote={selectNote} />
        </Suspense>
      </Canvas>
      <nav className="atlas-tools" aria-label={t("Atlas araçları")}>
        <button type="button" className={`atlas-tool${booksPanelOpen ? ' is-active' : ''}`} onClick={() => { setBooksPanelOpen((open) => !open); setSettingsOpen(false); setSelectedAtlasBookId(null); setSelectedPlaceId(null); closeNote() }} aria-expanded={booksPanelOpen}>
          <span aria-hidden="true">⌕</span>{t("Kitapları keşfet")} <small>{libraryBooks.length}</small>
        </button>
        <button type="button" className={`atlas-tool${settingsOpen ? ' is-active' : ''}`} onClick={() => { setSettingsOpen((open) => !open); setBooksPanelOpen(false) }} aria-expanded={settingsOpen}>
          <span aria-hidden="true">⚙</span>{t("Ayarlar")} </button>
      </nav>
      <button className="painting__mode-toggle" type="button" onClick={toggleTableauMode} aria-pressed={tableauMode}>
        <span aria-hidden="true">⛶</span>{tableauMode ? t("Tablo modundan çık") : t("Tablo modu")}
      </button>
      <ArchivePortal elementRef={portalElementRef} />
      {compassDestination && <aside className="atlas-compass" aria-label={compassDestination.kind === 'setting' ? t("Hikâyenin geçtiği yer") : t("Yazarın Pusulası")}><span>✦ {compassDestination.kind === 'setting' ? t("HİKÂYE PUSULASI") : t("YAZARIN PUSULASI")}</span><strong>{compassDestination.label || compassDestination.author}</strong><small>{compassDestination.kind === 'setting' ? t("Hikâyenin ana mekânı") : compassDestination.kind === 'birthplace' ? t("Yazarın doğum yeri") : t("Yazarla ilişkili yer")} · {compassDestination.title}</small><button type="button" onClick={() => setCompassDestination(null)} aria-label={t("Pusula odağını kapat")}>×</button></aside>}
      {settingsOpen && <aside className="atlas-settings" aria-label={t("Atlas ayarları")}>
        <header><div><span>{t("CHRONOLOGOS · TERCİHLER")}</span><h2>{t("Ayarlar")}</h2></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label={t("Ayarları kapat")}>×</button></header>
        <label className="atlas-setting"><input type="checkbox" checked={bookMarkersEnabled} onChange={(event) => setBookMarkerPreference(event.target.checked)} /><span><strong>{t("Dünya’da kitap işaretleri")}</strong><small>{t("Hikâyenin geçtiği yeri bilinen okunmuş kitapları Dünya üzerinde göster. Varsayılan: açık.")}</small></span></label>
        <p>{t("İşaretleri kapatsan da “Kitapları keşfet” panelinden tüm kitaplarda arama yapabilirsin.")}</p>
        <LanguageSelector />
      </aside>}
      {booksPanelOpen && <aside className="atlas-books-panel" aria-label={t("Kitapları keşfet")}>
        <header><div><span>{t("CHRONOLOGOS · KÜTÜPHANE")}</span><h2>{selectedAtlasBook ? selectedAtlasBook.title : displayPlaceLabel(selectedPlace) || t('Kitapları keşfet')}</h2><p>{selectedAtlasBook ? selectedAtlasBook.author : selectedPlace ? t('{value0} kitap · {value1}', { value0: selectedPlace.books.length, value1: selectedPlace.isCluster ? t('{value0} yakın konum', { value0: selectedPlace.placeCount, count: selectedPlace.placeCount }) : t('bu konum'), count: selectedPlace.books.length }) : t('{value0} okunmuş kitap · başlık veya yazar ara', { value0: libraryBooks.length, count: libraryBooks.length })}</p></div><button type="button" onClick={() => { setBooksPanelOpen(false); setSelectedAtlasBookId(null); setSelectedPlaceId(null) }} aria-label={t("Kitap panelini kapat")}>×</button></header>
        {selectedAtlasBook ? <>
          <button className="atlas-books-back" type="button" onClick={() => setSelectedAtlasBookId(null)}>← {selectedPlace ? t("{value0} kitaplarına dön", { value0: displayPlaceLabel(selectedPlace) }) : t("Tüm kitaplara dön")}</button>
          <article className="atlas-book-detail">
            {selectedAtlasBook.coverUrl && <img src={selectedAtlasBook.coverUrl} alt={t("{value0} kapak resmi", { value0: selectedAtlasBook.title })} onError={(event) => { event.currentTarget.hidden = true }} />}
            <span className={`atlas-book-status atlas-book-status--${selectedAtlasBook.status}`}>{t(({ read: 'Okudum', reading: 'Okuyorum', to_read: 'Okuma listemde', paused: 'Ara verdim' })[selectedAtlasBook.status])}</span>
            <h3>{selectedAtlasBook.title}</h3><p className="atlas-book-detail__author">{selectedAtlasBook.author}</p>
            {selectedAtlasBook.settingLabel && <p className="atlas-book-detail__place">✦ {selectedAtlasBook.settingBasis === 'writing_city' ? t("Yazarın eseri kaleme aldığı şehir") : t("Hikâyenin geçtiği yer")} · {selectedAtlasBook.settingLabel}{selectedAtlasBook.settingConfidence ? t(" · {value0}", { value0: t(selectedAtlasBook.settingConfidence === 'high' ? 'Kaynakla doğrulandı' : selectedAtlasBook.settingConfidence === 'medium' ? 'Olası eşleşme' : 'İnceleme bekliyor') }) : ""}{selectedAtlasBook.settingSource && <> · <a href={selectedAtlasBook.settingSource} target="_blank" rel="noreferrer">{t("Kaynak ↗")}</a></>}</p>}
            {selectedAtlasBook.settingNote && <p className="atlas-book-detail__description">{selectedAtlasBook.settingNote}</p>}
            {!selectedAtlasBook.settingLabel && <p className="atlas-book-detail__place">✦ {selectedAtlasBook.settingStatus === 'nonfiction' ? t("Tek bir ana hikâye mekânı yok") : selectedAtlasBook.settingStatus === 'fictional' ? t("Mekân kurgu ya da Dünya dışında") : t("Hikâye mekânı belirsiz")}{selectedAtlasBook.settingSource && <> · <a href={selectedAtlasBook.settingSource} target="_blank" rel="noreferrer">{t("Kaynak ↗")}</a></>}</p>}
            {selectedAtlasBook.description && <p className="atlas-book-detail__description">{selectedAtlasBook.description}</p>}
            <small>{selectedAtlasBook.originalYear || t("Yayın yılı bilinmiyor")}{selectedAtlasBook.pageCount ? t(" · {value0} sayfa", { value0: selectedAtlasBook.pageCount }) : ""}{selectedAtlasBook.noteCount ? t(" · {value0} Atlas notu", { value0: selectedAtlasBook.noteCount }) : ""}</small>
            <a href={`/library?book=${encodeURIComponent(selectedAtlasBook.id)}`} onClick={handleArchiveLink}>{t("Kitap fişini aç ↗")}</a>
          </article>
        </> : <>
          {selectedPlace && <button className="atlas-books-back" type="button" onClick={() => setSelectedPlaceId(null)}>{t("← Tüm kitaplara dön")}</button>}
          <label className="atlas-books-search"><span aria-hidden="true">⌕</span><input value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder={t("Kitap adı veya yazar")} autoFocus /></label>
          <div className="atlas-books-results" role="list" aria-label={t("Kitap sonuçları")}>
            {visibleBooks.map((book) => <button type="button" className="atlas-book-result" role="listitem" key={book.id} onClick={() => openAtlasBook(book)}><strong>{book.title}</strong><span>{book.author}</span><small>{book.settingLabel ? t("{value0}{value1}", { value0: book.settingBasis === 'writing_city' ? t('✦ Yazım şehri: ') : '✦ ', value1: book.settingLabel }) : book.settingStatus === 'nonfiction' ? t("Tek ana mekân yok") : book.settingStatus === 'fictional' ? t("Kurgu / Dünya dışı") : book.settingStatus === 'ambiguous' ? t("Mekân belirsiz") : t("Mekân araştırılıyor")} {t("· Okudum")}</small></button>)}
            {!visibleBooks.length && <p className="atlas-books-empty">{libraryBooks.length ? t("Bu aramayla eşleşen kitap bulunamadı.") : t("Kitaplık yükleniyor…")}</p>}
          </div>
          <footer><span>{visibleBooks.length} {t("kitap gösteriliyor ·", { count: visibleBooks.length })} {bookMarkerGroups.length} {t("harita işareti", { count: bookMarkerGroups.length })}</span><a href="/library" onClick={handleArchiveLink}>{t("Kitaplığa git ↗")}</a></footer>
        </>}
      </aside>}
      <div className="painting__grain" aria-hidden="true" />
      <div className="painting__vignette" aria-hidden="true" />
      <div className="inscription inscription--top" aria-hidden="true">
        <span className="inscription__rule" />
        <img className="inscription__mark" src="/chronologos-mark.svg" alt="" />
        <span>{t("CHRONOLOGOS")}</span>
        <span className="inscription__rule" />
      </div>
      <div className="inscription inscription--bottom" aria-hidden="true">
        <span>{t("AN ATLAS OF THOUGHT")}</span>
        <span className="inscription__diamond">✦</span>
        <span>{t("CHRONOS · LOGOS")}</span>
      </div>
      {selectedNote && <svg className="atlas-selection-trace" aria-hidden="true"><line ref={selectedLineRef} x1="0" y1="0" x2="0" y2="0" opacity="0" /><circle ref={selectedPointRef} cx="0" cy="0" r="3" opacity="0" /></svg>}
      {selectedNote && <aside ref={selectedCardRef} className={`atlas-note-card${presentationMode === 'memory' ? ' atlas-note-card--memory' : ''}${memoryClosing ? ' atlas-note-card--closing' : ''}`} aria-label={presentationMode === 'memory' ? t("Arşivden bir düşünce") : t("Seçili düşünce")} aria-live="off"
        onPointerEnter={() => presentationMode === 'memory' && setPresentationMode('manual')}
        onFocusCapture={() => presentationMode === 'memory' && setPresentationMode('manual')}>
        <button className="atlas-note-card__close" onClick={closeNote} aria-label={t("Notu kapat")}>×</button>
        <span className="atlas-note-card__eyebrow"><b>✦</b> {presentationMode === 'memory' ? t("ARŞİVDEN BİR DÜŞÜNCE") : t("SEÇİLİ YILDIZ")} · {selectedNote.kind === 'quote' ? t("ALINTI") : t("DÜŞÜNCE")}{selectedNote.themeName ? t(" · {value0}", { value0: selectedNote.themeName }) : ""}</span>
        {selectedNote.title && <h2>{selectedNote.title}</h2>}
        <p className={selectedNote.kind === 'quote' ? 'atlas-note-card__quote' : ''}>{selectedNote.content}</p>
        {selectedNote.commentary && <p className="atlas-note-card__commentary">{selectedNote.commentary}</p>}
        {(selectedNote.bookTitle || selectedNote.sourceLocator) && <div className="atlas-note-card__source">{selectedNote.bookTitle && <a href={selectedNote.libraryEntryId ? `/library?book=${encodeURIComponent(selectedNote.libraryEntryId)}` : '/library'} onClick={handleArchiveLink}>{selectedNote.bookTitle}{selectedNote.author ? t(" · {value0}", { value0: selectedNote.author }) : ""}</a>}{selectedNote.sourceLocator && <span>{selectedNote.sourceLocator}</span>}</div>}
        {selectedNote.kind === 'quote' && !selectedNote.bookTitle && <div className="atlas-note-card__source"><span>{t("Kaynak kitap belirtilmemiş")}</span>{selectedNote.sourceLocator ? <span>{selectedNote.sourceLocator}</span> : <span>{t("Sayfa / bölüm belirtilmemiş")}</span>}</div>}
        {selectedLinks.length > 0 && <div className="atlas-note-card__relations"><span>{t("BAĞLANTILI DÜŞÜNCELER")}</span>{selectedLinks.slice(0, 3).map((link) => { const outgoing = link.source === selectedNote.id; const other = atlasData.nodes.find((node) => node.id === (outgoing ? link.target : link.source)); const type = { supports: 'destekler', challenges: 'sorgular', extends: t("genişletir"), echoes: t("yankılar"), contrasts: t("karşıtlık gösterir") }[link.relationship]; return <p key={link.id}><b className={`relation--${link.relationship}`}>{outgoing ? t("Bu yıldız") : t("Diğer yıldız")} {outgoing ? type : t("tarafından {type}", { type: type })}</b> · {other?.title || other?.content?.slice(0, 56) || t("Düşünce")}{link.rationale && <small>{link.rationale}</small>}</p> })}</div>}
        <a className="atlas-note-card__archive" href={`/notes?note=${encodeURIComponent(selectedNote.id)}`} onClick={handleArchiveLink}>{t("Arşivde aç ↗")}</a>
        <button className="atlas-note-card__pause" onClick={() => setMemoryPreference(!memoriesEnabled)}>{memoriesEnabled ? t("Anı kartlarını duraklat") : t("Anı kartlarını aç")}</button>
      </aside>}
    </main>
  )
}
