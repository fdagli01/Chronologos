import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, ShaderMaterial, Sphere, Vector3 } from 'three'
import { createStarGeometry, createThreadGeometry, updateStarHighlights } from './logosGeometry.js'
import { createLinkPulsePositions } from './linkPulseGeometry.js'
import { stars } from '../data/universe.js'

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
  varying float vFresh;
  void main() {
    vColor = aColor;
    vSelected = aSelected;
    vFresh = aFresh * uFreshReveal;
    vPulse = 0.88 + 0.12 * sin(uTime * 0.46 + aPhase) + aSelected * (0.07 + 0.13 * uSelectionPulse);
    float themeReveal = mix(uNeighborReveal, uAnchorReveal, aAnchor);
    vReveal = mix(themeReveal, uFreshReveal, aFresh);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
    float focusSize = 0.76 + 0.5 * vReveal;
    gl_PointSize = min(30.0 + 18.0 * vFresh, (104.0 * aMagnitude * focusSize + aSelected * (8.0 + 3.0 * uSelectionPulse)) / max(1.0, vDepth) + 18.0 * vFresh);
  }
`

const starFragment = `
  uniform float uSelectionPulse;
  varying vec3 vColor;
  varying float vPulse;
  varying float vReveal;
  varying float vDepth;
  varying float vSelected;
  varying float vFresh;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float halo = exp(-radius * radius * 11.0) * 0.42;
    float core = smoothstep(0.16, 0.008, radius);
    float depthFade = 1.0 - smoothstep(44.0, 72.0, vDepth) * 0.5;
    float visibility = max(mix(0.14, 1.0, vReveal), vSelected * (0.78 + 0.22 * uSelectionPulse));
    float selectedHalo = vSelected * exp(-radius * radius * 5.0) * 0.48;
    float ringRadius = 0.18 + (1.0 - uSelectionPulse) * 0.25;
    float selectionRing = exp(-pow((radius - ringRadius) * 19.0, 2.0)) * vSelected * uSelectionPulse * 0.8;
    vec2 offset = abs(gl_PointCoord - vec2(0.5));
    float rays = (exp(-offset.x * 100.0) + exp(-offset.y * 100.0)) * exp(-radius * 8.0) * vFresh * 0.65;
    float alpha = (halo + core + selectedHalo + selectionRing + rays) * vPulse * depthFade * visibility;
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

function smoothEdge(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

function LinkCreationPulse({ request, atlasData }) {
  const geometry = useMemo(() => {
    const source = atlasData?.nodes?.find((node) => node.id === request?.source)
    const target = atlasData?.nodes?.find((node) => node.id === request?.target)
    const positions = createLinkPulsePositions(source?.position, target?.position)
    if (!positions) return null
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    result.setDrawRange(0, 0)
    return result
  }, [request?.id, request?.source, request?.target, atlasData])
  const material = useMemo(() => new LineBasicMaterial({ color: '#ffd68a', transparent: true, opacity: 0, depthWrite: false }), [])
  const started = useRef(null)
  useEffect(() => () => geometry?.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ clock }) => {
    if (!geometry || !request) return
    if (started.current == null) started.current = clock.elapsedTime
    const progress = Math.min(1, (clock.elapsedTime - started.current) / 0.6)
    geometry.setDrawRange(0, Math.ceil(20 * progress) * 2)
    material.opacity = Math.sin(Math.PI * progress) * 0.9
  })
  if (!geometry) return null
  return <lineSegments geometry={geometry} material={material} />
}


function ConstellationLayer({ themeId, atlasData, freshNoteId, selectedNoteId, registerMaterials, onSelectNote }) {
  const starGeometry = useMemo(() => createStarGeometry(themeId, atlasData), [themeId, atlasData])
  const threadGeometry = useMemo(() => createThreadGeometry(themeId, atlasData), [themeId, atlasData])
  useEffect(() => () => starGeometry.dispose(), [starGeometry])
  useEffect(() => () => threadGeometry.dispose(), [threadGeometry])
  useEffect(() => { updateStarHighlights(starGeometry, freshNoteId, selectedNoteId) }, [starGeometry, freshNoteId, selectedNoteId])
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

export function Logos({ revealRequest, linkCreationRequest, atlasData, selectedNoteId, onSelectNote }) {
  const layers = useRef(new Map())
  const pending = useRef([])
  const schedule = useRef({ active: null, activeNoteId: null, startAt: 0, nextAt: 8, recentlyShown: new Map() })
  const lastRequest = useRef(null)
  const selectionFocus = useRef({ id: null, startAt: 0 })
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const themeIds = useMemo(() => [...new Set([...ambientThemeIds, ...(atlasData?.themes || []).map((theme) => theme.id), ...(atlasData?.nodes || []).filter((note) => !note.themeId).map(() => 'unplaced')])], [atlasData])
  const linkExists = Boolean(linkCreationRequest && atlasData?.links?.some((link) => link.id === linkCreationRequest.id))

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const registerMaterials = useCallback((themeId, materials) => {
    layers.current.set(themeId, materials)
    return () => layers.current.delete(themeId)
  }, [])

  useEffect(() => {
    if (!revealRequest?.id || lastRequest.current === revealRequest.id || !themeIds.includes(revealRequest.themeId || 'unplaced')) return
    if (revealRequest.noteId && !atlasData?.nodes?.some((note) => note.id === revealRequest.noteId)) return
    if (pending.current.some((request) => request.themeId === revealRequest.themeId)) return
    if (revealRequest.kind === 'note-created') schedule.current.active = null
    pending.current.push({ ...revealRequest, themeId: revealRequest.themeId || 'unplaced' })
    lastRequest.current = revealRequest.id
  }, [revealRequest, themeIds, atlasData?.nodes])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const state = schedule.current
    if (selectionFocus.current.id !== selectedNoteId) selectionFocus.current = { id: selectedNoteId, startAt: time }
    const focusAge = selectedNoteId ? time - selectionFocus.current.startAt : Infinity
    const selectionPulse = reducedMotion || focusAge > 1.5 ? 0 : Math.max(0, 1 - focusAge / 1.5)

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
    const freshReveal = reducedMotion || elapsed < 0 ? 0 : smoothEdge(0, 2.1, elapsed) * (1 - smoothEdge(7.5, 10.5, elapsed))

    layers.current.forEach((materials, themeId) => {
      const isActive = themeId === state.active
      materials.starMaterial.uniforms.uTime.value = time
      materials.starMaterial.uniforms.uSelectionPulse.value = selectionPulse
      materials.threadMaterial.uniforms.uTime.value = time
      materials.starMaterial.uniforms.uAnchorReveal.value = isActive ? anchorReveal : 0
      materials.starMaterial.uniforms.uNeighborReveal.value = isActive ? neighborReveal : 0
      materials.starMaterial.uniforms.uFreshReveal.value = isActive && state.activeNoteId && materials.freshNoteId === state.activeNoteId ? freshReveal : 0
      materials.threadMaterial.uniforms.uReveal.value = isActive ? threadReveal : 0
    })
  })

  return <group>
    {themeIds.map((themeId) => <ConstellationLayer key={themeId} themeId={themeId} atlasData={atlasData} freshNoteId={revealRequest?.noteId} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} registerMaterials={registerMaterials} />)}
    {!reducedMotion && linkExists && <LinkCreationPulse key={linkCreationRequest.id} request={linkCreationRequest} atlasData={atlasData} />}
  </group>
}
