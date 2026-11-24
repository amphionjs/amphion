import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { Container } from '../container/container.ts'
import { NoRequestScopeException } from '../exceptions/errors.ts'

/** The state one request (or one job, or one command) owns while it runs. */
export interface RequestStore {
  /** A unique id, useful in logs. The HTTP kernel uses the request id. */
  readonly id: string
  /** The container that created this scope, used by `resolve()` inside it. */
  readonly container: Container | undefined
  /** Instances of `scoped()` bindings, built once per scope. */
  readonly instances: Map<unknown, unknown>
  /** Free storage for packages, keyed by a symbol each package owns. */
  readonly data: Map<PropertyKey, unknown>
}

/** Options for {@link RequestContext.run}. */
export interface RequestScopeOptions {
  id?: string
  container?: Container
}

const storage = new AsyncLocalStorage<RequestStore>()

/**
 * Per-request state on top of `AsyncLocalStorage`. Node keeps one process alive for every user,
 * so a singleton that held request data would leak it to the next request. A scope gives each
 * request its own store, which follows it across every `await`.
 *
 * The HTTP kernel opens one scope per request; queue workers open one per job.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: one shared AsyncLocalStorage behind a named API
export class RequestContext {
  /** Runs `fn` inside a new scope and returns what it returns. */
  static run<R>(fn: () => R, options: RequestScopeOptions = {}): R {
    const store: RequestStore = {
      id: options.id ?? randomUUID(),
      container: options.container,
      instances: new Map(),
      data: new Map(),
    }
    return storage.run(store, fn)
  }

  /** The current scope's store, or `undefined` outside a scope. */
  static get(): RequestStore | undefined {
    return storage.getStore()
  }

  /** The current scope's store. Throws outside a scope. */
  static getOrFail(): RequestStore {
    const store = storage.getStore()
    if (!store) {
      throw new NoRequestScopeException('There is no active request scope.', {
        help: 'Run the code inside RequestContext.run(), which the HTTP kernel does for every request.',
      })
    }
    return store
  }

  /** True inside a scope. */
  static active(): boolean {
    return storage.getStore() !== undefined
  }
}
