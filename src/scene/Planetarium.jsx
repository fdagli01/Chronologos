import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Preload } from '@react-three/drei'
import { Chronos } from './Chronos.jsx'
import { Logos } from './Logos.jsx'
import { DeepField } from './DeepField.jsx'
import { CelestialHaze } from './CelestialHaze.jsx'

export function Planetarium() {
  return (
    <>
      <color attach="background" args={['#071020']} />
      <ambientLight intensity={1.08} color="#c0d8dc" />
      <directionalLight position={[-4, 5, 7]} intensity={3.1} color="#ffe0a5" />
      <pointLight position={[5, -3, 4]} intensity={27} distance={14} color="#619ac1" />
      <CelestialHaze />
      <DeepField />
      <Logos />
      <Chronos />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.7} luminanceSmoothing={0.22} radius={0.62} />
      </EffectComposer>
      <Preload all />
    </>
  )
}
