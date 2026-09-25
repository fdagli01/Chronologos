import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { Planetarium } from './scene/Planetarium.jsx'

export default function App() {
  return (
    <main className="painting" aria-label="Chronologos: a living atlas of thought">
      <Canvas
        className="painting__canvas"
        camera={{ position: [0, 0.12, 10.7], fov: 42, near: 0.1, far: 100 }}
        dpr={[1, 1.65]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.3
        }}
      >
        <Suspense fallback={null}>
          <Planetarium />
        </Suspense>
      </Canvas>
      <div className="painting__grain" aria-hidden="true" />
      <div className="painting__vignette" aria-hidden="true" />
      <div className="inscription inscription--top" aria-hidden="true">
        <span className="inscription__rule" />
        <span>CHRONOLOGOS</span>
        <span className="inscription__rule" />
      </div>
      <div className="inscription inscription--bottom" aria-hidden="true">
        <span>AN ATLAS OF THOUGHT</span>
        <span className="inscription__diamond">✦</span>
        <span>CHRONOS · LOGOS</span>
      </div>
    </main>
  )
}
