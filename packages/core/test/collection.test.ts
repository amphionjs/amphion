import { describe, expect, expectTypeOf, it } from 'vitest'
import { Arr, Collection, collect, LazyCollection } from '../src/index.ts'

declare module '@amphion/core' {
  interface Collection<T> {
    toCsv(): string
  }
}

interface User {
  id: number
  name: string
  role: 'admin' | 'member'
  age: number
  team: string | null
}

const users: User[] = [
  { id: 1, name: 'Taylor', role: 'admin', age: 38, team: 'core' },
  { id: 2, name: 'Nima', role: 'admin', age: 30, team: 'core' },
  { id: 3, name: 'Abigail', role: 'member', age: 25, team: null },
  { id: 4, name: 'Dayle', role: 'member', age: 41, team: 'docs' },
]

describe('Arr', () => {
  it('reads and writes dot paths', () => {
    const target: Record<string, unknown> = { user: { address: { city: 'Tehran' } } }
    expect(Arr.get(target, 'user.address.city')).toBe('Tehran')
    expect(Arr.get(target, 'user.phone', 'none')).toBe('none')
    expect(Arr.has(target, 'user.address')).toBe(true)
    Arr.set(target, 'user.address.zip', '1234')
    expect(Arr.get(target, 'user.address.zip')).toBe('1234')
  })

  it('picks and wraps', () => {
    expect(Arr.only({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    expect(Arr.except({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    expect(Arr.wrap('x')).toEqual(['x'])
    expect(Arr.wrap(['x'])).toEqual(['x'])
    expect(Arr.wrap(null)).toEqual([])
    expect(Arr.flatten([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4])
    expect(Arr.collapse([[1], [2, 3]])).toEqual([1, 2, 3])
    expect(Arr.pluck(users, 'name')).toEqual(['Taylor', 'Nima', 'Abigail', 'Dayle'])
  })

  it('finds, shuffles and picks at random', () => {
    expect(Arr.first([1, 2, 3], (n) => n > 1)).toBe(2)
    expect(Arr.last([1, 2, 3], (n) => n < 3)).toBe(2)
    const shuffled = Arr.shuffle([1, 2, 3, 4, 5])
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5])
    expect([1, 2, 3]).toContain(Arr.random([1, 2, 3]))
    expect(Arr.random([])).toBeUndefined()
  })
})

describe('Collection', () => {
  it('filters, sorts and plucks fluently without changing the original', () => {
    const collection = collect(users)
    const names = collection.where('role', 'admin').sortBy('age').pluck('name')
    expect(names.all()).toEqual(['Nima', 'Taylor'])
    expectTypeOf(names).toEqualTypeOf<Collection<string>>()
    expect(collection.count()).toBe(4)
  })

  it('supports where operators and whereIn/whereNull', () => {
    const collection = collect(users)
    expect(collection.where('age', '>=', 38).pluck('id').all()).toEqual([1, 4])
    expect(collection.where('role', '!=', 'admin').pluck('id').all()).toEqual([3, 4])
    expect(collection.whereIn('id', [2, 4]).pluck('id').all()).toEqual([2, 4])
    expect(collection.whereNotIn('id', [2, 4]).pluck('id').all()).toEqual([1, 3])
    expect(collection.whereNull('team').pluck('id').all()).toEqual([3])
    expect(collection.whereNotNull('team').count()).toBe(3)
  })

  it('maps, filters, rejects and reduces', () => {
    const numbers = collect([1, 2, 3, 4, 5, 6])
    expect(numbers.map((n) => n * 2).all()).toEqual([2, 4, 6, 8, 10, 12])
    expect(numbers.filter((n) => n % 2 === 0).all()).toEqual([2, 4, 6])
    expect(numbers.reject((n) => n % 2 === 0).all()).toEqual([1, 3, 5])
    expect(numbers.reduce((carry, n) => carry + n, 0)).toBe(21)
    expect(collect([0, 1, '', 'a', null]).filter().all()).toEqual([1, 'a'])
    expect(numbers.flatMap((n) => [n, n]).count()).toBe(12)
  })

  it('aggregates', () => {
    const collection = collect(users)
    expect(collection.sum('age')).toBe(134)
    expect(collection.avg('age')).toBe(33.5)
    expect(collection.min('age')).toBe(25)
    expect(collection.max((user) => user.id)).toBe(4)
    expect(collect([1, 2, 3]).sum()).toBe(6)
    expect(collect<number>().avg()).toBeUndefined()
    expect(collect<number>().max()).toBeUndefined()
  })

  it('groups, keys and counts into plain objects', () => {
    const collection = collect(users)
    const groups = collection.groupBy('role')
    expect(Object.keys(groups)).toEqual(['admin', 'member'])
    expect(groups.admin?.pluck('name').all()).toEqual(['Taylor', 'Nima'])
    expect(JSON.parse(JSON.stringify(groups)).member).toHaveLength(2)
    expect(collection.keyBy('id')[3]?.name).toBe('Abigail')
    expect(collection.countBy('role')).toEqual({ admin: 2, member: 2 })
    expect(collection.countBy((user) => (user.age > 35 ? 'senior' : 'junior'))).toEqual({
      senior: 2,
      junior: 2,
    })
    expect(collection.mapWithKeys((user) => [user.name, user.id])).toEqual({
      Taylor: 1,
      Nima: 2,
      Abigail: 3,
      Dayle: 4,
    })
  })

  it('chunks, partitions, slices and zips', () => {
    const numbers = collect([1, 2, 3, 4, 5])
    expect(numbers.chunk(2).toArray()).toEqual([[1, 2], [3, 4], [5]])
    const [even, odd] = numbers.partition((n) => n % 2 === 0)
    expect(even.all()).toEqual([2, 4])
    expect(odd.all()).toEqual([1, 3, 5])
    expect(numbers.take(2).all()).toEqual([1, 2])
    expect(numbers.take(-2).all()).toEqual([4, 5])
    expect(numbers.skip(3).all()).toEqual([4, 5])
    expect(numbers.slice(1, 2).all()).toEqual([2, 3])
    expect(numbers.slice(-2).all()).toEqual([4, 5])
    expect(collect(['a', 'b']).zip([1]).all()).toEqual([
      ['a', 1],
      ['b', undefined],
    ])
  })

  it('finds and checks items', () => {
    const collection = collect(users)
    expect(collection.first()?.id).toBe(1)
    expect(collection.first((user) => user.age < 30)?.name).toBe('Abigail')
    expect(collection.last()?.id).toBe(4)
    expect(collection.firstWhere('name', 'Dayle')?.id).toBe(4)
    expect(collection.contains('name', 'Nima')).toBe(true)
    expect(collection.contains((user) => user.age > 40)).toBe(true)
    expect(collect([1, 2]).contains(3)).toBe(false)
    expect(collect([1, 2, 3]).every((n) => n > 0)).toBe(true)
    expect(collect([5, 6]).search(6)).toBe(1)
    expect(collect([1]).get(-1)).toBe(1)
    expect(collect().isEmpty()).toBe(true)
    expect(collection.isNotEmpty()).toBe(true)
  })

  it('removes duplicates, sorts and reverses', () => {
    expect(collect([3, 1, 3, 2]).unique().all()).toEqual([3, 1, 2])
    expect(collect(users).unique('role').pluck('id').all()).toEqual([1, 3])
    expect(collect([3, 1, 2]).sort().all()).toEqual([1, 2, 3])
    expect(collect(['b', 'a']).sort().all()).toEqual(['a', 'b'])
    expect(collect(users).sortByDesc('age').pluck('id').all()).toEqual([4, 1, 2, 3])
    expect(collect([1, 2]).reverse().all()).toEqual([2, 1])
  })

  it('combines collections', () => {
    expect(collect([1, 2]).concat([3]).all()).toEqual([1, 2, 3])
    expect(collect([1, 2]).merge(['a']).all()).toEqual([1, 2, 'a'])
    expect(collect([1, 2, 3]).diff([2]).all()).toEqual([1, 3])
    expect(collect([1, 2, 3]).intersect([2, 3, 4]).all()).toEqual([2, 3])
    expect(
      collect([[1], collect([2, [3]])])
        .flatten()
        .all(),
    ).toEqual([1, 2, 3])
    expect(
      collect([[1, [2]]])
        .flatten(1)
        .all(),
    ).toEqual([1, [2]])
  })

  it('joins into strings', () => {
    expect(collect(['a', 'b', 'c']).implode(', ')).toBe('a, b, c')
    expect(collect(users).implode('name', '/')).toBe('Taylor/Nima/Abigail/Dayle')
    expect(collect(['a', 'b', 'c']).join(', ', ' and ')).toBe('a, b and c')
    expect(collect(['a']).join(', ', ' and ')).toBe('a')
  })

  it('stops each() on false and supports pipe, tap, when and unless', () => {
    const seen: number[] = []
    collect([1, 2, 3]).each((n) => {
      seen.push(n)
      return n < 2
    })
    expect(seen).toEqual([1, 2])
    expect(collect([1, 2]).pipe((c) => c.sum())).toBe(3)
    expect(
      collect([1])
        .when(true, (c) => c.push(2))
        .all(),
    ).toEqual([1, 2])
    expect(
      collect([1])
        .unless(true, (c) => c.push(2))
        .all(),
    ).toEqual([1])
    let tapped = 0
    collect([1, 2]).tap((c) => {
      tapped = c.count()
    })
    expect(tapped).toBe(2)
  })

  it('builds with times and range, and is iterable and JSON-serialisable', () => {
    expect(Collection.times(3, (n) => n * 10).all()).toEqual([10, 20, 30])
    expect(Collection.range(1, 4).all()).toEqual([1, 2, 3, 4])
    expect(Collection.range(3, 1).all()).toEqual([3, 2, 1])
    expect([...collect(new Set([1, 2]))]).toEqual([1, 2])
    expect(JSON.stringify(collect([collect([1])]))).toBe('[[1]]')
  })

  it('accepts typed macros through module augmentation', () => {
    Collection.macro('toCsv', function (this: Collection<unknown>) {
      return this.implode(',')
    })
    expect(collect([1, 2, 3]).toCsv()).toBe('1,2,3')
    expect(Collection.hasMacro('toCsv')).toBe(true)
    expectTypeOf(collect([1]).toCsv()).toEqualTypeOf<string>()
    expect(() => Collection.macro('map', () => null)).toThrow(/built-in member/)
  })
})

describe('LazyCollection', () => {
  async function* numbers(pulled: number[]): AsyncGenerator<number> {
    for (let n = 1; n <= 1000; n++) {
      pulled.push(n)
      yield n
    }
  }

  it('pulls only as many items as it needs', async () => {
    const pulled: number[] = []
    const result = await LazyCollection.make(() => numbers(pulled))
      .filter((n) => n % 2 === 0)
      .map(async (n) => n * 10)
      .take(3)
      .all()
    expect(result).toEqual([20, 40, 60])
    expect(pulled).toHaveLength(6)
  })

  it('works over sync iterables and supports chunk, skip, takeWhile and reject', async () => {
    const lazy = LazyCollection.make([1, 2, 3, 4, 5])
    expect(await lazy.chunk(2).all()).toEqual([[1, 2], [3, 4], [5]])
    expect(await lazy.skip(3).all()).toEqual([4, 5])
    expect(await lazy.takeWhile((n) => n < 3).all()).toEqual([1, 2])
    expect(await lazy.reject((n) => n > 2).all()).toEqual([1, 2])
  })

  it('has terminal methods', async () => {
    const lazy = LazyCollection.make([1, 2, 3])
    expect(await lazy.count()).toBe(3)
    expect(await lazy.reduce((sum, n) => sum + n, 0)).toBe(6)
    expect(await lazy.first((n) => n > 1)).toBe(2)
    expect(await lazy.first()).toBe(1)
    const collection = await lazy.collect()
    expect(collection).toBeInstanceOf(Collection)
    expectTypeOf(collection).toEqualTypeOf<Collection<number>>()
    const seen: number[] = []
    await lazy.each((n) => {
      seen.push(n)
      return n < 2
    })
    expect(seen).toEqual([1, 2])
  })

  it('can be iterated again when built from a function', async () => {
    const lazy = LazyCollection.make(() => [1, 2])
    expect(await lazy.all()).toEqual([1, 2])
    expect(await lazy.all()).toEqual([1, 2])
    const seen: number[] = []
    for await (const n of lazy) seen.push(n)
    expect(seen).toEqual([1, 2])
  })
})
