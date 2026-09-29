import { useEffect, useMemo, useRef, useState } from 'react'
import { carryNoteToAtlas, navigateThroughPortal } from '../navigation/portalTransition.js'
import './library.css'

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'İstek tamamlanamadı.')
  return payload
}

const blank = { kind: 'thought', title: '', content: '', commentary: '', libraryEntryId: '', editionId: '', sourceLocator: '', themeIds: [] }
const relationLabels = { supports: 'destekler', challenges: 'sorgular', extends: 'genişletir', echoes: 'yankılar', contrasts: 'karşıtlık gösterir' }
const stopWords = new Set('acaba ama ancak aslında az bazı ben böyle çünkü çok daha de da değil gibi için ile ise kadar ki mı mi mu mü nasıl ne neden niçin o olan olarak sonra şu veya ve ya yani bir bu'.split(' '))

function noteTerms(note) {
  return new Set(`${note.title || ''} ${note.content || ''} ${note.commentary || ''}`.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]{4,}/gu)?.filter((word) => !stopWords.has(word)) || [])
}

export function NotesApp() {
  const [notes, setNotes] = useState([])
  const [books, setBooks] = useState([])
  const [themes, setThemes] = useState([])
  const [links, setLinks] = useState([])
  const [drafts, setDrafts] = useState([])
  const [quickCapture, setQuickCapture] = useState('')
  const [draftEditorId, setDraftEditorId] = useState(null)
  const [draftForm, setDraftForm] = useState(blank)
  const [reminder, setReminder] = useState({ enabled: false, enabledAt: null })
  const [forgottenStar, setForgottenStar] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:placement-sound') !== 'off' } catch { return true }
  })
  const saveInFlight = useRef(false)
  const [form, setForm] = useState(blank)
  const [showCommentary, setShowCommentary] = useState(false)
  const [showRecordDetails, setShowRecordDetails] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState(() => new URLSearchParams(window.location.search).get('note'))
  const [notesView, setNotesView] = useState(() => new URLSearchParams(window.location.search).has('note') ? 'archive' : 'work')
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [memoriesEnabled, setMemoriesEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:memories') !== 'off' } catch { return true }
  })
  const [query, setQuery] = useState('')
  const [themeFilter, setThemeFilter] = useState('all')
  const [relation, setRelation] = useState({ sourceNoteId: '', targetNoteId: '', relationship: '', rationale: '' })
  const [editingRelationId, setEditingRelationId] = useState(null)
  const [relationSearch, setRelationSearch] = useState('')
  const [localAi, setLocalAi] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const prefilledBook = useRef(false)
  const placementAudioContext = useRef(null)
  const connectionDialogRef = useRef(null)
  const connectionTriggerRef = useRef(null)
  const settingsPanelRef = useRef(null)
  const settingsTriggerRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      const [noteResult, bookResult, themeResult, atlasResult, draftResult, reminderResult] = await Promise.all([
        api('/api/notes'), api('/api/library'), api('/api/themes'), api('/api/atlas'), api('/api/notes/drafts'), api('/api/notes/reminder'),
      ])
      setNotes(noteResult.items)
      setBooks(bookResult.items)
      const requestedBookId = new URLSearchParams(window.location.search).get('book')
      if (requestedBookId && !prefilledBook.current) {
        const book = bookResult.items.find((item) => item.id === requestedBookId)
        if (book) {
          prefilledBook.current = true
          setForm((current) => current === blank || (!current.content && !current.libraryEntryId) ? { ...blank, libraryEntryId: book.id, editionId: book.editionId || '' } : current)
        }
      }
      setThemes(themeResult.items)
      setLinks(atlasResult.links)
      setDrafts(draftResult.items || [])
      setReminder(reminderResult)
      if (reminderResult.enabled) setForgottenStar(await api('/api/notes/forgotten-star'))
      else setForgottenStar(null)
      setRelation((current) => ({ ...current, sourceNoteId: current.sourceNoteId || noteResult.items[0]?.id || '', targetNoteId: current.targetNoteId || noteResult.items[1]?.id || '' }))
    } catch (fetchError) { setError(fetchError.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null

  useEffect(() => {
    if (!selectedNoteId) return
    api(`/api/notes/${encodeURIComponent(selectedNoteId)}/open`, { method: 'POST' }).catch(() => {})
  }, [selectedNoteId])

  useEffect(() => {
    let active = true
    setAiSuggestions([])
    setAiError('')
    if (!selectedNote) { setLocalAi(null); return () => { active = false } }
    api('/api/local-ai/status').then((status) => { if (active) setLocalAi(status) }).catch(() => { if (active) setLocalAi({ available: false, running: false }) })
    return () => { active = false }
  }, [selectedNote?.id])

  useEffect(() => {
    const noteId = new URLSearchParams(window.location.search).get('note')
    if (!noteId || loading) return undefined
    if (!notes.some((note) => note.id === noteId)) return undefined
    setSelectedNoteId(noteId)
    const timer = window.setTimeout(() => {
      const detail = document.getElementById('selected-note-detail')
      detail?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      detail?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [loading, notes.length])

  useEffect(() => {
    const syncSelection = () => {
      const noteId = new URLSearchParams(window.location.search).get('note')
      setSelectedNoteId(noteId)
      if (noteId) setNotesView('archive')
    }
    window.addEventListener('popstate', syncSelection)
    return () => window.removeEventListener('popstate', syncSelection)
  }, [])

  const visibleNotes = useMemo(() => notes.filter((note) => (themeFilter === 'all' || note.themeIds.includes(themeFilter)) && `${note.title || ''} ${note.content} ${note.commentary || ''} ${note.bookTitle || ''} ${note.sourceLocator || ''} ${note.themeNames || ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))), [notes, query, themeFilter])
  const relationChoices = useMemo(() => notes.filter((note) => note.id !== relation.sourceNoteId && `${note.title || ''} ${note.content} ${note.commentary || ''} ${note.bookTitle || ''} ${note.sourceLocator || ''} ${note.themeNames || ''}`.toLocaleLowerCase('tr').includes(relationSearch.toLocaleLowerCase('tr'))), [notes, relation.sourceNoteId, relationSearch])

  const suggestedConnections = useMemo(() => {
    if (!selectedNote) return []
    const sourceTerms = noteTerms(selectedNote)
    const existingTargets = new Set(links.flatMap((link) => link.source === selectedNote.id ? [link.target] : link.target === selectedNote.id ? [link.source] : []))
    return notes.filter((note) => note.id !== selectedNote.id && !existingTargets.has(note.id)).map((note) => {
      const sharedThemes = (note.themeIds || []).filter((id) => (selectedNote.themeIds || []).includes(id))
      const sharedTerms = [...noteTerms(note)].filter((word) => sourceTerms.has(word)).slice(0, 4)
      const score = sharedThemes.length * 3 + Math.min(sharedTerms.length, 4)
      const reasons = [...(sharedThemes.length ? [`Ortak tema: ${sharedThemes.map((id) => themes.find((theme) => theme.id === id)?.name || id).join(', ')}`] : []), ...(sharedTerms.length ? [`Ortak kavramlar: ${sharedTerms.join(', ')}`] : [])]
      return { note, score, rationale: reasons.join(' · ') }
    }).filter((candidate) => candidate.score >= 2).sort((a, b) => b.score - a.score).slice(0, 3)
  }, [links, notes, selectedNote, themes])

  function signalAtlas() {
    try { const channel = new BroadcastChannel('chronologos-notes'); channel.postMessage({ type: 'changed' }); channel.close() } catch { /* unsupported browsers refresh on focus */ }
  }

  function startEdit(note) {
    setEditing(note.id)
    setError('')
    setForm({ kind: note.kind, title: note.title || '', content: note.content, commentary: note.commentary || '', libraryEntryId: note.libraryEntryId || '', editionId: note.editionId || '', sourceLocator: note.sourceLocator || '', themeIds: note.themeIds || [] })
    setShowCommentary(Boolean(note.commentary) || note.kind === 'quote')
    setShowRecordDetails(Boolean(note.libraryEntryId || note.sourceLocator || note.themeIds?.length))
    setShowEditor(true)
    setNotesView('work')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectNote(note) {
    setSelectedNoteId(note?.id || null)
    if (note) setNotesView('archive')
    const url = new URL(window.location.href)
    if (note?.id) url.searchParams.set('note', note.id)
    else url.searchParams.delete('note')
    window.history.replaceState({}, '', url)
    if (note) window.setTimeout(() => document.getElementById('selected-note-detail')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 80)
  }

  function resetForm() { setEditing(null); setForm(blank); setShowCommentary(false); setShowRecordDetails(false); setError(''); setShowEditor(false) }

  function startNewNote() {
    setError(''); setEditing(null); setForm(blank); setShowCommentary(false); setShowRecordDetails(false); setNotesView('work'); setShowEditor(true); selectNote(null)
    window.setTimeout(() => document.getElementById('workbench-content')?.focus(), 50)
  }

  function addQuoteToForm() {
    setForm((current) => ({ ...current, kind: 'quote', content: '', commentary: [current.content, current.commentary].filter(Boolean).join('\n\n') }))
    setShowCommentary(true)
    setShowRecordDetails(true)
    window.setTimeout(() => document.getElementById('workbench-content')?.focus(), 50)
  }

  async function saveNote(event) {
    event.preventDefault()
    if (saveInFlight.current) return
    saveInFlight.current = true
    const trigger = event.nativeEvent?.submitter || event.currentTarget.querySelector('[type="submit"]')
    let leaving = false
    setSaving(true)
    setError('')
    const selectedBook = books.find((book) => book.id === form.libraryEntryId)
    const existingNote = editing ? notes.find((note) => note.id === editing) : null
    const sameBookAsBefore = existingNote && existingNote.libraryEntryId === (form.libraryEntryId || null)
    const editionId = !form.libraryEntryId ? null : sameBookAsBefore ? form.editionId || null : form.editionId || selectedBook?.editionId || null
    const payload = { ...form, libraryEntryId: form.libraryEntryId || null, editionId }
    try {
      const savedNote = await api(editing ? `/api/notes/${encodeURIComponent(editing)}` : '/api/notes', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      if (!editing) {
        signalAtlas()
        carryNoteToAtlas(savedNote, trigger)
        leaving = true
        return
      }
      setNotice(editing ? 'Not güncellendi.' : 'Not kaydedildi; Atlas için bir yıldız oluşturuldu.')
      setEditing(null)
      setForm(blank)
      setShowEditor(false)
      selectNote(savedNote)
      setNotesView('archive')
      await refresh()
      signalAtlas()
    } catch (saveError) { setError(saveError.message) }
    finally { if (!leaving) { saveInFlight.current = false; setSaving(false) } }
  }

  async function captureDraft(event) {
    event.preventDefault()
    const content = quickCapture.trim()
    if (!content) return
    try {
      const draft = await api('/api/notes/drafts', { method: 'POST', body: JSON.stringify({ content }) })
      setDrafts((current) => [draft, ...current])
      setQuickCapture('')
      setNotice('Düşünce Bulutsu’ya bırakıldı; henüz Atlas yıldızı değil.')
    } catch (captureError) { setError(captureError.message) }
  }

  async function captureDraftForDetail() {
    const content = quickCapture.trim()
    if (!content) return
    try {
      const draft = await api('/api/notes/drafts', { method: 'POST', body: JSON.stringify({ content }) })
      setDrafts((current) => [draft, ...current])
      setQuickCapture('')
      editDraft(draft)
      setNotice('Taslak açıldı; kaynak ve temalarını ekleyebilirsin.')
    } catch (captureError) { setError(captureError.message) }
  }

  function editDraft(draft) {
    setDraftEditorId(draft.id)
    setDraftForm({ kind: draft.kind, title: draft.title || '', content: draft.content, commentary: draft.commentary || '', libraryEntryId: draft.libraryEntryId || '', editionId: draft.editionId || '', sourceLocator: draft.sourceLocator || '', themeIds: draft.themeIds || [] })
    setError('')
  }

  async function saveDraft(event) {
    event.preventDefault()
    try {
      const saved = await api(`/api/notes/drafts/${encodeURIComponent(draftEditorId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...draftForm, libraryEntryId: draftForm.libraryEntryId || null, editionId: draftForm.editionId || null }),
      })
      setDrafts((current) => current.map((draft) => draft.id === saved.id ? saved : draft))
      setDraftEditorId(null)
      setNotice('Nebula taslağı güncellendi; henüz Atlas yıldızı değil.')
    } catch (draftError) { setError(draftError.message) }
  }

  async function removeDraft(draft) {
    try {
      await api(`/api/notes/drafts/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
      setDrafts((current) => current.filter((item) => item.id !== draft.id))
      setNotice('Taslak Bulutsu’dan kaldırıldı.')
    } catch (draftError) { setNotice(draftError.message) }
  }

  function preparePlacementSound() {
    if (!soundEnabled) return null
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return null
      const context = new AudioContextClass()
      placementAudioContext.current = context
      context.resume().catch(() => {})
      return context
    } catch { return null }
  }

  function playPlacementSound(context) {
    if (!context || context.state === 'closed') return
    try {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(660, now)
      oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.22)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.43)
      oscillator.onended = () => context.close().catch(() => {})
    } catch { context.close().catch(() => {}) }
  }

  async function placeDraft(draft, trigger) {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    let leaving = false
    const context = preparePlacementSound()
    try {
      const note = await api(`/api/notes/drafts/${encodeURIComponent(draft.id)}/place`, { method: 'POST', body: JSON.stringify({}) })
      playPlacementSound(context)
      if (context) placementAudioContext.current = null
      signalAtlas()
      carryNoteToAtlas(note, trigger)
      leaving = true
    } catch (placeError) {
      context?.close?.().catch?.(() => {})
      setError(placeError.message)
    }
    finally { if (!leaving) { saveInFlight.current = false; setSaving(false) } }
  }

  async function toggleForgottenStar() {
    try {
      const next = await api('/api/notes/reminder', { method: 'PATCH', body: JSON.stringify({ enabled: !reminder.enabled }) })
      setReminder(next)
      setForgottenStar(next.enabled ? await api('/api/notes/forgotten-star') : null)
    } catch (reminderError) { setNotice(reminderError.message) }
  }

  function togglePlacementSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    try { localStorage.setItem('chronologos:placement-sound', next ? 'on' : 'off') } catch { /* The current tab still honors this preference. */ }
  }

  async function removeNote(note) {
    if (!window.confirm(`“${note.title || note.content.slice(0, 50)}” notunu silmek istiyor musun?`)) return
    try { await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' }); if (selectedNoteId === note.id) selectNote(null); setNotice('Not silindi.'); await refresh(); signalAtlas() }
    catch (removeError) { setNotice(removeError.message) }
  }

  async function saveRelation(event) {
    event.preventDefault()
    setError('')
    try {
      await api(editingRelationId ? `/api/note-links/${encodeURIComponent(editingRelationId)}` : '/api/note-links', { method: editingRelationId ? 'PATCH' : 'POST', body: JSON.stringify(relation) })
      setNotice(editingRelationId ? 'Bağlantı güncellendi.' : 'Düşünce bağlantısı Atlas’a eklendi.')
      setEditingRelationId(null)
      setConnectionOpen(false)
      await refresh()
      signalAtlas()
    } catch (linkError) { setError(linkError.message) }
  }

  function editRelation(link) {
    setRelationSearch('')
    setEditingRelationId(link.id)
    setRelation({ sourceNoteId: link.source, targetNoteId: link.target, relationship: link.relationship, rationale: link.rationale || '' })
    setConnectionOpen(true)
  }

  function openConnectionFor(note, event) {
    if (event?.currentTarget) connectionTriggerRef.current = event.currentTarget
    setRelationSearch('')
    const target = notes.find((candidate) => candidate.id !== note?.id)
    setRelation((current) => ({ ...current, sourceNoteId: note?.id || current.sourceNoteId, targetNoteId: current.targetNoteId && current.targetNoteId !== note?.id ? current.targetNoteId : target?.id || '' }))
    setEditingRelationId(null)
    setConnectionOpen(true)
  }

  function useConnectionSuggestion(candidate, event) {
    if (event?.currentTarget) connectionTriggerRef.current = event.currentTarget
    setRelationSearch('')
    setRelation({ sourceNoteId: selectedNote.id, targetNoteId: candidate.note.id, relationship: candidate.relationship || '', rationale: candidate.rationale })
    setConnectionOpen(true)
  }

  useEffect(() => {
    if (!connectionOpen) return undefined
    const dialog = connectionDialogRef.current
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || [])]
    focusable()[0]?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); setConnectionOpen(false); return }
      if (event.key !== 'Tab') return
      const controls = focusable()
      if (!controls.length) return
      const first = controls[0]; const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      connectionTriggerRef.current?.focus?.()
      connectionTriggerRef.current = null
    }
  }, [connectionOpen])

  async function requestAiSuggestions() {
    if (!selectedNote || aiLoading) return
    setAiLoading(true)
    setAiError('')
    try {
      const result = await api('/api/local-ai/suggestions', { method: 'POST', body: JSON.stringify({ noteId: selectedNote.id }) })
      setAiSuggestions(result.items || [])
      setAiError(result.items?.length ? '' : 'Yerel model benzer olsa da anlamlı bir bağ önermedi.')
    } catch (suggestionError) { setAiError(suggestionError.message) }
    finally { setAiLoading(false) }
  }

  async function removeRelation(id) {
    try { await api(`/api/note-links/${encodeURIComponent(id)}`, { method: 'DELETE' }); setNotice('Bağlantı kaldırıldı.'); await refresh(); signalAtlas() }
    catch (removeError) { setNotice(removeError.message) }
  }

  async function exportArchive() {
    try {
      const response = await fetch('/api/export', { cache: 'no-store' })
      if (!response.ok) throw new Error('Yedek hazırlanamadı.')
      const file = new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `chronologos-backup-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('Kişisel arşivinin JSON yedeği indirildi.')
    } catch (exportError) { setNotice(exportError.message) }
  }

  function handleNotesTabKeyDown(event) {
    const tabIds = ['notes-tab-work', 'notes-tab-archive']
    const currentIndex = tabIds.indexOf(event.currentTarget.id)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabIds.length - 1) % tabIds.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabIds.length - 1
    else return
    event.preventDefault()
    const nextId = tabIds[nextIndex]
    setNotesView(nextIndex === 0 ? 'work' : 'archive')
    document.getElementById(nextId)?.focus()
  }

  function toggleMemories() {
    const enabled = !memoriesEnabled
    setMemoriesEnabled(enabled)
    try { localStorage.setItem('chronologos:memories', enabled ? 'on' : 'off') } catch { /* Setting still applies in this tab. */ }
    try { const channel = new BroadcastChannel('chronologos-notes'); channel.postMessage({ type: 'memories', enabled }); channel.close() } catch { /* Atlas can read the stored setting when opened. */ }
  }

  useEffect(() => {
    if (!settingsOpen) return undefined
    settingsPanelRef.current?.querySelector('button:not([disabled])')?.focus()
    function onPointerDown(event) {
      if (!settingsPanelRef.current?.contains(event.target) && !settingsTriggerRef.current?.contains(event.target)) setSettingsOpen(false)
    }
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setSettingsOpen(false)
      settingsTriggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const relationSourceNote = notes.find((note) => note.id === relation.sourceNoteId) || null
  const relationTargetNote = notes.find((note) => note.id === relation.targetNoteId) || null

  return <main className="library-app library-app--notes">
    <aside className="library-rail">
      <a className="library-brand" href="/library"><img className="library-brand__mark" src="/chronologos-mark.svg" alt="" /><span className="library-brand__word">CHRONOLOGOS<small>PERSONAL ARCHIVE</small></span></a>
      <div className="rail-divider" /><span className="rail-label">ÇALIŞMA ALANI</span>
      <a className="rail-link" href="/library"><span className="rail-icon">▤</span> Kitaplığım</a>
      <a className="rail-link rail-link--active" href="/notes"><span className="rail-icon">✎</span> Notlar <span className="rail-count">{notes.length}</span></a>
      <a className="rail-link" href="/atlas" onClick={(event) => { event.preventDefault(); navigateThroughPortal('/atlas', event.currentTarget) }}><span className="rail-icon">✧</span> Atlas’a dön <span className="rail-external">↗</span></a>
      <div className="rail-note"><span className="rail-note__symbol">✦</span><p>Her düşünce, atlasında yeni bir yıldız yakar.</p></div>
      <div className="rail-footer"><span className="status-light" /> YEREL ARŞİV <span className="rail-footer__version">0.2</span></div>
    </aside>

    <section className="library-main">
      <header className="library-topbar"><div className="breadcrumb"><span>KİŞİSEL ARŞİV</span><span className="breadcrumb__slash">/</span><strong>DÜŞÜNCELER</strong></div><div className="notes-top-actions"><div className="desk-settings-anchor"><button ref={settingsTriggerRef} className="quiet-button desk-settings-trigger" type="button" aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls="desk-settings-panel" onClick={() => setSettingsOpen((open) => !open)}>⚙ <span>Masa ayarları</span></button>{settingsOpen && <section id="desk-settings-panel" ref={settingsPanelRef} className="desk-settings-panel" role="dialog" aria-labelledby="desk-settings-title"><header><div><span className="eyebrow">ÇALIŞMA MASASI</span><h2 id="desk-settings-title">Masa ayarları</h2></div><button className="icon-button" type="button" aria-label="Masa ayarlarını kapat" onClick={() => { setSettingsOpen(false); settingsTriggerRef.current?.focus() }}>×</button></header><section className="desk-settings-group desk-settings-group--backup"><div><span className="desk-settings-group__label">YEDEK</span><strong>Arşivinin bir kopyası</strong><p>Notlarını ve kitaplığını JSON dosyası olarak indir.</p></div><button className="quiet-button" type="button" onClick={exportArchive}>↓ JSON yedeği indir</button></section><section className="desk-settings-group"><div><span className="desk-settings-group__label">HATIRLATMALAR</span><strong>Günün Unutulmuş Yıldızı</strong><p>Altı ayı geçen ve özellik açıldıktan sonra açılmamış bir notu çalışma masanda göster.</p></div><button className="settings-switch" type="button" role="switch" aria-checked={reminder.enabled} onClick={toggleForgottenStar}><span aria-hidden="true" />{reminder.enabled ? 'Açık' : 'Kapalı'}</button></section><section className="desk-settings-group"><div><span className="desk-settings-group__label">ATLAS HATIRLATMASI</span><strong>Anı kartları</strong><p>Atlas boşta kaldığında eski düşünceleri hatırlat.</p></div><button className="settings-switch" type="button" role="switch" aria-checked={memoriesEnabled} onClick={toggleMemories}><span aria-hidden="true" />{memoriesEnabled ? 'Açık' : 'Kapalı'}</button></section><section className="desk-settings-group"><div><span className="desk-settings-group__label">YERLEŞTİRME</span><strong>Yumuşak ses</strong><p>Taslak Atlas’a yıldız olarak yerleştiğinde kısa bir ses çal.</p></div><button className="settings-switch" type="button" role="switch" aria-checked={soundEnabled} onClick={togglePlacementSound}><span aria-hidden="true" />{soundEnabled ? 'Açık' : 'Kapalı'}</button></section></section>}</div></div></header>
      <div className="library-content notes-content">
        <section className="library-heading"><div><span className="eyebrow">OKUMAKTAN DÜŞÜNCEYE</span><h1>Notların<span>.</span></h1><p>Alıntılarını, kişisel yorumlarını ve kitaplardan bağımsız düşüncelerini aynı arşivde tut.</p></div><button className="primary-button" onClick={startNewNote}>＋ Tam not oluştur</button></section>


        <div className="notes-view-tabs" role="tablist" aria-label="Notlar çalışma alanı">
          <button id="notes-tab-work" role="tab" aria-selected={notesView === 'work'} aria-controls={showEditor ? 'notes-panel-work notes-panel-work-editor' : 'notes-panel-work'} className={notesView === 'work' ? 'is-active' : ''} onKeyDown={handleNotesTabKeyDown} tabIndex={notesView === 'work' ? 0 : -1} onClick={() => setNotesView('work')}>Çalışma Yüzeyi <span>{drafts.length}</span></button>
          <button id="notes-tab-archive" role="tab" aria-selected={notesView === 'archive'} aria-controls="notes-panel-archive" className={notesView === 'archive' ? 'is-active' : ''} onKeyDown={handleNotesTabKeyDown} tabIndex={notesView === 'archive' ? 0 : -1} onClick={() => setNotesView('archive')}>Arşiv Çekmecesi <span>{notes.length}</span></button>
        </div>

        {notesView === 'work' && <section id="notes-panel-work" role="tabpanel" aria-labelledby="notes-tab-work" className="notes-view-panel notes-view-panel--work">
        {reminder.enabled && forgottenStar?.candidate && <section className="forgotten-star-card" aria-labelledby="forgotten-star-title"><div className="forgotten-star-card__seal">✧</div><div className="forgotten-star-card__copy"><span className="eyebrow">GÜNÜN UNUTULMUŞ YILDIZI</span><h2 id="forgotten-star-title">{forgottenStar.candidate.title || 'Başlıksız düşünce'}</h2><p>{forgottenStar.candidate.content.slice(0, 190)}{forgottenStar.candidate.content.length > 190 ? '…' : ''}</p><small>{forgottenStar.candidate.bookTitle || 'Kitapsız düşünce'} · arşivden</small></div><button className="quiet-button" onClick={() => { selectNote(forgottenStar.candidate); window.setTimeout(() => document.getElementById('note-' + forgottenStar.candidate.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }}>Notu aç</button></section>}

        <section className={`nebula-section${drafts.length === 0 ? ' nebula-section--empty' : ''}`} aria-labelledby="nebula-title"><div className="collection-heading"><div><span className="eyebrow">HARİTALANMAMIŞ YILDIZLAR</span><h2 id="nebula-title">Nebula <small>{drafts.length} taslak</small></h2></div>{drafts.length > 0 && <span className="nebula-note">Taslaklar Atlas’ta görünmez; yerleştirene kadar yalnızca Bulutsu’da kalır.</span>}</div><form className="quick-capture" onSubmit={captureDraft}><label htmlFor="quick-capture-input">HIZLI YAKALAMA</label><div><input id="quick-capture-input" value={quickCapture} onChange={(event) => setQuickCapture(event.target.value)} placeholder="Aklından geçeni buraya bırak…" maxLength="12000" />{drafts.length > 0 && <><button className="primary-button" type="submit" disabled={!quickCapture.trim()}>Yakalamayı kaydet</button><button className="quiet-button quick-capture__details" type="button" disabled={!quickCapture.trim()} onClick={captureDraftForDetail}>Ayrıntı ekle</button></>}</div>{drafts.length === 0 && <p className="quick-capture__hint">Enter ile kaydet. Taslakların burada birikir; hazır olduğunda kaynak ve tema ekleyip Atlas’a yerleştirebilirsin.</p>}</form>{drafts.length > 0 && <div className="nebula-list">{drafts.map((draft) => <article key={draft.id} className="nebula-card"><span className="thought-kind">NEBULA TASLAĞI · YILDIZ DEĞİL</span>{draft.title && <h3>{draft.title}</h3>}<p>{draft.content}</p>{draft.commentary && <p className="thought-card__commentary">{draft.commentary}</p>}{(draft.bookTitle || draft.sourceLocator) && <small>{draft.bookTitle || 'Kaynak seçilmemiş'}{draft.sourceLocator ? ` · ${draft.sourceLocator}` : ''}</small>}{draft.themeNames && <small>Temalar · {draft.themeNames}</small>}{draftEditorId === draft.id ? <form className="draft-editor draft-editor--desk book-form" onSubmit={saveDraft}><label className="field"><span>Tür</span><select value={draftForm.kind} onChange={(event) => setDraftForm({ ...draftForm, kind: event.target.value })}><option value="thought">Düşünce</option><option value="quote">Alıntı</option></select></label><label className="field"><span>Başlık</span><input value={draftForm.title} onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })} /></label><label className={`field field--wide draft-sheet ${draftForm.kind === 'quote' ? 'draft-sheet--quote' : 'draft-sheet--own'}`}><span>{draftForm.kind === 'quote' ? 'Yazarın sesi · Alıntı' : 'Benim sesim · Düşünce'}</span><textarea required value={draftForm.content} onChange={(event) => setDraftForm({ ...draftForm, content: event.target.value })} rows="3" /></label><label className="field field--wide draft-sheet draft-sheet--own"><span>Kişisel yorum · Sentez</span><textarea value={draftForm.commentary} onChange={(event) => setDraftForm({ ...draftForm, commentary: event.target.value })} rows="2" /></label><label className="field"><span>Kaynak kitap</span><select value={draftForm.libraryEntryId} onChange={(event) => setDraftForm({ ...draftForm, libraryEntryId: event.target.value, editionId: books.find((book) => book.id === event.target.value)?.editionId || '' })}><option value="">Kitapsız</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.author}</option>)}</select></label><label className="field"><span>Sayfa / bölüm</span><input value={draftForm.sourceLocator} onChange={(event) => setDraftForm({ ...draftForm, sourceLocator: event.target.value })} /></label><fieldset className="field field--wide theme-picker"><legend>Atlas temaları</legend><div>{themes.map((theme) => <label key={theme.id} className="theme-choice"><input type="checkbox" checked={draftForm.themeIds.includes(theme.id)} onChange={(event) => setDraftForm({ ...draftForm, themeIds: event.target.checked ? [...draftForm.themeIds, theme.id] : draftForm.themeIds.filter((id) => id !== theme.id) })} /><i style={{ '--theme-color': theme.color }} />{theme.name}</label>)}</div></fieldset><footer className="book-form__actions"><button className="primary-button" type="submit">Taslağı güncelle</button><button type="button" className="quiet-button" onClick={() => setDraftEditorId(null)}>Vazgeç</button></footer></form> : <div className="nebula-card__actions"><button className="quiet-button" onClick={() => editDraft(draft)}>İşle ve kaynak ekle</button><button className="primary-button" disabled={saving} onClick={(event) => placeDraft(draft, event.currentTarget)}>Atlas’a yerleştir ✦</button><button className="quiet-button" onClick={() => removeDraft(draft)}>Sil</button></div>}</article>)}</div>}</section>

        {error && !showEditor && <p className="form-error" role="alert">{error}</p>}
        </section>}
        {notesView === 'archive' && selectedNote && <section id="selected-note-detail" tabIndex="-1" className="selected-thought" aria-labelledby="selected-thought-title">
          <div className="selected-thought__heading"><div><span className="eyebrow">SEÇİLİ ATLAS YILDIZI{selectedNote.themeNames ? ` · ${selectedNote.themeNames}` : ''}</span><h2 id="selected-thought-title">{selectedNote.title || selectedNote.content.split(/[.!?\n]/)[0].slice(0, 72) || 'Başlıksız düşünce'}</h2></div><button className="icon-button" type="button" aria-label="Seçili düşünceyi kapat" onClick={() => selectNote(null)}>×</button></div>
          <div className="selected-thought__body"><p className={selectedNote.kind === 'quote' ? 'thought-card__quote' : ''}>{selectedNote.content}</p>{selectedNote.commentary && <p className="thought-card__commentary">{selectedNote.commentary}</p>}
            <div className="thought-card__source">{selectedNote.bookTitle ? <a href="/library">{selectedNote.bookTitle}{selectedNote.author ? ` · ${selectedNote.author}` : ''}</a> : <span>Kaynak kitap eklenmemiş</span>}{selectedNote.sourceLocator ? <span>{selectedNote.sourceLocator}</span> : selectedNote.kind === 'quote' ? <span>Sayfa / bölüm belirtilmemiş</span> : null}</div>
          </div>
          <div className="selected-thought__actions"><a className="primary-button" href={`/atlas?note=${encodeURIComponent(selectedNote.id)}`} onClick={(event) => { event.preventDefault(); navigateThroughPortal(`/atlas?note=${encodeURIComponent(selectedNote.id)}`, event.currentTarget) }}>✦ Bu yıldızı Atlas’ta göster</a><button className="quiet-button" onClick={(event) => openConnectionFor(selectedNote, event)}>Bu düşünceyle bağ kur</button><button className="quiet-button" onClick={() => startEdit(selectedNote)}>Düşünceyi düzenle</button></div>
          <section className="connection-suggestions"><div><span className="eyebrow">DÜŞÜNCE KEŞFİ</span><h3>Bağ kurabileceğin düşünceler</h3><p>Benzer tema ve kavramlara göre yerel eşleşmeler; bunlar AI önerisi değildir.</p></div><div className="connection-suggestions__list">
            {suggestedConnections.map((candidate) => <article key={candidate.note.id}><div><strong>{candidate.note.title || candidate.note.content.split(/[.!?\n]/)[0].slice(0, 72)}</strong><span>{candidate.note.bookTitle || candidate.note.themeNames || 'Kaynak belirtilmemiş'}</span><small>{candidate.rationale}</small></div><button className="quiet-button" onClick={(event) => useConnectionSuggestion(candidate, event)}>Bağ adayı seç</button></article>)}
            <div className="local-ai-action"><div><strong>Yerel AI önerisi</strong><small>{localAi?.available ? `Bu cihazda ${localAi.chatModel} ve embedding modeliyle çalışır.` : localAi?.running === false ? 'Ollama bu cihazda çalışmıyor.' : localAi?.missing?.length ? `Eksik yerel modeller: ${localAi.missing.join(', ')}` : 'Yerel model durumu kontrol ediliyor…'}</small></div><button className="quiet-button" type="button" onClick={requestAiSuggestions} disabled={!localAi?.available || aiLoading}>{aiLoading ? 'Yerelde inceleniyor…' : 'AI ile öner'}</button></div>
            {aiSuggestions.map((candidate) => <article key={`ai-${candidate.note.id}`} className="connection-suggestion--ai"><div><strong>{candidate.note.title || candidate.note.content.split(/[.!?\n]/)[0].slice(0, 72)} <em>AI adayı</em></strong><span>{relationLabels[candidate.relationship]} · {candidate.note.bookTitle || candidate.note.themeNames || 'Kaynak belirtilmemiş'}</span><small>{candidate.rationale}</small></div><button className="quiet-button" onClick={(event) => useConnectionSuggestion(candidate, event)}>Gözden geçir</button></article>)}
            {aiError && <p className="local-ai-message" role="status">{aiError}</p>}
          </div></section>
        </section>}

        {notesView === 'work' && showEditor && <section id="notes-panel-work-editor" role="tabpanel" aria-labelledby="notes-tab-work workbench-title" className="notes-editor notes-editor--desk">
          <div className="notes-editor__heading"><div><span className="eyebrow">{editing ? 'KAYDI GÖZDEN GEÇİR' : 'KÂŞİFİN MASASI · YENİ KAYIT'}</span><h2 id="workbench-title">{editing ? 'Düşünceni yeniden işle' : 'Masanın üzerine bırak'}</h2><p className="workbench-intro">Bir düşünce yaz; dilersen bir kitaba ve Atlas temalarına bağla.</p></div><button className="quiet-button" onClick={() => editing ? resetForm() : setShowEditor(false)} type="button">{editing ? 'Düzenlemeyi bırak' : 'Formu kapat'}</button></div>
          <form className="book-form workbench-form" onSubmit={saveNote}>
            {!editing && <div className="workbench-kind-picker" role="group" aria-label="Not türü"><button type="button" className={form.kind === 'thought' ? 'is-active' : ''} aria-pressed={form.kind === 'thought'} onClick={() => setForm((current) => ({ ...current, kind: 'thought', content: current.content || current.commentary, commentary: current.content ? current.commentary : '' }))}><span>✧</span> Kendi düşüncem</button><button type="button" className={form.kind === 'quote' ? 'is-active' : ''} aria-pressed={form.kind === 'quote'} onClick={() => form.kind !== 'quote' && addQuoteToForm()}><span>❝</span> Kitaptan alıntı</button></div>}
            <div className="workbench-form__meta"><label className="field field--meta"><span>Başlık <small>İsteğe bağlı</small></span><input maxLength="180" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Düşüncene kısa bir ad ver" /></label></div>
            <div className={`workbench-papers${form.kind === 'quote' ? ' workbench-papers--dialogue' : ' workbench-papers--reflection'}`}>
              <label className={`field workbench-sheet ${form.kind === 'quote' ? 'workbench-sheet--quote' : 'workbench-sheet--own'}`}><span>{form.kind === 'quote' ? 'KİTAPTAN ALINTI' : 'DÜŞÜNCEN'} <b>*</b></span><textarea id="workbench-content" required rows="5" maxLength="12000" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder={form.kind === 'quote' ? 'Altını çizdiğin cümleyi buraya yaz…' : 'Bugün aklında ne kaldı?'} /></label>
              {(form.kind === 'quote' || showCommentary) && <label className="field workbench-sheet workbench-sheet--own"><span>{form.kind === 'quote' ? 'SENİN YORUMUN' : 'KENAR NOTU'} <small>İsteğe bağlı</small></span><textarea rows="5" maxLength="6000" value={form.commentary} onChange={(event) => setForm({ ...form, commentary: event.target.value })} placeholder={form.kind === 'quote' ? 'Bu alıntı sende ne uyandırdı?' : 'Düşüncene eklemek istediğin başka bir şey var mı?'} /></label>}
            </div>
            {form.kind === 'thought' && !showCommentary && <button className="workbench-disclosure-link" type="button" onClick={() => setShowCommentary(true)}>＋ Kenar notu ekle <small>Düşünceni biraz daha aç</small></button>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <details className="workbench-record-details" open={showRecordDetails}>
              <summary onClick={(event) => { event.preventDefault(); setShowRecordDetails((open) => !open) }}>Kitap, sayfa ve tema ekle <small>· isteğe bağlı</small>{(form.libraryEntryId || form.themeIds.length > 0) && <span> · {form.libraryEntryId ? books.find((book) => book.id === form.libraryEntryId)?.title : ''}{form.themeIds.length ? ` ${form.themeIds.length} tema` : ''}</span>}</summary>
              <div className="workbench-source"><span className="workbench-source__label">KAYNAK FİŞİ</span><label className="field"><span>Kitap</span><select value={form.libraryEntryId} onChange={(event) => setForm({ ...form, libraryEntryId: event.target.value, editionId: books.find((book) => book.id === event.target.value)?.editionId || '' })}><option value="">Kitapsız düşünce</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.author}</option>)}</select></label>
                <label className="field"><span>Sayfa / bölüm</span><input maxLength="240" value={form.sourceLocator} onChange={(event) => setForm({ ...form, sourceLocator: event.target.value })} placeholder="s. 42, Bölüm III" /></label></div>
              <fieldset className="field field--wide theme-picker"><legend>Atlas temaları <small>Birden fazla seçebilirsin</small></legend><div>{themes.map((theme) => <label key={theme.id} className="theme-choice"><input type="checkbox" checked={form.themeIds.includes(theme.id)} onChange={(event) => setForm({ ...form, themeIds: event.target.checked ? [...form.themeIds, theme.id] : form.themeIds.filter((id) => id !== theme.id) })} /><i style={{ '--theme-color': theme.color }} />{theme.name}</label>)}</div></fieldset>
            </details>
            <footer className="book-form__actions workbench-form__actions"><span>{editing ? 'Kayıt, var olan yıldızın yerini korur.' : 'Kaydedince Atlas’ında bir yıldız olarak görünür.'}</span><button className="primary-button notes-seal-button" type="submit" disabled={saving}>{saving ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : '✦ Atlas’a kaydet'}</button></footer>
          </form>
        </section>}

        {notesView === 'archive' && <section id="notes-panel-archive" role="tabpanel" aria-labelledby="notes-tab-archive" className="notes-list-section">
          <div className="collection-heading"><div><span className="eyebrow">KİŞİSEL ARŞİV</span><h2>Düşünce kayıtların <small>{visibleNotes.length}/{notes.length}</small></h2></div><div className="notes-filter-tools"><select className="notes-theme-filter" aria-label="Temaya göre filtrele" value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}><option value="all">Tüm temalar</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Not, kaynak veya tema ara" aria-label="Notlarda ara" /></label></div></div>
          {loading ? <div className="library-loading"><span className="loading-orbit" /> Notlar yükleniyor…</div> : visibleNotes.length ? <div className="thought-list">{visibleNotes.map((note) => <article id={`note-${note.id}`} tabIndex="-1" className={`thought-card${selectedNoteId === note.id ? ' thought-card--focused' : ''}`} key={note.id}>
            <div className="thought-card__meta"><span className={`thought-kind thought-kind--${note.kind}`}>{note.kind === 'quote' ? 'ALINTI' : 'DÜŞÜNCE'}</span><span className="thought-star-label">✦ ATLAS YILDIZI</span><span>{note.themeNames || 'Temasız'}</span></div>
            {note.title && <h3>{note.title}</h3>}<p className={note.kind === 'quote' ? 'thought-card__quote' : ''}>{note.content}</p>{note.commentary && <p className="thought-card__commentary">{note.commentary}</p>}
            <div className="thought-card__source">{note.bookTitle ? <a href="/library">{note.bookTitle}{note.author ? ` · ${note.author}` : ''}</a> : note.kind === 'quote' && <span>Kaynak kitap belirtilmemiş</span>}{note.sourceLocator ? <span>{note.sourceLocator}</span> : note.kind === 'quote' && <span>Sayfa / bölüm belirtilmemiş</span>}</div>
            <div className="thought-card__actions"><button className="thought-card__open" onClick={() => selectNote(note)}>{selectedNoteId === note.id ? 'Açık' : 'Aç'}</button><details className="thought-card__menu"><summary aria-label={`${note.title || 'Düşünce'} için diğer işlemler`}>⋯</summary><div><button onClick={(event) => openConnectionFor(note, event)}>Bağla</button><a href={`/atlas?note=${encodeURIComponent(note.id)}`} onClick={(event) => { event.preventDefault(); navigateThroughPortal(`/atlas?note=${encodeURIComponent(note.id)}`, event.currentTarget) }}>Atlas’ta göster ↗</a><button onClick={() => startEdit(note)}>Düzenle</button><button className="thought-card__delete" onClick={() => removeNote(note)}>Sil</button></div></details></div>
          </article>)}</div> : <div className="library-empty"><div className="library-empty__seal">✧</div><span className="eyebrow">İLK DÜŞÜNCE</span><h3>Arşivinde henüz not yok.</h3><p>Bir düşünce ya da alıntı eklediğinde Atlas’ta kalıcı bir yıldıza dönüşür.</p><button className="primary-button" onClick={startNewNote}>İlk notunu oluştur</button></div>}
        </section>}

        {connectionOpen && <div className="connection-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConnectionOpen(false)}><section ref={connectionDialogRef} className="notes-editor relation-editor connection-drawer" role="dialog" aria-modal="true" aria-labelledby="connection-drawer-title"><div className="notes-editor__heading"><div><span className="eyebrow">BAĞLANTI TEZGÂHI</span><h2 id="connection-drawer-title">Düşünceler arasında bağ</h2></div><button className="icon-button" type="button" aria-label="Bağlantı tezgâhını kapat" onClick={() => setConnectionOpen(false)}>×</button></div>
          {relationSourceNote && relationTargetNote && <div className="relation-pair-preview" aria-live="polite"><article><span>İLK DÜŞÜNCE</span><strong>{relationSourceNote.title || relationSourceNote.content.split(/[.!?\n]/)[0].slice(0, 72) || 'Başlıksız düşünce'}</strong><p>{relationSourceNote.content.slice(0, 112)}{relationSourceNote.content.length > 112 ? '…' : ''}</p></article><div className="relation-pair-preview__direction"><span>{relation.relationship ? relationLabels[relation.relationship] : 'İlişki türünü seç'}</span><b>→</b></div><article><span>İKİNCİ DÜŞÜNCE</span><strong>{relationTargetNote.title || relationTargetNote.content.split(/[.!?\n]/)[0].slice(0, 72) || 'Başlıksız düşünce'}</strong><p>{relationTargetNote.content.slice(0, 112)}{relationTargetNote.content.length > 112 ? '…' : ''}</p></article></div>}
          {notes.length > 1 ? <><label className="relation-search">Hedef düşüncelerde ara <input value={relationSearch} onChange={(event) => setRelationSearch(event.target.value)} placeholder="Başlık, metin, kitap veya tema" /></label><div className="relation-workbench__notes" role="group" aria-label="Bağlantı hedefi seç"><span className="relation-target-label">İKİNCİ DÜŞÜNCE · HEDEF SEÇ</span>{relationChoices.length ? relationChoices.map((note) => <button key={note.id} type="button" onClick={() => setRelation((current) => ({ ...current, targetNoteId: note.id }))} className={relation.targetNoteId === note.id ? 'is-target' : ''} aria-pressed={relation.targetNoteId === note.id}><strong>{note.title || note.content.split(/[.!?\n]/)[0].slice(0, 68)}</strong><small>{relation.targetNoteId === note.id ? 'Seçili hedef' : `${note.bookTitle || 'Kitapsız düşünce'} · Seçmek için dokun`}</small></button>) : <p className="relation-hint">Bu aramayla eşleşen başka düşünce yok.</p>}</div><form className="book-form" onSubmit={saveRelation}><label className="field"><span>İlk düşünce</span><select value={relation.sourceNoteId} onChange={(event) => setRelation((current) => ({ ...current, sourceNoteId: event.target.value, targetNoteId: current.targetNoteId === event.target.value ? notes.find((note) => note.id !== event.target.value)?.id || '' : current.targetNoteId }))}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title || note.content.slice(0, 48)}</option>)}</select></label><label className="field"><span>İlişki</span><select required value={relation.relationship} onChange={(event) => setRelation({ ...relation, relationship: event.target.value })}><option value="">İlişki türünü seç</option>{Object.entries(relationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><input type="hidden" name="targetNoteId" value={relation.targetNoteId} />{!relationTargetNote && <p className="relation-selection-hint" role="status">Devam etmek için listeden bir hedef düşünce seç.</p>}<label className="field field--wide"><span>Neden bağlılar? <small>İsteğe bağlı</small></span><input maxLength="1000" value={relation.rationale} onChange={(event) => setRelation({ ...relation, rationale: event.target.value })} placeholder="Bağlantının kısa açıklaması" /></label><footer className="book-form__actions"><button className="primary-button" type="submit" disabled={!relation.sourceNoteId || !relation.targetNoteId || !relation.relationship}>{editingRelationId ? 'Bağlantıyı güncelle' : 'Bağlantıyı oluştur'}</button>{editingRelationId && <button type="button" className="quiet-button" onClick={() => { setEditingRelationId(null); setRelation({ sourceNoteId: notes[0]?.id || '', targetNoteId: notes[1]?.id || '', relationship: '', rationale: '' }) }}>Düzenlemeden çık</button>}</footer></form></> : <p className="relation-hint">Bir düşünce bağlantısı kurmak için en az iki not ekle.</p>}
          {links.length > 0 && <ul className="relation-list">{links.map((link) => { const left = notes.find((note) => note.id === link.source); const right = notes.find((note) => note.id === link.target); return <li key={link.id}><span>{left?.title || left?.content.slice(0, 35)} <b className={`relation--${link.relationship}`}>— {relationLabels[link.relationship]} →</b> {right?.title || right?.content.slice(0, 35)}{link.rationale && <small>{link.rationale}</small>}</span><div><button onClick={() => editRelation(link)}>Düzenle</button><button onClick={() => removeRelation(link.id)}>Kaldır</button></div></li> })}</ul>}
        </section></div>}
        <footer className="library-footer"><span>CHRONOLOGOS</span><span>OKUMAKTAN DÜŞÜNCEYE</span><span>✦</span></footer>
      </div>
    </section>
    {notice && <div className="library-toast" role="status">{notice}</div>}
  </main>
}
