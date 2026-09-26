import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const processes = [
  spawn(process.execPath, ['server/index.js'], { cwd: projectDirectory, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: projectDirectory, stdio: 'inherit' }),
]

let stopping = false
function stopAll(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of processes) if (child.exitCode === null) child.kill('SIGTERM')
  setTimeout(() => process.exit(exitCode), 250)
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error(error)
    stopAll(1)
  })
  child.on('exit', (code) => {
    if (!stopping && code !== 0) stopAll(code || 1)
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
