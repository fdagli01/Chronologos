import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigateThroughPortal } from '../navigation/portalTransition.js'
import './library.css'

const filters = [
  { id: 'all', label: 'Tüm kitaplar' },
  { id: 'reading', label: 'Okuyorum' },
  { id: 'to_read', label: 'Okuma listem' },
  { id: 'read', label: 'Okudum' },
  { id: 'paused', label: 'Ara verdim' },
]

const statusLabels = {
  to_read: 'Okuma listemde',
  reading: 'Okuyorum',
  read: 'Okudum',
  paused: 'Ara verdim',
}

const resonanceOptions = [
  ['transformative', 'Dönüştürücü'], ['cornerstone', 'Temel taş'], ['questioning', 'Sorgulatıcı'], ['catalyst', 'Katalizör'],
]
const resonanceLabels = Object.fromEntries(resonanceOptions)

const emptyForm = {
  title: '', author: '', authors: [], originalYear: '', status: 'to_read', rating: '', resonanceTags: [],
  language: '', publisher: '', pageCount: '', isbn: '', translator: '', description: '', review: '',
  openLibraryWorkKey: '', openLibraryEditionKey: '', coverId: '', workCoverId: '',
}

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'İstek tamamlanamadı.')
  return payload
}

function BookCover({ item }) {
  const hues = [39, 190, 12, 150, 275, 215]
  const hash = [...item.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0)
  const hue = hues[hash % hues.length]
  return (
    <div className={`book-cover${item.coverUrl ? ' book-cover--remote' : ''}`} style={{ '--cover-hue': hue }}>
      {item.coverUrl && <img src={item.coverUrl} alt={`${item.title} kitap kapağı`} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement?.classList.remove('book-cover--remote') }} />}
      <span className="book-cover__stamp">C · L</span>
      <span className="book-cover__title">{item.title}</span>
      <span className="book-cover__author">{item.author}</span>
      <span className="book-cover__ornament">✦</span>
    </div>
  )
}

const spineHues = [25, 12, 39, 148, 190, 274, 215]

function spineMetrics(item) {
  const hash = [...item.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0)
  // Missing page counts get a stable visual stand-in so filtering and rerenders never reshuffle the shelf.
  const pages = Number(item.pageCount) > 0 ? Number(item.pageCount) : 110 + (hash % 691)
  return {
    width: Math.min(76, Math.max(36, 30 + pages * 0.045)),
    height: Math.min(226, Math.max(154, 158 + pages * 0.085)),
  }
}

function spineStyle(item) {
  const hash = [...item.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0)
  const { width, height } = spineMetrics(item)
  return {
    '--spine-width': `${width}px`,
    '--spine-height': `${height}px`,
    '--spine-hue': spineHues[hash % spineHues.length],
    '--spine-wear': Math.min(Number(item.noteCount || 0) / 8, 0.9),
  }
}

function BookSpine({ item, onOpen }) {
  return <button
    type="button"
    className={`book-spine book-spine--${item.status}`}
    style={spineStyle(item)}
    onClick={onOpen}
    aria-label={`${item.title}, ${item.author}, ${statusLabels[item.status]}${item.pageCount ? `, ${item.pageCount} sayfa` : ''}${item.noteCount ? `, ${item.noteCount} Atlas notu` : ''}. Katalog fişini aç.`}
    title={`${item.title} · ${item.author}`}
  >
    <span className="book-spine__status" aria-hidden="true" />
    <span className="book-spine__title">{item.title}</span>
    <span className="book-spine__author">{item.author}</span>
    {item.noteCount > 0 && <span className="book-spine__notes" aria-hidden="true">✦ {item.noteCount}</span>}
  </button>
}

function CatalogFiche({ item, onClose, onEdit, onRemove, onStatusChange }) {
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [notesError, setNotesError] = useState('')

  useEffect(() => {
    let active = true
    request(`/api/library/${encodeURIComponent(item.id)}/notes`)
      .then((result) => { if (active) setNotes(result.items || []) })
      .catch((error) => { if (active) setNotesError(error.message) })
      .finally(() => { if (active) setLoadingNotes(false) })

    const previousFocus = document.activeElement
    const dialog = document.querySelector('.catalog-fiche')
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], select:not([disabled])')]
    focusable()[0]?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      active = false
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [item.id, onClose])

  return <div className="catalog-fiche-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="catalog-fiche" role="dialog" aria-modal="true" aria-labelledby="catalog-fiche-title">
      <header className="catalog-fiche__header">
        <div><span className="eyebrow">CHRONOLOGOS · KÜTÜPHANE KATALOĞU</span><span className="catalog-fiche__number">FİŞ · {item.isbn || item.id.slice(0, 8).toUpperCase()}</span></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Katalog fişini kapat">×</button>
      </header>
      <div className="catalog-fiche__body">
        <div className="catalog-fiche__cover">
          <div className="physical-book" aria-label={`${item.title} kitabının kapak görünümü`}>
            <BookCover item={item} />
          </div>
        </div>
        <div className="catalog-fiche__record">
          <span className={`status-tag status-tag--${item.status}`}>{statusLabels[item.status]}</span>
          <h2 id="catalog-fiche-title">{item.title}</h2>
          <p className="catalog-fiche__author">{item.author}{item.originalYear ? ` · ${item.originalYear}` : ''}</p>
          <dl className="catalog-fiche__metadata">
            {item.language && <div><dt>Dil</dt><dd>{item.language}</dd></div>}
            {item.publisher && <div><dt>Yayınevi</dt><dd>{item.publisher}</dd></div>}
            {item.translator && <div><dt>Çevirmen</dt><dd>{item.translator}</dd></div>}
            {item.pageCount && <div><dt>Sayfa</dt><dd>{item.pageCount}</dd></div>}
            {item.isbn && <div><dt>ISBN</dt><dd>{item.isbn}</dd></div>}
          </dl>
          {item.resonanceTags?.length > 0 && <div className="resonance-badges">{item.resonanceTags.map((tag) => <span key={tag}>{resonanceLabels[tag]}</span>)}</div>}
          {item.description && <p className="catalog-fiche__description">{item.description}</p>}
          {item.review && <blockquote className="catalog-fiche__review">“{item.review}”</blockquote>}
          <div className="catalog-fiche__actions">
            <label className="status-select-label"><span>Okuma durumu</span><select value={item.status} onChange={(event) => onStatusChange(item, { status: event.target.value })}>{filters.filter((filter) => filter.id !== 'all').map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}</select></label>
            <button className="quiet-button" type="button" onClick={() => onEdit(item)}>Kaydı düzenle</button>
            <button className="remove-book" type="button" onClick={() => onRemove(item)}>Kitaplığımdan çıkar</button>
          </div>
        </div>
      </div>
      <section className="catalog-fiche__notes" aria-labelledby="catalog-fiche-notes-title">
        <div className="catalog-fiche__notes-heading"><span className="eyebrow">BU ESERDEN ATLAS’A</span><h3 id="catalog-fiche-notes-title">Düşünce ve alıntılar <small>{item.noteCount || 0}</small></h3></div>
        {loadingNotes ? <p className="catalog-fiche__empty">Kitap notları açılıyor…</p> : notesError ? <p className="catalog-fiche__empty" role="status">Notlara ulaşılamadı: {notesError}</p> : notes.length ? <div className="catalog-fiche__note-list">{notes.map((note) => <article className="catalog-fiche__note" key={note.id}>
          <span>{note.kind === 'quote' ? 'ALINTI' : 'DÜŞÜNCE'}{note.sourceLocator ? ` · ${note.sourceLocator}` : ''}</span>
          <h4>{note.title || note.content.split(/[.!?\n]/)[0].slice(0, 90) || 'Başlıksız düşünce'}</h4>
          <p>{note.content}</p>
          {note.commentary && <p className="catalog-fiche__note-commentary">{note.commentary}</p>}
          <a href={`/atlas?note=${encodeURIComponent(note.id)}`} onClick={(event) => { event.preventDefault(); navigateThroughPortal(`/atlas?note=${encodeURIComponent(note.id)}`, event.currentTarget) }}>Yıldızını Atlas’ta bul ↗</a>
        </article>)}</div> : <p className="catalog-fiche__empty">Bu kitaptan henüz Atlas’a bir düşünce bırakılmamış.</p>}
      </section>
    </section>
  </div>
}

function BookForm({ initialValue, onClose, onSave, saving, error }) {
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogItems, setCatalogItems] = useState([])
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [selectedWork, setSelectedWork] = useState(null)
  const [editions, setEditions] = useState([])
  const [editionsBusy, setEditionsBusy] = useState(false)
  const [form, setForm] = useState(() => initialValue ? {
    title: initialValue.title || '',
    author: initialValue.authors?.join('; ') || initialValue.author || '',
    originalYear: initialValue.originalYear || '',
    status: initialValue.status || 'to_read',
    resonanceTags: initialValue.resonanceTags || [],
    language: initialValue.language || '',
    publisher: initialValue.publisher || '',
    pageCount: initialValue.pageCount || '',
    isbn: initialValue.isbn || '',
    translator: initialValue.translator || '',
    description: initialValue.description || '',
    review: initialValue.review || '',
    openLibraryWorkKey: initialValue.openLibraryWorkKey || '',
    openLibraryEditionKey: initialValue.openLibraryEditionKey || '',
    coverId: initialValue.editionCoverId || '',
    workCoverId: initialValue.workCoverId || '',
  } : emptyForm)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = document.querySelector('.library-dialog')
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
    focusable()[0]?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const controls = focusable()
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [])

  function submit(event) {
    event.preventDefault()
    onSave({
      ...form,
      authors: form.author.split(';').map((name) => name.trim()).filter(Boolean),
      originalYear: form.originalYear || null,
      pageCount: form.pageCount || null,
      coverId: form.coverId || null,
      workCoverId: form.workCoverId || null,
    }, initialValue?.id)
  }

  async function searchCatalog(event) {
    event.preventDefault()
    if (!catalogQuery.trim()) return
    setCatalogBusy(true); setCatalogError(''); setCatalogItems([]); setSelectedWork(null); setEditions([])
    try { setCatalogItems((await request(`/api/catalog/search?q=${encodeURIComponent(catalogQuery.trim())}`)).items) }
    catch (lookupError) { setCatalogError(`${lookupError.message} Bilgileri elle girebilirsin.`) }
    finally { setCatalogBusy(false) }
  }

  async function chooseWork(work) {
    setSelectedWork(work); setEditions([]); setCatalogError(''); setEditionsBusy(true)
    setForm((current) => ({ ...current, title: work.title || current.title, author: (work.authors || []).join('; ') || current.author, originalYear: work.originalYear || current.originalYear, authors: work.authors || [], openLibraryWorkKey: work.workKey, workCoverId: work.coverId || '' }))
    try { setEditions((await request(`/api/catalog/works/${encodeURIComponent(work.workKey)}/editions`)).items) }
    catch (lookupError) { setCatalogError(`${lookupError.message} Baskı bilgilerini elle girebilirsin.`) }
    finally { setEditionsBusy(false) }
  }

  function chooseEdition(editionKey) {
    const edition = editions.find((candidate) => candidate.editionKey === editionKey)
    if (!edition) return
    setForm((current) => ({ ...current, isbn: edition.isbn || '', publisher: edition.publisher || '', language: edition.language || '', pageCount: edition.pageCount || '', openLibraryEditionKey: edition.editionKey, coverId: edition.coverId || '' }))
  }

  return (
    <div className="library-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="library-dialog" role="dialog" aria-modal="true" aria-labelledby="book-form-title">
        <header className="library-dialog__header">
          <div>
            <span className="eyebrow">YENİ KAYIT</span>
            <h2 id="book-form-title">{initialValue ? 'Kitap kaydını düzenle' : 'Kitaplığında yeni bir eser'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Pencereyi kapat">×</button>
        </header>
        <form className="book-form" onSubmit={submit}>
          {!initialValue && <section className="catalog-lookup field--wide" aria-label="Open Library katalog araması">
            <label className="field"><span>Katalogda ISBN veya başlık ara</span><div className="catalog-search-row"><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="ISBN ya da eser adı" /><button className="quiet-button" type="button" onClick={searchCatalog} disabled={catalogBusy}>{catalogBusy ? 'Aranıyor…' : 'Adayları ara'}</button></div></label>
            <p className="catalog-privacy">Yalnız arama terimi Open Library’ye gönderilir. Kişisel notların ve yorumların yerel kalır.</p>
            {catalogError && <p className="form-error" role="status">{catalogError}</p>}
            {catalogItems.length > 0 && <div className="catalog-candidates" role="list" aria-label="Kitap adayları">{catalogItems.map((work) => <button key={work.workKey} type="button" className={`catalog-candidate${selectedWork?.workKey === work.workKey ? ' is-selected' : ''}`} onClick={() => chooseWork(work)}><strong>{work.title}</strong><span>{work.authors.join(', ') || 'Yazar bilgisi yok'}{work.originalYear ? ` · ${work.originalYear}` : ''}</span></button>)}</div>}
            {selectedWork && <label className="field"><span>Baskı seç</span><select defaultValue="" onChange={(event) => chooseEdition(event.target.value)}><option value="">{editionsBusy ? 'Baskılar yükleniyor…' : 'Baskı seç veya bilgileri elle gir'}</option>{editions.map((edition) => <option value={edition.editionKey} key={edition.editionKey}>{[edition.title, edition.publishDate, edition.publisher, edition.isbn].filter(Boolean).join(' · ') || edition.editionKey}</option>)}</select></label>}
          </section>}
          <label className="field field--wide">
            <span>Kitap adı <b>*</b></span>
            <input required maxLength="240" value={form.title} onChange={set('title')} placeholder="Eserin adı" />
          </label>
          <label className="field field--wide">
            <span>Yazar <b>*</b></span>
            <input required maxLength="500" value={form.author} onChange={set('author')} placeholder="Birden çok yazarı noktalı virgülle ayır" />
          </label>
          <label className="field">
            <span>Okuma durumu</span>
            <select value={form.status} onChange={set('status')}>
              {filters.filter((filter) => filter.id !== 'all').map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>İlk yayın yılı</span>
            <input type="number" min="1" max="3000" value={form.originalYear} onChange={set('originalYear')} placeholder="Örn. 1947" />
          </label>
          <label className="field">
            <span>Baskı dili</span>
            <input maxLength="80" value={form.language} onChange={set('language')} placeholder="Türkçe" />
          </label>
          <label className="field">
            <span>Yayınevi</span>
            <input maxLength="160" value={form.publisher} onChange={set('publisher')} placeholder="Yayınevi" />
          </label>
          <label className="field">
            <span>ISBN</span>
            <input maxLength="32" value={form.isbn} onChange={set('isbn')} placeholder="Baskı numarası" />
          </label>
          <label className="field">
            <span>Çevirmen</span>
            <input maxLength="160" value={form.translator} onChange={set('translator')} placeholder="Varsa çevirmen" />
          </label>
          <label className="field">
            <span>Sayfa sayısı</span>
            <input type="number" min="1" max="100000" value={form.pageCount} onChange={set('pageCount')} placeholder="—" />
          </label>
          {form.status === 'read' && <div className="book-reflection-fields" key="read-reflections">
            <fieldset className="field field--wide resonance-picker"><legend>Etki derinliği <small>İsteğe bağlı · birden çok seçilebilir</small></legend><div>{resonanceOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={form.resonanceTags.includes(key)} onChange={(event) => setForm((current) => ({ ...current, resonanceTags: event.target.checked ? [...current.resonanceTags, key] : current.resonanceTags.filter((tag) => tag !== key) }))} />{label}</label>)}</div></fieldset>
            <label className="field field--wide">
              <span>Kitap açıklaması <small>İsteğe bağlı</small></span>
              <textarea rows="2" maxLength="2000" value={form.description} onChange={set('description')} placeholder="Eser hakkında kısa bilgi" />
            </label>
            <label className="field field--wide">
              <span>Kişisel düşüncen <small>İsteğe bağlı</small></span>
              <textarea rows="3" maxLength="5000" value={form.review} onChange={set('review')} placeholder="Bu eser sende ne bıraktı?" />
            </label>
          </div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer className="book-form__actions">
            <button className="quiet-button" type="button" onClick={onClose}>Vazgeç</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Kaydediliyor…' : initialValue ? 'Değişiklikleri kaydet' : 'Kitaplığa ekle'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function LibraryApp() {
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ all: 0, to_read: 0, reading: 0, read: 0, paused: 0, discover: 0, working: 0, atlas: 0 })
  const [insights, setInsights] = useState({ notesThisMonth: 0, crossBookLinks: 0, topTheme: null })
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeShelf, setActiveShelf] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formEditing, setFormEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [bookcaseWidth, setBookcaseWidth] = useState(0)
  const bookcaseRef = useRef(null)
  const requestSequence = useRef(0)
  const closeCatalogFiche = useCallback(() => setSelectedBookId(null), [])

  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (activeFilter !== 'all') query.set('status', activeFilter)
    if (activeShelf !== 'all') query.set('shelf', activeShelf)
    if (search.trim()) query.set('q', search.trim())
    return query.toString()
  }, [activeFilter, activeShelf, search])
  const paramsRef = useRef(params)
  paramsRef.current = params

  async function refresh(signal, query = paramsRef.current) {
    const sequence = ++requestSequence.current
    setLoading(true)
    setLoadError('')
    try {
      const result = await request(`/api/library${query ? `?${query}` : ''}`, { signal })
      if (sequence !== requestSequence.current) return
      setItems(result.items)
      setCounts(result.counts)
    } catch (error) {
      if (signal?.aborted || sequence !== requestSequence.current) return
      setLoadError(error.message)
    } finally {
      if (!signal?.aborted && sequence === requestSequence.current) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => refresh(controller.signal, params), search ? 180 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [params])

  useEffect(() => { request('/api/library/insights').then(setInsights).catch(() => {}) }, [])

  useEffect(() => {
    const element = bookcaseRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setBookcaseWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [items.length > 0])

  const shelfRows = useMemo(() => {
    if (!items.length) return []
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
    const capacity = Math.max(220, (bookcaseWidth || 760) - (mobile ? -120 : 42))
    const rows = []
    let row = []; let used = 0
    for (const item of items) {
      const width = spineMetrics(item).width + 8
      if (row.length && used + width > capacity) { rows.push(row); row = []; used = 0 }
      row.push(item); used += width
    }
    if (row.length) rows.push(row)
    return rows
  }, [items, bookcaseWidth])

  const selectedBook = items.find((item) => item.id === selectedBookId)

  async function saveBook(payload, entryId) {
    setSaving(true)
    setFormError('')
    try {
      await request(entryId ? `/api/library/${encodeURIComponent(entryId)}` : '/api/library', {
        method: entryId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setFormOpen(false)
      setFormEditing(null)
      setNotice(entryId ? 'Kitap kaydı güncellendi.' : 'Kitap kitaplığına eklendi.')
      await refresh()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateEntry(item, patch) {
    try {
      await request(`/api/library/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setNotice('Okuma kaydın güncellendi.')
      await refresh()
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function removeEntry(item) {
    if (!window.confirm(`“${item.title}” kitabını kişisel kitaplığından çıkarmak istiyor musun?`)) return
    try {
      await request(`/api/library/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      setSelectedBookId(null)
      setNotice('Kitap kişisel kitaplığından çıkarıldı.')
      await refresh()
    } catch (error) {
      setNotice(error.message)
    }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <main className="library-app library-app--books">
      <aside className="library-rail">
        <a className="library-brand" href="/library" aria-label="Chronologos kitaplığı">
          <span className="library-brand__mark">C<span>·</span>L</span>
          <span className="library-brand__word">CHRONOLOGOS<small>PERSONAL ARCHIVE</small></span>
        </a>
        <div className="rail-divider" />
        <span className="rail-label">ÇALIŞMA ALANI</span>
        <a className="rail-link rail-link--active" href="/library"><span className="rail-icon">▤</span> Kitaplığım <span className="rail-count">{counts.all}</span></a>
        <a className="rail-link" href="/notes"><span className="rail-icon">✎</span> Notlar <span className="rail-external">↗</span></a>
        <a className="rail-link" href="/atlas" onClick={(event) => { event.preventDefault(); navigateThroughPortal('/atlas', event.currentTarget) }}><span className="rail-icon">✧</span> Atlas’a dön <span className="rail-external">↗</span></a>
        <div className="rail-note">
          <span className="rail-note__symbol">✦</span>
          <p>Her kitap, zihninde başka bir yere açılan kapı.</p>
        </div>
        <div className="rail-footer"><span className="status-light" /> YEREL ARŞİV <span className="rail-footer__version">0.1</span></div>
      </aside>

      <section className="library-main">
        <header className="library-topbar">
          <div className="breadcrumb"><span>KİŞİSEL ARŞİV</span><span className="breadcrumb__slash">/</span><strong>KİTAPLIĞIM</strong></div>
          <a className="atlas-open" href="/atlas" onClick={(event) => { event.preventDefault(); navigateThroughPortal('/atlas', event.currentTarget) }}><span>✧</span> Atlas’a dön <b>↗</b></a>
        </header>

        <div className="library-content">
          <section className="library-heading">
            <div>
              <span className="eyebrow">OKUMA KAYITLARIN</span>
              <h1>Kitaplığım<span>.</span></h1>
              <p>Okudukların burada birikir. Onlardan doğan düşünceler, atlasında yeni yollar açar.</p>
            </div>
            <button className="primary-button add-book-button" onClick={() => { setFormError(''); setFormEditing(null); setFormOpen(true) }}>
              <span>＋</span> Yeni kitap ekle
            </button>
          </section>

          <section className="library-stats library-stats--synthesis" aria-label="Sentez özeti">
            <div className="stat-card"><span>BU AYIN YILDIZLARI</span><strong>{insights.notesThisMonth}</strong><i>yeni düşünce kaydı</i></div>
            <div className="stat-card"><span>KİTAPLAR ARASI BAĞLAR</span><strong>{insights.crossBookLinks}</strong><i>notların kurduğu köprüler</i></div>
            <div className="stat-card"><span>EN ÇOK İZ BIRAKAN TEMA</span><strong className="stat-theme">{insights.topTheme || '—'}</strong><i>notlarına göre</i></div>
          </section>

          <section className="collection-section">
            <div className="collection-heading">
              <div>
                <span className="eyebrow">KOLEKSİYON</span>
                <h2>Rafların</h2>
              </div>
              <label className="library-search">
                <span aria-hidden="true">⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kitap veya yazar ara" aria-label="Kitap veya yazar ara" />
              </label>
            </div>

            <div className="filter-row" role="tablist" aria-label="Okuma durumuna göre filtrele">
              {filters.map((filter) => (
                <button
                  className={`filter-chip${activeFilter === filter.id ? ' filter-chip--active' : ''}`}
                  key={filter.id}
                  onClick={() => { setActiveFilter(filter.id); if (filter.id === 'all') setActiveShelf('all') }}
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                >
                  {filter.label}<span>{counts[filter.id]}</span>
                </button>
              ))}
            </div>

            <div className="filter-row filter-row--thinking" role="tablist" aria-label="Atlas bağına göre filtrele">
              <span className="filter-row__caption">ATLAS BAĞI</span>
              {[['discover', 'Yıldızsız kitaplar', counts.discover], ['working', 'Okurken notlananlar', counts.working], ['atlas', 'Atlas izi olanlar', counts.atlas]].map(([id, label, count]) => <button key={id} className={`filter-chip${activeShelf === id ? ' filter-chip--active' : ''}`} onClick={() => setActiveShelf((current) => current === id ? 'all' : id)} role="tab" aria-selected={activeShelf === id}>{label}<span>{count}</span></button>)}
              {activeShelf === 'all' && <span className="filter-row__hint">Hepsi</span>}
            </div>

            {loadError ? (
              <div className="library-message library-message--error" role="alert">
                <span>Arşive ulaşılamadı</span><p>{loadError} API sunucusunun çalıştığını kontrol et.</p>
                <button className="quiet-button" onClick={() => refresh()}>Yeniden dene</button>
              </div>
            ) : loading ? (
              <div className="library-loading" aria-live="polite"><span className="loading-orbit" /> Arşiv açılıyor…</div>
            ) : items.length ? (
              <div className="bookcase" ref={bookcaseRef} aria-label="Ahşap kitap rafları">
                {shelfRows.map((row, rowIndex) => <div className="bookcase-row" key={`shelf-${rowIndex}`}>
                  <div className="bookcase-books" role="list" aria-label={`${rowIndex + 1}. raf`}>
                    {row.map((item) => <div className="bookcase-book" role="listitem" key={item.id}>
                      <BookSpine item={item} onOpen={() => setSelectedBookId(item.id)} />
                    </div>)}
                  </div>
                  <div className="bookcase-plank" aria-hidden="true"><span /></div>
                </div>)}
              </div>
            ) : (
              <div className="library-empty">
                <div className="library-empty__seal">✧</div>
                <span className="eyebrow">YENİ BİR SAYFA</span>
                <h3>{search || activeFilter !== 'all' || activeShelf !== 'all' ? 'Bu rafta eser bulunamadı.' : 'Kitaplığın ilk kitabını bekliyor.'}</h3>
                <p>{search || activeFilter !== 'all' || activeShelf !== 'all' ? 'Arama sözcüğünü ya da seçili filtreyi değiştirebilirsin.' : 'Bir kitap ekle; okuma yolculuğun ve düşünce atlasın birlikte büyüsün.'}</p>
                {!search && activeFilter === 'all' && <button className="primary-button" onClick={() => { setFormEditing(null); setFormOpen(true) }}>İlk kitabını ekle <span>↗</span></button>}
              </div>
            )}
          </section>
          <footer className="library-footer"><span>CHRONOLOGOS</span><span>OKUMAKTAN DÜŞÜNCEYE</span><span>✦</span></footer>
        </div>
      </section>

      {selectedBook && <CatalogFiche item={selectedBook} onClose={closeCatalogFiche} onEdit={(item) => { setSelectedBookId(null); setFormError(''); setFormEditing(item); setFormOpen(true) }} onRemove={removeEntry} onStatusChange={updateEntry} />}
      {formOpen && <BookForm key={formEditing?.id || 'new-book'} initialValue={formEditing} onClose={() => { setFormOpen(false); setFormEditing(null) }} onSave={saveBook} saving={saving} error={formError} />}
      {notice && <div className="library-toast" role="status">{notice}</div>}
    </main>
  )
}
