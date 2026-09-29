import { app, BrowserWindow, dialog, shell, utilityProcess } from 'electron'
import { backup, DatabaseSync } from 'node:sqlite'
import http from 'node:http'
import net from 'node:net'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = app.isPackaged ? join(process.resourcesPath, 'web') : join(projectRoot, 'dist')
const serverEntry = app.isPackaged
  ? join(process.resourcesPath, 'server', 'index.js')
  : join(projectRoot, 'server', 'index.js')
const webHost = '127.0.0.1'
const webPort = Number(process.env.CHRONOLOGOS_WEB_PORT || 4173)
const apiPortStart = Number(process.env.CHRONOLOGOS_API_PORT || 4178)
const appOrigin = `http://${webHost}:${webPort}`
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

app.setName('Chronologos')
app.setPath('userData', join(app.getPath('appData'), 'Chronologos'))
mkdirSync(app.getPath('userData'), { recursive: true })

let mainWindow
let apiProcess
let webServer
let quitting = false

function isPortAvailable(port, host = webHost) {
  return new Promise((resolveAvailability) => {
    const tester = net.createServer()
    tester.once('error', () => resolveAvailability(false))
    tester.listen(port, host, () => tester.close(() => resolveAvailability(true)))
  })
}

async function findApiPort() {
  for (let port = apiPortStart; port < apiPortStart + 64; port += 1) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error('Chronologos için boş bir API portu bulunamadı.')
}

async function migrateDevelopmentDatabase(databasePath) {
  if (app.isPackaged || existsSync(databasePath)) return
  const sourcePath = join(projectRoot, 'server', 'data', 'chronologos.sqlite')
  if (!existsSync(sourcePath)) return

  await mkdir(dirname(databasePath), { recursive: true })
  const source = new DatabaseSync(sourcePath, { readOnly: true, timeout: 5000 })
  try {
    await backup(source, databasePath)
  } finally {
    source.close()
  }
}

async function waitForApi(port) {
  const healthUrl = `http://${webHost}:${port}/api/health`
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {
      // The API process can take a moment to open SQLite and apply migrations.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error('Chronologos veritabanı servisi zamanında başlamadı.')
}

async function startApi() {
  const databasePath = join(app.getPath('userData'), 'chronologos.sqlite')
  await migrateDevelopmentDatabase(databasePath)
  const apiPort = await findApiPort()
  const serverDirectory = dirname(serverEntry)

  apiProcess = utilityProcess.fork(serverEntry, [], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      API_HOST: webHost,
      API_PORT: String(apiPort),
      DATABASE_PATH: databasePath,
    },
    serviceName: 'Chronologos API',
  })
  apiProcess.on('exit', (code) => {
    if (!quitting && code !== 0) {
      console.error(`Chronologos API exited with code ${code}`)
      dialog.showErrorBox('Chronologos servisi kapandı', 'Uygulamayı kapatıp yeniden açmayı deneyin.')
      app.quit()
    }
  })
  await waitForApi(apiPort)
  return apiPort
}

function safeFilePath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath)
  const normalized = resolve(webRoot, `.${decodedPath}`)
  const root = resolve(webRoot)
  if (normalized !== root && !normalized.startsWith(`${root}${sep}`)) return null
  return normalized
}

function proxyApiRequest(request, response, apiPort) {
  const upstream = http.request({
    hostname: webHost,
    port: apiPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `${webHost}:${apiPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'Chronologos servisine ulaşılamıyor.' }))
  })
  request.pipe(upstream)
}

function serveFile(request, response, pathname) {
  let filePath
  try {
    filePath = safeFilePath(pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }
  if (!filePath) {
    response.writeHead(403).end('Forbidden')
    return
  }

  const isAppRoute = pathname === '/' || ['/atlas', '/library', '/notes'].includes(pathname)
  if (isAppRoute) filePath = join(webRoot, 'index.html')
  const stream = createReadStream(filePath)
  stream.on('error', (error) => {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found')
  })
  stream.on('open', () => {
    response.writeHead(200, {
      'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      'content-type': contentTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') {
      stream.destroy()
      response.end()
    } else {
      stream.pipe(response)
    }
  })
}

async function startWebServer(apiPort) {
  if (!(await isPortAvailable(webPort))) {
    throw new Error(`127.0.0.1:${webPort} başka bir uygulama tarafından kullanılıyor. O uygulamayı kapatıp Chronologos'u yeniden açın.`)
  }
  webServer = http.createServer((request, response) => {
    const url = new URL(request.url || '/', appOrigin)
    if (url.pathname === '/_desktop/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      proxyApiRequest(request, response, apiPort)
      return
    }
    serveFile(request, response, url.pathname)
  })
  await new Promise((resolveListen, rejectListen) => {
    webServer.once('error', rejectListen)
    webServer.listen(webPort, webHost, resolveListen)
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    fullscreen: true,
    autoHideMenuBar: true,
    icon: join(projectRoot, 'electron', 'icon.ico'),
    backgroundColor: '#070b12',
    show: true,
    title: 'Chronologos',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11' || (input.key === 'Escape' && mainWindow?.isFullScreen())) {
      event.preventDefault()
      mainWindow?.setFullScreen(input.key === 'F11' ? !mainWindow.isFullScreen() : false)
    }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let isLocalUrl = false
    try { isLocalUrl = new URL(url).origin === appOrigin } catch { /* deny malformed URLs */ }
    if (!isLocalUrl) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = undefined })
  void mainWindow.loadURL(`${appOrigin}/atlas`)
}

function stopServices() {
  quitting = true
  if (webServer?.listening) webServer.close()
  if (apiProcess) apiProcess.kill()
}

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('before-quit', stopServices)
  app.on('window-all-closed', () => app.quit())

  app.whenReady().then(async () => {
    const apiPort = await startApi()
    await startWebServer(apiPort)
    createMainWindow()
  }).catch((error) => {
    console.error(error)
    dialog.showErrorBox('Chronologos açılamadı', error instanceof Error ? error.message : String(error))
    app.quit()
  })
}
