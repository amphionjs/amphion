# String and array helpers

## Str

```ts
import { Str } from '@amphion/core'
```

| Helper | Example |
| --- | --- |
| `Str.slug(value, separator = '-')` | `'Crème Brûlée!'` → `'creme-brulee'` |
| `Str.camel` / `Str.snake` / `Str.kebab` / `Str.studly` (`pascal`) | `'fooBar'` ↔ `'foo_bar'` ↔ `'foo-bar'` ↔ `'FooBar'` |
| `Str.title(value)` | `'a nice title'` → `'A Nice Title'` |
| `Str.plural(value, count = 2)` / `Str.singular(value)` | `'person'` ↔ `'people'`, keeping case |
| `Str.uuid()` | A random version 4 UUID |
| `Str.ulid()` | A ULID: 26 characters, sortable by creation time |
| `Str.random(length = 16)` | A cryptographically random alphanumeric string |
| `Str.limit(value, limit = 100, end = '...')` | Cuts to `limit` characters |
| `Str.words(value, words = 100, end = '...')` | Keeps the first `words` words |
| `Str.mask(value, character, index, length?)` | `mask('taylor@example.com', '*', 3)` → `'tay***************'` |
| `Str.after`, `afterLast`, `before`, `beforeLast`, `between` | Cut around a search string |
| `Str.contains`, `startsWith`, `endsWith` | Accept one needle or a list |
| `Str.start(value, prefix)` / `Str.finish(value, cap)` | Add a prefix or suffix once |
| `Str.ucfirst` / `Str.lcfirst` | Change the first character |
| `Str.isUuid` / `Str.isUlid` | Validate ids |

`plural` and `singular` follow English rules, including irregular words (`child` → `children`), using the [pluralize](https://www.npmjs.com/package/pluralize) package. The ORM uses them to turn a model name into a table name.

`slug` removes accents and keeps letters from other scripts (`'Привет мир'` → `'привет-мир'`), where Laravel would transliterate them.

## Arr

```ts
import { Arr } from '@amphion/core'

Arr.get(data, 'user.address.city', 'unknown')
Arr.set(data, 'user.address.zip', '1234')
Arr.has(data, 'user.address')
Arr.only(user, ['id', 'email'])
Arr.except(user, ['password'])
Arr.wrap(value) // value → [value]; arrays unchanged; null/undefined → []
Arr.flatten([1, [2, [3]]]) // [1, 2, 3]
Arr.collapse([[1], [2, 3]]) // [1, 2, 3]
Arr.pluck(users, 'email')
Arr.first(items, (item) => item.active)
Arr.last(items)
Arr.shuffle(items)
Arr.random(items)
```

`Arr.set` refuses the path segments `__proto__`, `prototype` and `constructor`, so a dot path built from user input cannot pollute a prototype.

## Macros

Add your own helpers with `Str.macro()`, and type them by augmenting the `StrHelpers` interface:

```ts
import { Str } from '@amphion/core'

declare module '@amphion/core' {
  interface StrHelpers {
    shout(value: string): string
  }
}

Str.macro('shout', (value: string) => `${value.toUpperCase()}!`)

Str.shout('hi') // 'HI!'
```

A macro cannot replace a built-in helper; that throws a `TypeError`. Collections have macros too: see [Collections](./collections#macros).
