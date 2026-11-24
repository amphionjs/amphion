# Collections

`Collection` wraps an array with Laravel's fluent API. Every method returns a new collection and leaves the original unchanged (except `push`, as in Laravel).

```ts
import { collect } from '@amphion/core'

const emails = collect(users)
  .where('active', true)
  .sortBy('name')
  .pluck('email')
  .all()
```

Item keys are type-checked: `where('activ', true)` is a compile error, and `pluck('email')` returns a `Collection<string>`.

## Methods

| Group | Methods |
| --- | --- |
| Create | `collect(iterable)`, `Collection.make`, `Collection.times(n, fn)`, `Collection.range(from, to)` |
| Read | `all`, `count`, `first`, `last`, `firstWhere`, `get`, `contains`, `every`, `search`, `isEmpty`, `isNotEmpty` |
| Transform | `map`, `flatMap`, `filter`, `reject`, `each`, `reduce`, `pluck`, `flatten`, `chunk`, `partition`, `zip` |
| Filter by key | `where(key, value)`, `where(key, operator, value)`, `whereIn`, `whereNotIn`, `whereNull`, `whereNotNull` |
| Order | `sort`, `sortBy`, `sortByDesc`, `reverse`, `unique`, `values` |
| Slice | `take` (negative takes from the end), `skip`, `slice` |
| Combine | `concat`, `merge`, `diff`, `intersect`, `push` |
| Group | `groupBy`, `keyBy`, `countBy`, `mapWithKeys` |
| Aggregate | `sum`, `avg`, `min`, `max`, `implode`, `join` |
| Control | `pipe`, `tap`, `when`, `unless` |
| Output | `toArray`, `toJSON`, and `for...of` iteration |

`sum`, `avg`, `min`, `max`, `sortBy`, `unique`, `groupBy`, `keyBy` and `countBy` take a key or a callback.

`each` stops when the callback returns `false`. `where` operators are `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=` (and `==`, `===`, `!==`).

## Differences from Laravel

- **A collection is always a list.** Laravel collections can also hold keyed items. In Amphion, `groupBy`, `keyBy`, `countBy` and `mapWithKeys` return plain objects instead, which serialize to the same JSON:

  ```ts
  collect(users).groupBy('role') // { admin: Collection, member: Collection }
  collect(users).countBy('role') // { admin: 2, member: 2 }
  ```

- **Comparisons are strict.** `where('id', '1')` does not match the number `1`; Laravel's `where` compares loosely by default.

## Lazy collections

`LazyCollection` pulls items one at a time from a sync or async iterable, so it can walk millions of rows or a stream in constant memory. Callbacks may be async, and nothing runs until a terminal method or a `for await` loop pulls items:

```ts
import { LazyCollection } from '@amphion/core'

await LazyCollection.make(() => readRows('big.csv'))
  .filter((row) => row.active)
  .map(async (row) => enrich(row))
  .chunk(500)
  .each((rows) => insertMany(rows))
```

- Chainable: `map`, `filter`, `reject`, `take`, `takeWhile`, `skip`, `chunk`.
- Terminal (they return promises): `each`, `reduce`, `first`, `count`, `all`, `collect` (which returns an eager `Collection`).

`take(3)` stops pulling from the source after three items. Pass a function to `make()` (as above) when you want to iterate the collection more than once.

## Macros

Add methods to every collection with `Collection.macro()`, and type them by augmenting the `Collection` interface:

```ts
import { Collection } from '@amphion/core'

declare module '@amphion/core' {
  interface Collection<T> {
    toCsv(): string
  }
}

Collection.macro('toCsv', function (this: Collection<unknown>) {
  return this.implode(',')
})

collect([1, 2, 3]).toCsv() // '1,2,3'
```

A macro cannot replace a built-in method; that throws a `TypeError`.
