import { describe, expect, expectTypeOf, it } from 'vitest'
import { Str } from '../src/index.ts'

declare module '@amphion/core' {
  interface StrHelpers {
    shout(value: string): string
  }
}

describe('Str case conversion', () => {
  it.each([
    ['foo_bar', 'fooBar', 'foo_bar', 'foo-bar', 'FooBar'],
    ['fooBar', 'fooBar', 'foo_bar', 'foo-bar', 'FooBar'],
    ['Foo Bar baz', 'fooBarBaz', 'foo_bar_baz', 'foo-bar-baz', 'FooBarBaz'],
    ['XMLHttpRequest', 'xmlHttpRequest', 'xml_http_request', 'xml-http-request', 'XmlHttpRequest'],
    ['user2fa-code', 'user2faCode', 'user2fa_code', 'user2fa-code', 'User2faCode'],
  ])('%s', (input, camel, snake, kebab, studly) => {
    expect(Str.camel(input)).toBe(camel)
    expect(Str.snake(input)).toBe(snake)
    expect(Str.kebab(input)).toBe(kebab)
    expect(Str.studly(input)).toBe(studly)
    expect(Str.pascal(input)).toBe(studly)
  })

  it('title-cases and changes the first letter', () => {
    expect(Str.title('a nice TITLE uses-correct case')).toBe('A Nice Title Uses-Correct Case')
    expect(Str.ucfirst('élan')).toBe('Élan')
    expect(Str.lcfirst('Hello')).toBe('hello')
    expect(Str.snake('fooBar', '.')).toBe('foo.bar')
  })
})

describe('Str.slug', () => {
  it('makes URL slugs', () => {
    expect(Str.slug('Hello World!')).toBe('hello-world')
    expect(Str.slug('  Crème Brûlée  ')).toBe('creme-brulee')
    expect(Str.slug('Laravel 11 & Amphion', '_')).toBe('laravel_11_amphion')
    expect(Str.slug('hi@example')).toBe('hi-at-example')
    expect(Str.slug('Привет мир')).toBe('привет-мир')
    expect(Str.slug('a.b', '.')).toBe('a.b')
  })
})

describe('Str plural and singular', () => {
  it('handles regular and irregular English words, keeping case', () => {
    expect(Str.plural('post')).toBe('posts')
    expect(Str.plural('person')).toBe('people')
    expect(Str.plural('Person')).toBe('People')
    expect(Str.plural('child')).toBe('children')
    expect(Str.plural('category')).toBe('categories')
    expect(Str.plural('post', 1)).toBe('post')
    expect(Str.singular('people')).toBe('person')
    expect(Str.singular('categories')).toBe('category')
  })
})

describe('Str ids and random', () => {
  it('makes UUIDs and ULIDs', () => {
    expect(Str.isUuid(Str.uuid())).toBe(true)
    const ulid = Str.ulid()
    expect(ulid).toHaveLength(26)
    expect(Str.isUlid(ulid)).toBe(true)
    expect(Str.ulid(0).slice(0, 10)).toBe('0000000000')
    expect(Str.ulid(1_700_000_000_000) < Str.ulid(1_800_000_000_000)).toBe(true)
    expect(Str.isUuid('not-a-uuid')).toBe(false)
  })

  it('makes random alphanumeric strings', () => {
    expect(Str.random()).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(Str.random(40)).toHaveLength(40)
    expect(Str.random()).not.toBe(Str.random())
  })
})

describe('Str substrings', () => {
  it('limits characters and words', () => {
    expect(Str.limit('The quick brown fox', 9)).toBe('The quick...')
    expect(Str.limit('short', 10)).toBe('short')
    expect(Str.limit('😀😀😀', 2, '')).toBe('😀😀')
    expect(Str.words('Perfectly balanced, as all things should be.', 3, ' >>>')).toBe(
      'Perfectly balanced, as >>>',
    )
    expect(Str.words('two words', 5)).toBe('two words')
  })

  it('masks', () => {
    expect(Str.mask('taylor@example.com', '*', 3)).toBe('tay***************')
    expect(Str.mask('taylor@example.com', '*', -15, 3)).toBe('tay***@example.com')
    expect(Str.mask('1234', '#', 0, 2)).toBe('##34')
  })

  it('cuts before, after and between', () => {
    expect(Str.after('app/Http/Controllers', '/')).toBe('Http/Controllers')
    expect(Str.afterLast('app/Http/Controllers', '/')).toBe('Controllers')
    expect(Str.before('app/Http/Controllers', '/')).toBe('app')
    expect(Str.beforeLast('app/Http/Controllers', '/')).toBe('app/Http')
    expect(Str.between('[a] and [b]', '[', ']')).toBe('a] and [b')
    expect(Str.after('nothing', '#')).toBe('nothing')
  })

  it('searches and caps', () => {
    expect(Str.contains('Amphion', ['x', 'phi'])).toBe(true)
    expect(Str.contains('Amphion', 'PHI')).toBe(false)
    expect(Str.contains('Amphion', 'PHI', true)).toBe(true)
    expect(Str.startsWith('lyre.ts', ['ar', 'ly'])).toBe(true)
    expect(Str.endsWith('lyre.ts', '.js')).toBe(false)
    expect(Str.start('path', '/')).toBe('/path')
    expect(Str.finish('/path/', '/')).toBe('/path/')
  })
})

describe('Str macros', () => {
  it('adds typed helpers and refuses to replace built-in ones', () => {
    Str.macro('shout', (value: string) => `${value.toUpperCase()}!`)
    expect(Str.shout('hi')).toBe('HI!')
    expect(Str.hasMacro('shout')).toBe(true)
    expectTypeOf(Str.shout).returns.toEqualTypeOf<string>()
    expect(() => Str.macro('slug', () => '')).toThrow(/built-in member/)
  })
})
