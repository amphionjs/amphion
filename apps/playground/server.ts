// HTTP entry of the playground. The app boots through @amphion/core; serving is still plain
// node:http until @amphion/http exists (Phase 2).
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { config } from '@amphion/core'
import Greeter from '#app/Services/Greeter.ts'
import app from '#bootstrap/app.ts'

/** Boots the app and returns a server that is not listening yet. */
export async function createPlaygroundServer(): Promise<Server> {
  await app.boot()
  const greeter = app.make(Greeter)

  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(greeter.greet())
  })

  // On shutdown: stop accepting connections, let in-flight requests finish, close idle sockets.
  app.terminating(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeIdleConnections()
      }),
  )
  return server
}

if (import.meta.main) {
  const server = await createPlaygroundServer()
  server.listen(config('app.port'), () => {
    const { port } = server.address() as AddressInfo
    console.log(`${config('app.name')} listening on http://localhost:${port}`)
  })
  await app.start()
}
