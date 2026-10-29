import { formatPercent, getLocale, t, useLanguage } from '../i18n/index.js'
import { LibraryExtras } from './LibraryExtras.jsx'
import { ArchiveNavigation } from './ArchiveNavigation.jsx'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { handleArchiveLink, navigateThroughPortal } from '../navigation/portalTransition.js'
import { setAuthorCompassDestination } from '../navigation/authorCompass.js'
import './library.css'
import './catalog-fiche.css'

const ReadingTimeline = lazy(() => import('./ReadingTimeline.jsx'))
const ReadingConstellation = lazy(() => import('./ReadingConstellation.jsx'))

const filters = [
  { id: 'overview', label: 'Kitaplıklar' },
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

const orbitYear = new Date().getFullYear()

function readingPercent(item) {
  if (item.status === 'read') return 100
  if (item.progressPercent !== null && item.progressPercent !== undefined) return Number(item.progressPercent)
  if (item.pageCount && item.currentPage !== null && item.currentPage !== undefined) return Math.min(100, Math.round(item.currentPage / item.pageCount * 100))
  return 0
}

const resonanceOptions = [
  ['transformative', 'Dönüştürücü'], ['cornerstone', 'Temel taş'], ['questioning', 'Sorgulatıcı'], ['catalyst', 'Katalizör'],
]
const resonanceLabels = Object.fromEntries(resonanceOptions)

const emptyForm = {
  title: '', author: '', authors: [], originalYear: '', status: 'to_read', rating: '', resonanceTags: [],
  language: '', publisher: '', pageCount: '', isbn: '', translator: '', description: '', review: '',
  openLibraryWorkKey: '', openLibraryEditionKey: '', coverId: '', workCoverId: '',
  latitude: '', longitude: '', locationLabel: '', locationKind: 'birthplace',
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

const bookCoverLookups = new Map()

function coverUrls(record) {
  const isbn = String(record.isbn || '').replace(/[^0-9x]/gi, '').toUpperCase()
  const urls = []
  if (isbn.length === 10 || isbn.length === 13) {
    urls.push(`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`)
  }
  if (record.coverId) {
    for (const size of ['L', 'M']) urls.push(`https://covers.openlibrary.org/b/id/${encodeURIComponent(record.coverId)}-${size}.jpg?default=false`)
  }
  if (record.openLibraryEditionKey) {
    urls.push(`https://covers.openlibrary.org/b/olid/${encodeURIComponent(record.openLibraryEditionKey)}-L.jpg?default=false`)
  }
  if (record.coverUrl) urls.push(record.coverUrl)
  return [...new Set(urls)]
}

function loadCoverImage(url) {
  return new Promise((resolve) => {
    const image = new window.Image()
    let settled = false
    const timer = window.setTimeout(() => finish(false), 10000)
    const finish = (loaded) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(loaded)
    }
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}

function normalizeCatalogText(value) {
  return String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function scoreCatalogMatch(candidate, item) {
  const candidateTitle = normalizeCatalogText(candidate.title)
  const targetTitle = normalizeCatalogText(item.title)
  const candidateAuthors = (candidate.authors || []).map(normalizeCatalogText)
  const targetAuthors = String(item.author || '').split(/[;,/&]+/).map(normalizeCatalogText).filter(Boolean)
  const containsWholePhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `)
  const titleMatches = candidateTitle === targetTitle || (
    Math.min(candidateTitle.length, targetTitle.length) >= 8 &&
    (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) &&
    Math.min(candidateTitle.length, targetTitle.length) / Math.max(candidateTitle.length, targetTitle.length) >= 0.75
  )
  const authorMatches = !targetAuthors.length || targetAuthors.some((targetAuthor) =>
    candidateAuthors.some((author) => author && (containsWholePhrase(author, targetAuthor) || containsWholePhrase(targetAuthor, author)))
  )
  if (!titleMatches || !authorMatches) return 0
  return (candidateTitle === targetTitle ? 4 : 2) + (targetAuthors.length ? 2 : 0)
}

async function findCatalogCover(item) {
  const isbn = String(item.isbn || '').replace(/[^0-9x]/gi, '')
  const queries = [...new Set([isbn, item.title].filter(Boolean))]
  for (const query of queries) {
    try {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) continue
      const result = await response.json()
      const candidates = (result.items || []).filter((candidate) => candidate.coverId || candidate.coverUrl)
        .map((candidate) => ({ candidate, score: scoreCatalogMatch(candidate, item) }))
        .sort((a, b) => b.score - a.score)
      for (const { candidate, score } of candidates) {
        if (score < 4) continue
        for (const url of coverUrls(candidate)) if (await loadCoverImage(url)) return url
      }
    } catch { /* The local Open Library proxy can be unavailable; keep the illustrated fallback. */ }
  }
  return null
}

function resolveBookCover(item) {
  const cacheKey = [item.id, item.isbn, item.coverId, item.openLibraryEditionKey, item.coverUrl, item.title, item.author].join('|')
  if (bookCoverLookups.has(cacheKey)) return bookCoverLookups.get(cacheKey)
  const lookup = (async () => {
    for (const url of coverUrls(item)) if (await loadCoverImage(url)) return url
    return findCatalogCover(item)
  })().catch(() => null)
  bookCoverLookups.set(cacheKey, lookup)
  if (bookCoverLookups.size > 400) bookCoverLookups.delete(bookCoverLookups.keys().next().value)
  return lookup
}

function BookCover({ item, allowRemote = false }) {
  const hues = [39, 190, 12, 150, 275, 215]
  const hash = [...item.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 0)
  const hue = hues[hash % hues.length]
  const [coverImage, setCoverImage] = useState(null)

  useEffect(() => {
    setCoverImage(null)
    if (!allowRemote) return undefined
    let cancelled = false
    resolveBookCover(item).then((url) => { if (!cancelled && url) setCoverImage(url) })
    return () => {
      cancelled = true
    }
  }, [allowRemote, item.id, item.isbn, item.coverId, item.openLibraryEditionKey, item.coverUrl, item.title, item.author])

  const hasRemoteCover = Boolean(allowRemote && coverImage)
  return (
    <div
      className={`book-cover${hasRemoteCover ? ' book-cover--remote' : ''}`}
      style={{
        '--cover-hue': hue,
        ...(hasRemoteCover ? {
          backgroundImage: `url("${coverImage}")`,
        } : {}),
      }}
    >
      {hasRemoteCover && <span className="book-cover__patina" aria-hidden="true" />}
      <span className="book-cover__stamp">{t("C · L")}</span>
      <span className="book-cover__title">{item.title}</span>
      <span className="book-cover__author">{item.author}</span>
      <span className="book-cover__ornament">✦</span>
    </div>
  )
}

const spinePalettes = [
  { hue: 14, saturation: '42%', lightness: '28%', ink: '#f8e8cf' },
  { hue: 34, saturation: '48%', lightness: '35%', ink: '#fff0d3' },
  { hue: 72, saturation: '27%', lightness: '29%', ink: '#f6efd8' },
  { hue: 150, saturation: '29%', lightness: '27%', ink: '#e8f1dd' },
  { hue: 184, saturation: '37%', lightness: '28%', ink: '#e9f5ee' },
  { hue: 213, saturation: '36%', lightness: '32%', ink: '#ebf0f4' },
  { hue: 273, saturation: '26%', lightness: '33%', ink: '#f2e9ee' },
]

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
  const palette = spinePalettes[hash % spinePalettes.length]
  return {
    '--spine-width': `${width}px`,
    '--spine-height': `${height}px`,
    '--spine-hue': palette.hue,
    '--spine-saturation': palette.saturation,
    '--spine-lightness': palette.lightness,
    '--spine-ink': palette.ink,
  }
}

function BookSpine({ item, onOpen, onPreview, onPreviewClose }) {
  return <button
    type="button"
    className={`book-spine book-spine--${item.status}`}
    style={spineStyle(item)}
    onClick={onOpen}
    onMouseEnter={(event) => onPreview(item, event.currentTarget)}
    onMouseLeave={(event) => { if (document.activeElement !== event.currentTarget) onPreviewClose() }}
    onFocus={(event) => onPreview(item, event.currentTarget)}
    onBlur={(event) => { if (!event.currentTarget.matches(':hover')) onPreviewClose() }}
    aria-label={t("{value0}, {value1}, {value2}{value3}{value4}{value5}. Katalog fişini aç.", { value0: item.title, value1: item.author, value2: t(statusLabels[item.status]), value3: item.pageCount ? t(", {count} sayfa", { count: item.pageCount }) : '', value4: item.status === 'reading' ? t(", {percent} okundu", { percent: formatPercent(readingPercent(item)) }) : '', value5: item.noteCount ? t(", {count} Atlas notu", { count: item.noteCount }) : '' })}
    title={`${item.title} · ${item.author}${item.status === 'reading' ? t(" · {percent} okundu", { percent: formatPercent(readingPercent(item)) }) : ''}`}
  >
    <span className="book-spine__status" aria-hidden="true" />
    <span className="book-spine__title">{item.title}</span>
    <span className="book-spine__author">{item.author}</span>
    {item.noteCount > 0 && <span className="book-spine__notes" aria-hidden="true">✦ {item.noteCount}</span>}
    {item.status === 'reading' && <span className="book-spine__ribbon" style={{ '--ribbon-height': `${18 + readingPercent(item) * 1.55}px` }} aria-hidden="true" />}
  </button>
}

function BookPreview({ preview }) {
  if (!preview) return null
  return createPortal(<div className="book-spine-preview" style={{ left: preview.left, top: preview.top }} aria-hidden="true">
    <div className="book-spine-preview__cover"><BookCover item={preview.item} allowRemote /></div>
    <div className="book-spine-preview__details"><strong>{preview.item.title}</strong><span>{preview.item.author}</span></div>
  </div>, document.body)
}

function ReadingCandle({ item }) {
  const progress = readingPercent(item)
  return <div className="reading-candle" style={{ '--wax-height': `${110 - progress * 0.7}px` }} aria-label={t("Okuma izi: yüzde {value0}; {value1} düşünce veya alıntı", { value0: progress, value1: item.noteCount || 0 })}>
    <span className="reading-candle__flame" aria-hidden="true" />
    <span className="reading-candle__wick" aria-hidden="true" />
    <span className="reading-candle__wax" aria-hidden="true" />
    <span className="reading-candle__pool" aria-hidden="true">{Array.from({ length: Math.min(item.noteCount || 0, 5) }, (_, index) => <i key={index} />)}</span>
    <small>{t("OKUMA İZİ · {percent}", { percent: formatPercent(progress) })}</small>
  </div>
}

function ReadingOrbit({ orbit, editing, draft, onEdit, onDraft, onSave, saving, error, birth, catalogItems = [], readingBooks = [], onBookOpen }) {
  const target = orbit?.target ?? null
  const completed = orbit?.completed ?? 0
  const birthIndex = birth ? orbit?.books?.findIndex((book) => book.id === birth.bookId) ?? -1 : -1
  const [stageVisible, setStageVisible] = useState(false)
  const [hoveredBook, setHoveredBook] = useState(null)
  const [focusedBookIndex, setFocusedBookIndex] = useState(-1)
  const stageRef = useRef(null)
  const catalogById = useMemo(() => new Map(catalogItems.map((item) => [item.id, item])), [catalogItems])
  const books = useMemo(() => (orbit?.books || []).map((book) => ({ ...book, author: catalogById.get(book.id)?.author || '' })), [orbit?.books, catalogById])
  const navigableBooks = [...books, ...readingBooks]

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    let intersects = false
    let pageVisible = document.visibilityState !== 'hidden'
    const update = () => setStageVisible(intersects && pageVisible)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      intersects = entry.isIntersecting
      update()
    }, { threshold: 0.05 })
    if (observer) observer.observe(stage)
    else intersects = true
    const onVisibility = () => { pageVisible = document.visibilityState !== 'hidden'; update() }
    document.addEventListener('visibilitychange', onVisibility)
    update()
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  return <section className="reading-orbit" aria-label={t("{value0} okuma yörüngesi", { value0: orbitYear })}>
    <div className="reading-orbit__copy"><span className="eyebrow">{orbitYear} {t("· YILDIZ USTURLABI")}</span><h2>{t("Yılın gökyüzü")}</h2><p>{target ? t("{completed} kitap yıldızını yaktı. {target} yıldızlık gökyüzün kendi hızında tamamlanıyor.", { completed: completed, target: target }) : t("{completed} bitmiş kitabın gökyüzünde. Bu yıl kaç yıldız yakacağını sen seç.", { completed: completed })}</p>
      {editing ? <form className="reading-orbit__form" onSubmit={onSave}><label>{t("Yıllık hedef")} <input type="number" min="1" max="500" required value={draft} onChange={(event) => onDraft(event.target.value)} placeholder={t("Örn. 50")} /></label><button type="submit" disabled={saving}>{saving ? t("Kaydediliyor…") : t("Yörüngeyi kaydet")}</button></form> : <button type="button" className="reading-orbit__edit" onClick={onEdit}>{target ? t("Hedefi değiştir") : t("Yıldız sayısını belirle")} ↗</button>}
      {error && <small className="reading-orbit__error" role="alert">{t(error)}</small>}
    </div>
    <div className="reading-orbit__sky" ref={stageRef} role="group" tabIndex={navigableBooks.length ? 0 : -1} aria-label={t("{value0} tamamlanan kitap yıldızı{value1}. İşaretler arasında ok tuşlarıyla gezin, Enter ile kitabı aç.", { value0: completed, value1: readingBooks.length ? t(" ve {count} okunmakta olan kitap işareti", { count: readingBooks.length }) : '' })} onMouseLeave={() => setHoveredBook(null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHoveredBook(null) }} onKeyDown={(event) => {
      if (!navigableBooks.length) return
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        const next = (focusedBookIndex + 1 + navigableBooks.length) % navigableBooks.length
        setFocusedBookIndex(next); setHoveredBook({ ...navigableBooks[next], starIndex: next < books.length ? next : -1 })
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = (focusedBookIndex - 1 + navigableBooks.length) % navigableBooks.length
        setFocusedBookIndex(next); setHoveredBook({ ...navigableBooks[next], starIndex: next < books.length ? next : -1 })
      } else if (event.key === 'Enter' && focusedBookIndex >= 0) {
        event.preventDefault(); onBookOpen(navigableBooks[focusedBookIndex].id)
      }
    }}>
      <div className="reading-orbit__stage">
        {stageVisible && <Suspense fallback={<div className="reading-orbit__loading" />}><ReadingConstellation target={target} completed={completed} books={books} readingBooks={readingBooks} birth={birth} birthIndex={birthIndex} selectedIndex={hoveredBook?.starIndex ?? -1} onBookOpen={onBookOpen} onHoverBook={setHoveredBook} /></Suspense>}
      </div>
      {readingBooks.length > 0 && <div className="reading-orbit__reading-count">{t("ŞU AN YOLCULUKTA")} <strong>{readingBooks.length}</strong></div>}
      {hoveredBook && <div className="reading-orbit__tooltip" role="status">{hoveredBook.title}<small>{hoveredBook.author && <span>{hoveredBook.author}</span>}<span>{hoveredBook.completedAt ? new Date(`${hoveredBook.completedAt.slice(0, 10)}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : hoveredBook.progressPercent !== null && hoveredBook.progressPercent !== undefined ? t("{percent} okundu · şu an okunuyor", { percent: formatPercent(hoveredBook.progressPercent) }) : t("Şu an okunuyor")}</span></small></div>}
      <div className="reading-orbit__count"><strong>{completed}</strong><span>{target ? t("/ {target}", { target: target }) : t("tamamlanan")}</span></div>
    </div>
  </section>
}

export function CatalogFiche({ item, onClose, onEdit, onRemove, onStatusChange }) {
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [notesError, setNotesError] = useState('')
  const [pageInput, setPageInput] = useState(item.currentPage ?? '')
  const [percentInput, setPercentInput] = useState(item.progressPercent ?? readingPercent(item))
  const [finishedInput, setFinishedInput] = useState(item.completedAt?.slice(0, 10) || '')

  useEffect(() => {
    setPageInput(item.currentPage ?? '')
    setPercentInput(item.progressPercent ?? readingPercent(item))
    setFinishedInput(item.completedAt?.slice(0, 10) || '')
  }, [item.id, item.currentPage, item.progressPercent, item.completedAt])

  useEffect(() => {
    let active = true
    request(`/api/library/${encodeURIComponent(item.id)}/notes`)
      .then((result) => { if (active) setNotes(result.items || []) })
      .catch((error) => { if (active) setNotesError(error.message) })
      .finally(() => { if (active) setLoadingNotes(false) })

    const previousFocus = document.activeElement
    const dialog = document.querySelector('.catalog-fiche')
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), textarea:not([disabled])')]
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
        <div><span className="eyebrow">{t("CHRONOLOGOS · KÜTÜPHANE KATALOĞU")}</span><span className="catalog-fiche__number">{t("FİŞ ·")} {item.isbn || item.id.slice(0, 8).toUpperCase()}</span></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label={t("Katalog fişini kapat")}>×</button>
      </header>
      <div className="catalog-fiche__body">
        <div className="catalog-fiche__cover">
          <div className="physical-book" aria-label={t("{value0} kitabının kapak görünümü", { value0: item.title })}>
            <BookCover item={item} allowRemote />
          </div>
          <div className="catalog-fiche__seal" aria-hidden="true">✦</div>
          <p className="catalog-fiche__cover-caption">{t("KİŞİSEL KÜTÜPHANE")}<span>{t("Bir kitap, bir düşünce evreni.")}</span></p>
          <dl className="catalog-fiche__summary">
            <div><dt>{t("Atlas notu")}</dt><dd>{item.noteCount || 0}</dd></div>
            <div><dt>{item.status === 'read' ? t("Tamamlandı") : t("Okuma yolculuğu")}</dt><dd>{formatPercent(readingPercent(item))}</dd></div>
          </dl>
        </div>
        <div className="catalog-fiche__record">
          <span className={`status-tag status-tag--${item.status}`}>{t(statusLabels[item.status])}</span>
          <h2 id="catalog-fiche-title">{item.title}</h2>
          <p className="catalog-fiche__author">{item.author}{item.originalYear ? t(" · {value0}", { value0: item.originalYear }) : ""}</p>
          <button className="author-compass" type="button" onClick={(event) => {
            if (item.latitude === null || item.longitude === null) { onEdit(item); return }
            if (setAuthorCompassDestination(item)) navigateThroughPortal('/atlas', event.currentTarget)
          }} aria-label={item.latitude === null || item.longitude === null ? t("Yazarın Pusulası için konum ekle") : t("{value0} konumunu Atlas’ta gör", { value0: item.locationLabel || item.author })}>
            <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" /><circle cx="32" cy="32" r="21" /><path d="M32 2v7m0 46v7M2 32h7m46 0h7M32 12l4 16-4 4-4-4zM32 52l-4-16 4-4 4 4z" /><circle cx="32" cy="32" r="3" /></svg>
            <span><strong>{t("Yazarın Pusulası")}</strong><small>{item.latitude === null || item.longitude === null ? t("Konum ekle ↗") : t("{value0} · {value1} · Atlas’ta gör ↗", { value0: item.locationLabel || t('Yazarla ilişkili yer'), value1: t(item.locationKind === 'birthplace' ? 'Doğum yeri' : 'İlişkili yer') })}</small></span>
          </button>
          <ReadingCandle item={item} />
          <dl className="catalog-fiche__metadata">
            {item.language && <div><dt>{t("Dil")}</dt><dd>{item.language}</dd></div>}
            {item.publisher && <div><dt>{t("Yayınevi")}</dt><dd>{item.publisher}</dd></div>}
            {item.translator && <div><dt>{t("Çevirmen")}</dt><dd>{item.translator}</dd></div>}
            {item.pageCount && <div><dt>{t("Sayfa")}</dt><dd>{item.pageCount}</dd></div>}
            {item.isbn && <div><dt>{t("ISBN")}</dt><dd>{item.isbn}</dd></div>}
          </dl>
          {item.resonanceTags?.length > 0 && <div className="resonance-badges">{item.resonanceTags.map((tag) => <span key={tag}>{t(resonanceLabels[tag])}</span>)}</div>}
          {item.description && <p className="catalog-fiche__description">{item.description}</p>}
          {item.review && <blockquote className="catalog-fiche__review">“{item.review}”</blockquote>}
          {item.status !== 'read' ? <form className="catalog-progress" onSubmit={(event) => { event.preventDefault(); onStatusChange(item, { currentPage: pageInput === '' ? null : Number(pageInput), progressPercent: percentInput === '' ? null : Number(percentInput), status: item.status === 'to_read' ? 'reading' : item.status }) }}><div><span>{t("İPEK AYRAÇ · OKUMA İLERLEMESİ")}</span><p>{t("Kaldığın sayfayı veya yüzdeliği güncelle; ayraç rafta yerini bulsun.")}</p></div><label>{t("Sayfa")} <input type="number" min="0" max={item.pageCount || 100000} value={pageInput} onChange={(event) => { const value = event.target.value; setPageInput(value); if (item.pageCount && value !== '') setPercentInput(Math.min(100, Math.round(Number(value) / item.pageCount * 100))) }} placeholder="0" />{item.pageCount && <small>/ {item.pageCount}</small>}</label><label>{t("Yüzde")} <input type="number" min="0" max="100" value={percentInput} onChange={(event) => { const value = event.target.value; setPercentInput(value); if (item.pageCount && value !== '') setPageInput(Math.round(Number(value) / 100 * item.pageCount)) }} placeholder="0" /><small>%</small></label><button type="submit">{t("İlerlemeyi kaydet")}</button></form> : <form className="catalog-progress catalog-progress--finished" onSubmit={(event) => { event.preventDefault(); onStatusChange(item, { completedAt: finishedInput || null }) }}><div><span>{t("YÖRÜNGEYE EKLENEN GÜN")}</span><p>{t("Bu tarih, kitabın hangi yılın yıldızı olacağını belirler.")}</p></div><label>{t("Bitiş tarihi")} <input type="date" value={finishedInput} onChange={(event) => setFinishedInput(event.target.value)} /></label><button type="submit">{t("Tarihi kaydet")}</button></form>}
          <div className="catalog-fiche__actions">
            <label className="status-select-label"><span>{t("Okuma durumu")}</span><select value={item.status} onChange={(event) => onStatusChange(item, { status: event.target.value })}>{filters.filter((filter) => !['all', 'overview'].includes(filter.id)).map((filter) => <option key={filter.id} value={filter.id}>{t(filter.label)}</option>)}</select></label>
            <button className="quiet-button" type="button" onClick={() => onEdit(item)}>{t("Kaydı düzenle")}</button>
            <button className="remove-book" type="button" onClick={() => onRemove(item)}>{t("Kitaplığımdan çıkar")}</button>
          </div>
        </div>
      </div>
      <section className="catalog-fiche__notes" aria-labelledby="catalog-fiche-notes-title">
        <div className="catalog-fiche__notes-heading"><span className="eyebrow">{t("BU ESERDEN ATLAS’A")}</span><h3 id="catalog-fiche-notes-title">{t("Düşünce ve alıntılar")} <small>{item.noteCount || 0}</small></h3></div>
        {loadingNotes ? <p className="catalog-fiche__empty">{t("Kitap notları açılıyor…")}</p> : notesError ? <p className="form-error" role="alert">{t("Notlara ulaşılamadı:")} {t(notesError)}</p> : notes.length ? <div className="catalog-fiche__note-list">{notes.map((note) => <article className="catalog-fiche__note" key={note.id}>
          <span>{note.kind === 'quote' ? t("ALINTI") : t("DÜŞÜNCE")}{note.sourceLocator ? t(" · {value0}", { value0: note.sourceLocator }) : ""}</span>
          <h4>{note.title || note.content.split(/[.!?\n]/)[0].slice(0, 90) || t("Başlıksız düşünce")}</h4>
          <p>{note.content}</p>
          {note.commentary && <p className="catalog-fiche__note-commentary">{note.commentary}</p>}
          <a href={`/atlas?note=${encodeURIComponent(note.id)}`} onClick={handleArchiveLink}>{t("Yıldızını Atlas’ta bul ↗")}</a>
        </article>)}</div> : <p className="catalog-fiche__empty">{t("Bu kitaptan henüz Atlas’a bir düşünce bırakılmamış.")}</p>}
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
  const [placeQuery, setPlaceQuery] = useState(initialValue?.locationLabel || '')
  const [places, setPlaces] = useState([])
  const [placesBusy, setPlacesBusy] = useState(false)
  const [placesError, setPlacesError] = useState('')
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
    latitude: initialValue.latitude ?? '',
    longitude: initialValue.longitude ?? '',
    locationLabel: initialValue.locationLabel || '',
    locationKind: initialValue.locationKind || 'birthplace',
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
    if (placeQuery.trim() && (form.latitude === '' || form.longitude === '')) {
      setPlacesError('Arama sonuçlarından bir yer seçmelisin. Önce “Yer ara”ya bas.')
      return
    }
    setPlacesError('')
    const willNavigateToAtlas = form.latitude !== '' && form.longitude !== '' && (
      !initialValue || Number(initialValue.latitude) !== Number(form.latitude) || Number(initialValue.longitude) !== Number(form.longitude)
    )
    onSave({
      ...form,
      authors: form.author.split(';').map((name) => name.trim()).filter(Boolean),
      originalYear: form.originalYear || null,
      pageCount: form.pageCount || null,
      coverId: form.coverId || null,
      workCoverId: form.workCoverId || null,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
    }, initialValue?.id, willNavigateToAtlas)
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

  async function searchPlaces() {
    if (placeQuery.trim().length < 2) { setPlacesError('Bir şehir veya yer adı yaz.'); return }
    setPlacesBusy(true); setPlacesError(''); setPlaces([])
    try { setPlaces((await request(`/api/places/search?q=${encodeURIComponent(placeQuery.trim())}`)).items || []) }
    catch (lookupError) { setPlacesError(lookupError.message) }
    finally { setPlacesBusy(false) }
  }

  function choosePlace(place) {
    setForm((current) => ({ ...current, latitude: String(place.latitude), longitude: String(place.longitude), locationLabel: place.label }))
    setPlaceQuery(place.displayName)
    setPlaces([])
    setPlacesError('')
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
            <span className="eyebrow">{t("YENİ KAYIT")}</span>
            <h2 id="book-form-title">{initialValue ? t("Kitap kaydını düzenle") : t("Kitaplığında yeni bir eser")}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("Pencereyi kapat")}>×</button>
        </header>
        <form className="book-form" onSubmit={submit}>
          {!initialValue && <section className="catalog-lookup field--wide" aria-label={t("Open Library katalog araması")}>
            <label className="field"><span>{t("Katalogda ISBN veya başlık ara")}</span><div className="catalog-search-row"><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder={t("ISBN ya da eser adı")} /><button className="quiet-button" type="button" onClick={searchCatalog} disabled={catalogBusy}>{catalogBusy ? t("Aranıyor…") : t("Adayları ara")}</button></div></label>
            <p className="catalog-privacy">{t("Yalnız arama terimi Open Library’ye gönderilir. Kişisel notların ve yorumların yerel kalır.")}</p>
            {catalogError && <p className="form-error" role="alert">{t(catalogError)}</p>}
            {catalogItems.length > 0 && <div className="catalog-candidates" role="list" aria-label={t("Kitap adayları")}>{catalogItems.map((work) => <button key={work.workKey} type="button" className={`catalog-candidate${selectedWork?.workKey === work.workKey ? ' is-selected' : ''}`} onClick={() => chooseWork(work)}><strong>{work.title}</strong><span>{work.authors.join(', ') || t("Yazar bilgisi yok")}{work.originalYear ? t(" · {value0}", { value0: work.originalYear }) : ""}</span></button>)}</div>}
            {selectedWork && <label className="field"><span>{t("Baskı seç")}</span><select defaultValue="" onChange={(event) => chooseEdition(event.target.value)}><option value="">{editionsBusy ? t("Baskılar yükleniyor…") : t("Baskı seç veya bilgileri elle gir")}</option>{editions.map((edition) => <option value={edition.editionKey} key={edition.editionKey}>{[edition.title, edition.publishDate, edition.publisher, edition.isbn].filter(Boolean).join(' · ') || edition.editionKey}</option>)}</select></label>}
          </section>}
          <label className="field field--wide">
            <span>{t("Kitap adı")} <b>*</b></span>
            <input required maxLength="240" value={form.title} onChange={set('title')} placeholder={t("Eserin adı")} />
          </label>
          <label className="field field--wide">
            <span>{t("Yazar")} <b>*</b></span>
            <input required maxLength="500" value={form.author} onChange={set('author')} placeholder={t("Birden çok yazarı noktalı virgülle ayır")} />
          </label>
          <label className="field">
            <span>{t("Okuma durumu")}</span>
            <select value={form.status} onChange={set('status')}>
              {filters.filter((filter) => !['all', 'overview'].includes(filter.id)).map((filter) => <option key={filter.id} value={filter.id}>{t(filter.label)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("İlk yayın yılı")}</span>
            <input type="number" min="1" max="3000" value={form.originalYear} onChange={set('originalYear')} placeholder={t("Örn. 1947")} />
          </label>
          <label className="field">
            <span>{t("Baskı dili")}</span>
            <input maxLength="80" value={form.language} onChange={set('language')} placeholder={t("Türkçe")} />
          </label>
          <label className="field">
            <span>{t("Yayınevi")}</span>
            <input maxLength="160" value={form.publisher} onChange={set('publisher')} placeholder={t("Yayınevi")} />
          </label>
          <label className="field">
            <span>{t("ISBN")}</span>
            <input maxLength="32" value={form.isbn} onChange={set('isbn')} placeholder={t("Baskı numarası")} />
          </label>
          <label className="field">
            <span>{t("Çevirmen")}</span>
            <input maxLength="160" value={form.translator} onChange={set('translator')} placeholder={t("Varsa çevirmen")} />
          </label>
          <label className="field">
            <span>{t("Sayfa sayısı")}</span>
            <input type="number" min="1" max="100000" value={form.pageCount} onChange={set('pageCount')} placeholder="—" />
          </label>
          <fieldset className="compass-fields field--wide"><legend>{t("Yazarın Pusulası")} <small>{t("İsteğe bağlı")}</small></legend><p>{t("Bir şehir ara, sonuçlardan doğru yeri seç. Koordinatları senin için ekleyelim.")}</p>
            <div className="place-search"><label className="field"><span>{t("Şehir veya yer")}</span><input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchPlaces() } }} placeholder={t("Örn. İstanbul, Türkiye")} /></label><button className="quiet-button" type="button" onClick={searchPlaces} disabled={placesBusy}>{placesBusy ? t("Yer aranıyor…") : t("Yer ara")}</button></div>
            {placesError && <p className="place-search__message" role="status">{t(placesError)}</p>}
            {places.length > 0 && <div className="place-search__results" aria-label={t("Bulunan yerler")}>{places.map((place) => <button type="button" key={place.id} onClick={() => choosePlace(place)}><strong>{place.label}</strong><span>{place.displayName}</span></button>)}</div>}
            <p className="place-search__attribution">{t("Arama terimi OpenStreetMap’e gönderilir. Sonuç verisi ©")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t("OpenStreetMap katkıcıları")}</a>.</p>
            <label className="field compass-fields__kind"><span>{t("Bu yer yazarın…")}</span><select value={form.locationKind} onChange={set('locationKind')}><option value="birthplace">{t("doğum yeri")}</option><option value="associated">{t("ilişkili olduğu yer")}</option></select></label>
            {form.latitude !== '' && form.longitude !== '' && <p className="place-search__selected">{t("✦ Seçildi:")} {form.locationLabel} · {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}</p>}
            <details className="compass-fields__manual"><summary>{t("Koordinatları elle girmek")}</summary><div>
              <label className="field"><span>{t("Enlem")}</span><input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={set('latitude')} placeholder="41.0082" /></label>
              <label className="field"><span>{t("Boylam")}</span><input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={set('longitude')} placeholder="28.9784" /></label>
              <label className="field"><span>{t("Yer adı")}</span><input maxLength="120" value={form.locationLabel} onChange={set('locationLabel')} placeholder={t("İstanbul")} /></label>
            </div></details>
          </fieldset>
          {form.status === 'read' && <div className="book-reflection-fields" key="read-reflections">
            <fieldset className="field field--wide resonance-picker"><legend>{t("Etki derinliği")} <small>{t("İsteğe bağlı · birden çok seçilebilir")}</small></legend><div>{resonanceOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={form.resonanceTags.includes(key)} onChange={(event) => setForm((current) => ({ ...current, resonanceTags: event.target.checked ? [...current.resonanceTags, key] : current.resonanceTags.filter((tag) => tag !== key) }))} />{t(label)}</label>)}</div></fieldset>
            <label className="field field--wide">
              <span>{t("Kitap açıklaması")} <small>{t("İsteğe bağlı")}</small></span>
              <textarea rows="2" maxLength="2000" value={form.description} onChange={set('description')} placeholder={t("Eser hakkında kısa bilgi")} />
            </label>
            <label className="field field--wide">
              <span>{t("Kişisel düşüncen")} <small>{t("İsteğe bağlı")}</small></span>
              <textarea rows="3" maxLength="5000" value={form.review} onChange={set('review')} placeholder={t("Bu eser sende ne bıraktı?")} />
            </label>
          </div>}
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <footer className="book-form__actions">
            <button className="quiet-button" type="button" onClick={onClose}>{t("Vazgeç")}</button>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? t("Kaydediliyor…") : form.latitude !== '' && form.longitude !== '' && (!initialValue || Number(initialValue.latitude) !== Number(form.latitude) || Number(initialValue.longitude) !== Number(form.longitude)) ? t("Kaydet ve Atlas’ta göster ↗") : initialValue ? t("Değişiklikleri kaydet") : t("Kitaplığa ekle")}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function LibraryApp() {
  const language = useLanguage()
  const [items, setItems] = useState([])
  const [libraryPanel, setLibraryPanel] = useState(() => new URLSearchParams(window.location.search).get('view') === 'timeline' ? 'timeline' : 'books')
  const [activeCollection, setActiveCollection] = useState('')
  const [extrasRevision, setExtrasRevision] = useState(0)
  const [openedBook, setOpenedBook] = useState(null)
  const [orbit, setOrbit] = useState(null)
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [orbitBirth, setOrbitBirth] = useState(null)
  const [counts, setCounts] = useState({ all: 0, to_read: 0, reading: 0, read: 0, paused: 0, discover: 0, working: 0, atlas: 0 })
  const [insights, setInsights] = useState({ notesThisMonth: 0, crossBookLinks: 0, topTheme: null })
  const [activeFilter, setActiveFilter] = useState('overview')
  const [activeShelf, setActiveShelf] = useState('all')
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('chronologos:library-view') === 'shelf' ? 'shelf' : 'covers' }
    catch { return 'covers' }
  })
  useEffect(() => {
    try { localStorage.setItem('chronologos:library-view', viewMode) } catch { /* Storage can be unavailable in private sessions. */ }
    setBookPreview(null)
  }, [viewMode])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formEditing, setFormEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [bookPreview, setBookPreview] = useState(null)
  const [goodreadsPreview, setGoodreadsPreview] = useState(null)
  const [goodreadsBusy, setGoodreadsBusy] = useState(false)
  const importFileRef = useRef(null)
  const importButtonRef = useRef(null)
  const goodreadsDialogRef = useRef(null)
  const goodreadsBusyRef = useRef(false)
  goodreadsBusyRef.current = goodreadsBusy
  const [bookcaseWidth, setBookcaseWidth] = useState(0)
  const bookcaseRef = useRef(null)
  const requestSequence = useRef(0)
  const initialRouteBook = useRef(new URLSearchParams(window.location.search).get('book'))
  const closeCatalogFiche = useCallback(() => setSelectedBookId(null), [])
  const previewOpen = Boolean(goodreadsPreview)
  useEffect(() => {
    if (!previewOpen) return undefined
    const dialog = goodreadsDialogRef.current
    const focusable = () => [...dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
    focusable()[0]?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!goodreadsBusyRef.current) setGoodreadsPreview(null)
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) { event.preventDefault(); dialog.focus(); return }
      const first = elements[0], last = elements.at(-1)
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); importButtonRef.current?.focus() }
  }, [previewOpen])
  const showBookPreview = useCallback((item, element) => {
    const rect = element.getBoundingClientRect()
    const previewWidth = 198
    const previewHeight = 300
    const left = rect.right + previewWidth + 18 <= window.innerWidth
      ? rect.right + 14
      : Math.max(12, rect.left - previewWidth - 14)
    const top = Math.max(12, Math.min(rect.top - 54, window.innerHeight - previewHeight - 12))
    setBookPreview({ item, left, top })
  }, [])

  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (activeFilter !== 'all' && activeFilter !== 'overview') query.set('status', activeFilter)
    if (activeShelf !== 'all') query.set('shelf', activeShelf)
    if (search.trim()) query.set('q', search.trim())
    if (activeCollection) query.set('collection', activeCollection)
    return query.toString()
  }, [activeFilter, activeShelf, search, activeCollection])
  const paramsRef = useRef(params)
  paramsRef.current = params

  async function refresh(signal, query = paramsRef.current) {
    const sequence = ++requestSequence.current
    setLoading(true)
    setLoadError('')
    try {
      const [result, orbitResult] = await Promise.all([
        request(`/api/library${query ? `?${query}` : ''}`, { signal }),
        request(`/api/library/orbit?year=${orbitYear}`, { signal }).catch(() => null),
      ])
      if (sequence !== requestSequence.current) return
      setItems(result.items)
      setExtrasRevision(value => value + 1)
      setCounts(result.counts)
      if (orbitResult) setOrbit(orbitResult)
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
    const bookId = initialRouteBook.current
    if (!bookId || loading) return
    initialRouteBook.current = null
    if (items.some((item) => item.id === bookId)) setSelectedBookId(bookId)
    const url = new URL(window.location.href)
    url.searchParams.delete('book')
    window.history.replaceState({}, '', url)
  }, [items, loading])

  useEffect(() => {
    const element = bookcaseRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setBookcaseWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [items.length > 0, activeFilter, activeShelf, search, viewMode, loading])

  const sortedItems = useMemo(() => [...items].sort((a, b) =>
    (a.author || '').localeCompare(b.author || '', getLocale()) || a.title.localeCompare(b.title, getLocale())),
  [items, language])
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / 24))
  const visibleItems = useMemo(() => sortedItems.slice((page - 1) * 24, page * 24), [sortedItems, page])
  const showOverview = activeFilter === 'overview' && !search.trim() && activeShelf === 'all' && !activeCollection

  useEffect(() => setPage(1), [activeFilter, activeShelf, search])
  useEffect(() => setBookPreview(null), [activeFilter, activeShelf, search, page])

  const shelfRows = useMemo(() => {
    if (!visibleItems.length) return []
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
    const capacity = Math.max(220, (bookcaseWidth || 760) - (mobile ? -120 : 42))
    const rows = []
    let row = []; let used = 0
    for (const item of visibleItems) {
      const width = spineMetrics(item).width + 8
      if (row.length && used + width > capacity) { rows.push(row); row = []; used = 0 }
      row.push(item); used += width
    }
    if (row.length) rows.push(row)
    return rows
  }, [visibleItems, bookcaseWidth])

  const selectedBook = items.find((item) => item.id === selectedBookId) || (openedBook?.id === selectedBookId ? openedBook : null)

  async function saveBook(payload, entryId, showInAtlas = false) {
    setSaving(true)
    setFormError('')
    try {
      const saved = await request(entryId ? `/api/library/${encodeURIComponent(entryId)}` : '/api/library', {
        method: entryId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setFormOpen(false)
      setFormEditing(null)
      setNotice(entryId ? 'Kitap kaydı güncellendi.' : 'Kitap kitaplığına eklendi.')
      await refresh()
      if (showInAtlas && saved.latitude !== null && saved.longitude !== null && setAuthorCompassDestination(saved)) navigateThroughPortal('/atlas')
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateEntry(item, patch) {
    try {
      const updated = await request(`/api/library/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setOpenedBook(updated)
      setNotice('Okuma kaydın güncellendi.')
      if (patch.status === 'read' && item.status !== 'read') {
        setActiveFilter('overview'); setActiveShelf('all'); setActiveCollection(''); setSearch(''); setSelectedBookId(null)
        await refresh(undefined, '')
        if (updated.completedAt?.startsWith(String(orbitYear))) {
          const key = Date.now()
          setOrbitBirth({ bookId: updated.id, key })
          window.setTimeout(() => setOrbitBirth((current) => current?.key === key ? null : current), 3200)
        }
      } else await refresh()
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function saveGoal(event) {
    event.preventDefault()
    setGoalSaving(true); setGoalError('')
    try {
      const result = await request(`/api/library/orbit?year=${orbitYear}`, { method: 'PUT', body: JSON.stringify({ target: Number(goalDraft) }) })
      setOrbit(result); setGoalEditing(false)
    } catch (error) { setGoalError(error.message) }
    finally { setGoalSaving(false) }
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

  async function previewGoodreadsFile(file) {
    if (!file) return
    setGoodreadsBusy(true)
    try {
      const text = await file.text()
      const stats = await request('/api/library/import/goodreads/preview', {
        method: 'POST', body: text, headers: { 'content-type': 'text/csv' },
      })
      setGoodreadsPreview({ name: file.name, text, stats })
    } catch (error) {
      setNotice(error.message)
    } finally {
      setGoodreadsBusy(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  async function importGoodreads() {
    if (!goodreadsPreview) return
    setGoodreadsBusy(true)
    try {
      const result = await request('/api/library/import/goodreads', {
        method: 'POST', body: goodreadsPreview.text, headers: { 'content-type': 'text/csv' },
      })
      setNotice({ key: '{count} kitap eklendi{matched}{skipped}{invalid}.', params: {
        count: result.imported,
        matched: result.matched ? { key: ', {count} mevcut kayıtla eşleşti', params: { count: result.matched } } : '',
        skipped: result.skipped ? { key: ', {count} zaten aktarılmıştı', params: { count: result.skipped } } : '',
        invalid: result.invalid ? { key: ', {count} satır atlandı', params: { count: result.invalid } } : '',
      } })
      await refresh()
      setGoodreadsPreview(null)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setGoodreadsBusy(false)
    }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <main className="library-app library-app--books">
      <ArchiveNavigation active="library" count={counts.all} />

      <section className="library-main">
        <header className="library-topbar">
          <div className="breadcrumb"><span>{t("KİŞİSEL ARŞİV")}</span><span className="breadcrumb__slash">/</span><strong>{t("KİTAPLIĞIM")}</strong></div>
          <a className="atlas-open" href="/atlas" onClick={handleArchiveLink}><span>✧</span> {t("Atlas’a dön")} <b>↗</b></a>
        </header>

        <div className="library-content">
          <section className="library-heading">
            <div>
              <span className="eyebrow">{t("OKUMA KAYITLARIN")}</span>
              <h1>{t("Kitaplığım")}<span>.</span></h1>
              <p>{t("Okudukların burada birikir. Onlardan doğan düşünceler, atlasında yeni yollar açar.")}</p>
            </div>
            <div className="library-heading__actions">
              <input ref={importFileRef} className="sr-only" type="file" accept=".csv,text/csv" aria-label={t("Goodreads CSV dosyası seç")} onChange={(event) => previewGoodreadsFile(event.target.files?.[0])} />
              <button ref={importButtonRef} className="quiet-button import-goodreads" type="button" disabled={goodreadsBusy} onClick={() => importFileRef.current?.click()}>{goodreadsBusy ? t("CSV okunuyor…") : t("Goodreads CSV aktar")}</button>
              <button className="primary-button add-book-button" onClick={() => { setFormError(''); setFormEditing(null); setFormOpen(true) }}>
                <span>＋</span> {t("Yeni kitap ekle")} </button>
            </div>
          </section>

          <nav className="library-panel-switch" aria-label={t("Kitaplık bölümleri")}>
            <button type="button" aria-pressed={libraryPanel === 'books'} onClick={() => setLibraryPanel('books')}>{t("Kitaplığım")}</button>
            <button type="button" aria-pressed={libraryPanel === 'timeline'} onClick={() => setLibraryPanel('timeline')}><span aria-hidden="true">✦</span> {t("Yıldız Yolu")}</button>
          </nav>
          {libraryPanel === 'timeline' ? <Suspense fallback={<div className="library-loading">{t("Yıldız yolu açılıyor…")}</div>}><ReadingTimeline revision={extrasRevision} Cover={BookCover} onRefresh={() => refresh()} onBookOpen={async id => { try { const book = await request('/api/library/' + encodeURIComponent(id)); setOpenedBook(book); setSelectedBookId(id) } catch (error) { setNotice(error.message) } }} /></Suspense> : <>
          <section className="library-stats library-stats--synthesis" aria-label={t("Sentez özeti")}>
            <div className="stat-card"><span>{t("BU AYIN YILDIZLARI")}</span><strong>{insights.notesThisMonth}</strong><i>{t("yeni düşünce kaydı", { count: insights.notesThisMonth })}</i></div>
            <div className="stat-card"><span>{t("KİTAPLAR ARASI BAĞLAR")}</span><strong>{insights.crossBookLinks}</strong><i>{t("notların kurduğu köprüler")}</i></div>
            <div className="stat-card"><span>{t("EN ÇOK İZ BIRAKAN TEMA")}</span><strong className="stat-theme">{insights.topTheme ? t(insights.topTheme) : "—"}</strong><i>{t("notlarına göre")}</i></div>
          </section>

          <LibraryExtras Cover={BookCover} revision={extrasRevision} activeCollection={activeCollection} onCollection={id => { setActiveCollection(id); setPage(1); setBookPreview(null) }} onRefresh={() => refresh()} onOpen={book => { setOpenedBook(book); setSelectedBookId(book.id) }} />

          {showOverview && <ReadingOrbit orbit={orbit} editing={goalEditing} draft={goalDraft} onEdit={() => { setGoalDraft(orbit?.target ?? ''); setGoalEditing(true); setGoalError('') }} onDraft={setGoalDraft} onSave={saveGoal} saving={goalSaving} error={goalError} birth={orbitBirth} catalogItems={items} readingBooks={items.filter((item) => item.status === 'reading')} onBookOpen={setSelectedBookId} />}

          <section className="collection-section">
            <div className="collection-heading">
              <div>
                {showOverview ? <span className="eyebrow">{t("KOLEKSİYON")}</span> : <button className="cabinet-back" type="button" onClick={() => { setSearch(''); setActiveShelf('all'); setActiveCollection(''); setActiveFilter('overview') }}>{t("← Kitaplıklara dön")}</button>}
                <h2>{viewMode === 'covers' ? t("Kitaplığım") : t("Rafların")}</h2>
              </div>
              <div className="collection-tools">
                <div className="library-view-switch" role="group" aria-label={t("Kitaplık görünümü")}>
                  <button type="button" aria-pressed={viewMode === 'shelf'} onClick={() => setViewMode('shelf')}><span aria-hidden="true">▥</span> {t("Raf")}</button>
                  <button type="button" aria-pressed={viewMode === 'covers'} onClick={() => setViewMode('covers')}><span aria-hidden="true">▦</span> {t("Kapaklar")}</button>
                </div>
              <label className="library-search">
                <span aria-hidden="true">⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Kitap veya yazar ara")} aria-label={t("Kitap veya yazar ara")} />
              </label>
              </div>
            </div>

            <div className="filter-row" role="tablist" aria-label={t("Okuma durumuna göre filtrele")}>
              {filters.map((filter) => (
                <button
                  className={`filter-chip${activeFilter === filter.id ? ' filter-chip--active' : ''}`}
                  key={filter.id}
                  onClick={() => { setActiveFilter(filter.id); if (filter.id === 'all' || filter.id === 'overview') setActiveShelf('all') }}
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                >
                  {t(filter.label)}{filter.id !== 'overview' && <span>{counts[filter.id]}</span>}
                </button>
              ))}
            </div>

            {!showOverview && <div className="filter-row filter-row--thinking" role="tablist" aria-label={t("Atlas bağına göre filtrele")}>
              <span className="filter-row__caption">{t("ATLAS BAĞI")}</span>
              {[['discover', t("Yıldızsız kitaplar"), counts.discover], ['working', 'Okurken notlananlar', counts.working], ['atlas', 'Atlas izi olanlar', counts.atlas]].map(([id, label, count]) => <button key={id} className={`filter-chip${activeShelf === id ? ' filter-chip--active' : ''}`} onClick={() => setActiveShelf((current) => current === id ? 'all' : id)} role="tab" aria-selected={activeShelf === id}>{label}<span>{count}</span></button>)}
              {activeShelf === 'all' && <span className="filter-row__hint">{t("Hepsi")}</span>}
            </div>}

            {loadError ? (
              <div className="library-message library-message--error" role="alert">
                <span>{t("Arşive ulaşılamadı")}</span><p>{t(loadError)} {t("API sunucusunun çalıştığını kontrol et.")}</p>
                <button className="quiet-button" onClick={() => refresh()}>{t("Yeniden dene")}</button>
              </div>
            ) : loading ? (
              <div className="library-loading" aria-live="polite"><span className="loading-orbit" /> {t("Arşiv açılıyor…")}</div>
            ) : items.length ? (
              <>
              <div className="bookcase-summary"><span>{activeFilter === 'overview' ? (search.trim() ? t("Arama sonuçları") : t("Tüm kitaplar")) : t(filters.find((filter) => filter.id === activeFilter)?.label)} · {sortedItems.length} {t("kitap", { count: sortedItems.length })}</span><span>{t("Yazara göre A–Z · Sayfa")} {page}/{pageCount}</span></div>
              {viewMode === 'covers' ? <div className="cover-gallery" role="list" aria-label={t("Kitap kapakları")}>
                {visibleItems.map((item) => <div role="listitem" key={item.id}>
                  <button type="button" className="cover-gallery__book" onClick={() => setSelectedBookId(item.id)} aria-label={t("{value0}, {value1} — kitap detayları", { value0: item.title, value1: item.author || t('Yazar belirtilmemiş') })}>
                    <div className="cover-gallery__art"><BookCover item={item} allowRemote /></div>
                    <span className={`cover-gallery__status cover-gallery__status--${item.status}`}>{t(statusLabels[item.status] || 'Kitaplığımda')}</span>
                    <strong className="cover-gallery__title">{item.title}</strong>
                    <span className="cover-gallery__author">{item.author || t("Yazar belirtilmemiş")}</span>
                    <span className="cover-gallery__detail">{Number(item.noteCount) > 0 ? t("{value0} düşünce notu", { value0: item.noteCount }) : t("Kitabı keşfet")} <span aria-hidden="true">↗</span></span>
                  </button>
                </div>)}
              </div> : <div className="bookcase" ref={bookcaseRef} aria-label={t("Ahşap kitap rafları")} onScroll={() => setBookPreview(null)}>
                {shelfRows.map((row, rowIndex) => <div className="bookcase-row" key={`shelf-${rowIndex}`}>
                  <div className="bookcase-books" role="list" aria-label={t("{value0}. raf", { value0: rowIndex + 1 })}>
                    {row.map((item) => <div className="bookcase-book" role="listitem" key={item.id}>
                      <BookSpine item={item} onOpen={() => { setBookPreview(null); setSelectedBookId(item.id) }} onPreview={showBookPreview} onPreviewClose={() => setBookPreview(null)} />
                    </div>)}
                  </div>
                  <div className="bookcase-plank" aria-hidden="true"><span /></div>
                </div>)}
              </div>
              }
              {pageCount > 1 && <nav className="bookcase-pagination" aria-label={t("Kitap rafı sayfaları")}><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>{t("← Önceki raf")}</button><span>{(page - 1) * 24 + 1}–{Math.min(page * 24, sortedItems.length)} / {sortedItems.length}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>{t("Sonraki raf →")}</button></nav>}
              </>
            ) : (
              <div className="library-empty">
                <div className="library-empty__seal">✧</div>
                <span className="eyebrow">{t("YENİ BİR SAYFA")}</span>
                <h3>{search || activeFilter !== 'all' || activeShelf !== 'all' ? t("Bu rafta eser bulunamadı.") : t("Kitaplığın ilk kitabını bekliyor.")}</h3>
                <p>{search || activeFilter !== 'all' || activeShelf !== 'all' ? t("Arama sözcüğünü ya da seçili filtreyi değiştirebilirsin.") : t("Bir kitap ekle; okuma yolculuğun ve düşünce atlasın birlikte büyüsün.")}</p>
                {!search && activeFilter === 'all' && <button className="primary-button" onClick={() => { setFormEditing(null); setFormOpen(true) }}>{t("İlk kitabını ekle")} <span>↗</span></button>}
              </div>
            )}
          </section>
          </>}
          <footer className="library-footer"><span>{t("CHRONOLOGOS")}</span><span>{t("OKUMAKTAN DÜŞÜNCEYE")}</span><span>✦</span></footer>
        </div>
      </section>

      {selectedBook && <CatalogFiche item={selectedBook} onClose={closeCatalogFiche} onEdit={(item) => { setSelectedBookId(null); setFormError(''); setFormEditing(item); setFormOpen(true) }} onRemove={removeEntry} onStatusChange={updateEntry} />}
      <BookPreview preview={bookPreview} />
      {formOpen && <BookForm key={formEditing?.id || 'new-book'} initialValue={formEditing} onClose={() => { setFormOpen(false); setFormEditing(null) }} onSave={saveBook} saving={saving} error={formError} />}
      {goodreadsPreview && <div className="catalog-fiche-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !goodreadsBusy && setGoodreadsPreview(null)}>
        <section ref={goodreadsDialogRef} tabIndex={-1} className="library-dialog goodreads-preview" role="dialog" aria-modal="true" aria-labelledby="goodreads-preview-title">
          <header className="library-dialog__header"><div><span className="eyebrow">{t("DIŞA AKTARIMI İÇE AL")}</span><h2 id="goodreads-preview-title">{t("Goodreads kitaplığın")}</h2></div><button className="icon-button" type="button" disabled={goodreadsBusy} onClick={() => setGoodreadsPreview(null)} aria-label={t("Önizlemeyi kapat")}>×</button></header>
          <p><strong>{goodreadsPreview.name}</strong> {t("dosyasında")} {goodreadsPreview.stats.total} {t("kayıt bulundu.")}</p>
          <div className="goodreads-preview__stats"><span><b>{goodreadsPreview.stats.shelves.read}</b> {t("okundu")}</span><span><b>{goodreadsPreview.stats.shelves['to-read']}</b> {t("okunacak")}</span><span><b>{goodreadsPreview.stats.shelves['currently-reading']}</b> {t("okunuyor")}</span></div>
          <p className="catalog-privacy">{t("Puanı olmayan kayıtlar boş kalır. Yorum ve özel notlar yalnızca CSV’de varsa alınır; mevcut kitap notların korunur. Tekrar içe aktarılan Goodreads kimlikleri atlanır.")}</p>
          <div className="library-dialog__actions"><button className="quiet-button" type="button" disabled={goodreadsBusy} onClick={() => setGoodreadsPreview(null)}>{t("Vazgeç")}</button><button className="primary-button" type="button" disabled={goodreadsBusy} onClick={importGoodreads}>{goodreadsBusy ? t("Kitaplar aktarılıyor…") : t("Kitapları içe aktar")}</button></div>
        </section>
      </div>}
      {notice && <div className="library-toast" role="status">{t(notice)}</div>}
    </main>
  )
}
