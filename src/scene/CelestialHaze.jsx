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
        return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
                   mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv - vec2(.5);
        vec2 drift = vec2(sin(uTime * .021), cos(uTime * .017)) * .025;
        float n = noise((vUv + drift) * 8.0) * .62 + noise((vUv - drift) * 21.0) * .28;
        float blue = exp(-dot((p - vec2(.09,.01)) * vec2(2.0, 2.9), (p - vec2(.09,.01)) * vec2(2.0, 2.9)) * 2.5);
        float gold = exp(-dot((p - vec2(-.29,.18)) * vec2(4.2, 2.6), (p - vec2(-.29,.18)) * vec2(4.2, 2.6)) * 3.3);
        float turquoise = exp(-dot((p - vec2(.33,-.16)) * vec2(4.0, 3.3), (p - vec2(.33,-.16)) * vec2(4.0, 3.3)) * 3.0);
        float veil = max(0.0, blue * (.29 + n * .22) + gold * (.16 + n * .13) + turquoise * (.1 + n * .09));
        vec3 color = mix(vec3(.07,.22,.36), vec3(.52,.33,.13), gold * .59);
        color = mix(color, vec3(.08,.38,.44), turquoise * .35);
        gl_FragColor = vec4(color, veil);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), [])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
  })

  return <mesh position={[0, 0, -6.2]} material={material}>
    <planeGeometry args={[16, 11]} />
  </mesh>
}
