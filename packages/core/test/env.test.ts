import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest'
import { Env, InvalidEnvException } from '../src/index.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amphion-env-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const schema = {
  APP_NAME: Env.string(),
  PORT: Env.number().default(3000),
  DEBUG: Env.boolean().default(false),
  APP_ENV: Env.enum(['local', 'testing', 'production'] as const).default('local'),
  APP_URL: Env.url().optional(),
}

describe('Env', () => {
  it('reads .env, validates and types the values', () => {
    writeFileSync(join(dir, '.env'), 'APP_NAME="My App"\nPORT=8080\nDEBUG=yes\n')
    const env = Env.create(dir, schema, { source: {} })
    expect(env.get('APP_NAME')).toBe('My App')
    expect(env.get('PORT')).toBe(8080)
    expect(env.get('DEBUG')).toBe(true)
    expect(env.get('APP_ENV')).toBe('local')
    expect(env.get('APP_URL')).toBeUndefined()

    expectTypeOf(env.get('PORT')).toEqualTypeOf<number>()
    expectTypeOf(env.get('APP_ENV')).toEqualTypeOf<'local' | 'testing' | 'production'>()
    expectTypeOf(env.get('APP_URL')).toEqualTypeOf<string | undefined>()
  })

  it('accepts a file URL to the base folder', () => {
    writeFileSync(join(dir, '.env'), 'APP_NAME=FromUrl\n')
    expect(Env.create(pathToFileURL(`${dir}/`), schema, { source: {} }).get('APP_NAME')).toBe(
      'FromUrl',
    )
  })

  it('lets the real environment win over .env', () => {
    writeFileSync(join(dir, '.env'), 'APP_NAME=file\nPORT=1\n')
    const env = Env.create(dir, schema, { source: { APP_NAME: 'process', PORT: undefined } })
    expect(env.get('APP_NAME')).toBe('process')
    expect(env.get('PORT')).toBe(1)
  })

  it('loads .env.<environment> after .env', () => {
    writeFileSync(join(dir, '.env'), 'APP_NAME=base\nPORT=1\n')
    writeFileSync(join(dir, '.env.testing'), 'APP_NAME=testing\n')
    const env = Env.create(dir, schema, { source: { APP_ENV: 'testing' } })
    expect(env.get('APP_NAME')).toBe('testing')
    expect(env.get('PORT')).toBe(1)
  })

  it('uses .env.testing when NODE_ENV is test', () => {
    writeFileSync(join(dir, '.env.testing'), 'APP_NAME=testing\n')
    expect(Env.create(dir, schema, { source: { NODE_ENV: 'test' } }).get('APP_NAME')).toBe(
      'testing',
    )
  })

  it('works without any .env file', () => {
    expect(Env.create(dir, schema, { source: { APP_NAME: 'x' } }).get('PORT')).toBe(3000)
  })

  it('never modifies process.env', () => {
    writeFileSync(join(dir, '.env'), 'AMPHION_ENV_TEST_SECRET=hidden\nAPP_NAME=x\n')
    Env.create(dir, { ...schema, AMPHION_ENV_TEST_SECRET: Env.string() })
    expect(process.env.AMPHION_ENV_TEST_SECRET).toBeUndefined()
  })

  it('lists every problem in one error, with names but never values', () => {
    const attempt = (): unknown =>
      Env.validate(schema, { PORT: 'eighty', DEBUG: 'maybe', APP_ENV: 'staging', APP_URL: 'nope' })
    expect(attempt).toThrow(InvalidEnvException)
    try {
      attempt()
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('APP_NAME is missing')
      expect(message).toContain('PORT must be a number')
      expect(message).toContain('DEBUG must be true or false')
      expect(message).toContain('APP_ENV must be one of: local, testing, production')
      expect(message).toContain('APP_URL must be a valid URL')
      expect(message).not.toMatch(/eighty|maybe|staging|nope/)
      expect(String(error)).toMatch(/^E_INVALID_ENV: /)
    }
  })

  it('treats an empty value as missing', () => {
    expect(() => Env.validate({ APP_KEY: Env.string() }, { APP_KEY: '' })).toThrow(
      /APP_KEY is missing/,
    )
  })

  it('freezes the values', () => {
    const env = Env.validate(schema, { APP_NAME: 'x' })
    expect(Object.isFrozen(env.all())).toBe(true)
  })
})
