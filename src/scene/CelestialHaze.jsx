import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, ShaderMaterial } from 'three'

export function CelestialHaze() {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
                   mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
      }
      void main() {
        vec2 uv = vUv;
        float t = uTime;
        vec2 flow = vec2(t * 0.0018, sin(t * 0.015) * 0.025);
        float cloud = noise((uv + flow) * 4.0) * 0.65 + noise((uv - flow * 0.53) * 9.0) * 0.35;
        float ridge = sin(uv.x * 8.0 - uv.y * 5.0 + t * 0.026 + cloud * 2.2);
        float ribbon = pow(max(0.0, ridge), 3.0);
        float left = exp(-pow((uv.x - 0.18) / 0.23, 2.0) - pow((uv.y - 0.35) / 0.42, 2.0));
        float right = exp(-pow((uv.x - 0.79) / 0.27, 2.0) - pow((uv.y - 0.62) / 0.34, 2.0));
        float center = exp(-pow((uv.x - 0.51) / 0.23, 2.0) - pow((uv.y - 0.50) / 0.34, 2.0));
        float presence = (left * 0.52 + right * 0.82) * (0.32 + cloud * 0.55 + ribbon * 0.5);
        presence *= 1.0 - center * 0.82;
        vec3 color = mix(vec3(0.08, 0.25, 0.50), vec3(0.18, 0.63, 0.92), cloud);
        gl_FragColor = vec4(color, clamp(presence * 0.32, 0.0, 0.30));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useFrame(({ clock }) => {
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    material.uniforms.uTime.value = clock.getElapsedTime()
  })

  return <mesh position={[0, 0, -80]} material={material}>
    <planeGeometry args={[210, 118]} />
  </mesh>
}
