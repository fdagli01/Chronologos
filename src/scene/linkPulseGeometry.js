import { Vector3 } from 'three'

export function createLinkPulsePositions(sourcePosition, targetPosition, segments = 20) {
  if (!Array.isArray(sourcePosition) || !Array.isArray(targetPosition) || sourcePosition.length !== 3 || targetPosition.length !== 3) return null
  const from = new Vector3(...sourcePosition)
  const to = new Vector3(...targetPosition)
  if (![...from.toArray(), ...to.toArray()].every(Number.isFinite)) return null
  const a = from.clone().normalize(), b = to.clone().normalize()
  const angle = a.angleTo(b), sine = Math.sin(angle), positions = []
  const antipodalAxis = sine < 1e-4 && angle > Math.PI / 2
    ? a.clone().cross(Math.abs(a.x) < 0.8 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize()
    : null
  let previous = from
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const direction = sine < 1e-4
      ? antipodalAxis ? a.clone().multiplyScalar(Math.cos(Math.PI * t)).addScaledVector(antipodalAxis, Math.sin(Math.PI * t)) : a.clone().lerp(b, t).normalize()
      : a.clone().multiplyScalar(Math.sin((1 - t) * angle) / sine).addScaledVector(b, Math.sin(t * angle) / sine)
    const next = direction.multiplyScalar(from.length() * (1 - t) + to.length() * t + Math.sin(Math.PI * t) * 0.08)
    positions.push(...previous.toArray(), ...next.toArray())
    previous = next
  }
  return new Float32Array(positions)
}
