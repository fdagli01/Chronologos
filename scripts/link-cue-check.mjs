import assert from 'node:assert/strict'
import { createLinkCue, LINK_CUE_STORAGE_KEY, readPendingLinkCue } from '../src/library/linkCue.js'
import { createLinkPulsePositions } from '../src/scene/linkPulseGeometry.js'

const now = 200000
const created = { id: 'link-1', source: 'note-a', target: 'note-b' }
assert.deepEqual(createLinkCue(created, false, now), { ...created, createdAt: now })
assert.equal(createLinkCue(created, true, now), null, 'editing an existing link must not cue an animation')
assert.equal(createLinkCue(null, false, now), null, 'failed or malformed saves must not cue an animation')

function memoryStorage(value) {
  return { value, removed: false, getItem() { return this.value }, removeItem(key) { assert.equal(key, LINK_CUE_STORAGE_KEY); this.removed = true; this.value = null } }
}
const storage = memoryStorage(JSON.stringify({ ...created, createdAt: now - 1000 }))
assert.deepEqual(readPendingLinkCue(storage, now), { ...created, createdAt: now - 1000 })
assert.equal(storage.removed, true, 'a pending cue is consumed once')
assert.equal(readPendingLinkCue(memoryStorage(JSON.stringify({ ...created, createdAt: now - 121000 })), now), null, 'expired cues are ignored')
assert.equal(readPendingLinkCue(memoryStorage('{broken'), now), null, 'malformed cues are ignored')

for (const [name, from, to] of [
  ['ordinary', [1, 0, 0], [0, 1, 0]],
  ['coincident', [1, 0, 0], [1, 0, 0]],
  ['antipodal', [1, 0, 0], [-1, 0, 0]],
]) {
  const positions = createLinkPulsePositions(from, to)
  assert.equal(positions.length, 120, `${name} path has 20 line segments`)
  assert.ok([...positions].every(Number.isFinite), `${name} path positions are finite`)
}
assert.equal(createLinkPulsePositions([1, 0, 0], null), null, 'missing endpoints produce no geometry')
console.log('Link cue and pulse geometry checks passed.')
