import { formatPercent, t } from '../i18n/index.js'
import { useEffect, useState } from 'react'
import { handleArchiveLink } from '../navigation/portalTransition.js'

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json' } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.')
  return data
}

function ContinueCard({ book, Cover, onOpen, onSaved }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pageMode = Boolean(book.pageCount)
  const percent = book.progressPercent ?? (pageMode ? Math.round((book.currentPage || 0) / book.pageCount * 100) : 0)
  useEffect(() => { setValue(String(pageMode ? book.currentPage ?? '' : book.progressPercent ?? '')) }, [book.currentPage, book.progressPercent, pageMode])
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const number = Number(value)
      if (!value.trim() || !Number.isInteger(number) || number < 0 || number > (pageMode ? book.pageCount : 100)) throw new Error('Geçerli bir ilerleme değeri gir.')
      await api(`/api/library/${encodeURIComponent(book.id)}`, { method: 'PATCH', body: JSON.stringify(pageMode ? { currentPage: number, progressPercent: Math.round(number / book.pageCount * 100) } : { progressPercent: number }) })
      await onSaved(); setMessage('İlerleme kaydedildi.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <article className="continue-card">
    <button type="button" className="continue-cover" onClick={() => onOpen(book)} aria-label={t("{value0} ayrıntılarını aç", { value0: book.title })}><Cover item={book} allowRemote /></button>
    <div className="continue-copy"><span className="eyebrow">{t("ŞU AN OKUYORUM")}</span><button className="continue-title" onClick={() => onOpen(book)}>{book.title}</button><p>{book.author}</p>
      <div className="continue-progress"><progress value={percent} max="100" aria-label={t("{value0} okuma ilerlemesi", { value0: book.title })} /><span>{formatPercent(percent)}</span></div>
      <form className="continue-form" onSubmit={save}><label>{pageMode ? t("Kaldığım sayfa / {value0}", { value0: book.pageCount }) : t("Okuma yüzdesi")}<input type="number" min="0" max={pageMode ? book.pageCount : 100} step="1" required value={value} onChange={e => setValue(e.target.value)} disabled={busy} /></label><button className="quiet-button" disabled={busy}>{busy ? t("Kaydediliyor…") : t("Kaydet")}</button></form>
      <a className="continue-thought" href={`/notes?book=${encodeURIComponent(book.id)}`} onClick={handleArchiveLink}>{t("＋ Bu kitaptan düşünce ekle")}</a>
      {message && <small role="status">{message}</small>}
    </div>
  </article>
}

export function LibraryExtras({ Cover, onOpen, onRefresh, activeCollection, onCollection, revision }) {
  const [books, setBooks] = useState([])
  const [collections, setCollections] = useState([])
  const [name, setName] = useState('')
  const [editing, setEditing] = useState('')
  const [rename, setRename] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  async function load(signal) {
    const [library, groups] = await Promise.all([api('/api/library', { signal }), api('/api/collections', { signal })])
    setBooks(library.items); setCollections(groups.items); setLoaded(true)
  }
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [revision])
  async function mutate(url, method, body, after) {
    setBusy(true); setError('')
    try { await api(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); await load(); await onRefresh(); after?.() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const selected = collections.find(c => c.id === editing)
  const reading = books.filter(b => b.status === 'reading')
  return <>
    <section className="continue-section" aria-labelledby="continue-title"><header className="extras-heading"><div><span className="eyebrow">{t("KALDIĞIN YERDEN")}</span><h2 id="continue-title">{t("Okumaya devam")} <small>{reading.length} {t("kitap", { count: reading.length })}</small></h2></div></header>
      {!loaded ? <p className="extras-muted">{t("Okuma kayıtları yükleniyor…")}</p> : reading.length ? <div className="continue-grid">{reading.map(book => <ContinueCard key={book.id} book={book} Cover={Cover} onOpen={onOpen} onSaved={async () => { await load(); await onRefresh() }} />)}</div> : <p className="extras-muted">{t("Şu an okuduğun bir kitap yok. Kitap ayrıntısından “Okuyorum” durumunu seçtiğinde burada görünür.")}</p>}
    </section>
    <section className="custom-collections" aria-labelledby="collections-title"><header className="extras-heading"><div><span className="eyebrow">{t("KENDİ RAFLARIN")}</span><h2 id="collections-title">{t("Koleksiyonlar")}</h2></div></header>
      <div className="collection-pills" role="group" aria-label={t("Koleksiyona göre filtrele")}><button type="button" aria-pressed={!activeCollection} onClick={() => onCollection('')}>{t("Tüm koleksiyonlar")}</button>{collections.map(c => <button key={c.id} type="button" aria-pressed={activeCollection === c.id} onClick={() => onCollection(activeCollection === c.id ? '' : c.id)}>{c.name}<span>{c.bookIds.length}</span></button>)}</div>
      <details className="collection-manager"><summary>{t("Koleksiyonları düzenle")}</summary><p className="extras-muted">{t("Bir kitap birden fazla koleksiyonda bulunabilir.")}</p>
        <form className="collection-create" onSubmit={e => { e.preventDefault(); mutate('/api/collections', 'POST', { name }, () => setName('')) }}><label className="field"><span>{t("Yeni koleksiyon")}</span><input required maxLength="80" placeholder={t("Örneğin: Tekrar okunacaklar")} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label><button className="primary-button" disabled={busy || !name.trim()}>{t("Oluştur")}</button></form>
        <label className="field"><span>{t("Düzenlenecek koleksiyon")}</span><select value={editing} disabled={busy} onChange={e => { setEditing(e.target.value); setRename(collections.find(c => c.id === e.target.value)?.name || ''); setDeleteConfirm(false); setSearch('') }}><option value="">{t("Koleksiyon seç")}</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {selected && <><form className="collection-create" onSubmit={e => { e.preventDefault(); mutate(`/api/collections/${encodeURIComponent(editing)}`, 'PATCH', { name: rename }) }}><label className="field"><span>{t("Koleksiyon adı")}</span><input required maxLength="80" value={rename} onChange={e => setRename(e.target.value)} disabled={busy} /></label><button className="quiet-button" disabled={busy || !rename.trim()}>{t("Adını kaydet")}</button></form>
          <label className="field"><span>{t("Koleksiyona kitap ekle / çıkar")}</span><input placeholder={t("Kitap veya yazar ara")} value={search} onChange={e => setSearch(e.target.value)} /></label><div className="collection-book-list">{books.filter(b => `${b.title} ${b.author}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map(b => <label key={b.id}><input type="checkbox" checked={selected.bookIds.includes(b.id)} disabled={busy} onChange={e => mutate(`/api/collections/${encodeURIComponent(editing)}/books/${encodeURIComponent(b.id)}`, e.target.checked ? 'PUT' : 'DELETE')} /><span>{b.title}<small>{b.author}</small></span></label>)}{!books.length && <p>{t("Önce kitaplığına bir kitap ekle.")}</p>}</div>
          {deleteConfirm ? <div className="collection-delete"><p>“{selected.name}{t("” koleksiyonu silinsin mi? Kitapların kitaplıkta kalacak.")}</p><button className="quiet-button" disabled={busy} onClick={() => mutate(`/api/collections/${encodeURIComponent(editing)}`, 'DELETE', null, () => { if (activeCollection === editing) onCollection(''); setEditing(''); setDeleteConfirm(false) })}>{t("Koleksiyonu sil")}</button><button className="quiet-button" disabled={busy} onClick={() => setDeleteConfirm(false)}>{t("Vazgeç")}</button></div> : <button className="quiet-button collection-delete" disabled={busy} onClick={() => setDeleteConfirm(true)}>{t("Koleksiyonu sil…")}</button>}
        </>}
      </details>
      {error && <p role="alert" className="library-message--error">{t(error)}</p>}
    </section>
  </>
}
