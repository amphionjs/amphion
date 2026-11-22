// Smoke test, run by CI on every supported Node.js version. It proves that Node's type stripping,
// package.json subpath imports (#app/*, #config/*) and workspace packages resolved from source
// all work together, with no build step.
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { createPlaygroundServer } from './server.ts'

const core = await import('@amphion/core')
assert.equal(typeof core, 'object', '@amphion/core should resolve from the workspace')

const server = createPlaygroundServer()
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address() as AddressInfo

try {
  const response = await fetch(`http://127.0.0.1:${port}/`)
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'Hello from Amphion Playground.')
  console.log(`Playground smoke test passed on Node.js ${process.version}.`)
} finally {
  server.closeAllConnections()
  server.close()
}
