import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial } from 'three'
import { createEarthTexture } from './earthTexture.js'

const BRASS = '#9e7744'
const PALE_BRASS = '#c9a66d'

function TickRing({ radius = 2.41, count = 96 }) {
  const geometry = useMemo(() => {
    const vertices = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const inner = radius - (i % 8 === 0 ? .12 : i % 2 === 0 ? .07 : .038)
      vertices.push(Math.cos(angle) * inner, Math.sin(angle) * inner, 0)
      vertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    return result
  }, [radius, count])

  return <lineSegments geometry={geometry}>
    <lineBasicMaterial color={PALE_BRASS} transparent opacity={0.48} />
  </lineSegments>
}

function Ring({ radius, tube = .009, opacity = .72 }) {
  return <mesh>
    <torusGeometry args={[radius, tube, 5, 180]} />
    <meshStandardMaterial color={PALE_BRASS} metalness={.84} roughness={.35} transparent opacity={opacity} side={DoubleSide} />
  </mesh>
}

function AtmosphericRim() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 world = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-world.xyz);
        gl_Position = projectionMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float edge = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
        gl_FragColor = vec4(0.33, 0.39, 0.35, edge * 0.18);
      }
    `,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), [])
  return <mesh material={material}>
    <sphereGeometry args={[2.04, 64, 48]} />
  </mesh>
}

export function Chronos() {
  const earth = useRef()
  const armillary = useRef()
  const texture = useMemo(() => createEarthTexture(), [])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    earth.current.rotation.y = -1.78 + time * .009
    armillary.current.rotation.y = time * -.0035
    armillary.current.rotation.z = Math.sin(time * .004) * .018
  })

  return <group rotation={[.13, 0, -.12]}>
    <group ref={earth}>
      <mesh>
        <sphereGeometry args={[1.95, 96, 64]} />
        <meshStandardMaterial map={texture} metalness={.05} roughness={.91} />
      </mesh>
      <AtmosphericRim />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.978, .007, 5, 180]} />
        <meshBasicMaterial color={PALE_BRASS} transparent opacity={.55} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1.985, .005, 5, 180]} />
        <meshBasicMaterial color={PALE_BRASS} transparent opacity={.35} />
      </mesh>
    </group>

    <group ref={armillary}>
      <group rotation={[.12, -.25, .19]}>
        <Ring radius={2.25} tube={.013} opacity={.75} />
        <Ring radius={2.31} tube={.004} opacity={.35} />
        <TickRing radius={2.4} />
      </group>
      <group rotation={[1.07, .3, -.12]}>
        <Ring radius={2.18} tube={.01} opacity={.42} />
      </group>
      <group rotation={[.32, 1.16, .65]}>
        <Ring radius={2.47} tube={.006} opacity={.38} />
      </group>
      <group rotation={[.48, -.55, -1.12]}>
        <Ring radius={2.54} tube={.004} opacity={.26} />
      </group>
      <mesh position={[0, 2.44, 0]}>
        <sphereGeometry args={[.045, 12, 8]} />
        <meshStandardMaterial color={BRASS} metalness={.95} roughness={.24} />
      </mesh>
      <mesh position={[0, -2.44, 0]}>
        <sphereGeometry args={[.045, 12, 8]} />
        <meshStandardMaterial color={BRASS} metalness={.95} roughness={.24} />
      </mesh>
    </group>
  </group>
}
