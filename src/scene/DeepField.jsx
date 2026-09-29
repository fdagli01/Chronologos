import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three'

function randomGenerator(seed) {
  let x = seed
  return () => ((x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296)
}

export function DeepField() {
  const stars = useRef()
  const geometry = useMemo(() => {
    const random = randomGenerator(98623)
    const coordinates = new Float32Array(2100 * 3)
    const phases = new Float32Array(2100)
    const sizes = new Float32Array(2100)
    for (let i = 0; i < 2100; i++) {
      const z = 2 * random() - 1
      const angle = random() * Math.PI * 2
      const radius = 41 + random() * 20
      coordinates[i * 3] = radius * Math.sqrt(1 - z * z) * Math.cos(angle)
      coordinates[i * 3 + 1] = radius * z
      coordinates[i * 3 + 2] = radius * Math.sqrt(1 - z * z) * Math.sin(angle)
      phases[i] = random() * Math.PI * 2
      sizes[i] = random()
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(coordinates, 3))
    result.setAttribute('aPhase', new BufferAttribute(phases, 1))
    result.setAttribute('aSize', new BufferAttribute(sizes, 1))
    return result
  }, [])

  useFrame(({ clock }) => {
    if (stars.current && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      stars.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return <group>
    <points geometry={geometry}>
      <shaderMaterial ref={stars} transparent depthWrite={false} blending={AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aPhase;
          attribute float aSize;
          uniform float uTime;
          varying float vLight;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = clamp((2.0 + aSize * 2.2) * 46.0 / max(18.0, -viewPosition.z), 1.0, 4.2);
            vLight = 0.44 + 0.32 * sin(uTime * (0.22 + aSize * 0.17) + aPhase);
          }
        `}
        fragmentShader={`
          varying float vLight;
          void main() {
            float r = length(gl_PointCoord - vec2(0.5));
            float glow = exp(-r * r * 25.0);
            gl_FragColor = vec4(0.62, 0.84, 1.0, glow * vLight * 0.8);
          }
        `}
      />
    </points>
  </group>
}
