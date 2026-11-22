// Baseline HTTP benchmark: a raw node:http "hello" server under autocannon load.
// Phase 2 compares Amphion's router against this number (and against Fastify and AdonisJS).
// Usage: pnpm bench:http [-- --connections 100 --duration 10]
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parseArgs } from 'node:util'
import autocannon from 'autocannon'

const { values } = parseArgs({
  options: {
    connections: { type: 'string', default: '100' },
    duration: { type: 'string', default: '10' },
  },
})

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end('hello')
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address() as AddressInfo

const result = await autocannon({
  url: `http://127.0.0.1:${port}/hello`,
  connections: Number(values.connections),
  duration: Number(values.duration),
})

console.log(autocannon.printResult(result))
console.log(
  `node:http baseline on Node.js ${process.version}: ${Math.round(result.requests.average)} req/s`,
)

server.closeAllConnections()
server.close()
