import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Preload } from '@react-three/drei'
import { Chronos } from './Chronos.jsx'
import { Logos } from './Logos.jsx'
import { DeepField } from './DeepField.jsx'
import { CelestialHaze } from './CelestialHaze.jsx'

export function Planetarium() {
  return (
    <>
      <color attach="background" args={['#070c16']} />
      <ambientLight intensity={0.95} color="#afc5d0" />
      <directionalLight position={[-4, 5, 7]} intensity={2.8} color="#ffdb9b" />
      <pointLight position={[5, -3, 4]} intensity={22} distance={14} color="#557fbd" />
      <CelestialHaze />
      <DeepField />
      <Logos />
      <Chronos />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.65} luminanceSmoothing={0.24} radius={0.6} />
      </EffectComposer>
      <Preload all />
    </>
  )
}
