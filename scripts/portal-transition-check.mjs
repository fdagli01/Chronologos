import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../src/navigation/portalTransition.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
function harness(reduced = false) {
  const calls = [], overlays = [], durations = []
  const storage = new Map()
  const window = {
    innerWidth: 1000, innerHeight: 800,
    location: { href: 'http://localhost/notes', origin: 'http://localhost', pathname: '/notes', search: '', assign: path => calls.push(['reload', path]) },
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn, ms) => { durations.push(ms); queueMicrotask(fn) },
    requestAnimationFrame: fn => queueMicrotask(fn),
  }
  const element = () => ({ style: { setProperty() {} }, setAttribute() {}, append() {}, remove() { this.removed = true } })
  const context = vm.createContext({ window, document: { createElement: element, body: { append: el => overlays.push(el) } }, sessionStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) }, t: value => value, startPortalBenchmark: () => {}, markPortalRouteHandler: () => {}, URL, Date, crypto: { randomUUID: () => 'event-id' }, queueMicrotask })
  vm.runInContext(source + '\nthis.api = { navigateThroughPortal, navigateInArchive, handleArchiveLink, registerPortalRouter, carryNoteToAtlas, readPortalArrival }', context)
  return { ...context.api, calls, overlays, durations, window }
}
let h = harness()
let prepareDone
h.registerPortalRouter((path, arrival) => h.calls.push(['route', path, arrival]), () => new Promise(resolve => { prepareDone = resolve }))
const pending = h.navigateThroughPortal('/atlas', null)
await h.navigateThroughPortal('/library', null)
assert.equal(h.calls.length, 0, 'Wait for prepared route and reject repeated clicks')
assert.equal(h.overlays.length, 1)
prepareDone()
await pending
await new Promise(resolve => setImmediate(resolve))
assert.equal(h.calls[0][0], 'route')
assert.equal(h.calls[0][1], '/atlas')
assert.equal(h.overlays[0].removed, true)
assert.deepEqual(h.durations, [360])
h.registerPortalRouter((path, arrival) => h.calls.push(['route', path, arrival]), () => Promise.resolve())
await h.navigateThroughPortal('/atlas?note=note-1', null, { noteId: 'note-1' })
assert.equal(h.durations.at(-1), 640)
assert.equal(h.calls.at(-1)[2].note.noteId, 'note-1')

h = harness(true)
h.registerPortalRouter((path, arrival) => h.calls.push(['route', path, arrival]), () => Promise.resolve())
await h.navigateThroughPortal('/atlas')
assert.equal(h.overlays.length, 0)
assert.equal(h.calls[0][0], 'route')
assert.equal(h.calls[0][2], null)

h = harness()
await h.navigateThroughPortal('https://example.com')
assert.equal(h.calls.length, 0)
await h.navigateThroughPortal('/atlas')
assert.equal(h.calls[0][0], 'reload', 'Standalone fallback still navigates')
h.window.location.pathname = '/atlas'
assert.equal(h.readPortalArrival().destination, '/atlas')
assert.equal(h.readPortalArrival(), null)

h = harness()
h.registerPortalRouter(() => assert.fail('Failed preload must not commit'), () => Promise.reject(new Error('offline')))
await h.navigateThroughPortal('/atlas')
assert.equal(h.calls[0][0], 'reload')
console.log('Portal navigation checks passed: preparation, repeated clicks, note handoff, reduced motion, fallback and arrival consumption.')

h = harness()
h.registerPortalRouter((path, arrival) => h.calls.push(['route', path, arrival]), () => undefined)
assert.equal(await h.navigateInArchive('/library?book=book-1'), true)
assert.deepEqual(h.calls[0], ['route', '/library?book=book-1', null])
assert.equal(h.overlays.length, 0, 'Archive navigation needs no portal effect')
assert.equal(await h.navigateInArchive('/notes'), false, 'Same current URL must keep the editor mounted')
assert.equal(await h.navigateInArchive('https://example.com/library'), false)
const click = (path, overrides = {}) => ({
  button: 0, defaultPrevented: false,
  currentTarget: { href: `http://localhost${path}`, target: '', hasAttribute: () => false },
  preventDefault() { this.defaultPrevented = true }, ...overrides,
})
for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }, { currentTarget: { target: '_blank', hasAttribute: () => false } }, { currentTarget: { hasAttribute: () => true } }]) {
  const event = click('/library', overrides)
  h.handleArchiveLink(event)
  assert.equal(h.calls.length, 1, 'Modified clicks must be left to the browser')
}
for (const path of ['/unrelated', '//example.com/library']) {
  const event = click(path)
  if (path.startsWith('//')) event.currentTarget.href = 'https://example.com/library'
  h.handleArchiveLink(event)
  assert.equal(event.defaultPrevented, false)
}
const event = click('/library?book=book-2')
h.handleArchiveLink(event)
await new Promise(resolve => setImmediate(resolve))
assert.equal(event.defaultPrevented, true)
assert.deepEqual(h.calls.at(-1), ['route', '/library?book=book-2', null])
h = harness()
let release
h.registerPortalRouter((path) => h.calls.push(['route', path]), () => new Promise(resolve => { release = resolve }))
const first = h.navigateInArchive('/library')
assert.equal(await h.navigateInArchive('/library'), false)
release()
await first
h.registerPortalRouter(() => assert.fail('Rejected preparation must not commit'), () => Promise.reject(new Error('offline')))
assert.equal(await h.navigateInArchive('/library'), true)
assert.equal(await h.navigateInArchive('/library'), true, 'Preparation failure must release the shared lock')
assert.equal(h.calls.at(-1)[0], 'reload')
h = harness()
await h.navigateInArchive('/library')
assert.equal(h.calls[0][0], 'reload')
console.log('Archive navigation checks passed: source deep links, no reload, same URL, browser click behavior, repeated clicks and fallback lock release.')

