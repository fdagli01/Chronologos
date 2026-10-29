import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

const WARMUP_MS = 3000
const MEASURE_MS = 8000
const MAX_SAMPLES = 10000

function percentile(sorted, fraction) {
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

export function AtlasPerformance({ sceneReady, dataReady, noteCount, linkCount }) {
  const previousFrame = useRef(null)
  const collectionStart = useRef(null)
  const sceneReadyMs = useRef(null)
  const intervals = useRef([])
  const [report, setReport] = useState(null)

  if (sceneReady && sceneReadyMs.current === null) {
    sceneReadyMs.current = performance.now()
  }

  useFrame(({ gl }) => {
    if (report || !sceneReady || !dataReady) return
    const now = performance.now()
    if (collectionStart.current === null) collectionStart.current = now
    const elapsed = now - collectionStart.current
    if (previousFrame.current !== null && elapsed > WARMUP_MS && elapsed <= WARMUP_MS + MEASURE_MS && intervals.current.length < MAX_SAMPLES) {
      intervals.current.push(now - previousFrame.current)
    }
    previousFrame.current = now
    if (elapsed < WARMUP_MS + MEASURE_MS) return

    const sorted = [...intervals.current].sort((a, b) => a - b)
    const dpr = gl.getPixelRatio()
    setReport({
      status: 'complete',
      warmupMs: WARMUP_MS,
      measurementMs: MEASURE_MS,
      frameIntervalsMs: {
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        max: sorted.length ? sorted[sorted.length - 1] : null,
        count: sorted.length,
      },
      archive: { noteCount, linkCount },
      renderer: { dpr },
      navigationToSceneReadyMs: sceneReadyMs.current,
      navigationToSceneReadyScope: 'performance.now() at first three rendered frames; excludes data readiness',
    })
  })

  if (!report) return null
  return <Html fullscreen>
    <aside aria-label="Atlas benchmark status" style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 2147483647, maxWidth: 'min(520px, calc(100vw - 24px))', maxHeight: '40vh', overflow: 'auto', padding: 12, color: '#f4ead6', background: 'rgba(12, 18, 24, .94)', border: '1px solid rgba(215, 185, 126, .6)', borderRadius: 8, font: '12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace', boxShadow: '0 4px 24px rgba(0,0,0,.35)' }}>
      <strong style={{ display: 'block', marginBottom: 6, font: '600 13px/1.3 system-ui, sans-serif' }}>Atlas benchmark · {report.status}</strong>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(report, null, 2)}</pre>
    </aside>
  </Html>
}
