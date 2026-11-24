import { describe, expect, expectTypeOf, it } from 'vitest'
import { ConfigRepository, type DotPath, defineConfig, type PathValue } from '../src/index.ts'

const database = defineConfig({
  default: 'pg',
  connections: {
    pg: { host: 'localhost', port: 5432 },
    sqlite: { file: 'db.sqlite' },
  },
  replicas: ['a', 'b'],
})

describe('ConfigRepository', () => {
  it('reads values by dot path', () => {
    const config = new ConfigRepository({ database })
    expect(config.get('database.default')).toBe('pg')
    expect(config.get('database.connections.pg.port')).toBe(5432)
    expect(config.get('database.connections')).toBe(database.connections)
    expect(config.get('database.missing')).toBeUndefined()
    expect(config.get('database.missing', 'fallback')).toBe('fallback')
  })

  it('checks and sets values', () => {
    const config = new ConfigRepository({ database: structuredClone(database) })
    expect(config.has('database.connections.pg')).toBe(true)
    expect(config.has('database.connections.mysql')).toBe(false)
    config.set('database.connections.mysql.host', 'db')
    expect(config.get('database.connections.mysql.host')).toBe('db')
    expect(config.has('database.connections.mysql')).toBe(true)
  })

  it('refuses paths that would pollute a prototype', () => {
    const config = new ConfigRepository()
    expect(() => config.set('__proto__.polluted', true)).toThrow(/Unsafe path/)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('does not read inherited properties', () => {
    const config = new ConfigRepository({ app: {} })
    expect(config.get('app.toString')).toBeUndefined()
  })
})

describe('config types', () => {
  type Registry = { database: typeof database; app: { name: string } }

  it('lists every dot path, without descending into arrays', () => {
    expectTypeOf<DotPath<Registry>>().toEqualTypeOf<
      | 'database'
      | 'database.default'
      | 'database.connections'
      | 'database.connections.pg'
      | 'database.connections.pg.host'
      | 'database.connections.pg.port'
      | 'database.connections.sqlite'
      | 'database.connections.sqlite.file'
      | 'database.replicas'
      | 'app'
      | 'app.name'
    >()
  })

  it('works for interfaces, which is how apps declare ConfigRegistry', () => {
    interface Registry2 {
      app: { name: string; boot: () => void; started: Date }
    }
    expectTypeOf<DotPath<Registry2>>().toEqualTypeOf<
      'app' | 'app.name' | 'app.boot' | 'app.started'
    >()
  })

  it('resolves the type at a path', () => {
    expectTypeOf<PathValue<Registry, 'database.connections.pg.port'>>().toEqualTypeOf<number>()
    expectTypeOf<PathValue<Registry, 'database.replicas'>>().toEqualTypeOf<string[]>()
    expectTypeOf<PathValue<Registry, 'app.missing'>>().toEqualTypeOf<never>()
  })
})
