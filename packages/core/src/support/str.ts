import { getRandomValues, randomInt, randomUUID } from 'node:crypto'
import pluralize from 'pluralize'
import { addMacro, hasMacro } from './macroable.ts'

/**
 * String helpers with Laravel's names. Add your own with `Str.macro()` and type them by
 * augmenting this interface:
 *
 * ```ts
 * declare module '@amphion/core' {
 *   interface StrHelpers {
 *     shout(value: string): string
 *   }
 * }
 * Str.macro('shout', (value: string) => `${value.toUpperCase()}!`)
 * ```
 */
export interface StrHelpers extends BuiltInStrHelpers {}

/** The helpers Str ships with. Kept apart from StrHelpers so macros never retype them. */
export interface BuiltInStrHelpers {
  /** `'Hello World'` → `'hello-world'`. Accents are removed; other letters are kept. */
  slug(value: string, separator?: string): string
  /** `'foo_bar'` → `'fooBar'` */
  camel(value: string): string
  /** `'fooBar'` → `'foo_bar'` */
  snake(value: string, delimiter?: string): string
  /** `'fooBar'` → `'foo-bar'` */
  kebab(value: string): string
  /** `'foo_bar'` → `'FooBar'` */
  studly(value: string): string
  /** Alias of {@link StrHelpers.studly}. */
  pascal(value: string): string
  /** `'a nice title'` → `'A Nice Title'` */
  title(value: string): string
  /** English plural: `'person'` → `'people'`. Returns `value` unchanged when `count` is 1. */
  plural(value: string, count?: number): string
  /** English singular: `'people'` → `'person'`. */
  singular(value: string): string
  /** A random version 4 UUID. */
  uuid(): string
  /** A ULID: sortable by creation time, 26 characters, Crockford base32. */
  ulid(time?: number): string
  /** A cryptographically random alphanumeric string. */
  random(length?: number): string
  /** Cuts a string to `limit` characters and appends `end` if it was longer. */
  limit(value: string, limit?: number, end?: string): string
  /** Keeps the first `words` words and appends `end` if there were more. */
  words(value: string, words?: number, end?: string): string
  /** Replaces part of a string with a character: `mask('taylor@example.com', '*', 3)`. */
  mask(value: string, character: string, index: number, length?: number): string
  /** Everything after the first `search`. */
  after(subject: string, search: string): string
  /** Everything after the last `search`. */
  afterLast(subject: string, search: string): string
  /** Everything before the first `search`. */
  before(subject: string, search: string): string
  /** Everything before the last `search`. */
  beforeLast(subject: string, search: string): string
  /** The part between `from` and `to`. */
  between(subject: string, from: string, to: string): string
  /** Upper-cases the first character. */
  ucfirst(value: string): string
  /** Lower-cases the first character. */
  lcfirst(value: string): string
  /** True when the string contains any of the needles. */
  contains(haystack: string, needles: string | readonly string[], ignoreCase?: boolean): boolean
  /** True when the string starts with any of the needles. */
  startsWith(haystack: string, needles: string | readonly string[]): boolean
  /** True when the string ends with any of the needles. */
  endsWith(haystack: string, needles: string | readonly string[]): boolean
  /** Adds `prefix` unless the string already starts with it. */
  start(value: string, prefix: string): string
  /** Adds `cap` unless the string already ends with it. */
  finish(value: string, cap: string): string
  /** True for a UUID string. */
  isUuid(value: string): boolean
  /** True for a ULID string. */
  isUlid(value: string): boolean
  /** Adds a helper. Type it by augmenting {@link StrHelpers}. */
  macro(name: string, fn: (...args: never[]) => unknown): void
  /** True when `name` was added with {@link StrHelpers.macro}. */
  hasMacro(name: string): boolean
}

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RANDOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Splits `fooBar`, `foo_bar`, `foo-bar` and `Foo Bar` into words. */
function splitWords(value: string): string[] {
  return value
    .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function list(needles: string | readonly string[]): readonly string[] {
  return (typeof needles === 'string' ? [needles] : needles).filter((needle) => needle !== '')
}

const helpers: BuiltInStrHelpers = {
  slug(value: string, separator = '-'): string {
    const escaped = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/@/g, ' at ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, separator)
      .replace(new RegExp(`^(${escaped})+|(${escaped})+$`, 'g'), '')
  },

  camel(value: string): string {
    const studly = Str.studly(value)
    return studly.charAt(0).toLowerCase() + studly.slice(1)
  },

  snake(value: string, delimiter = '_'): string {
    return splitWords(value)
      .map((word) => word.toLowerCase())
      .join(delimiter)
  },

  kebab(value: string): string {
    return Str.snake(value, '-')
  },

  studly(value: string): string {
    return splitWords(value)
      .map((word) => ucfirst(word.toLowerCase()))
      .join('')
  },

  pascal(value: string): string {
    return Str.studly(value)
  },

  title(value: string): string {
    return value.toLowerCase().replace(/(^|[\s\-_])(\p{L})/gu, (_, before, letter) => {
      return `${before}${letter.toUpperCase()}`
    })
  },

  plural(value: string, count = 2): string {
    return count === 1 ? value : pluralize.plural(value)
  },

  singular(value: string): string {
    return pluralize.singular(value)
  },

  uuid(): string {
    return randomUUID()
  },

  ulid(time = Date.now()): string {
    let timePart = ''
    let remaining = Math.floor(time)
    for (let index = 0; index < 10; index++) {
      timePart = ULID_ALPHABET[remaining % 32] + timePart
      remaining = Math.floor(remaining / 32)
    }
    let randomPart = ''
    // 256 is a multiple of 32, so `byte % 32` has no bias.
    for (const byte of getRandomValues(new Uint8Array(16))) randomPart += ULID_ALPHABET[byte % 32]
    return timePart + randomPart
  },

  random(length = 16): string {
    let result = ''
    for (let index = 0; index < length; index++) {
      result += RANDOM_ALPHABET[randomInt(RANDOM_ALPHABET.length)]
    }
    return result
  },

  limit(value: string, limit = 100, end = '...'): string {
    const chars = [...value]
    return chars.length <= limit ? value : `${chars.slice(0, limit).join('').trimEnd()}${end}`
  },

  words(value: string, words = 100, end = '...'): string {
    const match = value.match(new RegExp(`^\\s*(?:\\S+\\s*){1,${Math.max(1, words)}}`, 'u'))
    if (!match || match[0].length === value.length) return value
    return match[0].trimEnd() + end
  },

  mask(value: string, character: string, index: number, length?: number): string {
    if (character === '') return value
    const chars = [...value]
    const start = index < 0 ? Math.max(0, chars.length + index) : Math.min(index, chars.length)
    const count = length === undefined ? chars.length - start : Math.max(0, length)
    const end = Math.min(chars.length, start + count)
    const mask = [...character][0] as string
    return chars
      .map((char, position) => (position >= start && position < end ? mask : char))
      .join('')
  },

  after(subject: string, search: string): string {
    const position = search === '' ? -1 : subject.indexOf(search)
    return position === -1 ? subject : subject.slice(position + search.length)
  },

  afterLast(subject: string, search: string): string {
    const position = search === '' ? -1 : subject.lastIndexOf(search)
    return position === -1 ? subject : subject.slice(position + search.length)
  },

  before(subject: string, search: string): string {
    const position = search === '' ? -1 : subject.indexOf(search)
    return position === -1 ? subject : subject.slice(0, position)
  },

  beforeLast(subject: string, search: string): string {
    const position = search === '' ? -1 : subject.lastIndexOf(search)
    return position === -1 ? subject : subject.slice(0, position)
  },

  between(subject: string, from: string, to: string): string {
    if (from === '' || to === '') return subject
    return Str.beforeLast(Str.after(subject, from), to)
  },

  ucfirst,

  lcfirst(value: string): string {
    return value.charAt(0).toLowerCase() + value.slice(1)
  },

  contains(haystack: string, needles: string | readonly string[], ignoreCase = false): boolean {
    const subject = ignoreCase ? haystack.toLowerCase() : haystack
    return list(needles).some((needle) =>
      subject.includes(ignoreCase ? needle.toLowerCase() : needle),
    )
  },

  startsWith(haystack: string, needles: string | readonly string[]): boolean {
    return list(needles).some((needle) => haystack.startsWith(needle))
  },

  endsWith(haystack: string, needles: string | readonly string[]): boolean {
    return list(needles).some((needle) => haystack.endsWith(needle))
  },

  start(value: string, prefix: string): string {
    return value.startsWith(prefix) ? value : prefix + value
  },

  finish(value: string, cap: string): string {
    return value.endsWith(cap) ? value : value + cap
  },

  isUuid(value: string): boolean {
    return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  },

  isUlid(value: string): boolean {
    return /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value)
  },

  macro(name: string, fn: (...args: never[]) => unknown): void {
    addMacro(Str, name, fn)
  },

  hasMacro(name: string): boolean {
    return hasMacro(Str, name)
  },
}

/** String helpers. See {@link StrHelpers}. */
export const Str: StrHelpers = helpers as StrHelpers
