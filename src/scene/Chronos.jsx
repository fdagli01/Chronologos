import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Euler, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { createCoastTexture, createEarthTexture } from './earthTexture.js'
import { LivingEarth } from './LivingEarth.jsx'
import { globePoint } from './globePoint.js'

const BRASS = '#bb874e'
const PALE_BRASS = '#e1b575'

function northUpGlobeQuaternion(point, facing, cameraUp) {
  const northPole = new Vector3(0, 1, 0)
  const east = new Vector3().crossVectors(northPole, point)
  if (east.lengthSq() < 1e-8) east.set(0, 0, -1)
  east.normalize()
  const north = new Vector3().crossVectors(point, east).normalize()

  const screenUp = cameraUp.clone().addScaledVector(facing, -cameraUp.dot(facing)).normalize()
  if (screenUp.lengthSq() < 1e-8) screenUp.set(0, 1, 0).addScaledVector(facing, -facing.y).normalize()
  const screenRight = new Vector3().crossVectors(screenUp, facing).normalize()
  screenUp.crossVectors(facing, screenRight).normalize()

  const source = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, north, point))
  const targetFrame = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(screenRight, screenUp, facing))
  return targetFrame.multiply(source.invert())
}

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

export function Chronos({ compassDestination, bookPlaces = [], showBookMarkers = true, onSelectBookPlace }) {
  const earth = useRef()
  const travel = useRef(null)
  const lastRequest = useRef(null)
  const markerPulse = useRef()
  const armillary = useRef()
  const accent = useRef()
  const innerRing = useRef()
  const texture = useMemo(() => createEarthTexture(), [])
  const coastTexture = useMemo(() => createCoastTexture(), [])
  const parentTilt = useMemo(() => new Quaternion().setFromEuler(new Euler(.13, 0, -.12)), [])
  const markerPosition = useMemo(() => compassDestination ? globePoint(compassDestination.longitude, compassDestination.latitude).multiplyScalar(2.015).toArray() : null, [compassDestination])
  const markerOrientation = useMemo(() => compassDestination ? new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), globePoint(compassDestination.longitude, compassDestination.latitude)) : null, [compassDestination])
  const destinationHasBookPin = showBookMarkers && Boolean(compassDestination?.bookId && bookPlaces.some((place) => place.books.some((book) => book.id === compassDestination.bookId)))
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame(({ clock, camera }, delta) => {
    const time = clock.getElapsedTime()
    if (markerPulse.current && compassDestination) markerPulse.current.scale.setScalar(1 + .24 * (.5 + .5 * Math.sin(time * 2.6)))
    if (compassDestination?.requestId !== lastRequest.current) {
      lastRequest.current = compassDestination?.requestId || null
      if (compassDestination) {
        const localPoint = globePoint(compassDestination.longitude, compassDestination.latitude)
        const parentInverse = parentTilt.clone().invert()
        const facing = camera.position.clone().normalize().applyQuaternion(parentInverse)
        const cameraUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).applyQuaternion(parentInverse)
        const target = northUpGlobeQuaternion(localPoint, facing, cameraUp)
        travel.current = { start: earth.current.quaternion.clone(), target, elapsed: 0 }
        if (reducedMotion) earth.current.quaternion.copy(target)
      } else travel.current = null
    }
    if (travel.current) {
      if (!reducedMotion && travel.current.elapsed < 3) {
        travel.current.elapsed = Math.min(3, travel.current.elapsed + delta)
        const progress = travel.current.elapsed / 3
        const eased = progress * progress * (3 - 2 * progress)
        earth.current.quaternion.slerpQuaternions(travel.current.start, travel.current.target, eased)
      }
    } else earth.current.rotation.y += delta * .009
    armillary.current.rotation.y = time * -.0035
    armillary.current.rotation.z = Math.sin(time * .004) * .018
    innerRing.current.rotation.x = 1.07 + Math.sin(time * .055) * .12
    innerRing.current.rotation.z = -.12 + Math.sin(time * .035) * .08
    accent.current.position.set(-3 + Math.sin(time * .065) * 1.5, 2.5 + Math.cos(time * .05), 4)
  })

  return <group rotation={[.13, 0, -.12]}>
    <pointLight ref={accent} position={[-3, 3.5, 4]} intensity={8} distance={11} color="#ffd193" />
    <group ref={earth} rotation={[0, -1.78, 0]}>
      <mesh>
        <sphereGeometry args={[1.95, 96, 64]} />
        <meshStandardMaterial map={texture} bumpMap={coastTexture} bumpScale={.012} metalness={.04} roughness={.9} />
      </mesh>
      <AtmosphericRim />
      <LivingEarth />
      {showBookMarkers && bookPlaces.map((place) => {
        const point = globePoint(place.longitude, place.latitude)
        const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), point)
        const focused = Boolean(compassDestination?.bookId && place.books.some((book) => book.id === compassDestination.bookId))
        return <group key={place.id} position={point.multiplyScalar(2.035).toArray()} quaternion={orientation}
          onClick={(event) => { event.stopPropagation(); onSelectBookPlace?.(place) }}
          onPointerOver={() => { document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = '' }}>
          <mesh><sphereGeometry args={[place.isCluster ? .082 : place.books.length > 1 ? .065 : .047, 16, 12]} /><meshBasicMaterial color="#ffe5ad" toneMapped={false} /></mesh>
          <mesh ref={focused ? markerPulse : undefined}><ringGeometry args={focused ? [.092, .12, 28] : [.075, .091, 28]} /><meshBasicMaterial color={focused ? '#ffe3a3' : '#f2c579'} side={DoubleSide} transparent opacity={.95} depthWrite={false} toneMapped={false} /></mesh>
          {place.books.length > 1 && <Html position={[0, 0, .115]} center distanceFactor={7} occlude style={{ pointerEvents: 'none' }}><span className="atlas-book-marker-count" aria-hidden="true">{place.books.length}</span></Html>}
        </group>
      })}
      {showBookMarkers && markerPosition && !destinationHasBookPin && <group position={markerPosition} quaternion={markerOrientation}>
        <mesh><sphereGeometry args={[.15, 20, 16]} /><meshBasicMaterial color="#ffcf73" transparent opacity={.18} blending={AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[.058, 20, 16]} /><meshBasicMaterial color="#fff0c6" toneMapped={false} /></mesh>
        <mesh ref={markerPulse}><ringGeometry args={[.092, .122, 40]} /><meshBasicMaterial color="#ffcc70" side={DoubleSide} transparent opacity={.96} depthWrite={false} toneMapped={false} /></mesh>
      </group>}
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
