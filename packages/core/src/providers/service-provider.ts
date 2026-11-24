import type { Application } from '../application/application.ts'
import type { BindingKey } from '../container/token.ts'

/**
 * Base class for service providers, Laravel's two-phase boot:
 *
 * - `register()`: bind things into the container. Do not resolve other services here.
 * - `boot()`: everything is registered, so use other services.
 * - `ready()`: the app is about to serve (HTTP server listening, command running).
 * - `shutdown()`: close connections. Providers shut down in reverse order.
 *
 * Every method is optional, so subclasses write them without `override`.
 *
 * ```ts
 * export default class AppServiceProvider extends ServiceProvider {
 *   register() {
 *     this.app.singleton(PostService)
 *   }
 * }
 * ```
 */
export abstract class ServiceProvider {
  app: Application

  constructor(app: Application) {
    this.app = app
  }
}

/** The lifecycle methods a provider may define. */
export interface ProviderHooks {
  register?(): void
  boot?(): void | Promise<void>
  ready?(): void | Promise<void>
  shutdown?(): void | Promise<void>
}

/** A provider class. */
export type ProviderClass = new (app: Application) => ServiceProvider

/** A provider that loads only when one of the tokens it provides is first resolved. */
export interface DeferredProvider {
  readonly provides: readonly BindingKey[]
  readonly load: () => Promise<{ default: ProviderClass }>
}

/** An entry in the app's provider list. */
export type ProviderEntry = ProviderClass | DeferredProvider

/**
 * Declares a deferred provider. Its module is imported with `import()` only when one of the
 * listed tokens is first resolved with `app.makeAsync()`, which keeps CLI commands fast.
 *
 * ```ts
 * export default [
 *   AppServiceProvider,
 *   deferred([Mailer], () => import('#app/Providers/MailServiceProvider.ts')),
 * ]
 * ```
 */
export function deferred(
  provides: readonly BindingKey[],
  load: () => Promise<{ default: ProviderClass }>,
): DeferredProvider {
  return { provides, load }
}
