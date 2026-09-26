import { useEffect, useMemo, useState } from 'react'
import { navigateThroughPortal } from '../navigation/portalTransition.js'
import './library.css'

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'İstek tamamlanamadı.')
  return payload
}

const blank = { kind: 'thought', title: '', content: '', commentary: '', libraryEntryId: '', editionId: '', sourceLocator: '', themeIds: [] }
const relationLabels = { supports: 'destekler', challenges: 'sorgular', extends: 'genişletir', echoes: 'yankılar', contrasts: 'karşılaştırır' }

export function NotesApp() {
  const [notes, setNotes] = useState([])
  const [books, setBooks] = useState([])
  const [themes, setThemes] = useState([])
  const [links, setLinks] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [memoriesEnabled, setMemoriesEnabled] = useState(() => {
    try { return localStorage.getItem('chronologos:memories') !== 'off' } catch { return true }
  })
  const [query, setQuery] = useState('')
  const [themeFilter, setThemeFilter] = useState('all')
  const [relation, setRelation] = useState({ sourceNoteId: '', targetNoteId: '', relationship: 'echoes', rationale: '' })

  async function refresh() {
    setLoading(true)
    try {
      const [noteResult, bookResult, themeResult, atlasResult] = await Promise.all([
        api('/api/notes'), api('/api/library'), api('/api/themes'), api('/api/atlas'),
      ])
      setNotes(noteResult.items)
      setBooks(bookResult.items)
      setThemes(themeResult.items)
      setLinks(atlasResult.links)
      setRelation((current) => ({ ...current, sourceNoteId: current.sourceNoteId || noteResult.items[0]?.id || '', targetNoteId: current.targetNoteId || noteResult.items[1]?.id || '' }))
    } catch (fetchError) { setError(fetchError.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const noteId = new URLSearchParams(window.location.search).get('note')
    if (!noteId || loading) return undefined
    const timer = window.setTimeout(() => {
      const card = document.getElementById(`note-${noteId}`)
      card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      card?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [loading, notes.length])

  const visibleNotes = useMemo(() => notes.filter((note) => (themeFilter === 'all' || note.themeIds.includes(themeFilter)) && `${note.title || ''} ${note.content} ${note.bookTitle || ''} ${note.themeNames || ''}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))), [notes, query, themeFilter])

  function signalAtlas() {
    try { const channel = new BroadcastChannel('chronologos-notes'); channel.postMessage({ type: 'changed' }); channel.close() } catch { /* unsupported browsers refresh on focus */ }
  }

  function startEdit(note) {
    setEditing(note.id)
    setError('')
    setForm({ kind: note.kind, title: note.title || '', content: note.content, commentary: note.commentary || '', libraryEntryId: note.libraryEntryId || '', editionId: note.editionId || '', sourceLocator: note.sourceLocator || '', themeIds: note.themeIds || [] })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setEditing(null); setForm(blank); setError('') }

  async function saveNote(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const selectedBook = books.find((book) => book.id === form.libraryEntryId)
    const payload = { ...form, libraryEntryId: form.libraryEntryId || null, editionId: selectedBook?.editionId || form.editionId || null }
    try {
      await api(editing ? `/api/notes/${encodeURIComponent(editing)}` : '/api/notes', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      setNotice(editing ? 'Not güncellendi.' : 'Not kaydedildi; Atlas için bir yıldız oluşturuldu.')
      setEditing(null)
      setForm(blank)
      await refresh()
      signalAtlas()
    } catch (saveError) { setError(saveError.message) }
    finally { setSaving(false) }
  }

  async function removeNote(note) {
    if (!window.confirm(`“${note.title || note.content.slice(0, 50)}” notunu silmek istiyor musun?`)) return
    try { await api(`/api/notes/${encodeURIComponent(note.id)}`, { method: 'DELETE' }); setNotice('Not silindi.'); await refresh(); signalAtlas() }
    catch (removeError) { setNotice(removeError.message) }
  }

  async function saveRelation(event) {
    event.preventDefault()
    setError('')
    try {
      await api('/api/note-links', { method: 'POST', body: JSON.stringify(relation) })
      setNotice('Düşünce bağlantısı Atlas’a eklendi.')
      await refresh()
      signalAtlas()
    } catch (linkError) { setError(linkError.message) }
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

  function toggleMemories() {
    const enabled = !memoriesEnabled
    setMemoriesEnabled(enabled)
    try { localStorage.setItem('chronologos:memories', enabled ? 'on' : 'off') } catch { /* Setting still applies in this tab. */ }
    try { const channel = new BroadcastChannel('chronologos-notes'); channel.postMessage({ type: 'memories', enabled }); channel.close() } catch { /* Atlas can read the stored setting when opened. */ }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return <main className="library-app">
    <aside className="library-rail">
      <a className="library-brand" href="/library"><span className="library-brand__mark">C<span>·</span>L</span><span className="library-brand__word">CHRONOLOGOS<small>PERSONAL ARCHIVE</small></span></a>
      <div className="rail-divider" /><span className="rail-label">ÇALIŞMA ALANI</span>
      <a className="rail-link" href="/library"><span className="rail-icon">▤</span> Kitaplığım</a>
      <a className="rail-link rail-link--active" href="/notes"><span className="rail-icon">✎</span> Notlar <span className="rail-count">{notes.length}</span></a>
      <a className="rail-link" href="/atlas" onClick={(event) => { event.preventDefault(); navigateThroughPortal('/atlas', event.currentTarget) }}><span className="rail-icon">✧</span> Atlas’a dön <span className="rail-external">↗</span></a>
      <div className="rail-note"><span className="rail-note__symbol">✦</span><p>Her düşünce, atlasında yeni bir yıldız yakar.</p></div>
      <div className="rail-footer"><span className="status-light" /> YEREL ARŞİV <span className="rail-footer__version">0.2</span></div>
    </aside>

    <section className="library-main">
      <header className="library-topbar"><div className="breadcrumb"><span>KİŞİSEL ARŞİV</span><span className="breadcrumb__slash">/</span><strong>DÜŞÜNCELER</strong></div><div className="notes-top-actions"><button className="quiet-button archive-export" onClick={exportArchive}>↓ JSON yedeği</button><button className="quiet-button archive-export" aria-pressed={memoriesEnabled} onClick={toggleMemories}>✦ Anı kartları {memoriesEnabled ? 'açık' : 'kapalı'}</button><a className="atlas-open" href="/atlas" onClick={(event) => { event.preventDefault(); navigateThroughPortal('/atlas', event.currentTarget) }}><span>✧</span> Atlas’a dön <b>↗</b></a></div></header>
      <div className="library-content notes-content">
        <section className="library-heading"><div><span className="eyebrow">OKUMAKTAN DÜŞÜNCEYE</span><h1>Notların<span>.</span></h1><p>Alıntılarını, kişisel yorumlarını ve kitaplardan bağımsız düşüncelerini aynı arşivde tut.</p></div></section>

        <section className="notes-editor">
          <div className="notes-editor__heading"><div><span className="eyebrow">{editing ? 'KAYDI DÜZENLE' : 'YENİ BİR YILDIZ'}</span><h2>{editing ? 'Düşünceni gözden geçir' : 'Bir düşünceyi kaydet'}</h2></div>{editing && <button className="quiet-button" onClick={resetForm} type="button">Düzenlemeyi bırak</button>}</div>
          <form className="book-form" onSubmit={saveNote}>
            <label className="field"><span>Kayıt türü</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="thought">Kişisel düşünce</option><option value="quote">Alıntı</option></select></label>
            <label className="field"><span>Başlık <small>İsteğe bağlı</small></span><input maxLength="180" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bu düşünceye bir ad ver" /></label>
            <label className="field field--wide"><span>{form.kind === 'quote' ? 'Alıntı metni' : 'Düşünce'} <b>*</b></span><textarea required rows="4" maxLength="12000" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder={form.kind === 'quote' ? 'Alıntıladığın metni buraya yaz' : 'Aklında kalan düşünceyi kendi sözlerinle yaz'} /></label>
            <label className="field field--wide"><span>{form.kind === 'quote' ? 'Kişisel yorumun' : 'Ek not'} <small>İsteğe bağlı</small></span><textarea rows="3" maxLength="6000" value={form.commentary} onChange={(event) => setForm({ ...form, commentary: event.target.value })} placeholder="Bu sende ne çağrıştırıyor?" /></label>
            <label className="field"><span>Kaynak kitap</span><select value={form.libraryEntryId} onChange={(event) => setForm({ ...form, libraryEntryId: event.target.value, editionId: books.find((book) => book.id === event.target.value)?.editionId || '' })}><option value="">Kitapsız düşünce</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.author}</option>)}</select></label>
            <label className="field"><span>Sayfa / bölüm</span><input maxLength="240" value={form.sourceLocator} onChange={(event) => setForm({ ...form, sourceLocator: event.target.value })} placeholder="s. 42, Bölüm III" /></label>
            <fieldset className="field field--wide theme-picker"><legend>Atlas temaları <small>Birden fazla seçebilirsin</small></legend><div>{themes.map((theme) => <label key={theme.id} className="theme-choice"><input type="checkbox" checked={form.themeIds.includes(theme.id)} onChange={(event) => setForm({ ...form, themeIds: event.target.checked ? [...form.themeIds, theme.id] : form.themeIds.filter((id) => id !== theme.id) })} /><i style={{ '--theme-color': theme.color }} />{theme.name}</label>)}</div></fieldset>
            {error && <p className="form-error" role="alert">{error}</p>}
            <footer className="book-form__actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Kaydediliyor…' : editing ? 'Değişiklikleri kaydet' : 'Notu ve yıldızı oluştur'}</button></footer>
          </form>
        </section>

        <section className="notes-list-section">
          <div className="collection-heading"><div><span className="eyebrow">KİŞİSEL ARŞİV</span><h2>Düşünce kayıtların <small>{visibleNotes.length}/{notes.length}</small></h2></div><div className="notes-filter-tools"><select className="notes-theme-filter" aria-label="Temaya göre filtrele" value={themeFilter} onChange={(event) => setThemeFilter(event.target.value)}><option value="all">Tüm temalar</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Not, kaynak veya tema ara" aria-label="Notlarda ara" /></label></div></div>
          {loading ? <div className="library-loading"><span className="loading-orbit" /> Notlar yükleniyor…</div> : visibleNotes.length ? <div className="thought-list">{visibleNotes.map((note) => <article id={`note-${note.id}`} tabIndex="-1" className={`thought-card${new URLSearchParams(window.location.search).get('note') === note.id ? ' thought-card--focused' : ''}`} key={note.id}>
            <div className="thought-card__meta"><span className={`thought-kind thought-kind--${note.kind}`}>{note.kind === 'quote' ? 'ALINTI' : 'DÜŞÜNCE'}</span><span>{note.themeNames || 'Temasız'}</span></div>
            {note.title && <h3>{note.title}</h3>}<p className={note.kind === 'quote' ? 'thought-card__quote' : ''}>{note.content}</p>{note.commentary && <p className="thought-card__commentary">{note.commentary}</p>}
            {(note.bookTitle || note.sourceLocator) && <div className="thought-card__source">{note.bookTitle && <a href="/library">{note.bookTitle}{note.author ? ` · ${note.author}` : ''}</a>}{note.sourceLocator && <span>{note.sourceLocator}</span>}</div>}
            <div className="thought-card__actions"><a href={`/atlas?note=${encodeURIComponent(note.id)}`} onClick={(event) => { event.preventDefault(); navigateThroughPortal(`/atlas?note=${encodeURIComponent(note.id)}`, event.currentTarget) }}>Atlas’ta bul ↗</a><button onClick={() => startEdit(note)}>Düzenle</button><button onClick={() => removeNote(note)}>Sil</button></div>
          </article>)}</div> : <div className="library-empty"><div className="library-empty__seal">✧</div><span className="eyebrow">İLK DÜŞÜNCE</span><h3>Arşivinde henüz not yok.</h3><p>Bir düşünce ya da alıntı eklediğinde Atlas’ta kalıcı bir yıldıza dönüşür.</p></div>}
        </section>

        <section className="notes-editor relation-editor"><div className="notes-editor__heading"><div><span className="eyebrow">KULLANICI KURAR</span><h2>Düşünceler arasında bağ</h2></div></div>
          {notes.length > 1 ? <form className="book-form" onSubmit={saveRelation}><label className="field"><span>İlk düşünce</span><select value={relation.sourceNoteId} onChange={(event) => setRelation({ ...relation, sourceNoteId: event.target.value })}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title || note.content.slice(0, 48)}</option>)}</select></label><label className="field"><span>İlişki</span><select value={relation.relationship} onChange={(event) => setRelation({ ...relation, relationship: event.target.value })}>{Object.entries(relationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="field field--wide"><span>İkinci düşünce</span><select value={relation.targetNoteId} onChange={(event) => setRelation({ ...relation, targetNoteId: event.target.value })}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title || note.content.slice(0, 48)}</option>)}</select></label><label className="field field--wide"><span>Neden bağlılar? <small>İsteğe bağlı</small></span><input maxLength="1000" value={relation.rationale} onChange={(event) => setRelation({ ...relation, rationale: event.target.value })} placeholder="Bağlantının kısa açıklaması" /></label><footer className="book-form__actions"><button className="primary-button" type="submit">Bağlantıyı oluştur</button></footer></form> : <p className="relation-hint">Bir düşünce bağlantısı kurmak için en az iki not ekle.</p>}
          {links.length > 0 && <ul className="relation-list">{links.map((link) => { const left = notes.find((note) => note.id === link.source); const right = notes.find((note) => note.id === link.target); return <li key={link.id}><span>{left?.title || left?.content.slice(0, 35)} <b>— {relationLabels[link.relationship]} →</b> {right?.title || right?.content.slice(0, 35)}</span><button onClick={() => removeRelation(link.id)}>Kaldır</button></li> })}</ul>}
        </section>
        <footer className="library-footer"><span>CHRONOLOGOS</span><span>OKUMAKTAN DÜŞÜNCEYE</span><span>✦</span></footer>
      </div>
    </section>
    {notice && <div className="library-toast" role="status">{notice}</div>}
  </main>
}
