// The real @amphion/core container. Phase 1 target: a cached singleton resolves in under 1 µs.
// token-lookup.bench.ts holds the raw Map baseline this is compared against.
import { Container, RequestContext } from '@amphion/core'
import { bench, do_not_optimize, group, summary } from 'mitata'

class Config {}
class Logger {}
class UserService {
  static inject = [Config, Logger] as const
  config: Config
  log: Logger
  constructor(config: Config, log: Logger) {
    this.config = config
    this.log = log
  }
}
class CurrentUser {}

const container = new Container()
container.singleton(Config)
container.singleton(Logger)
container.singleton(UserService)
container.scoped(CurrentUser)

const transient = new Container()
transient.singleton(Config)
transient.singleton(Logger)

const raw = new Map<unknown, unknown>([[UserService, container.make(UserService)]])

group('container resolve', () => {
  summary(() => {
    bench('Map.get(class) baseline', () => do_not_optimize(raw.get(UserService)))
    bench('make(singleton), cached', () => do_not_optimize(container.make(UserService)))
    bench('make(class) with 2 singleton deps, new instance', () =>
      do_not_optimize(transient.make(UserService)),
    )
    // The per-request cost: open a scope (AsyncLocalStorage + id), build once, then a cached hit.
    bench('new request scope + build scoped + cached scoped', () =>
      RequestContext.run(() => {
        container.make(CurrentUser)
        return do_not_optimize(container.make(CurrentUser))
      }),
    )
  })
})
