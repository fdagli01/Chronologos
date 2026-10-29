import { readFile, readdir } from 'node:fs/promises'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
const traverse = traverseModule.default

const dictionaries = {}
const conflicts = []
for (const file of (await readdir('src/i18n')).filter(name => /^messages-.*\.json$/.test(name))) {
  const entries = JSON.parse(await readFile(`src/i18n/${file}`, 'utf8'))
  for (const [key, entry] of Object.entries(entries)) {
    if (dictionaries[key] && JSON.stringify(dictionaries[key]) !== JSON.stringify(entry)) conflicts.push(key)
    dictionaries[key] = entry
    for (const language of ['en', 'de']) {
      if (typeof entry[language] !== 'string' || !entry[language].trim()) throw new Error(`${file}: missing ${language}: ${key}`)
      const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',')
      if (placeholders(key) !== placeholders(entry[language])) throw new Error(`${file}: placeholder mismatch ${language}: ${key}`)
      if (entry.one?.[language] && placeholders(key) !== placeholders(entry.one[language])) throw new Error(`${file}: singular placeholder mismatch: ${key}`)
    }
  }
}

const missing = new Set()
const bare = []
const shadowed = []
let calls = 0
async function audit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'i18n') continue
    const file = `${directory}/${entry.name}`
    if (entry.isDirectory()) { await audit(file); continue }
    if (!/\.(jsx|js)$/.test(file)) continue
    const ast = parse(await readFile(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
    traverse(ast, { CallExpression(path) {
      if (path.node.callee?.name !== 't') return
      const binding = path.scope.getBinding('t')
      if (binding && !binding.path.isImportSpecifier()) shadowed.push(`${file}:${path.node.loc.start.line}`)
    } })
    function visit(node) {
      if (!node || typeof node !== 'object') return
      if (node.type === 'CallExpression' && node.callee?.name === 't' && node.arguments[0]?.type === 'StringLiteral') {
        calls++
        if (!dictionaries[node.arguments[0].value]) missing.add(node.arguments[0].value)
      }
      if (node.type === 'JSXText' && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(node.value)) bare.push(`${file}:${node.loc.start.line}: ${node.value.trim().slice(0, 100)}`)
      if (node.type === 'JSXAttribute' && ['aria-label', 'placeholder', 'title', 'alt'].includes(node.name?.name) && node.value?.type === 'StringLiteral' && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(node.value.value)) bare.push(`${file}:${node.loc.start.line}: ${node.name.name}=${node.value.value}`)
      for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue
        if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') visit(value)
      }
    }
    visit(ast)
  }
}
await audit('src')
console.log(JSON.stringify({ dictionaryKeys: Object.keys(dictionaries).length, calls, missing: [...missing], conflicts: [...new Set(conflicts)], bare, shadowed }, null, 2))
if (missing.size || conflicts.length || bare.length || shadowed.length) process.exitCode = 1
