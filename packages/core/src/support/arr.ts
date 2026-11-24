import { randomInt } from 'node:crypto'
import { dataGet, dataHas, dataSet } from './data.ts'

type Flat<T> = T extends readonly (infer U)[] ? Flat<U> : T

/** Array and object helpers with Laravel's names. Paths use dots: `'user.address.city'`. */
export interface ArrHelpers {
  /** Reads a nested value by dot path. */
  get(target: unknown, path: string, fallback?: unknown): unknown
  /** Writes a nested value by dot path, creating missing objects. */
  set(target: Record<string, unknown>, path: string, value: unknown): void
  /** True when the dot path exists. */
  has(target: unknown, path: string): boolean
  /** A copy with only the given keys. */
  only<T extends object, K extends keyof T>(target: T, keys: readonly K[]): Pick<T, K>
  /** A copy without the given keys. */
  except<T extends object, K extends keyof T>(target: T, keys: readonly K[]): Omit<T, K>
  /** Wraps a value in an array, unless it is one. `null` and `undefined` become `[]`. */
  wrap<T>(value: T | readonly T[] | null | undefined): T[]
  /** Flattens nested arrays completely. */
  flatten<T>(items: readonly T[]): Flat<T>[]
  /** Flattens one level. */
  collapse<T>(items: readonly (readonly T[])[]): T[]
  /** The values at one key of every item. */
  pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][]
  /** The first item, or the first that passes the test. */
  first<T>(items: readonly T[], test?: (item: T, index: number) => boolean): T | undefined
  /** The last item, or the last that passes the test. */
  last<T>(items: readonly T[], test?: (item: T, index: number) => boolean): T | undefined
  /** A shuffled copy (Fisher–Yates with a cryptographic random source). */
  shuffle<T>(items: readonly T[]): T[]
  /** One random item. */
  random<T>(items: readonly T[]): T | undefined
}

export const Arr: ArrHelpers = {
  get: dataGet,
  set: dataSet,
  has: dataHas,

  only<T extends object, K extends keyof T>(target: T, keys: readonly K[]): Pick<T, K> {
    const result = {} as Pick<T, K>
    for (const key of keys) if (Object.hasOwn(target, key)) result[key] = target[key]
    return result
  },

  except<T extends object, K extends keyof T>(target: T, keys: readonly K[]): Omit<T, K> {
    const result = { ...target }
    for (const key of keys) delete result[key]
    return result
  },

  wrap<T>(value: T | readonly T[] | null | undefined): T[] {
    if (value === null || value === undefined) return []
    return Array.isArray(value) ? [...(value as T[])] : [value as T]
  },

  flatten<T>(items: readonly T[]): Flat<T>[] {
    return items.flat(Number.POSITIVE_INFINITY) as Flat<T>[]
  },

  collapse<T>(items: readonly (readonly T[])[]): T[] {
    return items.flat() as T[]
  },

  pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
    return items.map((item) => item[key])
  },

  first<T>(items: readonly T[], test?: (item: T, index: number) => boolean): T | undefined {
    return test ? items.find(test) : items[0]
  },

  last<T>(items: readonly T[], test?: (item: T, index: number) => boolean): T | undefined {
    return test ? items.findLast(test) : items.at(-1)
  },

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index--) {
      const other = randomInt(index + 1)
      ;[copy[index], copy[other]] = [copy[other] as T, copy[index] as T]
    }
    return copy
  },

  random<T>(items: readonly T[]): T | undefined {
    return items.length === 0 ? undefined : items[randomInt(items.length)]
  },
}
