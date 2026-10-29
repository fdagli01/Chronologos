import assert from 'node:assert/strict'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import { createStarGeometry, createThreadGeometry, updateStarHighlights } from '../src/scene/logosGeometry.js'
import { stars } from '../src/data/universe.js'

const atlasData = {
  themes: [{ id: 'bench', color: '#d6c39f' }],
  nodes: Array.from({ length: 10_000 }, (_, index) => ({
    id: `note-${index}`,
    themeId: 'bench',
    position: [Math.sin(index) * 3, Math.cos(index) * 3, (index % 17) / 17],
    magnitude: 0.7 + (index % 10) / 10,
    phase: index / 10,
  })),
  links: Array.from({ length: 9999 }, (_, index) => ({ source: `note-${index}`, target: `note-${index + 1}` })),
}

function originalCreateStarGeometry(themeId, data, freshId, selectedId) {
  const noteStars = (data?.nodes || []).filter((note) => (note.themeId || 'unplaced') === themeId)
  const themeStars = stars.filter((star) => star.theme === themeId)
  const color = data?.themes?.find((theme) => theme.id === themeId)?.color || '#d6c39f'
  const entries = [...themeStars.map((star) => ({ ...star, noteId: null })), ...noteStars.map((note) => ({ id: note.id, noteId: note.id, position: note.position, magnitude: note.magnitude, phase: note.phase, color: note.color || color }))]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(entries.flatMap((star) => star.position)), 3))
  geometry.setAttribute('aMagnitude', new BufferAttribute(new Float32Array(entries.map((star) => star.magnitude)), 1))
  geometry.setAttribute('aAnchor', new BufferAttribute(new Float32Array(entries.map((star) => !star.noteId && star.magnitude > 1.8 ? 1 : 0)), 1))
  geometry.setAttribute('aFresh', new BufferAttribute(new Float32Array(entries.map((star) => star.noteId === freshId ? 1 : 0)), 1))
  geometry.setAttribute('aSelected', new BufferAttribute(new Float32Array(entries.map((star) => star.noteId === selectedId ? 1 : 0)), 1))
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(entries.map((star) => star.phase)), 1))
  geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(entries.flatMap((star) => new Color(star.color).toArray())), 3))
  geometry.userData.noteIds = entries.map((star) => star.noteId)
  return geometry
}

const geometry = createStarGeometry('bench', atlasData)
const position = geometry.getAttribute('position')
const threadGeometry = createThreadGeometry('bench', atlasData)
const threadPositions = threadGeometry.getAttribute('position')
assert.equal(threadPositions.count, atlasData.links.length * 24)
assert.ok(Array.from(threadPositions.array).every(Number.isFinite), 'thread positions remain finite')
const maxRadius = Math.max(...atlasData.nodes.map((note) => Math.hypot(...note.position)))
for (let offset = 0; offset < threadPositions.array.length; offset += 3) {
  const radius = Math.hypot(threadPositions.array[offset], threadPositions.array[offset + 1], threadPositions.array[offset + 2])
  assert.ok(radius <= maxRadius + 0.081, 'thread vertices stay within the endpoint radius plus curve lift')
}

const fresh = geometry.getAttribute('aFresh')
const selected = geometry.getAttribute('aSelected')
assert.equal(updateStarHighlights(geometry, 'note-8', 'note-12'), true)
assert.equal(fresh.getX(geometry.userData.noteIndices.get('note-8')), 1)
assert.equal(selected.getX(geometry.userData.noteIndices.get('note-12')), 1)
assert.equal(updateStarHighlights(geometry, 'note-9', null), true)
assert.equal(fresh.getX(geometry.userData.noteIndices.get('note-8')), 0)
assert.equal(fresh.getX(geometry.userData.noteIndices.get('note-9')), 1)
assert.equal(selected.getX(geometry.userData.noteIndices.get('note-12')), 0)
assert.equal(updateStarHighlights(geometry, null, null), true)
assert.equal(updateStarHighlights(geometry, null, null), false)
const selectedVersion = selected.version
assert.equal(updateStarHighlights(geometry, 'missing-note', 'missing-note'), false)
assert.equal(selected.version, selectedVersion, 'missing IDs do not upload unchanged buffers')
updateStarHighlights(geometry, 'note-9', 'note-9')
assert.equal(fresh.getX(geometry.userData.noteIndices.get('note-9')), 1)
assert.equal(selected.getX(geometry.userData.noteIndices.get('note-9')), 1)
updateStarHighlights(geometry, null, null)
assert.equal(fresh.getX(geometry.userData.noteIndices.get('note-9')), 0)
assert.equal(geometry.getAttribute('position'), position, 'selection preserves star buffers')
assert.equal(threadGeometry.getAttribute('position'), threadPositions, 'selection leaves thread geometry intact')

const rounds = 30
let beforeMs = 0
let afterMs = 0
for (let run = 0; run < rounds; run++) {
  const start = performance.now()
  const rebuilt = originalCreateStarGeometry('bench', atlasData, `note-${100 + run}`, `note-${9000 + run}`)
  beforeMs += performance.now() - start
  rebuilt.dispose()
  const updateStart = performance.now()
  updateStarHighlights(geometry, `note-${100 + run}`, `note-${9000 + run}`)
  afterMs += performance.now() - updateStart
}

console.log(`10,000 notes, ${rounds} selection changes: rebuild ${(beforeMs / rounds).toFixed(2)} ms; indexed update ${(afterMs / rounds).toFixed(3)} ms`)
geometry.dispose()
threadGeometry.dispose()
