import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Sphere, Vector3 } from 'three'
import { stars, threads, starById } from '../data/universe.js'

const REVEAL_DURATION = 16
const ambientThemeIds = [...new Set(stars.map((star) => star.theme))]
const chronosOccluder = new Sphere(new Vector3(), 2.56)
const occlusionHit = new Vector3()

const starVertex = `
  attribute float aMagnitude;
  attribute float aPhase;
  attribute float aAnchor;
  attribute float aFresh;
  attribute float aSelected;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uAnchorReveal;
  uniform float uNeighborReveal;
  uniform float uFreshReveal;
  uniform float uSelectionPulse;
  varying vec3 vColor;
  varying float vPulse;
  varying float vReveal;
  varying float vDepth;
  varying float vSelected;
  void main() {
    vColor = aColor;
    vSelected = aSelected;
    vPulse = 0.88 + 0.12 * sin(uTime * 0.46 + aPhase) + aSelected * (0.16 + 0.13 * uSelectionPulse);
    float themeReveal = mix(uNeighborReveal, uAnchorReveal, aAnchor);
    vReveal = mix(themeReveal, uFreshReveal, aFresh);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
    float focusSize = 0.76 + 0.5 * vReveal;
    gl_PointSize = min(30.0, (104.0 * aMagnitude * focusSize + aSelected * (8.0 + 3.0 * uSelectionPulse)) / max(1.0, vDepth));
  }
`

const starFragment = `
  varying vec3 vColor;
  varying float vPulse;
  varying float vReveal;
  varying float vDepth;
  varying float vSelected;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float halo = exp(-radius * radius * 11.0) * 0.42;
    float core = smoothstep(0.16, 0.008, radius);
    float depthFade = 1.0 - smoothstep(44.0, 72.0, vDepth) * 0.5;
    float visibility = max(mix(0.14, 1.0, vReveal), vSelected * (0.78 + 0.22 * uSelectionPulse));
    float selectedHalo = vSelected * exp(-radius * radius * 5.0) * 0.38;
    float alpha = (halo + core + selectedHalo) * vPulse * depthFade * visibility;
    if (alpha < 0.018) discard;
    float warmth = 1.25 + core * (3.0 + 1.2 * vReveal);
    gl_FragColor = vec4(vColor * warmth, alpha);
  }
`

const threadVertex = `
  attribute float aPhase;
  attribute float aStrength;
  uniform float uTime;
  uniform float uReveal;
  varying float vOpacity;
  varying float vDepth;
  void main() {
    float breathe = 0.9 + 0.1 * sin(uTime * 0.28 + aPhase);
    vOpacity = aStrength * (0.035 + 0.62 * uReveal) * breathe;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const threadFragment = `
  varying float vOpacity;
  varying float vDepth;
  void main() {
    float distanceFade = 1.0 - smoothstep(48.0, 72.0, vDepth) * 0.45;
    gl_FragColor = vec4(2.0, 1.26, 0.55, vOpacity * distanceFade);
  }
`

function createStarGeometry(themeId, atlasData, freshNoteId, selectedNoteId) {
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
  geometry.setAttribute('aFresh', new BufferAttribute(new Float32Array(entries.map((star) => star.noteId === freshNoteId ? 1 : 0)), 1))
  geometry.setAttribute('aSelected', new BufferAttribute(new Float32Array(entries.map((star) => star.noteId === selectedNoteId ? 1 : 0)), 1))
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(entries.map((star) => star.phase)), 1))
  geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(entries.flatMap((star) => new Color(star.color).toArray())), 3))
  geometry.userData.noteIds = entries.map((star) => star.noteId)
  return geometry
}

function createThreadGeometry(themeId, atlasData) {
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

function smoothEdge(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

function ConstellationLayer({ themeId, atlasData, freshNoteId, selectedNoteId, registerMaterials, onSelectNote }) {
  const starGeometry = useMemo(() => createStarGeometry(themeId, atlasData, freshNoteId, selectedNoteId), [themeId, atlasData, freshNoteId, selectedNoteId])
  const threadGeometry = useMemo(() => createThreadGeometry(themeId, atlasData), [themeId, atlasData])
  useEffect(() => () => { starGeometry.dispose(); threadGeometry.dispose() }, [starGeometry, threadGeometry])
  const starMaterial = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAnchorReveal: { value: 0 }, uNeighborReveal: { value: 0 }, uFreshReveal: { value: 0 }, uSelectionPulse: { value: 0 } },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])
  const threadMaterial = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
    vertexShader: threadVertex,
    fragmentShader: threadFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useEffect(() => registerMaterials(themeId, { starMaterial, threadMaterial, freshNoteId }), [themeId, registerMaterials, starMaterial, threadMaterial, freshNoteId])

  return <group>
    <lineSegments geometry={threadGeometry} material={threadMaterial} />
    <points geometry={starGeometry} material={starMaterial}
      onClick={(event) => {
        const id = event.object.geometry.userData.noteIds?.[event.index]
        if (!id) return
        const earthHit = event.ray.intersectSphere(chronosOccluder, occlusionHit)
        if (earthHit && event.camera.position.distanceTo(earthHit) < event.camera.position.distanceTo(event.point) - 0.02) return
        event.stopPropagation()
        onSelectNote?.(id)
      }}
      onPointerOver={(event) => { if (event.object.geometry.userData.noteIds?.[event.index]) document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }} />
  </group>
}

export function Logos({ revealRequest, atlasData, selectedNoteId, onSelectNote }) {
  const layers = useRef(new Map())
  const pending = useRef([])
  const schedule = useRef({ active: null, activeNoteId: null, startAt: 0, nextAt: 8, recentlyShown: new Map() })
  const lastRequest = useRef(null)
  const themeIds = useMemo(() => [...new Set([...ambientThemeIds, ...(atlasData?.themes || []).map((theme) => theme.id), ...(atlasData?.nodes || []).filter((note) => !note.themeId).map(() => 'unplaced')])], [atlasData])

  const registerMaterials = useCallback((themeId, materials) => {
    layers.current.set(themeId, materials)
    return () => layers.current.delete(themeId)
  }, [])

  useEffect(() => {
    if (!revealRequest?.id || lastRequest.current === revealRequest.id || !themeIds.includes(revealRequest.themeId || 'unplaced')) return
    if (pending.current.some((request) => request.themeId === revealRequest.themeId)) return
    pending.current.push({ ...revealRequest, themeId: revealRequest.themeId || 'unplaced' })
    lastRequest.current = revealRequest.id
  }, [revealRequest, themeIds])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const state = schedule.current

    if (state.active && time - state.startAt >= REVEAL_DURATION) {
      state.active = null
      state.activeNoteId = null
      state.nextAt = time + 44 + Math.random() * 40
    }

    if (!state.active && (pending.current.length || time >= state.nextAt)) {
      const request = pending.current.shift()
      const themeId = request?.themeId ?? [...themeIds].sort((a, b) =>
        (state.recentlyShown.get(a) ?? -Infinity) - (state.recentlyShown.get(b) ?? -Infinity),
      )[0]
      state.active = themeId
      state.activeNoteId = request?.noteId || null
      state.startAt = time
    state.recentlyShown.set(themeId, time)
    }

    const elapsed = state.active ? time - state.startAt : -1
    const fadeOut = elapsed < 0 ? 0 : 1 - smoothEdge(13, REVEAL_DURATION, elapsed)
    const anchorReveal = elapsed < 0 ? 0 : smoothEdge(0, 3, elapsed) * fadeOut
    const neighborReveal = elapsed < 0 ? 0 : smoothEdge(2, 5, elapsed) * fadeOut
    const threadReveal = elapsed < 0 ? 0 : smoothEdge(3.5, 7, elapsed) * (1 - smoothEdge(13, REVEAL_DURATION, elapsed))
    const freshReveal = elapsed < 0 ? 0 : smoothEdge(0, 2.1, elapsed) * (1 - smoothEdge(7.5, 10.5, elapsed))

    layers.current.forEach((materials, themeId) => {
      const isActive = themeId === state.active
      materials.starMaterial.uniforms.uTime.value = time
      materials.starMaterial.uniforms.uSelectionPulse.value = 0.5 + 0.5 * Math.sin(time * 2.1)
      materials.threadMaterial.uniforms.uTime.value = time
      materials.starMaterial.uniforms.uAnchorReveal.value = isActive ? anchorReveal : 0
      materials.starMaterial.uniforms.uNeighborReveal.value = isActive ? neighborReveal : 0
      materials.starMaterial.uniforms.uFreshReveal.value = isActive && state.activeNoteId && materials.freshNoteId === state.activeNoteId ? freshReveal : 0
      materials.threadMaterial.uniforms.uReveal.value = isActive ? threadReveal : 0
    })
  })

  return <group>
    {themeIds.map((themeId) => <ConstellationLayer key={themeId} themeId={themeId} atlasData={atlasData} freshNoteId={revealRequest?.noteId} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} registerMaterials={registerMaterials} />)}
  </group>
}
