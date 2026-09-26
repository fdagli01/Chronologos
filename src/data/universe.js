import { Vector3 } from 'three'

// This is deliberately separate from rendering. Replace these records with
// persisted notes and relationship scores without changing the scene components.
const themes = [
  {
    id: 'will', center: [-0.36, 0.28, -0.89], color: '#ffc87c', count: 38,
    pattern: [[-.55, -.08], [-.34, .11], [-.12, .02], [.12, .2], [.4, .1], [.18, -.16], [-.12, -.2], [.02, -.42]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7]],
  },
  {
    id: 'memory', center: [0.36, 0.29, -0.89], color: '#fff1d1', count: 36,
    pattern: [[-.46, -.05], [-.3, .21], [-.06, .3], [.22, .22], [.43, .02], [.2, -.19], [-.08, -.27], [-.31, -.18]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [1, 7]],
  },
  {
    id: 'becoming', center: [-0.37, -0.28, -0.89], color: '#f3a76c', count: 36,
    pattern: [[-.03, -.02], [.04, .04], [-.13, .15], [.15, .22], [-.24, .34], [.27, .43], [-.34, .58], [.4, .72]],
    links: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7]],
  },
  {
    id: 'kinship', center: [0.37, -0.3, -0.88], color: '#b9dfe0', count: 36,
    pattern: [[-.43, .1], [-.32, -.02], [-.4, -.15], [.43, .1], [.32, -.02], [.4, -.15], [.02, .2], [-.02, -.22]],
    links: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 6], [4, 6], [2, 7], [5, 7]],
  },
]

function randomGenerator(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const random = randomGenerator(114781)
// The observer sits inside this distant celestial shell, which makes Logos read
// as a surrounding sky instead of a small web floating around the Earth.
export const LOGOS_RADIUS = 21.5

export const stars = themes.flatMap((theme) => {
  const center = new Vector3(...theme.center).normalize()
  const tangent = new Vector3(0, 1, 0).cross(center).normalize()
  const bitangent = center.clone().cross(tangent).normalize()

  return Array.from({ length: theme.count }, (_, index) => {
    const anchor = theme.pattern[index]
    const anchorOffset = anchor ? [anchor[0] * 0.34, anchor[1] * 0.34] : null
    const spread = Math.sqrt(random()) * 0.22
    const offset = anchorOffset ?? [Math.cos(random() * Math.PI * 2) * spread, Math.sin(random() * Math.PI * 2) * spread]
    const position = center.clone()
      .addScaledVector(tangent, offset[0])
      .addScaledVector(bitangent, offset[1])
      .normalize()
      .multiplyScalar(LOGOS_RADIUS + (random() - 0.5) * 1.1)

    return {
      id: `${theme.id}-${index + 1}`,
      theme: theme.id,
      color: theme.color,
      position: position.toArray(),
      magnitude: index < theme.pattern.length ? 2.0 + random() * 0.45 : 0.55 + random() * 0.7,
      phase: random() * Math.PI * 2,
    }
  })
})

export const threads = themes.flatMap((theme) => {
  return theme.links.map(([sourceIndex, targetIndex], index) => ({
    id: `${theme.id}-thread-${index}`,
    source: `${theme.id}-${sourceIndex + 1}`,
    target: `${theme.id}-${targetIndex + 1}`,
    strength: 0.44 + random() * 0.34,
    phase: random() * Math.PI * 2,
  }))
})

export const starById = new Map(stars.map((star) => [star.id, star]))
