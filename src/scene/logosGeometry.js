import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import { stars, threads, starById } from '../data/universe.js'

export function createStarGeometry(themeId, atlasData) {
  const noteStars = (atlasData?.nodes || []).filter((note) => (note.themeId || 'unplaced') === themeId)
  const themeStars = stars.filter((star) => star.theme === themeId)
  const color = atlasData?.themes?.find((theme) => theme.id === themeId)?.color || '#d6c39f'
  const entries = [
    ...themeStars.map((star) => ({ ...star, noteId: null })),
    ...noteStars.map((note) => ({ id: note.id, noteId: note.id, position: note.position, magnitude: note.magnitude, phase: note.phase, color: note.color || color })),
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(entries.flatMap((star) => star.position)), 3))
  geometry.setAttribute('aMagnitude', new BufferAttribute(new Float32Array(entries.map((star) => star.magnitude)), 1))
  geometry.setAttribute('aAnchor', new BufferAttribute(new Float32Array(entries.map((star) => !star.noteId && star.magnitude > 1.8 ? 1 : 0)), 1))
  geometry.setAttribute('aFresh', new BufferAttribute(new Float32Array(entries.length), 1))
  geometry.setAttribute('aSelected', new BufferAttribute(new Float32Array(entries.length), 1))
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(entries.map((star) => star.phase)), 1))
  geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(entries.flatMap((star) => new Color(star.color).toArray())), 3))
  const noteIndices = new Map()
  entries.forEach((star, index) => { if (star.noteId) noteIndices.set(star.noteId, index) })
  geometry.userData.noteIds = entries.map((star) => star.noteId)
  geometry.userData.noteIndices = noteIndices
  return geometry
}

export function updateStarHighlights(geometry, freshId, selectedId) {
  const indices = geometry.userData.noteIndices
  const fresh = geometry.getAttribute('aFresh')
  const selected = geometry.getAttribute('aSelected')
  const previousFresh = geometry.userData.freshId ?? null
  const previousSelected = geometry.userData.selectedId ?? null
  const changed = new Set([previousFresh, freshId, previousSelected, selectedId])
  let freshChanged = false
  let selectedChanged = false
  for (const id of changed) {
    if (id == null) continue
    const index = indices.get(id)
    if (index === undefined) continue
    const nextFresh = id === freshId ? 1 : 0
    const nextSelected = id === selectedId ? 1 : 0
    if (fresh.getX(index) !== nextFresh) { fresh.setX(index, nextFresh); freshChanged = true }
    if (selected.getX(index) !== nextSelected) { selected.setX(index, nextSelected); selectedChanged = true }
  }
  if (freshChanged) fresh.needsUpdate = true
  if (selectedChanged) selected.needsUpdate = true
  geometry.userData.freshId = freshId ?? null
  geometry.userData.selectedId = selectedId ?? null
  return freshChanged || selectedChanged
}

export function createThreadGeometry(themeId, atlasData) {
  const positions = []
  const phases = []
  const strengths = []
  const noteById = new Map((atlasData?.nodes || []).map((note) => [note.id, note]))
  const ambientEdges = threads.filter((item) => item.id.startsWith(`${themeId}-`)).map((item) => ({ ...item, sourcePosition: starById.get(item.source)?.position, targetPosition: starById.get(item.target)?.position }))
  const noteEdges = (atlasData?.links || []).flatMap((link) => {
    const source = noteById.get(link.source)
    const target = noteById.get(link.target)
    if (!source || !target || (source.themeId || 'unplaced') !== themeId) return []
    return [{ sourcePosition: source.position, targetPosition: target.position, phase: source.phase, strength: 0.72 }]
  })
  for (const thread of [...ambientEdges, ...noteEdges]) {
    if (!thread.sourcePosition || !thread.targetPosition) continue
    const from = new Vector3(...thread.sourcePosition)
    const to = new Vector3(...thread.targetPosition)
    const fromDirection = from.clone().normalize()
    const toDirection = to.clone().normalize()
    const angle = fromDirection.angleTo(toDirection)
    const sinAngle = Math.sin(angle)
    const segments = 12
    let previous = from
    for (let segment = 1; segment <= segments; segment++) {
      const t = segment / segments
      const direction = sinAngle < 0.0001
        ? fromDirection.clone().lerp(toDirection, t).normalize()
        : fromDirection.clone().multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
          .addScaledVector(toDirection, Math.sin(t * angle) / sinAngle)
      const radius = from.length() * (1 - t) + to.length() * t + Math.sin(Math.PI * t) * 0.08
      const next = direction.multiplyScalar(radius)
      positions.push(...previous.toArray(), ...next.toArray())
      phases.push(thread.phase, thread.phase)
      strengths.push(thread.strength, thread.strength)
      previous = next
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1))
  geometry.setAttribute('aStrength', new BufferAttribute(new Float32Array(strengths), 1))
  return geometry
}
