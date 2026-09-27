import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, Ray, Sphere, SRGBColorSpace, Vector3 } from 'three'
import { Planetarium } from './Planetarium.jsx'
import { ArchivePortal } from './ArchivePortal.jsx'
import { navigateThroughPortal } from '../navigation/portalTransition.js'

const memoryEarth = new Sphere(new Vector3(), 2.56)
const memoryCamera = new Vector3(0, 0.12, 10.7)

function starIsVisible(node) {
  const point = new Vector3(...node.position)
  const ray = new Ray(memoryCamera, point.clone().sub(memoryCamera).normalize())
  const hit = ray.intersectSphere(memoryEarth, new Vector3())
  return !hit || memoryCamera.distanceTo(hit) >= memoryCamera.distanceTo(point) - 0.02
}

export default function AtlasApp({ revealRequest }) {
  const [atlasData, setAtlasData] = useState({ nodes: [], links: [], themes: [], revision: 0, events: [] })
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('note'))
  const [presentationMode, setPresentationMode] = useState(() => new URLSearchParams(window.location.search).has('note') ? 'manual' : null)
  const [memoriesEnabled, setMemoriesEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:memories') !== 'off' } catch { return true }
  })
  const [memoryClosing, setMemoryClosing] = useState(false)
  const [sceneReveal, setSceneReveal] = useState(revealRequest || null)
  const revision = useRef(0)
  const firstSnapshot = useRef(true)
  const fetching = useRef(false)
  const selectedLineRef = useRef(null)
  const selectedPointRef = useRef(null)
  const selectedCardRef = useRef(null)
  const portalElementRef = useRef(null)
  const initialRouteNote = useRef(new URLSearchParams(window.location.search).get('note'))
  const selectedNote = atlasData.nodes.find((node) => node.id === selectedId)
  const selectedLinks = selectedNote ? atlasData.links.filter((link) => link.source === selectedNote.id || link.target === selectedNote.id) : []
  const memoryNoteSignature = atlasData.nodes.map((note) => `${note.id}:${note.createdAt}`).join('|')

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
    finally { fetching.current = false }
  }, [])

  useEffect(() => {
    refresh()
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 18000)
    const onFocus = () => refresh()
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    let channel
    try {
      channel = new BroadcastChannel('chronologos-notes')
      channel.onmessage = (event) => {
        if (event.data?.type === 'changed') refresh()
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
    if (!memoriesEnabled || presentationMode || selectedId || atlasData.nodes.length < 2) return undefined
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
  }, [memoryNoteSignature, memoriesEnabled, presentationMode, selectedId])

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
    <main className="painting" aria-label="Chronologos: a living atlas of thought">
      <Canvas
        className="painting__canvas"
        camera={{ position: [0, 0.12, 10.7], fov: 42, near: 0.1, far: 180 }}
        dpr={[1, 1.65]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.3
        }}
      >
        <Suspense fallback={null}>
          <Planetarium revealRequest={sceneReveal} atlasData={atlasData} selectedNoteId={selectedId} selectedLineRef={selectedLineRef} selectedPointRef={selectedPointRef} selectedCardRef={selectedCardRef} portalElementRef={portalElementRef} onSelectNote={selectNote} />
        </Suspense>
      </Canvas>
      <ArchivePortal elementRef={portalElementRef} />
      <div className="painting__grain" aria-hidden="true" />
      <div className="painting__vignette" aria-hidden="true" />
      <div className="inscription inscription--top" aria-hidden="true">
        <span className="inscription__rule" />
        <span>CHRONOLOGOS</span>
        <span className="inscription__rule" />
      </div>
      <div className="inscription inscription--bottom" aria-hidden="true">
        <span>AN ATLAS OF THOUGHT</span>
        <span className="inscription__diamond">✦</span>
        <span>CHRONOS · LOGOS</span>
      </div>
      {selectedNote && <svg className="atlas-selection-trace" aria-hidden="true"><line ref={selectedLineRef} x1="0" y1="0" x2="0" y2="0" opacity="0" /><circle ref={selectedPointRef} cx="0" cy="0" r="3" opacity="0" /></svg>}
      {selectedNote && <aside ref={selectedCardRef} className={`atlas-note-card${presentationMode === 'memory' ? ' atlas-note-card--memory' : ''}${memoryClosing ? ' atlas-note-card--closing' : ''}`} aria-label={presentationMode === 'memory' ? 'Arşivden bir düşünce' : 'Seçili düşünce'} aria-live="off"
        onPointerEnter={() => presentationMode === 'memory' && setPresentationMode('manual')}
        onFocusCapture={() => presentationMode === 'memory' && setPresentationMode('manual')}>
        <button className="atlas-note-card__close" onClick={closeNote} aria-label="Notu kapat">×</button>
        <span className="atlas-note-card__eyebrow"><b>✦</b> {presentationMode === 'memory' ? 'ARŞİVDEN BİR DÜŞÜNCE' : 'SEÇİLİ YILDIZ'} · {selectedNote.kind === 'quote' ? 'ALINTI' : 'DÜŞÜNCE'}{selectedNote.themeName ? ` · ${selectedNote.themeName}` : ''}</span>
        {selectedNote.title && <h2>{selectedNote.title}</h2>}
        <p className={selectedNote.kind === 'quote' ? 'atlas-note-card__quote' : ''}>{selectedNote.content}</p>
        {selectedNote.commentary && <p className="atlas-note-card__commentary">{selectedNote.commentary}</p>}
        {(selectedNote.bookTitle || selectedNote.sourceLocator) && <div className="atlas-note-card__source">{selectedNote.bookTitle && <a href="/library">{selectedNote.bookTitle}{selectedNote.author ? ` · ${selectedNote.author}` : ''}</a>}{selectedNote.sourceLocator && <span>{selectedNote.sourceLocator}</span>}</div>}
        {selectedNote.kind === 'quote' && !selectedNote.bookTitle && <div className="atlas-note-card__source"><span>Kaynak kitap belirtilmemiş</span>{selectedNote.sourceLocator ? <span>{selectedNote.sourceLocator}</span> : <span>Sayfa / bölüm belirtilmemiş</span>}</div>}
        {selectedLinks.length > 0 && <div className="atlas-note-card__relations"><span>BAĞLANTILI DÜŞÜNCELER</span>{selectedLinks.slice(0, 3).map((link) => { const outgoing = link.source === selectedNote.id; const other = atlasData.nodes.find((node) => node.id === (outgoing ? link.target : link.source)); const type = { supports: 'destekler', challenges: 'sorgular', extends: 'genişletir', echoes: 'yankılar', contrasts: 'karşıtlık gösterir' }[link.relationship]; return <p key={link.id}><b className={`relation--${link.relationship}`}>{outgoing ? 'Bu yıldız' : 'Diğer yıldız'} {outgoing ? type : `tarafından ${type}`}</b> · {other?.title || other?.content?.slice(0, 56) || 'Düşünce'}{link.rationale && <small>{link.rationale}</small>}</p> })}</div>}
        <a className="atlas-note-card__archive" href={`/notes?note=${encodeURIComponent(selectedNote.id)}`} onClick={(event) => { event.preventDefault(); navigateThroughPortal(`/notes?note=${encodeURIComponent(selectedNote.id)}`, event.currentTarget) }}>Arşivde aç ↗</a>
        <button className="atlas-note-card__pause" onClick={() => setMemoryPreference(!memoriesEnabled)}>{memoriesEnabled ? 'Anı kartlarını duraklat' : 'Anı kartlarını aç'}</button>
      </aside>}
    </main>
  )
}
