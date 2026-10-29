import { useRef } from 'react'
import { Vector2 } from 'three'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Preload } from '@react-three/drei'
import { Chronos } from './Chronos.jsx'
import { Logos } from './Logos.jsx'
import { DeepField } from './DeepField.jsx'
import { NebulaBackdrop } from './NebulaBackdrop.jsx'
import { CelestialHaze } from './CelestialHaze.jsx'
import { CelestialSphere } from './CelestialSphere.jsx'

export function Planetarium({ revealRequest, linkCreationRequest, compassDestination, bookPlaces, showBookMarkers, onSelectBookPlace, atlasData, selectedNoteId, selectedLineRef, selectedPointRef, selectedCardRef, portalElementRef, onSelectNote }) {
  const selectedPosition = atlasData?.nodes?.find((note) => note.id === selectedNoteId)?.position || null
  const lensCenterRef = useRef(new Vector2(0.3, 0.73))
  return (
    <>
      <color attach="background" args={['#071020']} />
      <ambientLight intensity={0.54} color="#a8bdd8" />
      <directionalLight position={[-4, 5, 7]} intensity={2.45} color="#ffe3b5" />
      <pointLight position={[5, -3, 4]} intensity={14} distance={14} color="#619ac1" />
      <CelestialSphere selectedPosition={selectedPosition} selectedLineRef={selectedLineRef} selectedPointRef={selectedPointRef} selectedCardRef={selectedCardRef} portalElementRef={portalElementRef} lensCenterRef={lensCenterRef}>
        <NebulaBackdrop lensCenterRef={lensCenterRef} />
        <CelestialHaze />
        <DeepField />
        <Logos revealRequest={revealRequest} linkCreationRequest={linkCreationRequest} atlasData={atlasData} selectedNoteId={selectedNoteId} onSelectNote={onSelectNote} />
      </CelestialSphere>
      <Chronos compassDestination={compassDestination} bookPlaces={bookPlaces} showBookMarkers={showBookMarkers} onSelectBookPlace={onSelectBookPlace} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.7} luminanceSmoothing={0.22} radius={0.62} />
      </EffectComposer>
      <Preload all />
    </>
  )
}
