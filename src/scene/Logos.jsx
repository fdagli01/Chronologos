import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'
import { stars, threads, starById } from '../data/universe.js'

const starVertex = `
  attribute float aMagnitude;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    vColor = aColor;
    vPulse = 0.72 + 0.28 * sin(uTime * 0.72 + aPhase);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = min(48.0, (138.0 * aMagnitude) / max(1.0, -viewPosition.z));
  }
`

const starFragment = `
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float halo = exp(-radius * radius * 12.0) * 0.42;
    float core = smoothstep(0.17, 0.008, radius);
    float alpha = (halo + core) * vPulse;
    if (alpha < 0.025) discard;
    gl_FragColor = vec4(vColor * (1.16 + core * 3.0), alpha);
  }
`

const threadVertex = `
  attribute float aPhase;
  attribute float aStrength;
  uniform float uTime;
  varying float vOpacity;
  void main() {
    vOpacity = aStrength * (0.49 + 0.3 * sin(uTime * 0.43 + aPhase));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const threadFragment = `
  varying float vOpacity;
  void main() {
    gl_FragColor = vec4(1.0, 0.71, 0.38, vOpacity);
  }
`

export function Logos() {
  const root = useRef()
  const starMaterial = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, vertexShader: starVertex, fragmentShader: starFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }), [])
  const threadMaterial = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, vertexShader: threadVertex, fragmentShader: threadFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }), [])

  const starGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(stars.flatMap((star) => star.position)), 3))
    geometry.setAttribute('aMagnitude', new BufferAttribute(new Float32Array(stars.map((star) => star.magnitude)), 1))
    geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(stars.map((star) => star.phase)), 1))
    geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(stars.flatMap((star) => new Color(star.color).toArray())), 3))
    return geometry
  }, [])

  const threadGeometry = useMemo(() => {
    const positions = []
    const phases = []
    const strengths = []
    for (const thread of threads) {
      const source = starById.get(thread.source)
      const target = starById.get(thread.target)
      if (!source || !target) continue
      positions.push(...source.position, ...target.position)
      phases.push(thread.phase, thread.phase)
      strengths.push(thread.strength, thread.strength)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phases), 1))
    geometry.setAttribute('aStrength', new BufferAttribute(new Float32Array(strengths), 1))
    return geometry
  }, [])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    root.current.rotation.y = time * 0.005
    root.current.rotation.z = Math.sin(time * 0.006) * 0.025
    starMaterial.uniforms.uTime.value = time
    threadMaterial.uniforms.uTime.value = time
  })

  return <group ref={root}>
    <lineSegments geometry={threadGeometry} material={threadMaterial} />
    <points geometry={starGeometry} material={starMaterial} />
  </group>
}
