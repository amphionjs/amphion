# @amphion/core

The kernel of [Amphion](https://github.com/amphionjs/amphion), a TypeScript-first Node.js framework with the developer experience of Laravel: the service container, the application lifecycle, service providers, typed config and env, the request context (`AsyncLocalStorage`), base exceptions, and the `Str`, `Arr` and `Collection` helpers.

> **Status: built, not yet released.** It ships with v0.1, together with the HTTP layer and the CLI.

```ts
// bootstrap/app.ts
import { Application } from '@amphion/core'
import providers from './providers.ts'

export default Application.configure({ basePath: new URL('..', import.meta.url) })
  .withProviders(providers)
  .create()
```

```ts
// server.ts
import app from '#bootstrap/app.ts'

await app.boot() // load config/, register and boot providers
const greeter = app.make(Greeter) // constructor injection via `static inject`
await app.start() // ready; Ctrl+C now shuts down cleanly
```

Guides: [application and providers](https://github.com/amphionjs/amphion/blob/master/docs/guide/providers.md), [service container](https://github.com/amphionjs/amphion/blob/master/docs/guide/container.md), [configuration](https://github.com/amphionjs/amphion/blob/master/docs/guide/configuration.md), [exceptions](https://github.com/amphionjs/amphion/blob/master/docs/guide/errors.md), [helpers](https://github.com/amphionjs/amphion/blob/master/docs/guide/helpers.md), [collections](https://github.com/amphionjs/amphion/blob/master/docs/guide/collections.md).

## License

MIT
