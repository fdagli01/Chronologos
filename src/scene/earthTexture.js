import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import countries from 'world-atlas/countries-110m.json'
import { CanvasTexture, SRGBColorSpace } from 'three'

const WIDTH = 2048
const HEIGHT = 1024

export function createCoastTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const projection = geoEquirectangular().scale(WIDTH / (2 * Math.PI)).translate([WIDTH / 2, HEIGHT / 2])
  ctx.beginPath()
  geoPath(projection, ctx)(feature(countries, countries.objects.land))
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.5
  ctx.stroke()
  return new CanvasTexture(canvas)
}

function randomGenerator(seed) {
  let x = seed
  return () => ((x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296)
}

function drawCompass(ctx, x, y, radius) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(202, 164, 101, .42)'
  ctx.fillStyle = 'rgba(202, 164, 101, .27)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8
    const length = i % 4 === 0 ? radius : radius * 0.48
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, radius * .72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, radius * .12, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '25px Georgia'
  ctx.textAlign = 'center'
  ctx.fillText('N', 0, -radius - 14)
  ctx.restore()
}

function drawMountainChain(ctx, projection, locations, scale = 1) {
  ctx.save()
  ctx.lineCap = 'round'
  locations.forEach(([lon, lat], index) => {
    const [x, y] = projection([lon, lat])
    const size = (index % 3 === 0 ? 15 : 10) * scale
    ctx.strokeStyle = 'rgba(49, 54, 45, .45)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x - size * .85, y + size * .4)
    ctx.lineTo(x, y - size * .8)
    ctx.lineTo(x + size * .9, y + size * .4)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(249, 221, 168, .32)'
    ctx.beginPath()
    ctx.moveTo(x - size * .25, y - size * .36)
    ctx.lineTo(x, y - size * .8)
    ctx.lineTo(x + size * .38, y - size * .18)
    ctx.stroke()
  })
  ctx.restore()
}

function drawAtlasLabel(ctx, projection, text, lon, lat, size = 29) {
  const [x, y] = projection([lon, lat])
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = `italic ${size}px Georgia`
  ctx.letterSpacing = '3px'
  ctx.fillStyle = 'rgba(57, 53, 43, .65)'
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function createEarthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  const random = randomGenerator(20261004)

  const ocean = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  ocean.addColorStop(0, '#174454')
  ocean.addColorStop(.48, '#103648')
  ocean.addColorStop(1, '#0a273b')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Fine paper flecks live in the water as well as on the continents.
  for (let i = 0; i < 22000; i++) {
    ctx.fillStyle = random() > .5 ? 'rgba(240, 205, 146, .075)' : 'rgba(3, 11, 18, .09)'
    ctx.fillRect(random() * WIDTH, random() * HEIGHT, 1 + random() * 3, 1 + random() * 2)
  }

  ctx.strokeStyle = 'rgba(224, 183, 111, .28)'
  ctx.lineWidth = 1
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = (lon + 180) / 360 * WIDTH
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, HEIGHT)
    ctx.stroke()
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = (90 - lat) / 180 * HEIGHT
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(WIDTH, y)
    ctx.stroke()
  }

  const projection = geoEquirectangular()
    .scale(WIDTH / (2 * Math.PI))
    .translate([WIDTH / 2, HEIGHT / 2])
    .precision(.2)
  const land = feature(countries, countries.objects.land)
  const path = geoPath(projection, ctx)

  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(236, 183, 102, .42)'
  ctx.lineWidth = 15
  ctx.stroke()

  ctx.beginPath()
  path(land)
  const parchment = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  parchment.addColorStop(0, '#dec693')
  parchment.addColorStop(.5, '#c7a770')
  parchment.addColorStop(1, '#a88b5d')
  ctx.fillStyle = parchment
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(38, 49, 48, .17)'
  ctx.lineWidth = 1
  for (let x = -HEIGHT; x < WIDTH + HEIGHT; x += 13) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + HEIGHT, HEIGHT)
    ctx.stroke()
  }
  for (let i = 0; i < 15000; i++) {
    ctx.fillStyle = random() > .5 ? 'rgba(246, 218, 162, .15)' : 'rgba(48, 55, 49, .15)'
    ctx.fillRect(random() * WIDTH, random() * HEIGHT, 1 + random() * 3, 1 + random() * 2)
  }
  ctx.restore()

  ctx.beginPath()
  path(land)
  ctx.strokeStyle = '#493d31'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgba(244, 219, 161, .48)'
  ctx.lineWidth = 1.3
  ctx.stroke()

  drawMountainChain(ctx, projection, [[-79, 7], [-77, 0], [-76, -7], [-74, -14], [-71, -23], [-70, -31], [-70, -39]], 1.25)
  drawMountainChain(ctx, projection, [[-115, 34], [-112, 39], [-109, 44], [-106, 49], [-102, 53]], 1)
  drawMountainChain(ctx, projection, [[-7, 31], [-2, 32], [3, 34], [8, 35]], .85)
  drawMountainChain(ctx, projection, [[5, 45], [9, 46], [13, 47], [17, 47]], .82)
  drawMountainChain(ctx, projection, [[70, 35], [76, 33], [82, 31], [88, 29], [94, 28]], 1.2)
  drawMountainChain(ctx, projection, [[35, 10], [38, 7], [40, 4]], .9)

  drawAtlasLabel(ctx, projection, 'EUROPA', 19, 54, 25)
  drawAtlasLabel(ctx, projection, 'AFRICA', 20, 1, 36)
  drawAtlasLabel(ctx, projection, 'ASIA', 85, 49, 43)
  drawAtlasLabel(ctx, projection, 'AMERICA', -101, 43, 28)
  drawAtlasLabel(ctx, projection, 'AMERICA MERIDIONALIS', -59, -19, 22)
  drawAtlasLabel(ctx, projection, 'AUSTRALIA', 135, -23, 23)

  // These are part of the atlas illustration, not historical data points.
  drawCompass(ctx, 250, 670, 74)
  drawCompass(ctx, 1740, 365, 48)

  ctx.fillStyle = 'rgba(222, 191, 132, .34)'
  ctx.textAlign = 'center'
  ctx.font = 'italic 33px Georgia'
  ctx.fillText('MARE  PACIFICUM', 240, 390)
  ctx.fillText('MARE  ATLANTICUM', 1050, 650)
  ctx.fillText('OCEANUS  INDICUS', 1450, 770)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
