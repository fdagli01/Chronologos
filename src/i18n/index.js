import { useSyncExternalStore } from 'react'

const supported = new Set(['tr', 'en', 'de'])
const localeByLanguage = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE' }
const storageKey = 'chronologos:language'
const dictionaries = Object.values(import.meta.glob('./messages-*.json', { eager: true, import: 'default' }))
  .reduce((merged, dictionary) => Object.assign(merged, dictionary || {}), {})
const apiFieldLabels = {
  title: { tr: 'Başlık', en: 'Title', de: 'Titel' },
  author: { tr: 'Yazar', en: 'Author', de: 'Autor' },
  pageCount: { tr: 'Sayfa sayısı', en: 'Page count', de: 'Seitenzahl' },
  currentPage: { tr: 'Kaldığın sayfa', en: 'Current page', de: 'Aktuelle Seite' },
  isbn: { tr: 'ISBN', en: 'ISBN', de: 'ISBN' },
  description: { tr: 'Açıklama', en: 'Description', de: 'Beschreibung' },
  publisher: { tr: 'Yayınevi', en: 'Publisher', de: 'Verlag' },
  year: { tr: 'Yıl', en: 'Year', de: 'Jahr' },
  language: { tr: 'Dil', en: 'Language', de: 'Sprache' },
  'Original year': { tr: 'İlk yayın yılı', en: 'Original year', de: 'Erstveröffentlichungsjahr' },
  'Page count': { tr: 'Sayfa sayısı', en: 'Page count', de: 'Seitenzahl' },
  Rating: { tr: 'Puan', en: 'Rating', de: 'Bewertung' },
  Review: { tr: 'Yorum', en: 'Review', de: 'Rezension' },
  Translator: { tr: 'Çevirmen', en: 'Translator', de: 'Übersetzer' },
  'Cover ID': { tr: 'Kapak kimliği', en: 'Cover ID', de: 'Cover-ID' },
  'Open Library work ID': { tr: 'Open Library eser kimliği', en: 'Open Library work ID', de: 'Open-Library-Werk-ID' },
  'Open Library edition ID': { tr: 'Open Library baskı kimliği', en: 'Open Library edition ID', de: 'Open-Library-Ausgaben-ID' },
}
const dynamicApiTemplates = [
  { source: '{field} is required.', pattern: /^([A-Za-z][A-Za-z0-9 ]*) is required\.$/ },
  { source: '{field} must be text.', pattern: /^([A-Za-z][A-Za-z0-9 ]*) must be text\.$/ },
  { source: '{field} must be {max} characters or fewer.', pattern: /^([A-Za-z][A-Za-z0-9 ]*) must be (\d+) characters or fewer\.$/ },
  { source: '{field} must be a whole number.', pattern: /^([A-Za-z][A-Za-z0-9 ]*) must be a whole number\.$/ },
  { source: '{field} must be a whole number between {min} and {max}.', pattern: /^([A-Za-z][A-Za-z0-9 ]*) must be a whole number between (\d+) and (\d+)\.$/ },
]

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return supported.has(stored) ? stored : 'tr'
  } catch {
    return 'tr'
  }
}

let language = typeof window === 'undefined' ? 'tr' : readStoredLanguage()
const listeners = new Set()

function updateDocumentLanguage() {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = localeByLanguage[language]
    document.title = t('Chronologos — Düşünce Atlası')
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  updateDocumentLanguage()
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return
    const next = supported.has(event.newValue) ? event.newValue : 'tr'
    if (next === language) return
    language = next
    updateDocumentLanguage()
    emit()
  })
}

export function getLanguage() {
  return language
}

export function getLocale() {
  return localeByLanguage[language]
}

export function formatNumber(value) {
  return new Intl.NumberFormat(getLocale()).format(value)
}

export function formatPercent(value) {
  return new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 1 }).format(value / 100)
}

export function setLanguage(nextLanguage) {
  if (!supported.has(nextLanguage) || nextLanguage === language) return
  language = nextLanguage
  updateDocumentLanguage()
  try {
    window.localStorage.setItem(storageKey, language)
  } catch {
    // Keep the in-memory choice when storage is disabled or unavailable.
  }
  emit()
}

export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getLanguage,
    () => 'tr',
  )
}

export function t(sourceTurkishString, params = {}) {
  if (sourceTurkishString && typeof sourceTurkishString === 'object' && typeof sourceTurkishString.key === 'string') {
    return t(sourceTurkishString.key, sourceTurkishString.params || {})
  }
  if (typeof sourceTurkishString !== 'string') return sourceTurkishString ?? ''
  let entry = dictionaries[sourceTurkishString]
  let values = params
  const missingModels = /^Yerel AI modeli bulunamadı\. Ollama’da “([^”]+)” ve “([^”]+)” modellerini indir\.$/.exec(sourceTurkishString)
  if (!entry && missingModels) {
    entry = dictionaries['Yerel AI modeli bulunamadı. Ollama’da “{embedding}” ve “{chat}” modellerini indir.']
    values = { ...params, embedding: missingModels[1], chat: missingModels[2] }
  }
  if (!entry) {
    for (const template of dynamicApiTemplates) {
      const match = template.pattern.exec(sourceTurkishString)
      if (!match) continue
      entry = dictionaries[template.source]
      const rawField = match[1]
      const fieldLabels = apiFieldLabels[rawField] || Object.entries(apiFieldLabels)
        .find(([field]) => field.toLowerCase() === rawField.toLowerCase())?.[1]
      values = {
        ...params,
        field: fieldLabels?.[language] || rawField,
        ...(match.length === 3 ? { max: match[2] } : {}),
        ...(match.length === 4 ? { min: match[2], max: match[3] } : {}),
      }
      break
    }
  }
  const count = params.count ?? params[entry?.countParam]
  const translation = entry && (Number(count) === 1 && entry.one ? entry.one[language] : entry[language])
  const value = typeof translation === 'string' ? translation : sourceTurkishString
  return value.replace(/\{([\w]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(values, name)
      ? (values[name] && typeof values[name] === 'object' && typeof values[name].key === 'string' ? t(values[name]) : String(values[name]))
      : match
  ))
}
