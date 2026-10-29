import { t } from '../i18n/index.js'
import { useEffect, useRef, useState } from 'react'
import { navigateThroughPortal } from '../navigation/portalTransition.js'

export function ArchivePortal({ elementRef }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const trigger = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  function travel(event, path) {
    event.preventDefault()
    navigateThroughPortal(path, trigger.current)
  }

  const labelVisible = hovered || keyboardFocused || open

  return (
    <div
      ref={elementRef}
      className={`archive-portal${open ? ' archive-portal--open' : ''}`}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setHovered(true) }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(event) => { if (event.pointerType === 'touch') setHovered(false) }}
    >
      <button
        ref={trigger}
        className="archive-portal__trigger"
        type="button"
        aria-label={t("Arşiv portalını aç")}
        aria-haspopup="menu"
        aria-expanded={open}
        onFocus={(event) => setKeyboardFocused(event.currentTarget.matches(':focus-visible'))}
        onBlur={() => setKeyboardFocused(false)}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="archive-portal__visual" aria-hidden="true">
          <i className="archive-portal__accretion" />
          <i className="archive-portal__photon-ring" />
          <i className="archive-portal__singularity" />
          <i className="archive-portal__mote" />
        </span>
        <span className={`archive-portal__caption${labelVisible ? ' archive-portal__caption--visible' : ''}`} aria-hidden="true"><span className="archive-portal__sigil">✦</span> {t("Arşiv")}</span>
      </button>
      {open && <div className="archive-portal__menu" role="menu" aria-label={t("Arşiv boyutunu seç")}>
        <button type="button" role="menuitem" onClick={(event) => travel(event, '/library')}>{t("Kitaplık")}</button>
        <button type="button" role="menuitem" onClick={(event) => travel(event, '/notes')}>{t("Notlar")}</button>
      </div>}
    </div>
  )
}
