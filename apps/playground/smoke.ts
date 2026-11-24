// Smoke test, run by CI on every supported Node.js version. It proves that Node's type stripping,
// package.json subpath imports (#app/*, #bootstrap/*, #config/*) and workspace packages resolved
// from source all work together with no build step, and it checks the Phase 1 exit criteria:
// the app boots, resolves a service with injected dependencies, reads typed config, and shuts
// down cleanly on Ctrl+C.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { ConfigRepository, config } from '@amphion/core'
import Greeter from '#app/Services/Greeter.ts'
import app from '#bootstrap/app.ts'
import { createPlaygroundServer } from './server.ts'

// 1. Boot, serve one request, shut down.
const server = await createPlaygroundServer()
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address() as AddressInfo

const response = await fetch(`http://127.0.0.1:${port}/`)
assert.equal(response.status, 200)
assert.equal(await response.text(), 'Hello from Amphion Playground.')

// 2. A service with an injected dependency, shared as a singleton.
const greeter = app.make(Greeter)
assert.equal(greeter.config, app.make(ConfigRepository))
assert.equal(app.make(Greeter), greeter)

// 3. Typed config: `config('app.port')` is a number at compile time and at runtime.
const configuredPort: number = config('app.port')
assert.equal(typeof configuredPort, 'number')
// @ts-expect-error: a typo in a config path is a compile error.
assert.equal(config('app.prot'), undefined)

await app.terminate()
assert.equal(app.state, 'terminated')
assert.equal(server.listening, false)

// 4. Ctrl+C on a real server process: it must log its shutdown and exit with code 0.
const child = spawn(process.execPath, ['--conditions=amphion-source', 'server.ts'], {
  cwd: import.meta.dirname,
  env: { ...process.env, PORT: '0', APP_ENV: 'local', NODE_ENV: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
let signalled = false
child.stderr.on('data', (chunk: Buffer) => {
  output += chunk.toString()
})
const exitCode = await new Promise<number | null>((resolve, reject) => {
  const timeout = setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error(`The server did not shut down in time. Output:\n${output}`))
  }, 10_000)
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
    if (!signalled && output.includes('listening on')) {
      signalled = true
      child.kill('SIGINT')
    }
  })
  child.on('exit', (code) => {
    clearTimeout(timeout)
    resolve(code)
  })
})
assert.match(output, /AppServiceProvider: shut down\./, output)
assert.equal(exitCode, 0, output)

console.log(`Playground smoke test passed on Node.js ${process.version}.`)
