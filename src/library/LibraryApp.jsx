import { useEffect, useMemo, useRef, useState } from 'react'
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

const emptyForm = {
  title: '', author: '', originalYear: '', status: 'to_read', rating: '',
  language: '', publisher: '', pageCount: '', isbn: '', translator: '', description: '', review: '',
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

function BookCover({ item, index }) {
  const hues = [39, 190, 12, 150, 275, 215]
  const hue = hues[index % hues.length]
  return (
    <div className="book-cover" style={{ '--cover-hue': hue }} aria-hidden="true">
      <span className="book-cover__stamp">C · L</span>
      <span className="book-cover__title">{item.title}</span>
      <span className="book-cover__author">{item.author}</span>
      <span className="book-cover__ornament">✦</span>
    </div>
  )
}

function BookForm({ initialValue, onClose, onSave, saving, error }) {
  const [form, setForm] = useState(() => initialValue ? {
    title: initialValue.title || '',
    author: initialValue.author || '',
    originalYear: initialValue.originalYear || '',
    status: initialValue.status || 'to_read',
    rating: initialValue.rating || '',
    language: initialValue.language || '',
    publisher: initialValue.publisher || '',
    pageCount: initialValue.pageCount || '',
    isbn: initialValue.isbn || '',
    translator: initialValue.translator || '',
    description: initialValue.description || '',
    review: initialValue.review || '',
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
      originalYear: form.originalYear || null,
      rating: form.rating || null,
      pageCount: form.pageCount || null,
    }, initialValue?.id)
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
          <label className="field field--wide">
            <span>Kitap adı <b>*</b></span>
            <input required maxLength="240" value={form.title} onChange={set('title')} placeholder="Eserin adı" />
          </label>
          <label className="field field--wide">
            <span>Yazar <b>*</b></span>
            <input required maxLength="180" value={form.author} onChange={set('author')} placeholder="Yazarın adı" />
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
          <label className="field">
            <span>Kişisel puanın</span>
            <select value={form.rating} onChange={set('rating')}>
              <option value="">Henüz puanlamadım</option>
              {[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</option>)}
            </select>
          </label>
          <label className="field field--wide">
            <span>Kitap açıklaması <small>İsteğe bağlı</small></span>
            <textarea rows="2" maxLength="2000" value={form.description} onChange={set('description')} placeholder="Eser hakkında kısa bilgi" />
          </label>
          <label className="field field--wide">
            <span>Kişisel düşüncen <small>İsteğe bağlı</small></span>
            <textarea rows="3" maxLength="5000" value={form.review} onChange={set('review')} placeholder="Bu eser sende ne bıraktı?" />
          </label>
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
  const [counts, setCounts] = useState({ all: 0, to_read: 0, reading: 0, read: 0, paused: 0 })
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formEditing, setFormEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const requestSequence = useRef(0)

  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (activeFilter !== 'all') query.set('status', activeFilter)
    if (search.trim()) query.set('q', search.trim())
    return query.toString()
  }, [activeFilter, search])
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
    <main className="library-app">
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

          <section className="library-stats" aria-label="Kitaplık özeti">
            <div className="stat-card stat-card--total"><span>TOPLAM ESER</span><strong>{counts.all}</strong><i>kişisel arşivinde</i></div>
            <div className="stat-card"><span>OKUYORUM</span><strong>{counts.reading}</strong><i>şu an yanında</i></div>
            <div className="stat-card"><span>OKUDUM</span><strong>{counts.read}</strong><i>tamamlanmış eser</i></div>
            <div className="stat-card"><span>OKUMA LİSTEM</span><strong>{counts.to_read}</strong><i>sıradaki keşifler</i></div>
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
                  onClick={() => setActiveFilter(filter.id)}
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                >
                  {filter.label}<span>{counts[filter.id]}</span>
                </button>
              ))}
            </div>

            {loadError ? (
              <div className="library-message library-message--error" role="alert">
                <span>Arşive ulaşılamadı</span><p>{loadError} API sunucusunun çalıştığını kontrol et.</p>
                <button className="quiet-button" onClick={() => refresh()}>Yeniden dene</button>
              </div>
            ) : loading ? (
              <div className="library-loading" aria-live="polite"><span className="loading-orbit" /> Arşiv açılıyor…</div>
            ) : items.length ? (
              <div className="book-grid">
                {items.map((item, index) => (
                  <article className="book-card" key={item.id}>
                    <BookCover item={item} index={index} />
                    <div className="book-card__body">
                      <div className="book-card__meta">
                        <span className={`status-tag status-tag--${item.status}`}>{statusLabels[item.status]}</span>
                        {item.isDemo ? <span className="demo-tag">ÖRNEK</span> : null}
                      </div>
                      <h3>{item.title}</h3>
                      <p className="book-card__author">{item.author}{item.originalYear ? <span> · {item.originalYear}</span> : null}</p>
                      <div className="book-card__details">
                        {item.language && <span>{item.language}</span>}
                        {item.pageCount && <span>{item.pageCount} s.</span>}
                        {item.rating && <span className="book-rating">{'★'.repeat(item.rating)}<i>{'☆'.repeat(5 - item.rating)}</i></span>}
                      </div>
                      {item.review && <p className="book-card__review">“{item.review}”</p>}
                      <div className="book-card__actions">
                        <label className="status-select-label">
                          <span className="sr-only">{item.title} okuma durumu</span>
                          <select value={item.status} onChange={(event) => updateEntry(item, { status: event.target.value })}>
                            {filters.filter((filter) => filter.id !== 'all').map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                          </select>
                        </label>
                        <button className="edit-book" onClick={() => { setFormError(''); setFormEditing(item); setFormOpen(true) }}>Düzenle</button>
                        <button className="remove-book" onClick={() => removeEntry(item)} aria-label={`${item.title} kitabını kitaplığımdan çıkar`}>Sil</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="library-empty">
                <div className="library-empty__seal">✧</div>
                <span className="eyebrow">YENİ BİR SAYFA</span>
                <h3>{search || activeFilter !== 'all' ? 'Bu rafta eser bulunamadı.' : 'Kitaplığın ilk kitabını bekliyor.'}</h3>
                <p>{search || activeFilter !== 'all' ? 'Arama sözcüğünü ya da seçili filtreyi değiştirebilirsin.' : 'Bir kitap ekle; okuma yolculuğun ve düşünce atlasın birlikte büyüsün.'}</p>
                {!search && activeFilter === 'all' && <button className="primary-button" onClick={() => { setFormEditing(null); setFormOpen(true) }}>İlk kitabını ekle <span>↗</span></button>}
              </div>
            )}
          </section>
          <footer className="library-footer"><span>CHRONOLOGOS</span><span>OKUMAKTAN DÜŞÜNCEYE</span><span>✦</span></footer>
        </div>
      </section>

      {formOpen && <BookForm key={formEditing?.id || 'new-book'} initialValue={formEditing} onClose={() => { setFormOpen(false); setFormEditing(null) }} onSave={saveBook} saving={saving} error={formError} />}
      {notice && <div className="library-toast" role="status">{notice}</div>}
    </main>
  )
}
