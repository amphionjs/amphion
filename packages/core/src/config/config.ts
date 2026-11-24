import { dataGet, dataHas, dataSet } from '../support/data.ts'

/**
 * The shape of the app's config, keyed by file name in `config/`. Apps fill it in once, in
 * `types/config.ts`, so `config.get()` paths and values are typed:
 *
 * ```ts
 * declare module '@amphion/core' {
 *   interface ConfigRegistry {
 *     app: typeof import('#config/app.ts').default
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled in by apps through module augmentation
export interface ConfigRegistry {}

type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6]

/** Values that are read whole: dot paths never descend into them. */
type ConfigLeaf =
  | readonly unknown[]
  | ((...args: never[]) => unknown)
  | Date
  | RegExp
  | URL
  | Map<unknown, unknown>
  | Set<unknown>

/** Every dot path into `T` (`'database'`, `'database.connections'`, ...), up to 7 levels deep. */
export type DotPath<T, Depth extends number = 7> = [Depth] extends [never]
  ? never
  : T extends ConfigLeaf
    ? never
    : T extends object
      ? {
          [K in keyof T & string]: NonNullable<T[K]> extends ConfigLeaf
            ? K
            : NonNullable<T[K]> extends object
              ? K | `${K}.${DotPath<NonNullable<T[K]>, PrevDepth[Depth]>}`
              : K
        }[keyof T & string]
      : never

/** The type at a dot path into `T`. */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? PathValue<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

type RegistryIsEmpty = keyof ConfigRegistry extends never ? true : false

/** A typed config path, or any string while the app has not filled in {@link ConfigRegistry}. */
export type ConfigPath = RegistryIsEmpty extends true ? string : DotPath<ConfigRegistry>

/** The type of the config value at a path. */
export type ConfigValue<P extends string> = RegistryIsEmpty extends true
  ? unknown
  : PathValue<ConfigRegistry, P>

/**
 * Marks a config file's default export. It returns its argument unchanged; it exists so the type
 * is inferred from the object and editors can suggest keys.
 *
 * ```ts
 * // config/app.ts
 * export default defineConfig({ name: env.get('APP_NAME'), port: env.get('PORT') })
 * ```
 */
export function defineConfig<T extends Record<string, unknown>>(config: T): T {
  return config
}

/**
 * Holds the loaded config. Read values with dot paths: `config.get('database.connections.pg')`.
 * Config is loaded once at boot; the process stays alive, so no config cache is needed.
 */
export class ConfigRepository {
  readonly #items: Record<string, unknown>

  constructor(items: Record<string, unknown> = {}) {
    this.#items = items
  }

  /** Reads a value. Returns `defaultValue` when the path is missing. */
  get<P extends ConfigPath>(path: P): ConfigValue<P>
  get<P extends ConfigPath, D>(path: P, defaultValue: D): NonNullable<ConfigValue<P>> | D
  get(path: string, defaultValue?: unknown): unknown {
    return dataGet(this.#items, path, defaultValue)
  }

  /** True when the path exists. */
  has(path: ConfigPath): boolean {
    return dataHas(this.#items, path)
  }

  /** Changes a value at runtime, mostly in tests. */
  set(path: ConfigPath, value: unknown): void {
    dataSet(this.#items, path, value)
  }

  /** Every config value, keyed by file name. */
  all(): Record<string, unknown> {
    return this.#items
  }
}
