import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const dictionaries = Object.fromEntries(fs.readdirSync('src/i18n').filter(name => /^messages-.*\.json$/.test(name))
  .map(name => [name, JSON.parse(fs.readFileSync(`src/i18n/${name}`, 'utf8').replace(/^\uFEFF/, ''))]))
const source = fs.readFileSync('src/i18n/index.js', 'utf8')
  .replace(/^import .*\n/, '')
  .replace("import.meta.glob('./messages-*.json', { eager: true, import: 'default' })", 'loadedDictionaries')
  .replace(/export function /g, 'function ')
const stored = new Map()
const context = vm.createContext({
  loadedDictionaries: dictionaries,
  document: { documentElement: {}, title: '' },
  window: { localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) }, addEventListener() {} },
})
vm.runInContext(source + '\nthis.api = { t, setLanguage, getLanguage, getLocale };', context)
const { t, setLanguage, getLanguage, getLocale } = context.api
assert.equal(getLanguage(), 'tr')
assert.equal(t('Kitaplığım'), 'Kitaplığım')
setLanguage('de')
assert.equal(getLocale(), 'de-DE')
assert.equal(context.document.documentElement.lang, 'de-DE')
assert.equal(stored.get('chronologos:language'), 'de')
assert.equal(context.document.title, 'Chronologos — Gedankenatlas')
assert.equal(t('Title is required.'), 'Titel ist erforderlich.')
assert.ok(!t('Page count must be a whole number between 1 and 100000.').includes('must be'))
assert.ok(t('Yerel AI modeli bulunamadı. Ollama’da “embed-test” ve “chat-test” modellerini indir.').includes('embed-test'))
assert.equal(t('Kullanıcının değişmeyen özel metni'), 'Kullanıcının değişmeyen özel metni')
setLanguage('unsupported')
assert.equal(getLanguage(), 'de')
setLanguage('en')
assert.equal(t('Title is required.'), 'Title is required.')
assert.equal(t('kitap', { count: 1 }), 'book')
assert.equal(t('kitap', { count: 0 }), 'books')
assert.equal(t({ key: '{count} kitap eklendi{matched}{skipped}{invalid}.', params: { count: 1, matched: { key: ', {count} mevcut kayıtla eşleşti', params: { count: 2 } }, skipped: '', invalid: '' } }), '1 book added, 2 matched existing entries.')
assert.equal(t('{field} must be {max} characters or fewer.', { field: 'Title', max: 240 }), 'Title must be 240 characters or fewer.')
assert.equal(t(undefined), '')
setLanguage('tr')
assert.equal(t('Title is required.'), 'Başlık gerekli.')
console.log('Localization core checks passed: defaults, persistence, locale, title, API errors, placeholders, user content.')
