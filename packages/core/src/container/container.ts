import { RequestContext } from '../context/request-context.ts'
import {
  BindingNotFoundException,
  CircularDependencyException,
  DeferredBindingException,
  NoContainerException,
  NoRequestScopeException,
  ScopedInSingletonException,
  UnresolvableDependencyException,
} from '../exceptions/errors.ts'
import {
  type BindingKey,
  type Constructor,
  describeToken,
  type Factory,
  type InjectList,
  isClass,
} from './token.ts'

/** How long a resolved value lives. */
export type Lifetime = 'transient' | 'singleton' | 'scoped'

/** What a binding builds from: a class (built with its `static inject`) or a factory function. */
export type Concrete<T> = Constructor<T> | Factory<T, Container>

/** Called with each new instance the container builds for a binding. */
export type ResolvingCallback<T> = (instance: T, container: Container) => void

/** The `needs()` step of `container.when(Consumer).needs(Dependency).give(...)`. */
export interface ContextualNeeds {
  needs<T>(dependency: BindingKey<T>): ContextualGive<T>
}

/** The `give()` step: a class, a factory, or a ready value. */
export interface ContextualGive<T> {
  give(implementation: Concrete<T> | T): void
}

interface Binding {
  readonly build: () => unknown
  readonly lifetime: Lifetime
}

interface Frame {
  readonly key: unknown
  readonly lifetime: Lifetime
}

type Given = { kind: 'class' | 'factory' | 'value'; value: unknown }

type Instantiable = new (...args: unknown[]) => unknown

/**
 * The container whose `make()` or `call()` is running right now. Construction is synchronous, so
 * a module-level slot is enough: it is set around every build and restored afterwards. This is
 * what lets `resolve()` work in field initializers and default parameters.
 */
let active: Container | undefined

const classCache = new WeakMap<object, boolean>()

function isClassCached(value: unknown): value is Instantiable {
  if (typeof value !== 'function') return false
  let known = classCache.get(value)
  if (known === undefined) {
    known = isClass(value)
    classCache.set(value, known)
  }
  return known
}

/**
 * The service container: Laravel's core idea. Every controller, middleware, listener and job is
 * resolved through it, which makes everything swappable and testable.
 *
 * Classes are their own tokens and declare their constructor dependencies with `static inject`;
 * interfaces use a typed {@link token}. No decorators are involved, so app code runs through
 * Node's type stripping as is.
 */
export class Container {
  static #instance: Container | undefined

  /** The global container (the application), like Laravel's `Container::getInstance()`. */
  static getInstance(): Container | undefined {
    return Container.#instance
  }

  /** Sets (or clears) the global container. The application calls this when it is created. */
  static setInstance(container: Container | undefined): void {
    Container.#instance = container
  }

  readonly #instances = new Map<unknown, unknown>()
  readonly #bindings = new Map<unknown, Binding>()
  readonly #aliases = new Map<unknown, unknown>()
  readonly #contextual = new Map<unknown, Map<unknown, Given>>()
  readonly #resolving = new Map<unknown, ResolvingCallback<unknown>[]>()
  readonly #globalResolving: ResolvingCallback<unknown>[] = []
  readonly #swapped = new Map<unknown, { had: boolean; value: unknown }>()
  readonly #deferred = new Map<unknown, () => Promise<void>>()
  readonly #loading = new Map<() => Promise<void>, Promise<void>>()
  readonly #frames: Frame[] = []

  /** Binds a token that builds a new value every time it is resolved. */
  bind<T>(key: BindingKey<T>, concrete?: Concrete<T>): this {
    return this.#register(key, concrete, 'transient')
  }

  /** Binds a token that is built once and shared for the life of the process. */
  singleton<T>(key: BindingKey<T>, concrete?: Concrete<T>): this {
    return this.#register(key, concrete, 'singleton')
  }

  /**
   * Binds a token that is built once per request scope (see {@link RequestContext}). Use it for
   * anything that holds request data. A singleton can never depend on it.
   */
  scoped<T>(key: BindingKey<T>, concrete?: Concrete<T>): this {
    return this.#register(key, concrete, 'scoped')
  }

  /** Registers a value that already exists as a shared instance, and returns it. */
  instance<T>(key: BindingKey<T>, value: T): T {
    this.#instances.set(key, value)
    return value
  }

  /** Makes `alias` resolve to whatever `target` resolves to (the same shared instance). */
  alias<T>(alias: BindingKey<T>, target: BindingKey<T>): this {
    if (alias === target) {
      throw new TypeError(`${describeToken(alias)} cannot be an alias of itself.`)
    }
    this.#aliases.set(alias, target)
    return this
  }

  /** Starts a contextual binding: `when(Consumer).needs(Dependency).give(Implementation)`. */
  when(consumer: Constructor): ContextualNeeds {
    return {
      needs: <T>(dependency: BindingKey<T>): ContextualGive<T> => ({
        give: (implementation: Concrete<T> | T): void => {
          let rules = this.#contextual.get(consumer)
          if (!rules) {
            rules = new Map()
            this.#contextual.set(consumer, rules)
          }
          rules.set(dependency, toGiven(implementation))
        },
      }),
    }
  }

  /** Runs a callback for every new instance the container builds (or only for one token). */
  resolving(callback: ResolvingCallback<unknown>): this
  resolving<T>(key: BindingKey<T>, callback: ResolvingCallback<T>): this
  resolving<T>(
    keyOrCallback: BindingKey<T> | ResolvingCallback<unknown>,
    callback?: ResolvingCallback<T>,
  ): this {
    if (callback === undefined) {
      this.#globalResolving.push(keyOrCallback as ResolvingCallback<unknown>)
      return this
    }
    const list = this.#resolving.get(keyOrCallback) ?? []
    list.push(callback as ResolvingCallback<unknown>)
    this.#resolving.set(keyOrCallback, list)
    return this
  }

  /** True when the token is bound, has an instance, is an alias, or comes from a deferred provider. */
  bound(key: BindingKey): boolean {
    return (
      this.#bindings.has(key) ||
      this.#instances.has(key) ||
      this.#aliases.has(key) ||
      this.#deferred.has(key)
    )
  }

  /** Alias of {@link bound}. */
  has(key: BindingKey): boolean {
    return this.bound(key)
  }

  /** Drops the shared instance of a token, so the next `make()` builds a new one. */
  forgetInstance(key: BindingKey): void {
    this.#instances.delete(key)
  }

  /**
   * Resolves a token. A cached singleton costs one Map lookup. An unbound class is built from its
   * `static inject` list each time.
   */
  make<T>(key: BindingKey<T>): T {
    const cached = this.#instances.get(key)
    if (cached !== undefined) return cached as T
    return this.#resolve(key) as T
  }

  /**
   * Like {@link make}, but first loads any deferred provider the resolution needs. Framework code
   * that resolves app classes (the router, the CLI kernel) uses this.
   */
  async makeAsync<T>(key: BindingKey<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return this.make(key)
      } catch (error) {
        if (!(error instanceof DeferredBindingException) || attempt >= 50) throw error
        await this.loadDeferred(error.token as BindingKey)
      }
    }
  }

  /**
   * Calls a method on an object and injects what its class declares in `static methods`, after
   * the arguments you pass:
   *
   * ```ts
   * class PostsController {
   *   static methods = { store: [StorePostRequest] } as const
   *   async store(ctx: HttpContext, request: StorePostRequest) {}
   * }
   * container.call(controller, 'store', [ctx])
   * ```
   *
   * `resolve()` in the method's default parameters also works, because the call runs with this
   * container active.
   */
  call<T extends object, K extends keyof T>(
    target: T,
    method: K,
    args: readonly unknown[] = [],
  ): T[K] extends (...params: never[]) => infer R ? R : never {
    const fn = target[method]
    if (typeof fn !== 'function') {
      throw new TypeError(`${describeToken(target.constructor)}.${String(method)} is not a method.`)
    }
    const consumer = target.constructor
    const deps = (consumer as { methods?: Partial<Record<PropertyKey, InjectList>> }).methods?.[
      method as PropertyKey
    ]
    const previous = active
    active = this
    try {
      const injected = deps ? deps.map((dep) => this.#dependency(consumer, dep)) : []
      return fn.apply(target, [...args, ...injected])
    } finally {
      active = previous
    }
  }

  /**
   * Replaces what a token resolves to, usually with a fake in a test. Returns a function that puts
   * the original back. {@link restoreAll} restores every swap.
   */
  swap<T>(key: BindingKey<T>, replacement: T): () => void {
    if (!this.#swapped.has(key)) {
      this.#swapped.set(key, { had: this.#instances.has(key), value: this.#instances.get(key) })
    }
    this.#instances.set(key, replacement)
    return () => this.restore(key)
  }

  /** Undoes {@link swap} for one token. */
  restore(key: BindingKey): void {
    const saved = this.#swapped.get(key)
    if (!saved) return
    this.#swapped.delete(key)
    if (saved.had) this.#instances.set(key, saved.value)
    else this.#instances.delete(key)
  }

  /** Undoes every {@link swap}. */
  restoreAll(): void {
    for (const key of [...this.#swapped.keys()]) this.restore(key as BindingKey)
  }

  /**
   * Registers tokens that a deferred provider binds. `loader` runs (once) the first time one of
   * them is resolved with {@link makeAsync}.
   */
  defer(keys: readonly BindingKey[], loader: () => Promise<void>): void {
    for (const key of keys) this.#deferred.set(key, loader)
  }

  /** True when the token comes from a deferred provider that has not loaded yet. */
  isDeferred(key: BindingKey): boolean {
    return this.#deferred.has(key)
  }

  /** Loads the deferred provider behind a token. Concurrent calls share one load. */
  async loadDeferred(key: BindingKey): Promise<void> {
    const loader = this.#deferred.get(key)
    if (!loader) return
    let pending = this.#loading.get(loader)
    if (!pending) {
      pending = loader().then(
        () => {
          for (const [deferredKey, owner] of this.#deferred) {
            if (owner === loader) this.#deferred.delete(deferredKey)
          }
        },
        (error: unknown) => {
          this.#loading.delete(loader)
          throw error
        },
      )
      this.#loading.set(loader, pending)
    }
    await pending
  }

  #register<T>(key: BindingKey<T>, concrete: Concrete<T> | undefined, lifetime: Lifetime): this {
    let build: () => unknown
    if (concrete === undefined) {
      if (!isClassCached(key)) {
        throw new TypeError(
          `${describeToken(key)} is not a class, so bind it to a class or a factory function.`,
        )
      }
      build = () => this.#construct(key)
    } else if (isClassCached(concrete)) {
      build = () => this.#construct(concrete)
    } else if (typeof concrete === 'function') {
      const factory = concrete as Factory<T, Container>
      build = () => factory(this)
    } else {
      throw new TypeError(`The binding for ${describeToken(key)} must be a class or a function.`)
    }
    this.#instances.delete(key)
    this.#bindings.set(key, { build, lifetime })
    return this
  }

  #resolve(requested: unknown): unknown {
    let key = requested
    for (let hops = 0; this.#aliases.has(key); hops++) {
      if (hops > 32) {
        throw new CircularDependencyException(`The aliases of ${describeToken(requested)} loop.`)
      }
      key = this.#aliases.get(key)
    }
    if (key !== requested) {
      const cached = this.#instances.get(key)
      if (cached !== undefined) return cached
    }

    const binding = this.#bindings.get(key)
    if (binding === undefined) {
      if (this.#deferred.has(key)) {
        throw new DeferredBindingException(
          key,
          `${describeToken(key)} is bound by a deferred provider that has not loaded yet.`,
        )
      }
      if (isClassCached(key)) return this.#build(key, () => this.#construct(key), 'transient')
      throw new BindingNotFoundException(`Nothing is bound to ${describeToken(key)}.`, {
        help: "Bind it in a service provider's register() method, for example app.singleton(token, () => value).",
      })
    }

    if (binding.lifetime === 'singleton') {
      const value = this.#build(key, binding.build, 'singleton')
      this.#instances.set(key, value)
      return value
    }

    if (binding.lifetime === 'scoped') {
      const store = RequestContext.get()
      if (!store) {
        throw new NoRequestScopeException(
          `${describeToken(key)} is scoped to a request, but there is no active request scope.`,
          {
            help: 'Resolve it while handling a request, or wrap the code in RequestContext.run().',
          },
        )
      }
      if (store.instances.has(key)) return store.instances.get(key)
      const value = this.#build(key, binding.build, 'scoped')
      store.instances.set(key, value)
      return value
    }

    return this.#build(key, binding.build, 'transient')
  }

  #build(key: unknown, build: () => unknown, lifetime: Lifetime): unknown {
    const frames = this.#frames
    for (const frame of frames) {
      if (frame.key === key) {
        const chain = [...frames.slice(frames.indexOf(frame)).map((f) => f.key), key]
        throw new CircularDependencyException(
          `Circular dependency: ${chain.map(describeToken).join(' -> ')}.`,
          { help: 'Break the cycle, for example by resolving one side lazily with resolve().' },
        )
      }
    }
    if (lifetime === 'scoped') {
      const owner = frames.find((frame) => frame.lifetime === 'singleton')
      if (owner) {
        throw new ScopedInSingletonException(
          `The singleton ${describeToken(owner.key)} depends on the scoped ${describeToken(key)}, which would share one request's state with every request.`,
          {
            help: `Make ${describeToken(owner.key)} scoped too, or resolve ${describeToken(key)} inside the method that needs it.`,
          },
        )
      }
    }

    frames.push({ key, lifetime })
    const previous = active
    active = this
    let value: unknown
    try {
      value = build()
    } finally {
      frames.pop()
      active = previous
    }

    const callbacks = this.#resolving.get(key)
    if (callbacks) for (const callback of callbacks) callback(value, this)
    for (const callback of this.#globalResolving) callback(value, this)
    return value
  }

  #construct(target: unknown): unknown {
    const cls = target as Instantiable & { inject?: InjectList }
    const deps = cls.inject
    if (deps === undefined || deps.length === 0) {
      if (cls.length > 0) {
        throw new UnresolvableDependencyException(
          `Cannot build ${describeToken(cls)}: its constructor takes ${cls.length} argument(s) but the class has no static inject list.`,
          {
            help: `Add static inject = [...] as const to ${describeToken(cls)}, or bind it with a factory.`,
          },
        )
      }
      return new cls()
    }
    const args = new Array<unknown>(deps.length)
    for (let index = 0; index < deps.length; index++) {
      const dep = deps[index]
      if (dep === undefined) {
        throw new UnresolvableDependencyException(
          `Cannot build ${describeToken(cls)}: entry ${index} of its static inject list is undefined.`,
          {
            help: 'This usually means a circular import between two modules. Move one import, or use a token.',
          },
        )
      }
      args[index] = this.#dependency(cls, dep)
    }
    return new cls(...args)
  }

  #dependency(consumer: unknown, dep: BindingKey): unknown {
    const given = this.#contextual.get(consumer)?.get(dep)
    if (given === undefined) return this.make(dep)
    if (given.kind === 'value') return given.value
    if (given.kind === 'class') return this.make(given.value as Constructor)
    return (given.value as Factory<unknown, Container>)(this)
  }
}

function toGiven(implementation: unknown): Given {
  if (isClassCached(implementation)) return { kind: 'class', value: implementation }
  if (typeof implementation === 'function') return { kind: 'factory', value: implementation }
  return { kind: 'value', value: implementation }
}

/**
 * Resolves a token from the container that is active right now, like Laravel's `resolve()`. Use
 * it in app code where `static inject` would be noisy:
 *
 * ```ts
 * class PostsController {
 *   posts = resolve(PostService)
 *   async store(ctx: HttpContext, request = resolve(StorePostRequest)) {}
 * }
 * ```
 *
 * It looks in order at: the container building the current object, the current request scope's
 * container, and the global application.
 */
export function resolve<T>(key: BindingKey<T>): T {
  const container = active ?? RequestContext.get()?.container ?? Container.getInstance()
  if (container === undefined) {
    throw new NoContainerException(
      `Cannot resolve ${describeToken(key)}: no container is active.`,
      {
        help: 'Create the application first, or call container.make() directly.',
      },
    )
  }
  return container.make(key)
}
