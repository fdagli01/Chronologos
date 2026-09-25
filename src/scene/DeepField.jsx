import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'

function randomGenerator(seed) {
  let x = seed
  return () => ((x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296)
}

export function DeepField() {
  const geometry = useMemo(() => {
    const random = randomGenerator(98623)
    const coordinates = new Float32Array(1350 * 3)
    for (let i = 0; i < 1350; i++) {
      const z = 2 * random() - 1
      const angle = random() * Math.PI * 2
      const radius = 15 + random() * 7
      coordinates[i * 3] = radius * Math.sqrt(1 - z * z) * Math.cos(angle)
      coordinates[i * 3 + 1] = radius * z
      coordinates[i * 3 + 2] = radius * Math.sqrt(1 - z * z) * Math.sin(angle)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(coordinates, 3))
    return result
  }, [])

  return <points geometry={geometry}>
    <pointsMaterial color="#a3abb6" size={0.028} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
  </points>
}
