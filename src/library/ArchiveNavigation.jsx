import { t } from '../i18n/index.js'
import { handleArchiveLink } from '../navigation/portalTransition.js'
import { LanguageSelector } from '../i18n/LanguageSelector.jsx'

function ArchiveIcon({ type }) {
  const paths = {
    library: <><path d="M4 5h16v15H4zM4 10h16M4 15h16M8 5v5m5 0V5m3 10v5M9 15v5" /><path d="M3 20h18" /></>,
    notes: <><path d="M5 3h12l3 3v15H5zM17 3v4h3M9 11h7M9 15h7" /><path d="M3 7h4M3 12h4M3 17h4" /></>,
    atlas: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" transform="rotate(35 12 12)" /><path d="m12 6 1.4 4.6L18 12l-4.6 1.4L12 18l-1.4-4.6L6 12l4.6-1.4z" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>
}

export function ArchiveNavigation({ active, count }) {
  return (
    <aside className="library-rail archive-rail">
      <a className="library-brand" href="/library" onClick={handleArchiveLink} aria-label={t("Chronologos kitaplığı")}>
        <img className="library-brand__mark" src="/chronologos-mark-celestial.svg" alt="" />
        <span className="library-brand__word">{t("CHRONOLOGOS")}<small>{t("KİŞİSEL DÜŞÜNCE ATLASI")}</small></span>
      </a>
      <div className="rail-divider" />
      <span className="rail-label">{t("ARŞİVİNİ KEŞFET")}</span>
      <nav className="archive-navigation" aria-label={t("Çalışma alanı")}>
        <a className={`rail-link${active === 'library' ? ' rail-link--active' : ''}`} href="/library" onClick={handleArchiveLink} aria-current={active === 'library' ? 'page' : undefined}>
          <span className="rail-icon"><ArchiveIcon type="library" /></span><span className="rail-link__label">{t("Kitaplığım")}</span>{active === 'library' && <span className="rail-count">{count}</span>}
        </a>
        <a className={`rail-link${active === 'notes' ? ' rail-link--active' : ''}`} href="/notes" onClick={handleArchiveLink} aria-current={active === 'notes' ? 'page' : undefined}>
          <span className="rail-icon"><ArchiveIcon type="notes" /></span><span className="rail-link__label">{t("Notlar")}</span>{active === 'notes' && <span className="rail-count">{count}</span>}
        </a>
        <a className="rail-link" href="/atlas" onClick={handleArchiveLink}>
          <span className="rail-icon"><ArchiveIcon type="atlas" /></span><span className="rail-link__label">{t("Atlas’a dön")}</span><span className="rail-external" aria-hidden="true">↗</span>
        </a>
      </nav>
      <div className="rail-note"><span className="rail-note__symbol" aria-hidden="true">✦</span><p>{active === 'library' ? t("Her kitap, atlasında başka bir yere açılan kapı.") : t("Her düşünce, atlasında yeni bir yıldız yakar.")}</p></div>
      <LanguageSelector />
      <div className="rail-footer"><span className="status-light" /> {t("YEREL ARŞİV")}</div>
    </aside>
  )
}
