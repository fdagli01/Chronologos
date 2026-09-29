function coordinateIsPresent(value, limit) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit
}

export function groupBookPlaces(books) {
  const places = new Map()
  for (const book of books) {
    if (!coordinateIsPresent(book.settingLatitude, 90) || !coordinateIsPresent(book.settingLongitude, 180)) continue
    const latitude = Number(book.settingLatitude)
    const longitude = Number(book.settingLongitude)
    const label = (book.settingLabel || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`).trim()
    const key = `${label.toLocaleLowerCase('tr')}|${latitude.toFixed(2)}|${longitude.toFixed(2)}`
    if (!places.has(key)) places.set(key, { id: key, label, latitude, longitude, books: [] })
    places.get(key).books.push(book)
  }
  return [...places.values()]
}

const CLUSTER_RADIUS = 0.095

function angularDistance(left, right) {
  const lat1 = left.latitude * Math.PI / 180
  const lat2 = right.latitude * Math.PI / 180
  const deltaLat = lat2 - lat1
  const deltaLon = (right.longitude - left.longitude) * Math.PI / 180
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  return 2 * Math.asin(Math.sqrt(Math.min(1, haversine)))
}

function clusterCenter(places) {
  let x = 0
  let y = 0
  let z = 0
  for (const place of places) {
    const latitude = place.latitude * Math.PI / 180
    const longitude = place.longitude * Math.PI / 180
    const weight = Math.max(1, place.books.length)
    x += Math.cos(latitude) * Math.cos(longitude) * weight
    y += Math.sin(latitude) * weight
    z += Math.cos(latitude) * Math.sin(longitude) * weight
  }
  return {
    latitude: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI,
    longitude: Math.atan2(z, x) * 180 / Math.PI,
  }
}

export function clusterBookPlaces(places) {
  const clusters = []
  const sorted = [...places].sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude || a.id.localeCompare(b.id))
  for (const place of sorted) {
    let bestCluster = null
    let bestDistance = Infinity
    for (const cluster of clusters) {
      const distance = angularDistance(place, cluster.center)
      if (distance >= CLUSTER_RADIUS || distance >= bestDistance) continue
      if (cluster.places.every((member) => angularDistance(place, member) < CLUSTER_RADIUS)) {
        bestCluster = cluster
        bestDistance = distance
      }
    }
    if (bestCluster) {
      bestCluster.places.push(place)
      bestCluster.center = clusterCenter(bestCluster.places)
    } else {
      clusters.push({ places: [place], center: { latitude: place.latitude, longitude: place.longitude } })
    }
  }

  return clusters.map(({ places: members, center }) => {
    if (members.length === 1) return { ...members[0], isCluster: false, placeCount: 1 }
    const ids = members.map((place) => place.id).sort()
    return {
      id: `cluster:${JSON.stringify(ids)}`,
      label: 'Yakın konumlar',
      latitude: center.latitude,
      longitude: center.longitude,
      books: members.flatMap((place) => place.books),
      places: members,
      placeCount: members.length,
      isCluster: true,
    }
  })
}

export function hasBookCoordinates(book) {
  return coordinateIsPresent(book?.settingLatitude, 90) && coordinateIsPresent(book?.settingLongitude, 180)
}
