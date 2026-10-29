const enabled = new URLSearchParams(window.location.search).get('portalBench') === '1'
const listeners = new Set()
let run = null
let completed = null

function percentile(values, fraction) {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  return Math.round(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)] * 10) / 10
}

function publish(report) {
  completed = report
  listeners.forEach((listener) => listener(report))
}

function sampleFrame(now) {
  if (!run) return
  if (run.lastFrame !== null) run.frames.push(now - run.lastFrame)
  run.lastFrame = now
  run.raf = window.requestAnimationFrame(sampleFrame)
}

export function startPortalBenchmark() {
  if (!enabled || run) return
  const now = performance.now()
  run = { startedAt: now, routeAt: null, readyAt: null, frames: [], lastFrame: null, raf: null }
  run.raf = window.requestAnimationFrame(sampleFrame)
}

export function markPortalRouteHandler() {
  if (run && run.routeAt === null) run.routeAt = performance.now()
}

export function markPortalReady() {
  if (run && run.readyAt === null) run.readyAt = performance.now()
}

export function finishPortalBenchmark(timedOut = false) {
  if (!run) return
  const endedAt = performance.now()
  window.cancelAnimationFrame(run.raf)
  const report = {
    phase: timedOut ? 'Timed out' : 'Complete',
    route: run.routeAt === null ? null : Math.round((run.routeAt - run.startedAt) * 10) / 10,
    ready: run.readyAt === null ? null : Math.round((run.readyAt - run.startedAt) * 10) / 10,
    elapsed: Math.round((endedAt - run.startedAt) * 10) / 10,
    frames: { count: run.frames.length, p50: percentile(run.frames, 0.5), p95: percentile(run.frames, 0.95), max: run.frames.length ? Math.round(Math.max(...run.frames) * 10) / 10 : null },
  }
  run = null
  publish(report)
}

export function subscribePortalBenchmark(listener) {
  listeners.add(listener)
  if (completed) listener(completed)
  return () => listeners.delete(listener)
}
