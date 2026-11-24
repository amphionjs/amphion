import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { type ConfigPath, ConfigRepository } from '../config/config.ts'
import { Container } from '../container/container.ts'
import { InvalidAppStateException } from '../exceptions/errors.ts'
import type {
  DeferredProvider,
  ProviderClass,
  ProviderEntry,
  ProviderHooks,
  ServiceProvider,
} from '../providers/service-provider.ts'
import { dataGet } from '../support/data.ts'

/** The application's lifecycle, in order. */
export type AppState = 'created' | 'registered' | 'booted' | 'ready' | 'terminating' | 'terminated'

/** A lifecycle callback. It may be async. */
export type AppHook = (app: Application) => void | Promise<void>

/** Options for {@link Application}. Usually set through `Application.configure()`. */
export interface ApplicationOptions {
  /** The app's root folder (where `app/`, `config/` and `package.json` live). */
  basePath: string | URL
  /** Service providers, in the order they register and boot. */
  providers?: readonly ProviderEntry[]
  /**
   * `local`, `testing`, `production` or any name you use. When omitted it comes from, in order:
   * `APP_ENV`, `NODE_ENV=test` (→ `testing`), the `app.env` config value, other `NODE_ENV`
   * values (`production`, `development` → `local`), then `local`.
   */
  environment?: string
  /** Config values that take the place of the files in `config/` with the same name. */
  config?: Record<string, unknown>
  /** How long a signal-triggered shutdown may take before the process is forced to exit. */
  shutdownTimeout?: number
  /** Whether `start()` installs SIGINT/SIGTERM handlers. Defaults to on, except in `testing`. */
  handleSignals?: boolean
}

type ProviderInstance = ServiceProvider & ProviderHooks

/**
 * Builds an {@link Application}, in the style of Laravel 11's `bootstrap/app.php`:
 *
 * ```ts
 * export default Application.configure({ basePath: new URL('..', import.meta.url) })
 *   .withProviders(providers)
 *   .create()
 * ```
 */
export class ApplicationBuilder {
  readonly #options: ApplicationOptions & { providers: ProviderEntry[] }

  constructor(options: ApplicationOptions) {
    this.#options = { ...options, providers: [...(options.providers ?? [])] }
  }

  /** Adds service providers, in the order they register and boot. */
  withProviders(providers: readonly ProviderEntry[]): this {
    this.#options.providers.push(...providers)
    return this
  }

  /** Sets config values that take the place of the files in `config/` with the same name. */
  withConfig(values: Record<string, unknown>): this {
    this.#options.config = { ...this.#options.config, ...values }
    return this
  }

  /** Forces the environment instead of reading it from `APP_ENV`. */
  withEnvironment(environment: string): this {
    this.#options.environment = environment
    return this
  }

  /** Creates the application. Call `await app.boot()` next. */
  create(): Application {
    return new Application(this.#options)
  }
}

/**
 * The application: the container plus its paths, environment, config and lifecycle.
 *
 * Lifecycle: `register providers → boot providers → ready → serve → terminating → shutdown`.
 * `boot()` loads config and runs the providers, `start()` marks the app ready and listens for
 * SIGINT/SIGTERM, and `terminate()` runs the shutdown hooks, so in-flight work can finish and
 * connections close before the process exits. Docker and Kubernetes rely on this.
 */
export class Application extends Container {
  /** Starts building an application: `Application.configure({ basePath }).create()`. */
  static configure(options: ApplicationOptions): ApplicationBuilder {
    return new ApplicationBuilder(options)
  }

  /** The current application, used by the `app()`, `config()` and `resolve()` helpers. */
  static override getInstance(): Application | undefined {
    const instance = Container.getInstance()
    return instance instanceof Application ? instance : undefined
  }

  /** The app's root folder. */
  readonly basePath: string
  /** The loaded config. */
  readonly config: ConfigRepository
  /** Milliseconds a signal-triggered shutdown may take before the process is forced to exit. */
  shutdownTimeout: number

  readonly #entries: readonly ProviderEntry[]
  readonly #providers: ProviderInstance[] = []
  readonly #presetConfig: Record<string, unknown>
  readonly #forcedEnvironment: string | undefined
  readonly #handleSignals: boolean | undefined
  readonly #booting: AppHook[] = []
  readonly #booted: AppHook[] = []
  readonly #terminating: AppHook[] = []
  #environment: string
  #state: AppState = 'created'
  #bootPromise: Promise<void> | undefined
  #terminatePromise: Promise<void> | undefined
  #signalHandler: ((signal: NodeJS.Signals) => void) | undefined

  constructor(options: ApplicationOptions) {
    super()
    this.basePath =
      typeof options.basePath === 'string' ? options.basePath : fileURLToPath(options.basePath)
    this.#entries = options.providers ?? []
    this.#presetConfig = { ...options.config }
    this.config = new ConfigRepository({ ...options.config })
    this.shutdownTimeout = options.shutdownTimeout ?? 10_000
    this.#handleSignals = options.handleSignals
    this.#forcedEnvironment = options.environment
    this.#environment = this.#detectEnvironment()

    this.instance(Application, this)
    this.instance(Container, this)
    this.instance(ConfigRepository, this.config)
    Container.setInstance(this)
  }

  // Paths ------------------------------------------------------------------------------------

  /** A path inside the app's root folder. */
  makePath(...segments: string[]): string {
    return join(this.basePath, ...segments)
  }

  /** `app/` */
  appPath(...segments: string[]): string {
    return this.makePath('app', ...segments)
  }

  /** `bootstrap/` */
  bootstrapPath(...segments: string[]): string {
    return this.makePath('bootstrap', ...segments)
  }

  /** `config/` */
  configPath(...segments: string[]): string {
    return this.makePath('config', ...segments)
  }

  /** `database/` */
  databasePath(...segments: string[]): string {
    return this.makePath('database', ...segments)
  }

  /** `public/` */
  publicPath(...segments: string[]): string {
    return this.makePath('public', ...segments)
  }

  /** `resources/` */
  resourcesPath(...segments: string[]): string {
    return this.makePath('resources', ...segments)
  }

  /** `routes/` */
  routesPath(...segments: string[]): string {
    return this.makePath('routes', ...segments)
  }

  /** `storage/` */
  storagePath(...segments: string[]): string {
    return this.makePath('storage', ...segments)
  }

  // Environment and state --------------------------------------------------------------------

  /** `local`, `testing`, `production`, or another name the app uses. */
  get environment(): string {
    return this.#environment
  }

  /** True when the environment is one of the given names. */
  environmentIs(...names: string[]): boolean {
    return names.includes(this.#environment)
  }

  isProduction(): boolean {
    return this.#environment === 'production'
  }

  isLocal(): boolean {
    return this.#environment === 'local'
  }

  inTesting(): boolean {
    return this.#environment === 'testing'
  }

  /** Where the app is in its lifecycle. */
  get state(): AppState {
    return this.#state
  }

  /** True once every provider has booted. */
  isBooted(): boolean {
    return this.#state === 'booted' || this.#state === 'ready'
  }

  // Hooks ------------------------------------------------------------------------------------

  /** Runs before providers boot (after they register). */
  booting(callback: AppHook): this {
    this.#booting.push(callback)
    return this
  }

  /** Runs after every provider has booted, or right away if that already happened. */
  booted(callback: AppHook): this {
    this.#booted.push(callback)
    if (this.isBooted()) void callback(this)
    return this
  }

  /** Runs first when the app terminates, before providers shut down. Close servers here. */
  terminating(callback: AppHook): this {
    this.#terminating.push(callback)
    return this
  }

  // Providers --------------------------------------------------------------------------------

  /** The providers that have registered, in order. */
  get providers(): readonly ServiceProvider[] {
    return this.#providers
  }

  /** The registered instance of a provider class, if any. */
  getProvider<P extends ServiceProvider>(
    provider: abstract new (app: Application) => P,
  ): P | undefined {
    return this.#providers.find((instance) => instance instanceof provider) as P | undefined
  }

  /**
   * Registers a provider at runtime, like Laravel's `$app->register()`. If the app has already
   * booted, the provider boots right away too. Registering the same class twice returns the
   * first instance.
   */
  async register(provider: ProviderClass): Promise<ServiceProvider> {
    const existing = this.#providers.find((instance) => instance.constructor === provider)
    if (existing) return existing
    const instance = this.#registerProvider(provider)
    if (this.isBooted()) await instance.boot?.()
    if (this.#state === 'ready') await instance.ready?.()
    return instance
  }

  // Lifecycle --------------------------------------------------------------------------------

  /**
   * Loads every file in `config/`, registers the providers, then boots them. Calling it again
   * returns the same promise.
   */
  boot(): Promise<void> {
    if (this.#state === 'terminating' || this.#state === 'terminated') {
      return Promise.reject(
        new InvalidAppStateException(`Cannot boot an application that is ${this.#state}.`, {
          help: 'Create a new Application instead.',
        }),
      )
    }
    this.#bootPromise ??= this.#boot()
    return this.#bootPromise
  }

  /**
   * Boots the app if needed, runs every provider's `ready()`, and (outside `testing`) installs
   * SIGINT and SIGTERM handlers that terminate the app and exit.
   */
  async start(): Promise<void> {
    await this.boot()
    if (this.#state !== 'booted') return
    for (const provider of this.#providers) await provider.ready?.()
    this.#state = 'ready'
    if (this.#handleSignals ?? !this.inTesting()) this.#installSignalHandlers()
  }

  /**
   * Shuts the app down: `terminating` hooks first, then every provider's `shutdown()` in reverse
   * order. Every step runs even if an earlier one fails; failures are thrown together at the end
   * as an AggregateError. Calling it again returns the same promise.
   */
  terminate(): Promise<void> {
    this.#terminatePromise ??= this.#terminate()
    return this.#terminatePromise
  }

  async #boot(): Promise<void> {
    await this.#loadConfiguration()
    for (const entry of this.#entries) {
      if (isDeferred(entry)) this.defer(entry.provides, () => this.#loadDeferred(entry))
      else this.#registerProvider(entry)
    }
    this.#state = 'registered'
    for (const callback of this.#booting) await callback(this)
    // Index loop: a deferred provider loaded during boot is appended and booted here too.
    for (let index = 0; index < this.#providers.length; index++) {
      await this.#providers[index]?.boot?.()
    }
    this.#state = 'booted'
    for (const callback of this.#booted) await callback(this)
  }

  async #terminate(): Promise<void> {
    this.#state = 'terminating'
    const errors: unknown[] = []
    for (const callback of this.#terminating) {
      try {
        await callback(this)
      } catch (error) {
        errors.push(error)
      }
    }
    for (const provider of [...this.#providers].reverse()) {
      try {
        await provider.shutdown?.()
      } catch (error) {
        errors.push(error)
      }
    }
    this.#state = 'terminated'
    this.#removeSignalHandlers()
    if (Container.getInstance() === this) Container.setInstance(undefined)
    if (errors.length > 0)
      throw new AggregateError(errors, 'The application did not shut down cleanly.')
  }

  #registerProvider(provider: ProviderClass): ProviderInstance {
    const instance = new provider(this) as ProviderInstance
    this.#providers.push(instance)
    instance.register?.()
    return instance
  }

  async #loadDeferred(entry: DeferredProvider): Promise<void> {
    const module = await entry.load()
    await this.register(module.default)
  }

  async #loadConfiguration(): Promise<void> {
    const dir = this.configPath()
    if (existsSync(dir)) {
      const files = readdirSync(dir)
        .filter((file) => /\.(ts|js|mjs)$/.test(file) && !file.endsWith('.d.ts'))
        .sort()
      for (const file of files) {
        const key = file.replace(/\.(ts|js|mjs)$/, '')
        if (key in this.#presetConfig || this.config.has(key as ConfigPath)) continue
        const module = (await import(pathToFileURL(join(dir, file)).href)) as { default?: unknown }
        this.config.set(key as ConfigPath, module.default ?? {})
      }
    }
    this.#environment = this.#detectEnvironment()
  }

  #detectEnvironment(): string {
    if (this.#forcedEnvironment) return this.#forcedEnvironment
    const fromAppEnv = normalizeEnvironment(process.env.APP_ENV)
    if (fromAppEnv) return fromAppEnv
    if (process.env.NODE_ENV === 'test') return 'testing'
    const fromConfig = dataGet(this.config.all(), 'app.env')
    if (typeof fromConfig === 'string' && fromConfig !== '') {
      return normalizeEnvironment(fromConfig) ?? 'local'
    }
    return normalizeEnvironment(process.env.NODE_ENV) ?? 'local'
  }

  #installSignalHandlers(): void {
    const handler = (signal: NodeJS.Signals): void => {
      if (this.#terminatePromise) {
        console.error(`Received ${signal} again, exiting now.`)
        process.exit(1)
      }
      const timer = setTimeout(() => {
        console.error(`Shutdown took longer than ${this.shutdownTimeout} ms, exiting.`)
        process.exit(1)
      }, this.shutdownTimeout)
      this.terminate().then(
        () => {
          clearTimeout(timer)
          process.exit()
        },
        (error: unknown) => {
          console.error(error)
          process.exit(1)
        },
      )
    }
    this.#signalHandler = handler
    process.on('SIGINT', handler)
    process.on('SIGTERM', handler)
  }

  #removeSignalHandlers(): void {
    if (!this.#signalHandler) return
    process.off('SIGINT', this.#signalHandler)
    process.off('SIGTERM', this.#signalHandler)
    this.#signalHandler = undefined
  }
}

function isDeferred(entry: ProviderEntry): entry is DeferredProvider {
  return typeof entry === 'object' && entry !== null && 'load' in entry
}

function normalizeEnvironment(value: string | undefined): string | undefined {
  if (!value) return undefined
  const lower = value.trim().toLowerCase()
  if (lower === 'test') return 'testing'
  if (lower === 'development' || lower === 'dev') return 'local'
  if (lower === 'prod') return 'production'
  return lower
}
