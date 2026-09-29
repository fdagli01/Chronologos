import { Vector3 } from 'three'

// Match the atlas texture and LivingEarth's decorative routes exactly.
export function globePoint(longitude, latitude) {
  const phi = (longitude + 180) * Math.PI / 180
  const theta = (90 - latitude) * Math.PI / 180
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
}
