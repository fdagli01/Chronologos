import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace, Vector2 } from 'three'

export function NebulaBackdrop({ lensCenterRef }) {
  const image = useTexture('/images/chronologos-nebula-reference.png?rev=3')
  const material = useRef()
  const uniforms = useMemo(() => ({ uMap: { value: image }, uLensCenter: { value: new Vector2(0.07, 0.88) }, uTime: { value: 0 } }), [image])

  useEffect(() => {
    image.colorSpace = SRGBColorSpace
    image.anisotropy = 4
    image.needsUpdate = true
  }, [image])

  useFrame(({ clock }) => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pageHidden = typeof document !== 'undefined' && document.hidden
    if (material.current && !reduceMotion && !pageHidden) material.current.uniforms.uTime.value = clock.getElapsedTime()
    if (lensCenterRef?.current && material.current) {
      material.current.uniforms.uLensCenter.value.copy(lensCenterRef.current)
    }
  })

  return <mesh position={[0, 0, -82]}>
    <planeGeometry args={[210, 118]} />
    <shaderMaterial
      ref={material}
      uniforms={uniforms}
      toneMapped={false}
      vertexShader={`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform sampler2D uMap;
        uniform vec2 uLensCenter;
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float lightBeam(vec2 uv, vec2 source, vec2 axis, float width) {
          vec2 offset = uv - source;
          float along = dot(offset, axis);
          float across = abs(offset.x * axis.y - offset.y * axis.x);
          float spread = width + max(along, 0.0) * 0.055;
          float body = exp(-pow(across / spread, 2.0));
          float ends = smoothstep(0.015, 0.12, along) * (1.0 - smoothstep(0.58, 0.96, along));
          return body * ends * exp(-max(along, 0.0) * 0.72);
        }
        void main() {
          // The source is portrait-leaning; crop its top and bottom to fill the wide atlas plane.
          vec2 coverUv = vec2(vUv.x, (vUv.y - 0.5) * 0.83 + 0.5);
          vec2 delta = coverUv - uLensCenter;
          float radius = length(delta);
          vec2 direction = delta / max(radius, 0.001);
          float bend = min(0.018, 0.0025 * exp(-radius * 35.0) / (radius + 0.02));
          vec2 warpedUv = clamp(coverUv - direction * bend, vec2(0.001), vec2(0.999));
          vec4 color = sRGBTransferEOTF(texture2D(uMap, warpedUv));
          float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          color.rgb = mix(vec3(luminance), color.rgb, 1.22) * 1.10;
          vec2 drift = vec2(sin(uTime * 0.018), cos(uTime * 0.014)) * 0.025;
          float cloud = noise((coverUv + drift) * 5.0) * 0.62 + noise((coverUv - drift * 0.7) * 11.0) * 0.38;
          float violetCloud = smoothstep(0.35, 0.83, cloud) * (0.45 + 0.55 * sin(coverUv.y * 5.2 + uTime * 0.022));
          float goldCloud = smoothstep(0.52, 0.92, noise((coverUv + vec2(-drift.y, drift.x)) * 4.3)) * (0.5 + 0.5 * sin(coverUv.x * 6.0 - uTime * 0.017));
          color.rgb += vec3(0.035, 0.026, 0.095) * violetCloud * 0.20;
          color.rgb += vec3(0.105, 0.043, 0.012) * goldCloud * 0.22;
          // Broad, low-contrast ice-blue rays breathe slowly from the right edge.
          // Keep most of their energy around the globe so its silhouette stays clear.
          float sweep = sin(uTime * 0.057) * 0.016;
          vec2 axisMain = normalize(vec2(-0.72 - sweep, -0.69 + sweep));
          vec2 axisLow = normalize(vec2(-0.88 + sweep * 0.5, -0.47 - sweep * 0.5));
          vec2 axisHigh = normalize(vec2(-0.57 - sweep * 0.4, -0.82 + sweep * 0.4));
          float rayMain = lightBeam(coverUv, vec2(0.86, 0.80), axisMain, 0.020);
          float rayLow = lightBeam(coverUv, vec2(0.98, 0.70), axisLow, 0.028);
          float rayHigh = lightBeam(coverUv, vec2(0.78, 0.91), axisHigh, 0.014);
          float globeShade = exp(-pow((coverUv.x - 0.50) / 0.24, 2.0) - pow((coverUv.y - 0.51) / 0.34, 2.0));
          float beamSpace = 1.0 - globeShade * 0.72;
          float breatheMain = 0.92 + 0.08 * sin(uTime * 0.069 + 0.4);
          float breatheLow = 0.92 + 0.08 * sin(uTime * 0.057 + 2.1);
          float breatheHigh = 0.92 + 0.08 * sin(uTime * 0.081 + 4.0);
          color.rgb += vec3(0.045, 0.29, 0.82) * rayMain * breatheMain * beamSpace * 0.72;
          color.rgb += vec3(0.025, 0.19, 0.64) * rayLow * breatheLow * beamSpace * 0.58;
          color.rgb += vec3(0.06, 0.36, 0.90) * rayHigh * breatheHigh * beamSpace * 0.44;
          float photonRing = exp(-pow((radius - 0.032) / 0.0055, 2.0));
          float coolHalo = exp(-pow(radius / 0.078, 2.0));
          color.rgb += vec3(0.3, 0.17, 0.075) * photonRing * 0.28;
          color.rgb += vec3(0.018, 0.045, 0.085) * coolHalo * 0.22;
          gl_FragColor = color;
          #include <colorspace_fragment>
        }
      `}
    />
  </mesh>
}
