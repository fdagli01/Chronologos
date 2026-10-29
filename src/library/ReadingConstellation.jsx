import { t } from '../i18n/index.js'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GOLD = new THREE.Color('#f6c875')
const IVORY = new THREE.Color('#fff3ce')
const DUSK = new THREE.Color('#8ca9ba')

function makeStars(count, completed) {
  const positions = []
  for (let index = 0; index < count; index += 1) {
    const band = index % 3
    const angle = index * 2.399963229728653
    const radius = [0.76, 1.42, 2.08][band] + ((index * 17) % 13) / 100
    positions.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.59 + Math.sin(index * 0.81) * 0.14,
      Math.sin(index * 1.71) * 0.72 + Math.cos(angle) * 0.18,
    ])
  }
  return positions.map((position, index) => ({ position, lit: index < completed }))
}

function StarField({ target, completed, books, birthIndex, selectedIndex, showFullPath, onBookOpen, onHoverBook }) {
  const mesh = useRef(null)
  const targetMesh = useRef(null)
  const hoveredIndex = useRef(-1)
  const stars = useMemo(() => makeStars(Math.min(500, Math.max(target || 0, completed)), completed), [target, completed])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const context = canvas.getContext('2d')
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.16, 'rgba(255,255,255,.78)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,.24)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(canvas)
  }, [])
  const glowGeometry = useMemo(() => {
    const visible = stars.filter((star, index) => star.lit && index !== selectedIndex)
    const positions = visible.flatMap((star) => star.position)
    const colors = visible.flatMap((star, index) => {
      const color = new THREE.Color(index % 5 === 0 ? '#fff0c7' : '#f0bb61')
      return color.toArray()
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [stars, selectedIndex])
  const selectedGlowGeometry = useMemo(() => {
    const star = stars[selectedIndex]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(star?.lit ? star.position : [], 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(star?.lit ? new THREE.Color('#fff6d8').toArray() : [], 3))
    return geometry
  }, [stars, selectedIndex])

  useLayoutEffect(() => {
    if (!mesh.current) return
    stars.forEach((star, index) => {
      dummy.position.set(...star.position)
      const depthScale = 0.72 + (Math.sin(index * 1.71) + 1) * 0.13
      const scale = star.lit ? (index === birthIndex || index === selectedIndex ? 0.078 : 0.061 * depthScale) : 0.0001
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
      const color = star.lit ? (index === birthIndex ? IVORY : GOLD) : DUSK
      mesh.current.setColorAt(index, color)
      if (targetMesh.current) {
        dummy.position.set(...star.position)
        dummy.rotation.set(0, 0, index * 1.9)
        dummy.scale.setScalar(star.lit ? 0.0001 : 1)
        dummy.updateMatrix()
        targetMesh.current.setMatrixAt(index, dummy.matrix)
        targetMesh.current.setColorAt(index, DUSK)
      }
    })
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    if (targetMesh.current) {
      targetMesh.current.instanceMatrix.needsUpdate = true
      if (targetMesh.current.instanceColor) targetMesh.current.instanceColor.needsUpdate = true
    }
  }, [stars, dummy, birthIndex])

  const links = []
  if (showFullPath) {
    for (let index = 1; index < Math.min(completed, stars.length); index += 1) {
      links.push(...stars[index - 1].position, ...stars[index].position)
    }
  } else if (selectedIndex >= 0 && selectedIndex < Math.min(completed, stars.length)) {
    if (selectedIndex > 0) links.push(...stars[selectedIndex - 1].position, ...stars[selectedIndex].position)
    if (selectedIndex + 1 < Math.min(completed, stars.length)) links.push(...stars[selectedIndex].position, ...stars[selectedIndex + 1].position)
  }
  if (birthIndex >= 0 && birthIndex < Math.min(completed, stars.length)) {
    if (!showFullPath && selectedIndex < 0) {
      const origin = stars[birthIndex].position
      const neighbors = [birthIndex - 1, birthIndex + 1].filter((index) => index >= 0 && index < Math.min(completed, stars.length))
      neighbors.forEach((index) => links.push(...origin, ...stars[index].position))
    }
  }

  return <>
    {stars.some((star) => star.lit) && <points geometry={glowGeometry} renderOrder={1}>
      <pointsMaterial map={glowTexture} vertexColors size={completed > 90 ? 0.14 : 0.2} transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation toneMapped={false} />
    </points>}
    {selectedIndex >= 0 && stars[selectedIndex]?.lit && <points geometry={selectedGlowGeometry} renderOrder={1}>
      <pointsMaterial map={glowTexture} vertexColors size={0.32} transparent opacity={0.62} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation toneMapped={false} />
    </points>}
    {stars.length > 0 && <instancedMesh ref={targetMesh} args={[undefined, undefined, stars.length]} renderOrder={2}>
      <torusGeometry args={[0.043, 0.006, 4, 14]} />
      <meshBasicMaterial vertexColors transparent opacity={0.82} toneMapped={false} />
    </instancedMesh>}
    {stars.length > 0 && <instancedMesh ref={mesh} args={[undefined, undefined, stars.length]} renderOrder={3} onClick={(event) => {
      event.stopPropagation()
      const star = stars[event.instanceId]
      if (star?.lit && books[event.instanceId]) onBookOpen(books[event.instanceId].id)
    }} onPointerMove={(event) => {
      if (hoveredIndex.current === event.instanceId) return
      hoveredIndex.current = event.instanceId
      const book = stars[event.instanceId]?.lit ? books[event.instanceId] : null
      onHoverBook(book ? { ...book, starIndex: event.instanceId } : null)
      document.body.style.cursor = book ? 'pointer' : ''
    }} onPointerOut={() => { hoveredIndex.current = -1; onHoverBook(null); document.body.style.cursor = '' }}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>}
    {links.length > 0 && <lineSegments>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(links), 3]} /></bufferGeometry>
      <lineBasicMaterial color="#f3cd87" transparent opacity={showFullPath ? 0.34 : 0.72} depthWrite={false} />
    </lineSegments>}
  </>
}

function BirthEvent({ position, reducedMotion }) {
  const light = useRef(null)
  const ring = useRef(null)
  const ringMaterial = useRef(null)
  const elapsed = useRef(0)
  const origin = useMemo(() => new THREE.Vector3(position[0], position[1] - 1.25, position[2] - 0.3), [position])
  const destination = useMemo(() => new THREE.Vector3(...position), [position])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(origin, new THREE.Vector3(position[0] - 0.45, position[1] - 0.25, position[2] + 0.25), destination), [origin, destination, position])
  useFrame((_, delta) => {
    elapsed.current += delta
    const progress = Math.min(1, elapsed.current / 1.35)
    if (light.current) {
      light.current.position.copy(curve.getPoint(progress))
      light.current.visible = progress < 0.96
    }
    if (ring.current) ring.current.scale.setScalar(0.35 + progress * 1.35)
    if (ringMaterial.current) ringMaterial.current.opacity = Math.max(0, 0.8 * (1 - progress))
  })
  return <group>
    <line>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[curve.getPoints(24).flatMap((point) => point.toArray()), 3]} /></bufferGeometry>
      <lineBasicMaterial color="#e9d19b" transparent opacity={reducedMotion ? 0.12 : 0.16} depthWrite={false} />
    </line>
    <mesh ref={light} position={origin.toArray()}>
      <sphereGeometry args={[0.045, 12, 10]} />
      <meshBasicMaterial color="#fff0c7" toneMapped={false} />
    </mesh>
    <mesh ref={ring} position={position} rotation={[0.3, 0.2, 0.1]}>
      <torusGeometry args={[0.09, 0.009, 6, 48]} />
      <meshBasicMaterial ref={ringMaterial} color="#edcf92" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  </group>
}

function ReadingCrescent({ item, index, onBookOpen, onHoverBook, reducedMotion }) {
  const marker = useRef(null)
  const phase = index * 1.91
  let hash = 2166136261
  for (const character of String(item.id)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2
  const radius = 2.57
  const position = [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.59, Math.sin(index * 1.37) * 0.2]
  useFrame(({ clock }) => {
    if (!marker.current || reducedMotion) return
    const pulse = 0.96 + Math.sin(clock.elapsedTime * 1.45 + phase) * 0.055
    marker.current.scale.setScalar(pulse)
  })
  return <group ref={marker} position={position} rotation={[0.24, 0.08, angle + 0.4]} onClick={(event) => { event.stopPropagation(); onBookOpen(item.id) }} onPointerOver={(event) => {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
    const percent = item.progressPercent ?? (item.pageCount && item.currentPage !== null ? Math.round((item.currentPage / item.pageCount) * 100) : null)
    onHoverBook({ ...item, starIndex: -1, progressPercent: percent })
  }} onPointerOut={() => { document.body.style.cursor = ''; onHoverBook(null) }}>
    <mesh>
      <torusGeometry args={[0.075, 0.012, 6, 28, Math.PI * 1.48]} />
      <meshBasicMaterial color="#72dce8" toneMapped={false} />
    </mesh>
    <mesh scale={1.48}>
      <torusGeometry args={[0.075, 0.004, 4, 28, Math.PI * 1.48]} />
      <meshBasicMaterial color="#72dce8" transparent opacity={0.42} depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0.012, -0.014, 0.016]}>
      <sphereGeometry args={[0.026, 10, 8]} />
      <meshBasicMaterial color="#effff0" toneMapped={false} />
    </mesh>
  </group>
}

function ReadingConstellationLayer({ books, onBookOpen, onHoverBook, reducedMotion }) {
  const rail = useRef(null)
  const shown = [...books].sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, 18)
  return <group ref={rail} rotation={[0.18, 0.15, 0]}>
    <mesh rotation={[0.38, 0.16, 0.38]}>
      <torusGeometry args={[2.57, 0.004, 4, 180]} />
      <meshBasicMaterial color="#59cbd9" transparent opacity={0.32} depthWrite={false} />
    </mesh>
    {shown.map((item, index) => <ReadingCrescent key={item.id} item={item} index={index} onBookOpen={onBookOpen} onHoverBook={onHoverBook} reducedMotion={reducedMotion} />)}
  </group>
}

function Armillary({ target, completed, books, readingBooks, birth, birthIndex, selectedIndex, showFullPath, onBookOpen, onHoverBook, reducedMotion }) {
  const assembly = useRef(null)
  const time = useRef(0)
  useFrame((_, delta) => {
    if (!assembly.current || reducedMotion) return
    time.current += delta
    assembly.current.rotation.y = Math.sin(time.current * 0.16) * 0.055
    assembly.current.rotation.x = Math.sin(time.current * 0.11) * 0.027
    assembly.current.rotation.z = Math.cos(time.current * 0.13) * 0.018
  })
  return <group ref={assembly} rotation={[0.15, -0.22, -0.12]}>
    <mesh>
      <sphereGeometry args={[0.12, 28, 24]} />
      <meshBasicMaterial color="#f5dba3" toneMapped={false} />
    </mesh>
    <mesh scale={1.65}>
      <sphereGeometry args={[0.12, 24, 18]} />
      <meshBasicMaterial color="#edca8d" transparent opacity={0.11} depthWrite={false} />
    </mesh>
    <mesh rotation={[0.28, 0.12, 0.18]}>
      <torusGeometry args={[0.82, 0.015, 6, 144]} />
      <meshBasicMaterial color="#d6a85d" transparent opacity={0.86} />
    </mesh>
    <mesh rotation={[1.13, 0.32, -0.12]}>
      <torusGeometry args={[1.48, 0.013, 6, 160]} />
      <meshBasicMaterial color="#c69a55" transparent opacity={0.76} />
    </mesh>
    <mesh rotation={[0.44, 0.75, 1.23]}>
      <torusGeometry args={[2.13, 0.011, 6, 180]} />
      <meshBasicMaterial color="#bb965e" transparent opacity={0.68} />
    </mesh>
    <mesh rotation={[0.86, 0.12, -0.48]}>
      <torusGeometry args={[2.33, 0.006, 4, 180]} />
      <meshBasicMaterial color="#d4b676" transparent opacity={0.48} />
    </mesh>
    {birth && birthIndex >= 0 && <BirthEvent key={birth.key} position={makeStars(Math.max(target || 0, completed), completed)[birthIndex].position} reducedMotion={reducedMotion} />}
    <StarField target={target} completed={completed} books={books} birthIndex={birthIndex} selectedIndex={selectedIndex} showFullPath={showFullPath} onBookOpen={onBookOpen} onHoverBook={onHoverBook} key={birth?.key || 'steady'} />
    {readingBooks.length > 0 && <ReadingConstellationLayer books={readingBooks} onBookOpen={onBookOpen} onHoverBook={onHoverBook} reducedMotion={reducedMotion} />}
  </group>
}

function StaticFallback({ target, completed, readingCount }) {
  const count = Math.min(500, Math.max(target || 0, completed))
  return <div className="reading-orbit__fallback" aria-hidden="true">
    <i className="reading-orbit__fallback-ring reading-orbit__fallback-ring--one" />
    <i className="reading-orbit__fallback-ring reading-orbit__fallback-ring--two" />
    <i className="reading-orbit__fallback-ring reading-orbit__fallback-ring--three" />
    {readingCount > 0 && <i className="reading-orbit__fallback-reading-rail" />}
    <i className="reading-orbit__fallback-core" />
    {Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963229728653
      const radius = [14, 25, 37][index % 3]
      return <i key={index} className={`reading-orbit__fallback-star${index < completed ? ' is-lit' : ''}`} style={{ '--star-x': `${50 + Math.cos(angle) * radius}%`, '--star-y': `${50 - Math.sin(angle) * radius * 0.52}%` }} />
    })}
    {Array.from({ length: Math.min(readingCount, 18) }, (_, index) => {
      const angle = (index / Math.max(1, Math.min(readingCount, 18))) * Math.PI * 2
      return <i key={`reading-${index}`} className="reading-orbit__fallback-reading-star" style={{ '--star-x': `${50 + Math.cos(angle) * 43}%`, '--star-y': `${50 - Math.sin(angle) * 28}%` }} />
    })}
  </div>
}

export default function ReadingConstellation(props) {
  const [showFullPath, setShowFullPath] = useState(false)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { target, completed } = props
  return <>
    <Canvas className="reading-orbit__canvas" aria-hidden="true" camera={{ position: [0, 0, 6.7], fov: 40 }} dpr={[1, 1.5]} frameloop={reducedMotion ? 'demand' : 'always'} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} fallback={<StaticFallback target={target} completed={completed} readingCount={props.readingBooks?.length || 0} />}>
      <ambientLight intensity={0.75} />
      <pointLight position={[-3, 3, 4]} intensity={24} color="#a8d5e3" />
      <pointLight position={[2, 1.5, 2]} intensity={28} color="#efd39b" />
      <Armillary {...props} showFullPath={showFullPath} selectedIndex={props.selectedIndex ?? -1} reducedMotion={reducedMotion} />
    </Canvas>
    {completed > 1 && <button type="button" className="reading-orbit__path-toggle" aria-pressed={showFullPath} onClick={() => setShowFullPath((value) => !value)}>{showFullPath ? t("Yolu gizle") : t("Tüm okuma yolunu göster")}</button>}
  </>
}
