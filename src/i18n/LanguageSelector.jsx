import { useId } from 'react'
import { setLanguage, useLanguage } from './index.js'

const labels = { tr: 'Dil', en: 'Language', de: 'Sprache' }
const options = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

export function LanguageSelector({ className = '' }) {
  const language = useLanguage()
  const id = useId()
  return (
    <div className={`language-selector ${className}`.trim()}>
      <label className="language-selector__label" htmlFor={id}>{labels[language]}</label>
      <select
        className="language-selector__select"
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}
