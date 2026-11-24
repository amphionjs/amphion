# Application and providers

## Creating the application

`bootstrap/app.ts` builds the application, in the style of Laravel 11's `bootstrap/app.php`:

```ts
// bootstrap/app.ts
import { Application } from '@amphion/core'
import providers from './providers.ts'

export default Application.configure({ basePath: new URL('..', import.meta.url) })
  .withProviders(providers)
  .create()
```

```ts
// bootstrap/providers.ts
import type { ProviderEntry } from '@amphion/core'
import AppServiceProvider from '#app/Providers/AppServiceProvider.ts'

export default [AppServiceProvider] satisfies ProviderEntry[]
```

The application is also the [container](./container), so `app.make()`, `app.singleton()` and the rest work on it directly. Anywhere else in your code, the `app()` helper returns it, and `app(Token)` resolves a token from it.

## Lifecycle

```text
created → register providers → boot providers → ready → (serve) → terminating → terminated
```

| Call | What happens |
| --- | --- |
| `await app.boot()` | Loads every file in `config/`, runs each provider's `register()`, then each provider's `boot()` |
| `await app.start()` | Boots if needed, runs each provider's `ready()`, and starts listening for Ctrl+C (SIGINT) and SIGTERM |
| `await app.terminate()` | Runs `terminating` hooks, then each provider's `shutdown()` in reverse order |

Calling `boot()` or `terminate()` twice is safe: both return the same promise.

### Graceful shutdown

When the process gets SIGINT or SIGTERM (Ctrl+C, `docker stop`, a Kubernetes rollout), Amphion terminates the app and exits with code 0. Close servers in a `terminating` hook, so in-flight requests finish first. Close database and Redis connections in your providers' `shutdown()`, which runs after:

```ts
app.terminating(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeIdleConnections()
    }),
)
```

- Every shutdown step runs even if an earlier one fails. Failures are reported together at the end, and the exit code is 1.
- If shutdown takes longer than `app.shutdownTimeout` (10 seconds by default), the process exits with code 1.
- A second Ctrl+C exits right away.
- Signal handlers are not installed in the `testing` environment. Pass `handleSignals: true` to `Application.configure()` to force them.

### Hooks

```ts
app.booting((app) => {}) // after every provider registered, before any boots
app.booted((app) => {}) // after every provider booted (runs right away if that already happened)
app.terminating((app) => {}) // first thing during shutdown
```

## Service providers

Providers are where packages and apps hook into the lifecycle. Each method is optional:

```ts
// app/Providers/AppServiceProvider.ts
import { ServiceProvider } from '@amphion/core'
import PostService from '#app/Services/PostService.ts'

export default class AppServiceProvider extends ServiceProvider {
  // Bind things into the container. Do not resolve other services here.
  register(): void {
    this.app.singleton(PostService)
  }

  // Everything is registered: use other services. May be async.
  async boot(): Promise<void> {}

  // The app is about to serve.
  ready(): void {}

  // Close connections. Providers shut down in reverse order.
  async shutdown(): Promise<void> {}
}
```

Register a provider at runtime with `await app.register(MyProvider)`. If the app has already booted, the new provider boots right away. Registering the same class twice returns the first instance.

### Deferred providers

A deferred provider is imported only when one of its bindings is first needed, which keeps commands that never use it fast:

```ts
import { deferred } from '@amphion/core'

export default [
  AppServiceProvider,
  deferred([Mailer], () => import('#app/Providers/MailServiceProvider.ts')),
]
```

Resolve its bindings with `await app.makeAsync(Mailer)`. The framework's own entry points (the router and the CLI) resolve your classes this way, so constructor injection of deferred services works without extra code.

## Paths and environment

```ts
app.basePath // the app's root folder
app.appPath('Models', 'User.ts')
app.configPath()
app.databasePath('migrations')
app.storagePath('logs')
app.resourcesPath(), app.routesPath(), app.publicPath(), app.bootstrapPath()
```

`app.environment` is `local`, `testing`, `production`, or any name you use. It comes from, in order: the `environment` option, `APP_ENV`, `NODE_ENV=test` (which means `testing`), the `app.env` config value, other `NODE_ENV` values, and finally `local`.

```ts
app.isProduction()
app.isLocal()
app.inTesting()
app.environmentIs('staging', 'production')
```
