import { useMemo } from 'react'
import { AdditiveBlending, ShaderMaterial } from 'three'

export function CelestialHaze() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
                   mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv - vec2(.5);
        float n = noise(vUv * 9.0) * .6 + noise(vUv * 22.0) * .25;
        float blue = exp(-dot((p - vec2(.05,.02)) * vec2(2.1, 2.8), (p - vec2(.05,.02)) * vec2(2.1, 2.8)) * 2.7);
        float gold = exp(-dot((p - vec2(-.28,.14)) * vec2(4.8, 2.8), (p - vec2(-.28,.14)) * vec2(4.8, 2.8)) * 4.0);
        float veil = max(0.0, blue * (.22 + n * .16) + gold * (.08 + n * .09));
        vec3 color = mix(vec3(.05,.16,.29), vec3(.32,.23,.13), gold * .47);
        gl_FragColor = vec4(color, veil);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  return <mesh position={[0, 0, -6.2]} material={material}>
    <planeGeometry args={[16, 11]} />
  </mesh>
}
