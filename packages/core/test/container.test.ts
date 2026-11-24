import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import {
  BindingNotFoundException,
  CircularDependencyException,
  Container,
  DeferredBindingException,
  NoContainerException,
  NoRequestScopeException,
  RequestContext,
  resolve,
  ScopedInSingletonException,
  type Token,
  token,
  UnresolvableDependencyException,
} from '../src/index.ts'

class Clock {
  now(): number {
    return 42
  }
}

class Logger {
  lines: string[] = []
}

class Greeter {
  static inject = [Clock, Logger] as const
  clock: Clock
  log: Logger
  constructor(clock: Clock, log: Logger) {
    this.clock = clock
    this.log = log
  }
}

interface CacheStore {
  get(key: string): string | undefined
}
const Cache: Token<CacheStore> = token('Cache')

afterEach(() => {
  Container.setInstance(undefined)
})

describe('resolving classes', () => {
  it('builds an unbound class from its static inject list, fresh each time', () => {
    const container = new Container()
    const greeter = container.make(Greeter)
    expect(greeter).toBeInstanceOf(Greeter)
    expect(greeter.clock).toBeInstanceOf(Clock)
    expect(greeter.log).toBeInstanceOf(Logger)
    expect(container.make(Greeter)).not.toBe(greeter)
  })

  it('shares singletons', () => {
    const container = new Container()
    container.singleton(Logger)
    expect(container.make(Logger)).toBe(container.make(Logger))
    expect(container.make(Greeter).log).toBe(container.make(Logger))
  })

  it('builds a new value for every bind() resolution', () => {
    const container = new Container()
    container.bind(Logger)
    expect(container.make(Logger)).not.toBe(container.make(Logger))
  })

  it('binds a token to a factory or a class', () => {
    const container = new Container()
    container.singleton(Cache, () => ({ get: () => 'hit' }))
    expect(container.make(Cache).get('x')).toBe('hit')

    class MemoryCache implements CacheStore {
      get(): string {
        return 'memory'
      }
    }
    container.bind(Cache, MemoryCache)
    expect(container.make(Cache)).toBeInstanceOf(MemoryCache)
  })

  it('passes the container to factories', () => {
    const container = new Container()
    container.singleton(Clock)
    container.bind(Greeter, (c) => new Greeter(c.make(Clock), new Logger()))
    expect(container.make(Greeter).clock).toBe(container.make(Clock))
  })

  it('registers existing instances', () => {
    const container = new Container()
    const logger = new Logger()
    expect(container.instance(Logger, logger)).toBe(logger)
    expect(container.make(Logger)).toBe(logger)
  })

  it('rebinding drops a cached singleton', () => {
    const container = new Container()
    container.singleton(Logger)
    const first = container.make(Logger)
    container.singleton(Logger)
    expect(container.make(Logger)).not.toBe(first)
  })

  it('resolves aliases to the same shared instance', () => {
    abstract class Store {}
    class FileStore extends Store {}
    const container = new Container()
    container.singleton(FileStore)
    container.alias(Store, FileStore)
    expect(container.make(Store)).toBe(container.make(FileStore))
  })

  it('reports whether a token is bound', () => {
    const container = new Container()
    expect(container.bound(Cache)).toBe(false)
    container.instance(Cache, { get: () => undefined })
    expect(container.bound(Cache)).toBe(true)
    expect(container.has(Cache)).toBe(true)
  })

  it('infers the resolved type from the token', () => {
    const container = new Container()
    container.instance(Cache, { get: () => undefined })
    expectTypeOf(container.make(Cache)).toEqualTypeOf<CacheStore>()
    expectTypeOf(container.make(Greeter)).toEqualTypeOf<Greeter>()
  })
})

describe('errors', () => {
  it('explains how to fix a class without static inject', () => {
    class NeedsArgs {
      value: string
      constructor(value: string) {
        this.value = value
      }
    }
    const container = new Container()
    expect(() => container.make(NeedsArgs)).toThrow(UnresolvableDependencyException)
    expect(() => container.make(NeedsArgs)).toThrow(/no static inject list/)
    try {
      container.make(NeedsArgs)
    } catch (error) {
      expect((error as UnresolvableDependencyException).code).toBe('E_UNRESOLVABLE_DEPENDENCY')
      expect((error as UnresolvableDependencyException).help).toMatch(/static inject/)
    }
  })

  it('points at circular imports when an inject entry is undefined', () => {
    class Broken {
      static inject = [undefined as unknown as typeof Clock] as const
      constructor(_clock: Clock) {}
    }
    expect(() => new Container().make(Broken)).toThrow(/entry 0 of its static inject list/)
    try {
      new Container().make(Broken)
    } catch (error) {
      expect(String(error)).toMatch(/circular import/)
    }
  })

  it('throws for an unbound symbol token', () => {
    expect(() => new Container().make(Cache)).toThrow(BindingNotFoundException)
    expect(() => new Container().make(Cache)).toThrow(/Symbol\(Cache\)/)
  })

  it('detects circular dependencies and prints the chain', () => {
    class A {
      static inject: readonly (typeof B)[] = []
      constructor(_b: unknown) {}
    }
    class B {
      static inject = [A] as const
      constructor(_a: A) {}
    }
    A.inject = [B]
    const container = new Container()
    expect(() => container.make(A)).toThrow(CircularDependencyException)
    expect(() => container.make(A)).toThrow('Circular dependency: A -> B -> A.')
  })
})

describe('contextual bindings', () => {
  it('gives one consumer a different implementation', () => {
    class Writer {
      name = 'default'
    }
    class SpecialWriter extends Writer {
      override name = 'special'
    }
    class Report {
      static inject = [Writer] as const
      writer: Writer
      constructor(writer: Writer) {
        this.writer = writer
      }
    }
    class Invoice {
      static inject = [Writer] as const
      writer: Writer
      constructor(writer: Writer) {
        this.writer = writer
      }
    }
    const container = new Container()
    container.when(Report).needs(Writer).give(SpecialWriter)
    expect(container.make(Report).writer.name).toBe('special')
    expect(container.make(Invoice).writer.name).toBe('default')
  })

  it('accepts factories and plain values', () => {
    class Paginator {
      static inject = [Cache] as const
      cache: CacheStore
      constructor(cache: CacheStore) {
        this.cache = cache
      }
    }
    const container = new Container()
    container
      .when(Paginator)
      .needs(Cache)
      .give({ get: () => 'value' })
    expect(container.make(Paginator).cache.get('x')).toBe('value')
    container
      .when(Paginator)
      .needs(Cache)
      .give(() => ({ get: () => 'factory' }))
    expect(container.make(Paginator).cache.get('x')).toBe('factory')
  })
})

describe('resolving callbacks', () => {
  it('runs for each new instance, globally or per token', () => {
    const container = new Container()
    const seen: unknown[] = []
    container.resolving(Logger, (logger) => {
      logger.lines.push('configured')
    })
    container.resolving((instance) => seen.push(instance))
    container.singleton(Logger)
    const logger = container.make(Logger)
    container.make(Logger)
    expect(logger.lines).toEqual(['configured'])
    expect(seen).toEqual([logger])
  })
})

describe('swap', () => {
  it('replaces a binding until restored', () => {
    const container = new Container()
    container.singleton(Clock)
    const real = container.make(Clock)
    const fake = { now: () => 1 }
    const restore = container.swap(Clock, fake)
    expect(container.make(Clock)).toBe(fake)
    expect(container.make(Greeter).clock).toBe(fake)
    restore()
    expect(container.make(Clock)).toBe(real)
  })

  it('restoreAll undoes every swap, including tokens that had no instance', () => {
    const container = new Container()
    container.swap(Cache, { get: () => 'fake' })
    container.swap(Clock, { now: () => 0 })
    container.restoreAll()
    expect(() => container.make(Cache)).toThrow(BindingNotFoundException)
    expect(container.make(Clock)).toBeInstanceOf(Clock)
  })
})

describe('scoped bindings', () => {
  class CurrentUser {
    id = Math.random()
  }

  it('builds once per request scope', () => {
    const container = new Container()
    container.scoped(CurrentUser)
    const [a1, a2] = RequestContext.run(() => [
      container.make(CurrentUser),
      container.make(CurrentUser),
    ])
    const b = RequestContext.run(() => container.make(CurrentUser))
    expect(a1).toBe(a2)
    expect(b).not.toBe(a1)
  })

  it('refuses to resolve outside a scope', () => {
    const container = new Container()
    container.scoped(CurrentUser)
    expect(() => container.make(CurrentUser)).toThrow(NoRequestScopeException)
  })

  it('refuses to inject a scoped binding into a singleton', () => {
    class UserCache {
      static inject = [CurrentUser] as const
      constructor(_user: CurrentUser) {}
    }
    const container = new Container()
    container.scoped(CurrentUser)
    container.singleton(UserCache)
    expect(() => RequestContext.run(() => container.make(UserCache))).toThrow(
      ScopedInSingletonException,
    )
  })

  it('also catches a scoped binding reached through a transient', () => {
    class Middle {
      static inject = [CurrentUser] as const
      constructor(_user: CurrentUser) {}
    }
    class Top {
      static inject = [Middle] as const
      constructor(_middle: Middle) {}
    }
    const container = new Container()
    container.scoped(CurrentUser)
    container.singleton(Top)
    expect(() => RequestContext.run(() => container.make(Top))).toThrow(/Top depends on the scoped/)
  })
})

describe('resolve() and call()', () => {
  class PostService {
    all(): string[] {
      return ['first post']
    }
  }
  class StorePostRequest {
    validated(): { title: string } {
      return { title: 'Hello' }
    }
  }

  it('resolve() works in field initializers (style B)', () => {
    class PostsController {
      posts = resolve(PostService)
    }
    const container = new Container()
    container.singleton(PostService)
    expect(container.make(PostsController).posts).toBe(container.make(PostService))
  })

  it('call() injects what static methods declares, after the given arguments (style A)', () => {
    class PostsController {
      static methods = { store: [StorePostRequest] } as const
      store(ctx: { user: string }, request: StorePostRequest): string {
        return `${ctx.user}: ${request.validated().title}`
      }
    }
    const container = new Container()
    const controller = container.make(PostsController)
    const result = container.call(controller, 'store', [{ user: 'nima' }])
    expect(result).toBe('nima: Hello')
    expectTypeOf(result).toEqualTypeOf<string>()
  })

  it('call() makes resolve() work in default parameters (style B)', async () => {
    class PostsController {
      async store(ctx: { user: string }, request = resolve(StorePostRequest)): Promise<string> {
        await Promise.resolve()
        return `${ctx.user}: ${request.validated().title}`
      }
    }
    const container = new Container()
    await expect(container.call(new PostsController(), 'store', [{ user: 'nima' }])).resolves.toBe(
      'nima: Hello',
    )
  })

  it('resolve() falls back to the request scope container, then the global instance', () => {
    const scoped = new Container()
    scoped.instance(Cache, { get: () => 'scoped' })
    expect(RequestContext.run(() => resolve(Cache).get('x'), { container: scoped })).toBe('scoped')

    const global = new Container()
    global.instance(Cache, { get: () => 'global' })
    Container.setInstance(global)
    expect(resolve(Cache).get('x')).toBe('global')
  })

  it('resolve() throws when no container exists', () => {
    expect(() => resolve(Clock)).toThrow(NoContainerException)
  })
})

describe('deferred bindings', () => {
  it('make() explains that the provider is not loaded; makeAsync() loads it once', async () => {
    const container = new Container()
    let loads = 0
    container.defer([Cache], async () => {
      loads++
      container.singleton(Cache, () => ({ get: () => 'loaded' }))
    })
    expect(container.bound(Cache)).toBe(true)
    expect(() => container.make(Cache)).toThrow(DeferredBindingException)

    const [a, b] = await Promise.all([container.makeAsync(Cache), container.makeAsync(Cache)])
    expect(a.get('x')).toBe('loaded')
    expect(a).toBe(b)
    expect(loads).toBe(1)
    expect(container.isDeferred(Cache)).toBe(false)
  })

  it('makeAsync() loads deferred dependencies of a class', async () => {
    class Report {
      static inject = [Cache] as const
      cache: CacheStore
      constructor(cache: CacheStore) {
        this.cache = cache
      }
    }
    const container = new Container()
    container.defer([Cache], async () => {
      container.singleton(Cache, () => ({ get: () => 'deferred' }))
    })
    expect((await container.makeAsync(Report)).cache.get('x')).toBe('deferred')
  })

  it('a failed load can be retried', async () => {
    const container = new Container()
    let attempts = 0
    container.defer([Cache], async () => {
      if (attempts++ === 0) throw new Error('network')
      container.instance(Cache, { get: () => 'ok' })
    })
    await expect(container.makeAsync(Cache)).rejects.toThrow('network')
    expect((await container.makeAsync(Cache)).get('x')).toBe('ok')
  })
})
