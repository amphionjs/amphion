import { Collection } from './collection.ts'

type Source<T> = Iterable<T> | AsyncIterable<T> | (() => Iterable<T> | AsyncIterable<T>)
type Awaitable<T> = T | Promise<T>

/**
 * A collection that pulls items one at a time from a (sync or async) iterable, so it can walk
 * millions of rows or a stream without holding them all in memory. Laravel's `LazyCollection`.
 *
 * ```ts
 * await LazyCollection.make(readLines('big.csv'))
 *   .filter((line) => line !== '')
 *   .map(parseRow)
 *   .chunk(500)
 *   .each((rows) => insert(rows))
 * ```
 *
 * Callbacks may be async. Nothing runs until a terminal method (`each`, `reduce`, `collect`,
 * `all`, `first`, `count`) or a `for await` loop pulls items.
 */
export class LazyCollection<T> implements AsyncIterable<T> {
  /** A lazy collection over an iterable, an async iterable, or a function returning one. */
  static make<T>(source: Source<T>): LazyCollection<T> {
    return new LazyCollection(source)
  }

  readonly #source: Source<T>

  constructor(source: Source<T>) {
    this.#source = source
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    const source = typeof this.#source === 'function' ? this.#source() : this.#source
    yield* source as AsyncIterable<T>
  }

  map<R>(callback: (item: T, index: number) => Awaitable<R>): LazyCollection<R> {
    return this.#pipe<R>(async function* (items) {
      let index = 0
      for await (const item of items) yield (await callback(item as T, index++)) as R
    })
  }

  filter(test: (item: T, index: number) => Awaitable<unknown> = Boolean): LazyCollection<T> {
    return this.#pipe<T>(async function* (items) {
      let index = 0
      for await (const item of items) if (await test(item as T, index++)) yield item as T
    })
  }

  reject(test: (item: T, index: number) => Awaitable<unknown>): LazyCollection<T> {
    return this.filter(async (item, index) => !(await test(item, index)))
  }

  /** The first `limit` items. Stops pulling from the source after that. */
  take(limit: number): LazyCollection<T> {
    return this.#pipe<T>(async function* (items) {
      if (limit <= 0) return
      let taken = 0
      for await (const item of items) {
        yield item as T
        if (++taken >= limit) return
      }
    })
  }

  /** Items while the test passes; stops at the first failure. */
  takeWhile(test: (item: T, index: number) => Awaitable<unknown>): LazyCollection<T> {
    return this.#pipe<T>(async function* (items) {
      let index = 0
      for await (const item of items) {
        if (!(await test(item as T, index++))) return
        yield item as T
      }
    })
  }

  skip(count: number): LazyCollection<T> {
    return this.#pipe<T>(async function* (items) {
      let index = 0
      for await (const item of items) if (index++ >= count) yield item as T
    })
  }

  /** Groups items into arrays of `size`. */
  chunk(size: number): LazyCollection<T[]> {
    return this.#pipe<T[]>(async function* (items) {
      if (size <= 0) return
      let chunk: T[] = []
      for await (const item of items) {
        chunk.push(item as T)
        if (chunk.length === size) {
          yield chunk
          chunk = []
        }
      }
      if (chunk.length > 0) yield chunk
    })
  }

  /** Calls `callback` for each item. Return `false` to stop early. */
  async each(callback: (item: T, index: number) => Awaitable<unknown>): Promise<void> {
    let index = 0
    for await (const item of this) if ((await callback(item as T, index++)) === false) return
  }

  async reduce<R>(
    callback: (carry: R, item: T, index: number) => Awaitable<R>,
    initial: R,
  ): Promise<R> {
    let carry = initial
    let index = 0
    for await (const item of this) carry = await callback(carry, item as T, index++)
    return carry
  }

  /** The first item, or the first that passes the test. Stops pulling after it. */
  async first(test?: (item: T, index: number) => Awaitable<unknown>): Promise<T | undefined> {
    let index = 0
    for await (const item of this) if (!test || (await test(item as T, index++))) return item as T
    return undefined
  }

  async count(): Promise<number> {
    let count = 0
    for await (const _ of this) count++
    return count
  }

  /** Every item, in memory. */
  async all(): Promise<T[]> {
    const items: T[] = []
    for await (const item of this) items.push(item as T)
    return items
  }

  /** Every item, as an eager {@link Collection}. */
  async collect(): Promise<Collection<T>> {
    return new Collection(await this.all())
  }

  #pipe<R>(step: (items: AsyncIterable<T>) => AsyncGenerator<R>): LazyCollection<R> {
    return new LazyCollection(() => step(this))
  }
}
