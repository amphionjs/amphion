# Service container

The container builds your classes and hands them their dependencies, like Laravel's service container. Controllers, middleware, listeners and jobs are all resolved through it, so anything can be swapped for a fake in a test.

```ts
import app from '#bootstrap/app.ts'

const users = app.make(UserService)
```

## Declaring dependencies

Laravel reads PHP type hints at runtime. Node.js strips TypeScript types before running your code, so Amphion needs another signal. There are two styles.

### `static inject` (the standard style)

List the constructor's dependencies in a static `inject` field, in the same order as the parameters. Framework packages and generated code use this style.

```ts
import Logger from '#app/Services/Logger.ts'
import PostRepository from '#app/Services/PostRepository.ts'

export default class PostService {
  static inject = [PostRepository, Logger] as const

  posts: PostRepository
  log: Logger

  constructor(posts: PostRepository, log: Logger) {
    this.posts = posts
    this.log = log
  }
}
```

Fields are declared explicitly because parameter properties (`constructor(private posts: PostRepository)`) are not erasable syntax: Node's type stripping rejects them.

For methods, list the extra dependencies in `static methods`. The caller's own arguments come first (for a controller, that is the `HttpContext`):

```ts
export default class PostsController {
  static methods = { store: [StorePostRequest] } as const

  async store(ctx: HttpContext, request: StorePostRequest) {
    // ...
  }
}

container.call(controller, 'store', [ctx])
```

### `resolve()` (allowed in app code)

`resolve()` is Laravel's helper of the same name. It works in field initializers and default parameters, and the type is inferred, so you write it once:

```ts
import { resolve } from '@amphion/core'

export default class PostsController {
  posts = resolve(PostService)

  async store(ctx: HttpContext, request = resolve(StorePostRequest)) {
    // ...
  }
}
```

The trade-off: dependencies are less visible, and a unit test cannot pass a fake through the constructor. Use `container.swap()` instead (see [Testing](#swapping-in-tests)).

`resolve()` looks for a container in this order: the container that is building the current object, the current request's container, then the application.

## Binding

A class with a `static inject` list (or no constructor arguments) needs no binding: `make()` builds a new one each time. Bind it when you want something else.

| Method | Lifetime |
| --- | --- |
| `bind(token, concrete?)` | A new value on every `make()` |
| `singleton(token, concrete?)` | Built once, shared for the life of the process |
| `scoped(token, concrete?)` | Built once per request (see below) |
| `instance(token, value)` | A value you already have |

`concrete` is a class or a factory function that receives the container:

```ts
app.singleton(PostRepository)
app.singleton(Cache, () => new RedisStore(app.make(RedisConnection)))
app.bind(PaymentGateway, StripeGateway)
```

Factories are synchronous. Do async setup (opening a connection pool, for example) in a provider's `boot()` method.

### Interfaces: typed tokens

Interfaces do not exist at runtime, so bind them to a typed symbol:

```ts
import { type Token, token } from '@amphion/core'

export interface CacheStore {
  get(key: string): Promise<string | undefined>
}
export const Cache: Token<CacheStore> = token('Cache')

app.singleton(Cache, () => new MemoryStore())
app.make(Cache) // CacheStore
```

An abstract class also works as a token, and keeps the interface and the token in one name.

### Aliases and contextual bindings

```ts
// Both names resolve to the same shared instance.
app.alias(Store, FileStore)

// ReportService gets S3Storage; every other class still gets the default Storage.
app.when(ReportService).needs(Storage).give(S3Storage)
```

`give()` accepts a class, a factory function, or a ready value.

### Resolving callbacks

```ts
app.resolving(Mailer, (mailer) => mailer.setFrom('hello@example.com'))
app.resolving((instance) => {
  // runs for everything the container builds
})
```

## Request scope

A Node.js server keeps one process alive for every user. A singleton that stored the current user would show that user to the next request, so request data never goes in a singleton. Use `scoped()`: the value is built once per request, and each request gets its own.

```ts
app.scoped(CurrentUser)
```

Under the hood each request runs inside an `AsyncLocalStorage` scope (`RequestContext`), which follows it across every `await`. The HTTP kernel opens one scope per request; you can open one yourself, for example in a queue worker:

```ts
import { RequestContext } from '@amphion/core'

await RequestContext.run(async () => {
  await handleJob()
})
```

The container protects you from two mistakes:

- resolving a scoped binding outside a scope throws `E_NO_REQUEST_SCOPE`;
- a singleton that depends on a scoped binding throws `E_SCOPED_IN_SINGLETON`, because it would capture the first request's value forever.

## Deferred bindings

Bindings from a [deferred provider](./providers#deferred-providers) load on first use. Resolve them with `await app.makeAsync(token)`, which imports the provider first. A plain `make()` on a binding that has not loaded yet throws `E_DEFERRED_BINDING` and tells you to use `makeAsync()`.

## Swapping in tests

```ts
const restore = app.swap(Mailer, fakeMailer)
// ... everything that resolves Mailer now gets fakeMailer
restore() // or app.restoreAll()
```

## Errors

| Code | Meaning |
| --- | --- |
| `E_UNRESOLVABLE_DEPENDENCY` | The constructor takes arguments but the class has no `static inject`, or an entry is `undefined` (usually a circular import) |
| `E_CIRCULAR_DEPENDENCY` | Two bindings depend on each other; the message prints the chain, such as `A -> B -> A` |
| `E_BINDING_NOT_FOUND` | Nothing is bound to a symbol token |
| `E_NO_REQUEST_SCOPE` | A scoped binding was resolved outside a request |
| `E_SCOPED_IN_SINGLETON` | A singleton depends on a scoped binding |
| `E_DEFERRED_BINDING` | Use `makeAsync()` for a binding from a deferred provider |
| `E_NO_CONTAINER` | `resolve()` was called before any application exists |

## Performance

A cached singleton resolves with one `Map` lookup: about 4 ns on the development machine, the same as a bare `Map.get`. Run `pnpm bench container` in the repository to measure it yourself.
