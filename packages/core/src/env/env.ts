import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { InvalidEnvException } from '../exceptions/errors.ts'

type Parse<T> = (raw: string) => { ok: true; value: T } | { ok: false; reason: string }

/**
 * One variable in an env schema. Built with `Env.string()`, `Env.number()` and friends, then
 * narrowed with `.optional()` or `.default(value)`.
 */
export class EnvRule<T> {
  readonly #parse: Parse<unknown>
  readonly #optional: boolean
  readonly #fallback: { value: unknown } | undefined

  constructor(parse: Parse<T>, optional = false, fallback?: { value: unknown }) {
    this.#parse = parse
    this.#optional = optional
    this.#fallback = fallback
  }

  /** Allows the variable to be missing; its type gains `undefined`. */
  optional(): EnvRule<T | undefined> {
    return new EnvRule<T | undefined>(this.#parse as Parse<T>, true, this.#fallback)
  }

  /** The value to use when the variable is missing. */
  default(value: NonNullable<T>): EnvRule<NonNullable<T>> {
    return new EnvRule<NonNullable<T>>(this.#parse as Parse<NonNullable<T>>, false, { value })
  }

  /** Validates one raw value. An empty string counts as missing. */
  validate(raw: string | undefined): { ok: true; value: T } | { ok: false; reason: string } {
    if (raw === undefined || raw === '') {
      if (this.#fallback) return { ok: true, value: this.#fallback.value as T }
      if (this.#optional) return { ok: true, value: undefined as T }
      return { ok: false, reason: 'is missing' }
    }
    return this.#parse(raw) as { ok: true; value: T } | { ok: false; reason: string }
  }
}

/** A schema: variable name → rule. */
export type EnvSchema = Record<string, EnvRule<unknown>>

/** The typed values a schema produces. */
export type EnvValues<S extends EnvSchema> = {
  [K in keyof S]: S[K] extends EnvRule<infer T> ? T : never
}

/** Options for {@link Env.create}. */
export interface EnvOptions {
  /**
   * The real environment, which wins over the `.env` files. Defaults to `process.env`; tests pass
   * their own object.
   */
  source?: Record<string, string | undefined>
  /** Which `.env.<environment>` file to load after `.env`. Defaults to `APP_ENV`. */
  environment?: string
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])
const FALSE_VALUES = new Set(['false', '0', 'no', 'off'])

/**
 * Typed, validated environment variables. Declare a schema once (in `bootstrap/env.ts`) and
 * boot fails with one clear error that lists every missing or invalid variable:
 *
 * ```ts
 * export default Env.create(new URL('..', import.meta.url), {
 *   APP_KEY: Env.string(),
 *   PORT: Env.number().default(3000),
 *   APP_ENV: Env.enum(['local', 'testing', 'production'] as const).default('local'),
 * })
 * ```
 *
 * Files are read with Node's built-in `util.parseEnv`: `.env`, then `.env.<APP_ENV>`. Real
 * environment variables win. `process.env` is never modified, so secrets from `.env` do not
 * leak into child processes.
 */
export class Env<T extends Record<string, unknown>> {
  /** A string. */
  static string(): EnvRule<string> {
    return new EnvRule((raw) => ({ ok: true, value: raw }))
  }

  /** A finite number, such as a port. */
  static number(): EnvRule<number> {
    return new EnvRule((raw) => {
      const value = Number(raw)
      return raw.trim() !== '' && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, reason: 'must be a number' }
    })
  }

  /** A boolean: `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` (any case). */
  static boolean(): EnvRule<boolean> {
    return new EnvRule((raw) => {
      const lower = raw.trim().toLowerCase()
      if (TRUE_VALUES.has(lower)) return { ok: true, value: true }
      if (FALSE_VALUES.has(lower)) return { ok: true, value: false }
      return { ok: false, reason: 'must be true or false' }
    })
  }

  /** One of a fixed list of strings. Pass the list `as const` to get a union type. */
  static enum<const V extends readonly string[]>(values: V): EnvRule<V[number]> {
    return new EnvRule((raw) =>
      values.includes(raw)
        ? { ok: true, value: raw as V[number] }
        : { ok: false, reason: `must be one of: ${values.join(', ')}` },
    )
  }

  /** An absolute URL, kept as a string. */
  static url(): EnvRule<string> {
    return new EnvRule((raw) =>
      URL.canParse(raw) ? { ok: true, value: raw } : { ok: false, reason: 'must be a valid URL' },
    )
  }

  /**
   * Reads the `.env` files in `basePath`, merges the real environment over them, and validates
   * the result against the schema.
   */
  static create<S extends EnvSchema>(
    basePath: string | URL,
    schema: S,
    options: EnvOptions = {},
  ): Env<EnvValues<S>> {
    const dir = typeof basePath === 'string' ? basePath : fileURLToPath(basePath)
    const source = options.source ?? process.env
    const environment =
      options.environment ?? source.APP_ENV ?? (source.NODE_ENV === 'test' ? 'testing' : undefined)

    const fromFiles: Record<string, string> = {}
    const files = ['.env', ...(environment ? [`.env.${environment}`] : [])]
    for (const file of files) {
      const path = join(dir, file)
      if (existsSync(path)) Object.assign(fromFiles, parseEnv(readFileSync(path, 'utf8')))
    }

    return Env.validate(schema, { ...fromFiles, ...definedOnly(source) })
  }

  /** Validates a plain object against a schema, without reading any file. */
  static validate<S extends EnvSchema>(
    schema: S,
    values: Record<string, string | undefined>,
  ): Env<EnvValues<S>> {
    const result: Record<string, unknown> = {}
    const problems: string[] = []
    for (const [name, rule] of Object.entries(schema)) {
      const checked = rule.validate(values[name])
      if (checked.ok) result[name] = checked.value
      else problems.push(`  - ${name} ${checked.reason}`)
    }
    if (problems.length > 0) {
      throw new InvalidEnvException(`Invalid environment variables:\n${problems.join('\n')}\n`, {
        help: 'Set them in .env (see .env.example) or in the process environment.',
      })
    }
    return new Env(result as EnvValues<S>)
  }

  readonly #values: T

  constructor(values: T) {
    this.#values = Object.freeze({ ...values })
  }

  /** The validated value of one variable. */
  get<K extends keyof T>(key: K): T[K] {
    return this.#values[key]
  }

  /** Every validated value. */
  all(): Readonly<T> {
    return this.#values
  }
}

function definedOnly(source: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) if (value !== undefined) result[key] = value
  return result
}
