import { Arr } from './arr.ts'
import { addMacro, hasMacro } from './macroable.ts'

/** A key of each item, or a function that computes a value from it. */
export type Accessor<T, R = unknown> = keyof T | ((item: T, index: number) => R)

/** Operators accepted by `where(key, operator, value)`. Equality is strict (`===`). */
export type WhereOperator = '=' | '==' | '===' | '!=' | '!==' | '<>' | '<' | '<=' | '>' | '>='

type Flat<T> = T extends readonly (infer U)[]
  ? Flat<U>
  : T extends Collection<infer V>
    ? Flat<V>
    : T

function read<T, R>(item: T, accessor: Accessor<T, R>, index: number): R {
  return typeof accessor === 'function'
    ? (accessor as (item: T, index: number) => R)(item, index)
    : ((item as Record<PropertyKey, R>)[accessor as PropertyKey] as R)
}

function compare(left: unknown, operator: WhereOperator, right: unknown): boolean {
  switch (operator) {
    case '=':
    case '==':
    case '===':
      return left === right
    case '!=':
    case '!==':
    case '<>':
      return left !== right
    case '<':
      return (left as number) < (right as number)
    case '<=':
      return (left as number) <= (right as number)
    case '>':
      return (left as number) > (right as number)
    case '>=':
      return (left as number) >= (right as number)
  }
}

function sortValue(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined || a === null) return 1
  if (b === undefined || b === null) return -1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  return (a as number) < (b as number) ? -1 : 1
}

/**
 * A fluent wrapper around an array with Laravel's Collection API. Every method returns a new
 * collection; the original is never changed (except by `push`, as in Laravel).
 *
 * ```ts
 * collect(users).where('active', true).sortBy('name').pluck('email').all()
 * ```
 *
 * Laravel collections can also hold keyed items; in JavaScript a collection is always a list.
 * `groupBy`, `keyBy` and `countBy` return plain objects instead, which serialize to the same
 * JSON as Laravel's keyed collections.
 */
export class Collection<T> implements Iterable<T> {
  /** Adds a method to every collection. Type it by augmenting the `Collection` interface. */
  static macro<C extends Collection<unknown>>(
    name: string,
    fn: (this: C, ...args: never[]) => unknown,
  ): void {
    addMacro(Collection.prototype, name, fn as (...args: never[]) => unknown)
  }

  /** True when `name` was added with {@link Collection.macro}. */
  static hasMacro(name: string): boolean {
    return hasMacro(Collection.prototype, name)
  }

  /** A collection from any iterable. */
  static make<T>(items: Iterable<T> = []): Collection<T> {
    return new Collection(items)
  }

  /** A collection of `count` values built by `callback(1)`, `callback(2)`, ... */
  static times<T>(count: number, callback: (number: number) => T): Collection<T> {
    return new Collection(
      Array.from({ length: Math.max(0, count) }, (_, index) => callback(index + 1)),
    )
  }

  /** A collection of integers from `from` to `to`, inclusive. */
  static range(from: number, to: number, step = 1): Collection<number> {
    const items: number[] = []
    if (step <= 0) throw new RangeError('The step must be greater than zero.')
    if (from <= to) for (let value = from; value <= to; value += step) items.push(value)
    else for (let value = from; value >= to; value -= step) items.push(value)
    return new Collection(items)
  }

  protected items: T[]

  constructor(items: Iterable<T> = []) {
    this.items = Array.isArray(items) ? [...items] : Array.from(items)
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]()
  }

  // Reading ---------------------------------------------------------------------------------

  /** The items as an array (a copy). */
  all(): T[] {
    return [...this.items]
  }

  /** The number of items. */
  count(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  isNotEmpty(): boolean {
    return this.items.length > 0
  }

  /** The first item, or the first that passes the test. */
  first(test?: (item: T, index: number) => boolean): T | undefined {
    return Arr.first(this.items, test)
  }

  /** The last item, or the last that passes the test. */
  last(test?: (item: T, index: number) => boolean): T | undefined {
    return Arr.last(this.items, test)
  }

  /** The first item whose `key` equals `value`. */
  firstWhere<K extends keyof T>(key: K, value: T[K]): T | undefined {
    return this.items.find((item) => item[key] === value)
  }

  /** The item at an index; negative indexes count from the end. */
  get(index: number): T | undefined {
    return this.items.at(index)
  }

  /** True when the collection holds the value, or an item passes the test. */
  contains(valueOrTest: T | ((item: T, index: number) => boolean)): boolean
  /** True when an item's `key` equals `value`. */
  contains<K extends keyof T>(key: K, value: T[K]): boolean
  contains(...args: unknown[]): boolean {
    if (args.length === 2) {
      const [key, value] = args as [keyof T, unknown]
      return this.items.some((item) => item[key] === value)
    }
    const [needle] = args
    if (typeof needle === 'function') {
      return this.items.some(needle as (item: T, index: number) => boolean)
    }
    return this.items.includes(needle as T)
  }

  /** True when every item passes the test. */
  every(test: (item: T, index: number) => boolean): boolean {
    return this.items.every(test)
  }

  /** The index of the first item that equals the value or passes the test, or `-1`. */
  search(valueOrTest: T | ((item: T, index: number) => boolean)): number {
    return typeof valueOrTest === 'function'
      ? this.items.findIndex(valueOrTest as (item: T, index: number) => boolean)
      : this.items.indexOf(valueOrTest)
  }

  // Transforming -----------------------------------------------------------------------------

  map<R>(callback: (item: T, index: number) => R): Collection<R> {
    return new Collection(this.items.map(callback))
  }

  flatMap<R>(callback: (item: T, index: number) => R | readonly R[]): Collection<R> {
    return new Collection(this.items.flatMap(callback))
  }

  /** Keeps the items that pass the test, or the truthy items when no test is given. */
  filter(test?: (item: T, index: number) => unknown): Collection<T> {
    return new Collection(this.items.filter(test ?? Boolean))
  }

  /** Removes the items that pass the test. */
  reject(test: (item: T, index: number) => unknown): Collection<T> {
    return new Collection(this.items.filter((item, index) => !test(item, index)))
  }

  /** Calls `callback` for each item. Return `false` to stop early. */
  each(callback: (item: T, index: number) => unknown): this {
    for (let index = 0; index < this.items.length; index++) {
      if (callback(this.items[index] as T, index) === false) break
    }
    return this
  }

  reduce<R>(callback: (carry: R, item: T, index: number) => R, initial: R): R {
    return this.items.reduce(callback, initial)
  }

  /** The values at one key of every item. */
  pluck<K extends keyof T>(key: K): Collection<T[K]> {
    return new Collection(Arr.pluck(this.items, key))
  }

  /** Flattens nested arrays and collections. */
  flatten(depth: number = Number.POSITIVE_INFINITY): Collection<Flat<T>> {
    const flat = (items: readonly unknown[], level: number): unknown[] =>
      items.flatMap((item) => {
        const inner = item instanceof Collection ? item.all() : item
        return Array.isArray(inner) && level > 0 ? flat(inner, level - 1) : [inner]
      })
    return new Collection(flat(this.items, depth) as Flat<T>[])
  }

  /** Splits into collections of `size` items. */
  chunk(size: number): Collection<Collection<T>> {
    if (size <= 0) return new Collection()
    const chunks: Collection<T>[] = []
    for (let index = 0; index < this.items.length; index += size) {
      chunks.push(new Collection(this.items.slice(index, index + size)))
    }
    return new Collection(chunks)
  }

  /** Splits into the items that pass the test and the items that do not. */
  partition(test: (item: T, index: number) => unknown): [Collection<T>, Collection<T>] {
    const passed: T[] = []
    const failed: T[] = []
    this.items.forEach((item, index) => {
      ;(test(item, index) ? passed : failed).push(item)
    })
    return [new Collection(passed), new Collection(failed)]
  }

  /** Pairs each item with the item at the same index of every other array. */
  zip<U>(other: Iterable<U>): Collection<[T, U | undefined]> {
    const others = [...other]
    return new Collection(
      this.items.map((item, index): [T, U | undefined] => [item, others[index]]),
    )
  }

  /** Items whose `key` equals `value`, or compares with it using `operator`. */
  where<K extends keyof T>(key: K, value: T[K]): Collection<T>
  where<K extends keyof T>(key: K, operator: WhereOperator, value: unknown): Collection<T>
  where<K extends keyof T>(key: K, ...rest: unknown[]): Collection<T> {
    const [operator, value] =
      rest.length === 1 ? (['===', rest[0]] as const) : (rest as [WhereOperator, unknown])
    return this.filter((item) => compare(item[key], operator, value))
  }

  /** Items whose `key` is one of `values`. */
  whereIn<K extends keyof T>(key: K, values: readonly T[K][]): Collection<T> {
    const set = new Set(values)
    return this.filter((item) => set.has(item[key]))
  }

  /** Items whose `key` is not one of `values`. */
  whereNotIn<K extends keyof T>(key: K, values: readonly T[K][]): Collection<T> {
    const set = new Set(values)
    return this.reject((item) => set.has(item[key]))
  }

  /** Items whose `key` is `null` or `undefined`. */
  whereNull<K extends keyof T>(key: K): Collection<T> {
    return this.filter((item) => item[key] === null || item[key] === undefined)
  }

  /** Items whose `key` is not `null` or `undefined`. */
  whereNotNull<K extends keyof T>(key: K): Collection<T> {
    return this.reject((item) => item[key] === null || item[key] === undefined)
  }

  /** Removes duplicates, compared by the item or by a key or callback. */
  unique(accessor?: Accessor<T>): Collection<T> {
    const seen = new Set<unknown>()
    return this.filter((item, index) => {
      const value = accessor === undefined ? item : read(item, accessor, index)
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
  }

  /** Sorts by the items themselves, or with a compare function. */
  sort(compareFn?: (a: T, b: T) => number): Collection<T> {
    return new Collection([...this.items].sort(compareFn ?? sortValue))
  }

  /** Sorts ascending by a key or a callback. */
  sortBy(accessor: Accessor<T>): Collection<T> {
    const keyed = this.items.map((item, index) => ({ item, key: read(item, accessor, index) }))
    keyed.sort((a, b) => sortValue(a.key, b.key))
    return new Collection(keyed.map((entry) => entry.item))
  }

  /** Sorts descending by a key or a callback. */
  sortByDesc(accessor: Accessor<T>): Collection<T> {
    return this.sortBy(accessor).reverse()
  }

  reverse(): Collection<T> {
    return new Collection([...this.items].reverse())
  }

  /** Resets indexes. A no-op for list collections, kept for Laravel parity. */
  values(): Collection<T> {
    return new Collection(this.items)
  }

  /** The first `limit` items, or the last ones when `limit` is negative. */
  take(limit: number): Collection<T> {
    return new Collection(limit < 0 ? this.items.slice(limit) : this.items.slice(0, limit))
  }

  /** Everything except the first `count` items. */
  skip(count: number): Collection<T> {
    return new Collection(this.items.slice(count))
  }

  /** The items from `offset`, at most `length` of them. */
  slice(offset: number, length?: number): Collection<T> {
    const start = offset < 0 ? Math.max(0, this.items.length + offset) : offset
    return new Collection(
      length === undefined ? this.items.slice(start) : this.items.slice(start, start + length),
    )
  }

  /** The items of this collection followed by `other`. */
  concat<U>(other: Iterable<U>): Collection<T | U> {
    return new Collection<T | U>([...this.items, ...other])
  }

  /** Alias of {@link concat}, Laravel's name for list collections. */
  merge<U>(other: Iterable<U>): Collection<T | U> {
    return this.concat(other)
  }

  /** The items that are not in `other`. */
  diff(other: Iterable<T>): Collection<T> {
    const set = new Set(other)
    return this.reject((item) => set.has(item))
  }

  /** The items that are also in `other`. */
  intersect(other: Iterable<T>): Collection<T> {
    const set = new Set(other)
    return this.filter((item) => set.has(item))
  }

  /** Adds items to the end. Changes this collection, as in Laravel. */
  push(...items: T[]): this {
    this.items.push(...items)
    return this
  }

  // Grouping ---------------------------------------------------------------------------------

  /** Groups items by a key or callback: `{ [group]: Collection }`. */
  groupBy(accessor: Accessor<T>): Record<string, Collection<T>> {
    const groups: Record<string, Collection<T>> = Object.create(null)
    this.items.forEach((item, index) => {
      const group = String(read(item, accessor, index))
      groups[group] ??= new Collection()
      groups[group].push(item)
    })
    return groups
  }

  /** Keys items by a key or callback: `{ [key]: item }`. Later items win. */
  keyBy(accessor: Accessor<T>): Record<string, T> {
    const keyed: Record<string, T> = Object.create(null)
    this.items.forEach((item, index) => {
      keyed[String(read(item, accessor, index))] = item
    })
    return keyed
  }

  /** Counts items per value, or per key or callback result. */
  countBy(accessor?: Accessor<T>): Record<string, number> {
    const counts: Record<string, number> = Object.create(null)
    this.items.forEach((item, index) => {
      const group = String(accessor === undefined ? item : read(item, accessor, index))
      counts[group] = (counts[group] ?? 0) + 1
    })
    return counts
  }

  /** Builds an object from `[key, value]` pairs returned by the callback. */
  mapWithKeys<V>(
    callback: (item: T, index: number) => readonly [PropertyKey, V],
  ): Record<string, V> {
    const result: Record<string, V> = Object.create(null)
    this.items.forEach((item, index) => {
      const [key, value] = callback(item, index)
      result[String(key)] = value
    })
    return result
  }

  // Aggregates ---------------------------------------------------------------------------------

  /** The sum of the items, or of a key or callback. */
  sum(accessor?: Accessor<T, number>): number {
    return this.#numbers(accessor).reduce((total, value) => total + value, 0)
  }

  /** The average, or `undefined` for an empty collection. */
  avg(accessor?: Accessor<T, number>): number | undefined {
    return this.items.length === 0 ? undefined : this.sum(accessor) / this.items.length
  }

  /** The smallest value, or `undefined` for an empty collection. */
  min(accessor?: Accessor<T, number>): number | undefined {
    const values = this.#numbers(accessor)
    return values.length === 0 ? undefined : values.reduce((a, b) => Math.min(a, b))
  }

  /** The largest value, or `undefined` for an empty collection. */
  max(accessor?: Accessor<T, number>): number | undefined {
    const values = this.#numbers(accessor)
    return values.length === 0 ? undefined : values.reduce((a, b) => Math.max(a, b))
  }

  /** Joins the items (or a key of each) into a string. */
  implode(glue: string): string
  implode<K extends keyof T>(key: K, glue: string): string
  implode(keyOrGlue: string | keyof T, glue?: string): string {
    if (glue === undefined) return this.items.join(keyOrGlue as string)
    return this.items.map((item) => item[keyOrGlue as keyof T]).join(glue)
  }

  /** Joins with `glue`, using `finalGlue` before the last item: `'a, b and c'`. */
  join(glue: string, finalGlue = ''): string {
    if (finalGlue === '' || this.items.length < 2) return this.items.join(glue)
    return `${this.items.slice(0, -1).join(glue)}${finalGlue}${String(this.items.at(-1))}`
  }

  // Control flow -------------------------------------------------------------------------------

  /** Passes the collection to a callback and returns what it returns. */
  pipe<R>(callback: (collection: this) => R): R {
    return callback(this)
  }

  /** Passes the collection to a callback and returns the collection. */
  tap(callback: (collection: this) => void): this {
    callback(this)
    return this
  }

  /** Runs `callback` when `condition` is truthy, otherwise `fallback`. */
  when<R = this>(
    condition: unknown,
    callback: (collection: this) => R,
    fallback?: (collection: this) => R,
  ): R | this {
    if (condition) return callback(this)
    return fallback ? fallback(this) : this
  }

  /** Runs `callback` when `condition` is falsy, otherwise `fallback`. */
  unless<R = this>(
    condition: unknown,
    callback: (collection: this) => R,
    fallback?: (collection: this) => R,
  ): R | this {
    return this.when(!condition, callback, fallback)
  }

  // Output -------------------------------------------------------------------------------------

  /** A plain array; nested collections become arrays too. */
  toArray(): unknown[] {
    return this.items.map((item) => (item instanceof Collection ? item.toArray() : item))
  }

  toJSON(): unknown[] {
    return this.toArray()
  }

  #numbers(accessor?: Accessor<T, number>): number[] {
    return this.items.map((item, index) =>
      Number(accessor === undefined ? item : read(item, accessor, index)),
    )
  }
}

/** Wraps any iterable in a {@link Collection}. Laravel's `collect()`. */
export function collect<T>(items: Iterable<T> = []): Collection<T> {
  return new Collection(items)
}
