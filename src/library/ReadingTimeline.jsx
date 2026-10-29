import { getLocale, t, useLanguage } from '../i18n/index.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigateThroughPortal } from '../navigation/portalTransition.js'
import './reading-timeline.css'

const currentYear = String(new Date().getFullYear())
const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const seasons = ['Kış', 'Kış', 'İlkbahar', 'İlkbahar', 'İlkbahar', 'Yaz', 'Yaz', 'Yaz', 'Sonbahar', 'Sonbahar', 'Sonbahar', 'Kış']
const kindLabels = { book: 'KİTAP BİTİŞİ', thought: 'DÜŞÜNCE', quote: 'ALINTI' }
const dateLabel = value => value ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : t('Tarih bilinmiyor')

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json' } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Zaman çizelgesi açılamadı.')
  return result
}

function Star({ kind, reread }) {
  return <span className={`timeline-star timeline-star--${kind}${reread ? ' timeline-star--echo' : ''}`} aria-hidden="true">{kind === 'book' ? "✦" : kind === 'quote' ? '◇' : '•'}</span>
}

function StarPath({ items, selected, onSelect }) {
  const container = useRef(null)
  const [paths, setPaths] = useState({ road: '', bridges: [] })
  const focused = selected?.bookId
  const connected = items.filter(e => focused && e.bookId === focused)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const draw = () => {
      const rect = element.getBoundingClientRect()
      const points = [...element.querySelectorAll('[data-event-marker]')].map(mark => {
        const r = mark.getBoundingClientRect()
        return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top, id: mark.dataset.eventMarker, bookId: mark.dataset.book || null }
      })
      let road = points.length ? `M ${points[0].x} ${points[0].y}` : ''
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dy = (b.y - a.y) / 3
        road += ` C ${a.x + 15} ${a.y + dy}, ${b.x - 15} ${b.y - dy}, ${b.x} ${b.y}`
      }
      const related = focused ? points.filter(p => p.bookId === focused) : []
      const bridges = related.slice(1).map((b, i) => {
        const a = related[i], curve = Math.max(28, Math.min(64, (b.y - a.y) / 4))
        return `M ${a.x} ${a.y} C ${a.x - curve} ${a.y}, ${b.x - curve} ${b.y}, ${b.x} ${b.y}`
      })
      setPaths({ road, bridges })
    }
    const observer = new ResizeObserver(draw); observer.observe(element)
    draw()
    return () => observer.disconnect()
  }, [items, focused])
  let lastMonth = ''
  return <div className="timeline-path" ref={container}>
    <svg className="timeline-threads" width="100%" height="100%" aria-hidden="true"><path className="timeline-road" d={paths.road} />{paths.bridges.map((d, i) => <path key={i} className="timeline-bridge" d={d} />)}</svg>
    {items.map(event => {
      const month = event.date.slice(0, 7), first = month !== lastMonth; lastMonth = month
      const monthIndex = Number(event.date.slice(5, 7)) - 1
      const related = focused && event.bookId === focused
      return <div key={event.id} className="timeline-stop">
        {first && <h3 className="timeline-month"><span>{t(monthNames[monthIndex])} <small>{event.date.slice(0, 4)}</small></span><i>{t(seasons[monthIndex])}</i></h3>}
        <button type="button" className={`timeline-event${related ? ' timeline-event--related' : ''}${focused && connected.length > 1 && !related ? ' timeline-event--quiet' : ''}`} aria-pressed={selected?.id === event.id} onClick={() => onSelect(event)}>
          <time dateTime={event.date}><strong>{Number(event.date.slice(8, 10))}</strong><span>{t(monthNames[monthIndex]).toLocaleLowerCase(getLocale())}</span></time>
          <span className="timeline-marker" data-event-marker={event.id} data-book={event.bookId || ''}><Star kind={event.kind} reread={event.kind === 'book' && event.sequence > 1} /></span>
          <span className="timeline-event-copy"><span className="timeline-event-kind">{t(kindLabels[event.kind])}{event.isDemo && t(" · {value0}", { value0: t('ÖRNEK') })}</span><strong>{event.title}</strong><small>{event.kind === 'book' ? event.author || t('Yazar belirtilmemiş') : event.bookTitle || t('Bağımsız düşünce')}{event.kind === 'book' && event.sequence > 1 ? t(" · {value0}. {value1}", { value0: event.sequence, value1: t('okuma') }) : ""}</small>{event.kind !== 'book' && event.themes.length > 0 && <span className="timeline-event-themes">{event.themes.map(name => t(name)).join(' · ')}</span>}</span>
        </button>
      </div>
    })}
  </div>
}

function TimelineFiche({ event, Cover, onBookOpen, onChanged, revision }) {
  const [book, setBook] = useState(null)
  const [note, setNote] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingDate, setEditingDate] = useState(false)
  const [date, setDate] = useState(event?.date || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!event) return
    const controller = new AbortController()
    setBook(null); setNote(null); setHistory([]); setError(''); setLoading(true); setEditingDate(false); setDate(event.date || '')
    Promise.all([
      event.bookId ? request(`/api/library/${encodeURIComponent(event.bookId)}`, { signal: controller.signal }) : null,
      event.noteId ? request(`/api/notes/${encodeURIComponent(event.noteId)}`, { signal: controller.signal }) : null,
      event.bookId ? request(`/api/library/${encodeURIComponent(event.bookId)}/history`, { signal: controller.signal }) : null,
    ]).then(([b, n, h]) => { if (!controller.signal.aborted) { setBook(b); setNote(n); setHistory(h?.items || []) } }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [event?.id, event?.date, event?.updatedAt, revision])
  if (!event) return <aside className="timeline-fiche timeline-fiche--empty"><span aria-hidden="true">✧</span><h3>{t("Bir izin hikâyesi")}</h3><p>{t("Yoldaki bir yıldızı seç. Kitabı, düşüncesi ve okuma geçmişi burada açılır.")}</p></aside>
  async function changeDate(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request(`/api/library/history/${encodeURIComponent(event.sessionId)}`, { method: 'PATCH', body: JSON.stringify({ completedAt: date || null }) })
      await onChanged({ completedAt: date || null }); setEditingDate(false)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  async function reread() {
    setBusy(true); setError('')
    try { await request(`/api/library/${encodeURIComponent(event.bookId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'reading' }) }); await onChanged() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const completed = history.filter(h => h.isCompleted)
  return <aside className="timeline-fiche" aria-label={t("Seçilen kaydın ayrıntıları")}>
    <div className="timeline-fiche-corner" aria-hidden="true">✦</div>
    <header><span className="timeline-fiche-kind">{t(kindLabels[event.kind])}{event.isDemo && t(" · {value0}", { value0: t('ÖRNEK KAYIT') })}</span><p>{dateLabel(event.date)}</p><h3>{event.title}</h3></header>
    {loading && <p role="status">{t("Kaydın hikâyesi açılıyor…")}</p>}
    {error && <p role="alert" className="timeline-fiche-error">{t(error)}</p>}
    {book && <div className="timeline-source"><div className="timeline-source-cover"><Cover item={book} allowRemote /></div><div><span>{t("KAYNAK ESER")}</span><strong>{book.title}</strong><p>{book.author}</p>{note?.sourceLocator && <small>{note.sourceLocator}</small>}</div></div>}
    {note && <><div className={`timeline-voice${note.kind === 'quote' ? ' timeline-voice--quote' : ''}`}><span>{note.kind === 'quote' ? t("ALINTI") : t("BENİM DÜŞÜNCEM")}</span><p>{note.content}</p></div>{note.commentary && <div className="timeline-voice"><span>{t("KİŞİSEL YORUM")}</span><p>{note.commentary}</p></div>}{note.themeNames && <p className="timeline-fiche-themes">{note.themeNames}</p>}</>}
    {book && event.kind === 'book' && <><p className="timeline-completion-copy">{event.sequence > 1 ? t("Aynı kitap, başka bir zamandaki sen.") : t("Bir okuma tamamlandı; bıraktığı düşünceler yoluna devam ediyor.")}</p>{book.review && <div className="timeline-voice"><span>{t("KİTABA DAİR BUGÜNKÜ DEĞERLENDİRMEN")}</span><p>{book.review}</p></div>}</>}
    {completed.length > 0 && <section className="timeline-reading-history"><h4>{t("Bu kitabın okuma izleri")} <span>{completed.length}</span></h4><ol>{completed.map(h => <li key={h.id} className={h.id === event.sessionId ? 'is-current' : ''}><span aria-hidden="true">{h.id === event.sessionId ? "✦" : "◌"}</span><div><strong>{dateLabel(h.completedAt)}</strong>{h.startedAt && <small>{t("Başlangıç ·")} {dateLabel(h.startedAt)}</small>}</div></li>)}</ol>{history.some(h => !h.isCompleted) && book?.status === 'reading' && <p>{t("Yeni okuman devam ediyor. Önceki izlerin korunuyor.")}</p>}</section>}
    {event.kind === 'book' && <div className="timeline-date-edit">{editingDate ? <form onSubmit={changeDate}><label>{t("Bu okumanın bitiş tarihi")}<input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={busy} /></label><div><button type="submit" disabled={busy}>{busy ? t("Kaydediliyor…") : t("Tarihi kaydet")}</button><button type="button" disabled={busy} onClick={() => setEditingDate(false)}>{t("Vazgeç")}</button></div><small>{t("Boş tarih, bu kaydı Tarihsiz izler alanına taşır.")}</small></form> : <button type="button" onClick={() => setEditingDate(true)} disabled={busy}>{event.date ? t("Bitiş tarihini düzelt") : t("Bu okumaya tarih ekle")}</button>}</div>}
    <footer className="timeline-fiche-actions">{book && <button type="button" onClick={() => onBookOpen(book.id)}>{t("Kitap fişini aç ↗")}</button>}{event.noteId && <><a href={`/notes?note=${encodeURIComponent(event.noteId)}`}>{t("Notu aç ↗")}</a><a href={`/atlas?note=${encodeURIComponent(event.noteId)}`} onClick={e => { e.preventDefault(); navigateThroughPortal(e.currentTarget.getAttribute('href'), e.currentTarget) }}>{t("Atlas’ta göster ✧")}</a></>}{event.kind === 'book' && book?.status === 'read' && <button type="button" disabled={busy} onClick={reread}>{t("Yeniden okumaya başla")}</button>}</footer>
  </aside>
}

export default function ReadingTimeline({ revision, Cover, onBookOpen, onRefresh }) {
  useLanguage()
  const [year, setYear] = useState(() => { try { const saved = localStorage.getItem('chronologos:timeline-year'); return saved === 'all' || /^\d{4}$/.test(saved || '') ? saved : currentYear } catch { return currentYear } })
  const [data, setData] = useState(null)
  const [kind, setKind] = useState('all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [limit, setLimit] = useState(40)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [undatedOpen, setUndatedOpen] = useState(false)
  const [undatedLimit, setUndatedLimit] = useState(20)
  const selectionRef = useRef(null)
  useEffect(() => { try { localStorage.setItem('chronologos:timeline-year', year) } catch { /* Storage can be unavailable. */ } }, [year])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    request(`/api/library/timeline?year=${encodeURIComponent(year)}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result) }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [year, revision, reload])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setReload(value => value + 1) }
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    const interval = window.setInterval(refresh, 60000)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.clearInterval(interval) }
  }, [])
  useEffect(() => { setLimit(40); setUndatedLimit(20) }, [year, kind, start, end])
  const invalidRange = Boolean(start && end && start > end)
  const filtered = useMemo(() => (data?.items || []).filter(e => !invalidRange && (kind === 'all' || e.kind === kind) && (!start || e.date >= start) && (!end || e.date <= end)), [data, kind, start, end, invalidRange])
  const undated = useMemo(() => (data?.undated || []).filter(e => kind === 'all' || e.kind === kind), [data, kind])
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit])
  const selected = [...(data?.items || []), ...(data?.undated || [])].find(e => e.id === selectedId) || null
  useEffect(() => { if (selectedId && !filtered.some(e => e.id === selectedId) && !undated.some(e => e.id === selectedId)) setSelectedId(null) }, [filtered, undated, selectedId])
  const select = useCallback(event => { setSelectedId(current => current === event.id ? null : event.id); if (window.matchMedia('(max-width: 900px)').matches) window.setTimeout(() => selectionRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }), 0) }, [])
  async function changed(change) {
    if (change && Object.hasOwn(change, 'completedAt')) {
      if (change.completedAt) { setYear(change.completedAt.slice(0, 4)); setStart(''); setEnd('') }
      else setUndatedOpen(true)
    }
    setReload(value => value + 1); await onRefresh()
  }
  const summary = data?.summary
  const related = selected?.bookId ? (data?.items || []).filter(e => e.bookId === selected.bookId).length : 0
  const years = [...new Set([Number(year) || Number(currentYear), ...(data?.years || [Number(currentYear)])])].sort((a, b) => b - a)
  return <section className="reading-timeline" aria-labelledby="timeline-title">
    <header className="timeline-heading"><div><span className="eyebrow">{t("ZAMANIN BIRAKTIĞI İZLER")}</span><h2 id="timeline-title">{t("Okuma Yörüngesi")}<span>.</span></h2><p>{t("Kitapların bittiği, düşüncelerinin başladığı yer.")}</p></div><div className="timeline-year-seal" aria-hidden="true"><span>{year === 'all' ? t("ARŞİV") : year}</span><small>{t("OKUMAKTAN DÜŞÜNCEYE")}</small><i>✧</i></div></header>
    <div className="timeline-controls"><label>{t("Yolculuğun yılı")}<select value={year} onChange={e => { setYear(e.target.value); setStart(''); setEnd(''); setSelectedId(null) }}><option value="all">{t("Tüm yıllar")}</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label><label>{t("Kayıt türü")}<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">{t("Tüm izler")}</option><option value="book">{t("Kitap bitişleri")}</option><option value="thought">{t("Düşünceler")}</option><option value="quote">{t("Alıntılar")}</option></select></label><label>{t("Başlangıç")}<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>{t("Bitiş")}<input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} /></label>{(start || end || kind !== 'all') && <button type="button" className="quiet-button" onClick={() => { setKind('all'); setStart(''); setEnd('') }}>{t("Filtreleri temizle")}</button>}</div>
    {invalidRange && <p className="timeline-error" role="alert">{t("Başlangıç tarihi bitişten sonra olamaz.")}</p>}
    {error && <div className="timeline-error" role="alert"><p>{t(error)}</p><button className="quiet-button" onClick={() => setReload(value => value + 1)}>{t("Yeniden dene")}</button></div>}
    {loading && (!data || data.year !== year) ? <div className="library-loading" role="status"><span className="loading-orbit" /> {t("Zamanın izleri açılıyor…")}</div> : data && <>
      <section className="timeline-year-review" aria-label={t("{value0} özeti", { value0: year === 'all' ? t('Arşivin') : t('{value0} yılının', { value0: year }) })}><div className="timeline-review-title"><span>{year === 'all' ? t("ARŞİVİN ÖZETİ") : t("{year}’NIN İZLERİ", { year: year })}</span><small>{t("Seçilen yılın tamamı · örnek kayıtlar sayılmaz")}</small></div><div className="timeline-review-numbers"><div><strong>{summary.completions}</strong><span>{t("kitap bitişi", { count: summary.completions })}</span><small>{summary.uniqueBooks} {t("farklı eser", { count: summary.uniqueBooks })}{summary.rereads > 0 ? t(" · {value0} yeniden okuma", { value0: summary.rereads, count: summary.rereads }) : ""}</small></div><div><strong>{summary.thoughts}</strong><span>{t("düşünce", { count: summary.thoughts })}</span></div><div><strong>{summary.quotes}</strong><span>{t("alıntı", { count: summary.quotes })}</span></div><div><strong>{summary.activeMonths}</strong><span>{t("iz bıraktığın ay", { count: summary.activeMonths })}</span></div></div>{summary.themes.length > 0 && <p className="timeline-year-themes"><span>{t("Yılın düşünce izleri")}</span>{summary.themes.map((theme) => <span key={theme.name}>{t(theme.name)} <small>{theme.count} {t("not", { count: theme.count })}</small></span>)}</p>}</section>
      {year !== 'all' && <div className="timeline-month-rhythm" role="group" aria-label={t("Aylık okuma ve not izleri")}>{data.months.map(m => <button key={m.month} type="button" aria-pressed={start === `${year}-${String(m.month).padStart(2, '0')}-01` && Boolean(end)} aria-label={t("{value0}: {value1} kitap bitişi, {value2} not. Bu ayı göster.", { value0: t(monthNames[m.month - 1]), value1: m.books, value2: m.notes, count: m.books })} onClick={() => { const first = `${year}-${String(m.month).padStart(2, '0')}-01`; const last = new Date(Number(year), m.month, 0).getDate(); if (start === first) { setStart(''); setEnd('') } else { setStart(first); setEnd(`${year}-${String(m.month).padStart(2, '0')}-${last}`) } }}><span>{t(monthNames[m.month - 1]).slice(0, 3)}</span><div className="timeline-month-lights" aria-hidden="true"><i style={{ opacity: m.books ? 1 : 0.12 }}>✦</i><b style={{ opacity: m.notes ? 1 : 0.12 }}>•</b></div><small>{m.books + m.notes || "—"}</small></button>)}</div>}
      <div className="timeline-legend"><span><Star kind="book" /> {t("Kitap bitişi")}</span><span><Star kind="thought" /> {t("Düşünce")}</span><span><Star kind="quote" /> {t("Alıntı")}</span><span><Star kind="book" reread /> {t("Yeniden okuma")}</span><small>{filtered.length} {t("tarihli iz", { count: filtered.length })}{selected?.isDemo ? t(" · seçili kayıt örnek") : ""}</small></div>
      <div className="timeline-layout"><div className="timeline-journey"><div className="timeline-journey-caption"><span>{t("YILDIZ YOLU")}</span>{selected && <button className="quiet-button" onClick={() => setSelectedId(null)}>{t("Seçimi kaldır")}</button>}</div>{selected?.bookId && related > 1 && <p className="timeline-connection-caption">{t("Seçili eserin")} {related} {t("izi · ince bağlar ortak kaynak kitabı gösterir.")}</p>}{visible.length ? <><StarPath items={visible} selected={selected} onSelect={select} />{filtered.length > limit && <button type="button" className="quiet-button timeline-more" onClick={() => setLimit(value => value + 40)}>{t("Sonraki")} {Math.min(40, filtered.length - limit)} {t("izi göster")} <span>({visible.length}/{filtered.length})</span></button>}</> : <div className="timeline-empty"><span aria-hidden="true">✧</span><h3>{t("Bu dönemin göğü henüz sessiz.")}</h3><p>{start || end || kind !== 'all' ? t("Başka bir tarih aralığı veya kayıt türü seçebilirsin.") : t("Bu yıl için tarihli bir kitap bitişi ya da not bulunmuyor. Tarihi eksik okumaların aşağıda korunur.")}</p></div>}
        <section className="timeline-nebula"><button className="timeline-nebula-toggle" type="button" aria-expanded={undatedOpen} onClick={() => setUndatedOpen(value => !value)}><span aria-hidden="true">◌</span><span><strong>{t("Tarihsiz izler")}</strong><small>{t("Henüz zaman yoluna yerleşmemiş kayıtlar")}</small></span><b>{undated.length}</b><i aria-hidden="true">{undatedOpen ? "−" : "＋"}</i></button>{undatedOpen && <><p className="timeline-nebula-hint">{t("Bu kayıtlar yıl ve tarih filtrelerinin dışında tutulur. Bir okumanın bitiş tarihini eklediğinde yıldızı kendi yılına yerleşir.")}</p>{undated.slice(0, undatedLimit).map(e => <button className="timeline-undated-event" key={e.id} type="button" aria-pressed={selectedId === e.id} onClick={() => select(e)}><Star kind={e.kind} /><span><strong>{e.title}</strong><small>{t(kindLabels[e.kind])}{e.isDemo ? t(" · ÖRNEK") : ""} · {e.kind === 'book' ? t(e.author) : t(e.bookTitle || 'Bağımsız düşünce')}</small></span></button>)}{!undated.length && <p className="timeline-nebula-hint">{t("Bu türde tarihsiz kayıt yok.")}</p>}{undated.length > undatedLimit && <button className="quiet-button" onClick={() => setUndatedLimit(value => value + 20)}>{t("Diğer tarihsiz izleri göster")}</button>}</>}</section>
      </div><div className="timeline-detail-column" ref={selectionRef}><TimelineFiche event={selected} Cover={Cover} onBookOpen={onBookOpen} onChanged={changed} revision={revision} /></div></div>
    </>}
  </section>
}
