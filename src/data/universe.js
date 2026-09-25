import { Vector3 } from 'three'

// This is deliberately separate from rendering. Replace these records with
// persisted notes and relationship scores without changing the scene components.
const themes = [
  { id: 'will', center: [-0.74, 0.53, -0.42], color: '#ffc87c', count: 38 },
  { id: 'memory', center: [0.62, 0.65, -0.44], color: '#fff1d1', count: 36 },
  { id: 'becoming', center: [-0.63, -0.51, -0.58], color: '#f3a76c', count: 36 },
  { id: 'kinship', center: [0.68, -0.36, -0.64], color: '#b9dfe0', count: 36 },
]

function randomGenerator(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const random = randomGenerator(114781)
export const LOGOS_RADIUS = 5.4

export const stars = themes.flatMap((theme) => {
  const center = new Vector3(...theme.center).normalize()
  const tangent = new Vector3(0, 1, 0).cross(center).normalize()
  const bitangent = center.clone().cross(tangent).normalize()

  return Array.from({ length: theme.count }, (_, index) => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * (index === 0 ? 0.02 : 0.55)
    const position = center.clone()
      .addScaledVector(tangent, Math.cos(angle) * spread)
      .addScaledVector(bitangent, Math.sin(angle) * spread)
      .normalize()
      .multiplyScalar(LOGOS_RADIUS + (random() - 0.5) * 0.38)

    return {
      id: `${theme.id}-${index + 1}`,
      theme: theme.id,
      color: theme.color,
      position: position.toArray(),
      magnitude: index === 0 ? 1.65 : 0.55 + random() * 0.85,
      phase: random() * Math.PI * 2,
    }
  })
})

export const threads = themes.flatMap((theme) => {
  const group = stars.filter((star) => star.theme === theme.id)
  const edges = new Set()

  group.forEach((star, index) => {
    const nearest = group
      .filter((other) => other.id !== star.id)
      .map((other) => ({ other, distance: new Vector3(...star.position).distanceTo(new Vector3(...other.position)) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, index % 5 === 0 ? 3 : 2)

    nearest.forEach(({ other }) => {
      const ids = [star.id, other.id].sort()
      edges.add(ids.join('|'))
    })
  })

  return [...edges].map((edge, index) => {
    const [source, target] = edge.split('|')
    return { id: `${theme.id}-thread-${index}`, source, target, strength: 0.4 + random() * 0.6, phase: random() * Math.PI * 2 }
  })
})

export const starById = new Map(stars.map((star) => [star.id, star]))
