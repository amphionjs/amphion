// Builds the application, like Laravel's bootstrap/app.php. Entry files (server.ts, lyre.ts)
// import it and call `await app.boot()`.
import { Application } from '@amphion/core'
import providers from './providers.ts'

export default Application.configure({ basePath: new URL('..', import.meta.url) })
  .withProviders(providers)
  .create()
