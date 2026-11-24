declare const tokenType: unique symbol

/**
 * A typed symbol that stands for an interface in the container, since interfaces do not exist at
 * runtime:
 *
 * ```ts
 * export const Cache: Token<CacheStore> = token('Cache')
 * app.singleton(Cache, () => new RedisStore())
 * app.make(Cache) // CacheStore
 * ```
 */
export type Token<T> = symbol & { readonly [tokenType]?: T }

/** Any class, concrete or abstract. A class is its own container token. */
export type Constructor<T = unknown> = abstract new (...args: never[]) => T

/** Anything the container can resolve: a class or a typed symbol token. */
export type BindingKey<T = unknown> = Constructor<T> | Token<T>

/** A function that builds a value. It receives the container to resolve what it needs. */
export type Factory<T, C = unknown> = (container: C) => T

/** The constructor dependencies a class declares with `static inject`. */
export type InjectList = readonly BindingKey[]

/** Creates a typed symbol token. The description shows in error messages. */
export function token<T>(description: string): Token<T> {
  return Symbol(description) as Token<T>
}

/** A readable name for a token, used in error messages. */
export function describeToken(key: unknown): string {
  if (typeof key === 'function') return key.name || '<anonymous class>'
  if (typeof key === 'symbol') return key.description ? `Symbol(${key.description})` : 'Symbol()'
  return String(key)
}

/** True when the function is a class rather than a factory function. */
export function isClass(value: unknown): value is new (...args: unknown[]) => unknown {
  return (
    typeof value === 'function' &&
    value.prototype !== undefined &&
    /^class[\s{]/.test(Function.prototype.toString.call(value))
  )
}
