import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace, Vector2 } from 'three'

export function NebulaBackdrop({ lensCenterRef }) {
  const image = useTexture('/images/chronologos-nebula-background.jpg')
  const material = useRef()
  const uniforms = useMemo(() => ({ uMap: { value: image }, uLensCenter: { value: new Vector2(0.07, 0.88) } }), [image])

  useEffect(() => {
    image.colorSpace = SRGBColorSpace
    image.anisotropy = 4
    image.needsUpdate = true
  }, [image])

  useFrame(() => {
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
        varying vec2 vUv;
        void main() {
          vec2 delta = vUv - uLensCenter;
          float radius = length(delta);
          vec2 direction = delta / max(radius, 0.001);
          float bend = min(0.018, 0.0025 * exp(-radius * 35.0) / (radius + 0.02));
          vec2 warpedUv = clamp(vUv - direction * bend, 0.001, 0.999);
          vec4 color = sRGBTransferEOTF(texture2D(uMap, warpedUv));
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
