// HTTP entry of the playground. Until @amphion/http exists (Phase 2), this is plain node:http.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { greeting } from '#app/greeting.ts'
import config from '#config/app.ts'

export function handle(_request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  response.end(greeting(config.name))
}

export function createPlaygroundServer(): Server {
  return createServer(handle)
}

if (import.meta.main) {
  createPlaygroundServer().listen(config.port, () => {
    console.log(`${config.name} listening on http://localhost:${config.port}`)
  })
}
