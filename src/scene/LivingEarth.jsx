import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector3 } from 'three'
import { createCoastTexture } from './earthTexture.js'

function CoastGlow() {
  const coast = useMemo(() => createCoastTexture(), [])
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCoast: { value: coast } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uCoast;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float coastline = texture2D(uCoast, vUv).r;
        float wave = pow(.5 + .5 * sin(vUv.x * 18.0 + vUv.y * 5.0 - uTime * .22), 6.0);
        gl_FragColor = vec4(1.65, 1.08, .43, coastline * (.08 + .48 * wave));
      }
    `,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }), [coast])
  useFrame(({ clock }) => { material.uniforms.uTime.value = clock.getElapsedTime() })
  return <mesh material={material}>
    <sphereGeometry args={[1.954, 96, 64]} />
  </mesh>
}

// Decorative routes for the ambient prototype; these do not assert historical influence.
const journeys = [
  [[-5, 36], [29, 41]], [[29, 41], [72, 24]],
  [[12, 42], [31, 30]], [[-16, 18], [-65, -12]],
  [[80, 28], [116, 35]], [[-75, 40], [-1, 51]],
]

function globePoint([longitude, latitude]) {
  const phi = (longitude + 180) * Math.PI / 180
  const theta = (90 - latitude) * Math.PI / 180
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
}

export function LivingEarth() {
  const { geometry, particles, samples, material } = useMemo(() => {
    const positions = [], progress = [], phases = []
    const samples = journeys.map(([from, to], index) => {
      const start = globePoint(from), end = globePoint(to)
      const curve = Array.from({ length: 97 }, (_, step) => {
        const t = step / 96
        return start.clone().lerp(end, t).normalize().multiplyScalar(1.968 + Math.sin(t * Math.PI) * .16)
      })
      for (let step = 0; step < 96; step++) {
        positions.push(...curve[step].toArray(), ...curve[step + 1].toArray())
        progress.push(step / 96, (step + 1) / 96)
        phases.push(index * .163, index * .163)
      }
      return curve
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('aProgress', new BufferAttribute(new Float32Array(progress), 1))
    geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1))
    const particles = new BufferGeometry()
    particles.setAttribute('position', new BufferAttribute(new Float32Array(journeys.length * 3), 3))
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aProgress;
        attribute float aPhase;
        varying float vProgress;
        varying float vPhase;
        void main() {
          vProgress = aProgress;
          vPhase = aPhase;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vProgress;
        varying float vPhase;
        void main() {
          float head = fract(uTime * .025 + vPhase);
          float distanceBehind = head - vProgress;
          float trail = step(0.0, distanceBehind) * exp(-distanceBehind * 19.0);
          float fade = smoothstep(0.0, .07, head) * (1.0 - smoothstep(.93, 1.0, head));
          gl_FragColor = vec4(vec3(1.7, 1.0, .34), .12 + trail * fade * .78);
        }
      `,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    })
    return { geometry, particles, samples, material }
  }, [])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    material.uniforms.uTime.value = time
    const positions = particles.attributes.position
    samples.forEach((curve, index) => {
      const t = (time * .025 + index * .163) % 1
      const scaled = t * 96, step = Math.min(95, Math.floor(scaled)), fraction = scaled - step
      const a = curve[step], b = curve[step + 1]
      positions.setXYZ(index, a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction, a.z + (b.z - a.z) * fraction)
    })
    positions.needsUpdate = true
  })

  return <group>
    <CoastGlow />
    <lineSegments geometry={geometry} material={material} />
    <points geometry={particles} frustumCulled={false}>
      <shaderMaterial transparent depthWrite={false} blending={AdditiveBlending}
        vertexShader={`
          void main() {
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
            gl_PointSize = 82.0 / max(1.0, -p.z);
          }
        `}
        fragmentShader={`
          void main() {
            float r = length(gl_PointCoord - .5);
            float glow = exp(-r*r*22.0);
            gl_FragColor = vec4(2.1, 1.25, .43, glow * .85);
          }
        `}
      />
    </points>
  </group>
}
