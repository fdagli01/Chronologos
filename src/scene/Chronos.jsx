import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial } from 'three'
import { createEarthTexture } from './earthTexture.js'
import { LivingEarth } from './LivingEarth.jsx'

const BRASS = '#bb874e'
const PALE_BRASS = '#e1b575'

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
    <lineBasicMaterial color={PALE_BRASS} transparent opacity={0.64} />
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
    uniforms: { uTime: { value: 0 } },
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
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float edge = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.0);
        float breath = .88 + .12 * sin(uTime * .27);
        vec3 tint = mix(vec3(.25,.54,.61), vec3(.75,.52,.23), smoothstep(.1,.9,vNormal.y));
        gl_FragColor = vec4(tint, edge * .26 * breath);
      }
    `,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), [])
  useFrame(({ clock }) => { material.uniforms.uTime.value = clock.getElapsedTime() })
  return <mesh material={material}>
    <sphereGeometry args={[2.04, 64, 48]} />
  </mesh>
}

export function Chronos() {
  const earth = useRef()
  const armillary = useRef()
  const accent = useRef()
  const innerRing = useRef()
  const texture = useMemo(() => createEarthTexture(), [])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    earth.current.rotation.y = -1.78 + time * .009
    armillary.current.rotation.y = time * -.0035
    armillary.current.rotation.z = Math.sin(time * .004) * .018
    innerRing.current.rotation.x = 1.07 + Math.sin(time * .055) * .12
    innerRing.current.rotation.z = -.12 + Math.sin(time * .035) * .08
    accent.current.position.set(-3 + Math.sin(time * .065) * 1.5, 2.5 + Math.cos(time * .05), 4)
  })

  return <group rotation={[.13, 0, -.12]}>
    <pointLight ref={accent} position={[-3, 3.5, 4]} intensity={12} distance={11} color="#ffd193" />
    <group ref={earth}>
      <mesh>
        <sphereGeometry args={[1.95, 96, 64]} />
        <meshStandardMaterial map={texture} metalness={.05} roughness={.91} />
      </mesh>
      <AtmosphericRim />
      <LivingEarth />
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
      <group ref={innerRing} rotation={[1.07, .3, -.12]}>
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
