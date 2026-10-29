import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Ray, Sphere, Vector2, Vector3 } from 'three'

const projectedPoint = new Vector3()
const worldPoint = new Vector3()
const rayDirection = new Vector3()
const occlusionPoint = new Vector3()
const portalPosition = new Vector3()
const portalAnchorSphere = new Sphere(new Vector3(), 38)
const portalScreenTarget = new Vector2(-0.86, 0.76)
const portalWorldPosition = new Vector3()
const portalProjectedPosition = new Vector3()
const portalRayDirection = new Vector3()
const portalOcclusionPoint = new Vector3()
const nebulaPlaneCenter = new Vector3(0, 0, -82)
const earthSphere = new Sphere(new Vector3(0, 0, 0), 2.56)
const selectionRay = new Ray()
const portalRay = new Ray()

// The photograph, decorative starfield, and note constellations share one
// fixed coordinate frame so the atlas composition stays in place during long
// sessions. Ambient motion lives in the individual layers, not the sky transform.
export function CelestialSphere({ children, selectedPosition, selectedLineRef, selectedPointRef, selectedCardRef, portalElementRef, lensCenterRef }) {
  const sky = useRef()
  const portalAnchorInitialized = useRef(false)

  useFrame(({ camera, size }) => {
    const portal = portalElementRef?.current
    if (portal) {
      sky.current.updateMatrixWorld(true)
      if (!portalAnchorInitialized.current) {
        camera.updateMatrixWorld()
        portalWorldPosition.set(portalScreenTarget.x, portalScreenTarget.y, 0.5).unproject(camera)
        portalRayDirection.subVectors(portalWorldPosition, camera.position).normalize()
        portalRay.set(camera.position, portalRayDirection)
        portalRay.intersectSphere(portalAnchorSphere, portalWorldPosition)
        sky.current.worldToLocal(portalWorldPosition)
        portalPosition.copy(portalWorldPosition)
        portalAnchorInitialized.current = true
      }
      portalWorldPosition.copy(portalPosition)
      sky.current.localToWorld(portalWorldPosition)
      portalProjectedPosition.copy(portalWorldPosition).project(camera)
      const visibleInCamera = portalProjectedPosition.z > -1 && portalProjectedPosition.z < 1
      portalRayDirection.subVectors(portalWorldPosition, camera.position).normalize()
      portalRay.set(camera.position, portalRayDirection)
      const portalEarthHit = portalRay.intersectSphere(earthSphere, portalOcclusionPoint)
      const hiddenByEarth = portalEarthHit && camera.position.distanceTo(portalEarthHit) < camera.position.distanceTo(portalWorldPosition) - 0.02
      const projectedX = (portalProjectedPosition.x * 0.5 + 0.5) * size.width
      const projectedY = (1 - (portalProjectedPosition.y * 0.5 + 0.5)) * size.height
      portal.style.left = `${Math.max(92, Math.min(size.width - 92, projectedX))}px`
      portal.style.top = `${Math.max(76, Math.min(size.height - 90, projectedY))}px`
      portal.style.opacity = visibleInCamera && !hiddenByEarth ? '1' : '0'
      portal.style.pointerEvents = visibleInCamera && !hiddenByEarth ? 'auto' : 'none'
      if (lensCenterRef?.current) {
        // Convert screen NDC into the nebula plane's UVs. The plane is larger
        // than the camera frustum, so directly using screen percentages would
        // offset the lens from the projected portal.
        const backdropDistance = camera.position.distanceTo(nebulaPlaneCenter)
        const visibleHeight = 2 * backdropDistance * Math.tan((camera.fov * Math.PI) / 360)
        const visibleWidth = visibleHeight * camera.aspect
        const visibleU = visibleWidth / 210
        const visibleV = visibleHeight / 118
        lensCenterRef.current.set(
          0.5 + portalProjectedPosition.x * visibleU * 0.5,
          0.5 + portalProjectedPosition.y * visibleV * 0.5,
        )
      }
    }

    const line = selectedLineRef?.current
    const point = selectedPointRef?.current
    const card = selectedCardRef?.current
    if (!line || !selectedPosition || !card) {
      line?.setAttribute('opacity', '0')
      point?.setAttribute('opacity', '0')
      return
    }

    sky.current.updateMatrixWorld(true)
    worldPoint.set(...selectedPosition)
    sky.current.localToWorld(worldPoint)
    projectedPoint.copy(worldPoint).project(camera)
    const starX = (projectedPoint.x * 0.5 + 0.5) * size.width
    const starY = (1 - (projectedPoint.y * 0.5 + 0.5)) * size.height
    const distanceToStar = camera.position.distanceTo(worldPoint)
    rayDirection.subVectors(worldPoint, camera.position).normalize()
    selectionRay.set(camera.position, rayDirection)
    const earthHit = selectionRay.intersectSphere(earthSphere, occlusionPoint)
    const isBehindEarth = earthHit && camera.position.distanceTo(earthHit) < distanceToStar - 0.02
    if (projectedPoint.x < -1 || projectedPoint.x > 1 || projectedPoint.y < -1 || projectedPoint.y > 1 || projectedPoint.z < -1 || projectedPoint.z > 1 || isBehindEarth) {
      line.setAttribute('opacity', '0')
      point?.setAttribute('opacity', '0')
      return
    }

    const rect = card.getBoundingClientRect()
    const viewportLeft = rect.left
    const viewportRight = rect.right
    const viewportTop = rect.top
    const viewportBottom = rect.bottom
    const endX = starX < (viewportLeft + viewportRight) / 2 ? viewportLeft : viewportRight
    const endY = Math.min(viewportBottom - 14, Math.max(viewportTop + 14, starY))
    line.setAttribute('x1', `${starX}`)
    line.setAttribute('y1', `${starY}`)
    line.setAttribute('x2', `${endX}`)
    line.setAttribute('y2', `${endY}`)
    line.setAttribute('opacity', '0.78')
    point?.setAttribute('cx', `${starX}`)
    point?.setAttribute('cy', `${starY}`)
    point?.setAttribute('opacity', '1')
  })

  return <group ref={sky}>{children}</group>
}
