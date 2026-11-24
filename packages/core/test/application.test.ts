import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Application,
  app,
  ConfigRepository,
  Container,
  config,
  deferred,
  InvalidAppStateException,
  ServiceProvider,
  type Token,
  token,
} from '../src/index.ts'

const fixtureApp = join(import.meta.dirname, 'fixtures', 'app')
const emptyApp = join(import.meta.dirname, 'fixtures', 'missing')

afterEach(() => {
  Container.setInstance(undefined)
})

describe('Application', () => {
  it('knows its paths', () => {
    const application = Application.configure({ basePath: '/srv/app' }).create()
    expect(application.appPath('Models', 'User.ts')).toBe('/srv/app/app/Models/User.ts')
    expect(application.configPath()).toBe('/srv/app/config')
    expect(application.databasePath('migrations')).toBe('/srv/app/database/migrations')
    expect(application.storagePath('logs')).toBe('/srv/app/storage/logs')
    expect(application.routesPath('web.ts')).toBe('/srv/app/routes/web.ts')
    expect(application.resourcesPath()).toBe('/srv/app/resources')
    expect(application.publicPath()).toBe('/srv/app/public')
  })

  it('accepts a file URL as base path', () => {
    const application = Application.configure({ basePath: new URL('file:///srv/app/') }).create()
    expect(application.makePath('lyre.ts')).toBe('/srv/app/lyre.ts')
  })

  it('binds itself, the container and the config repository', () => {
    const application = Application.configure({ basePath: emptyApp }).create()
    expect(application.make(Application)).toBe(application)
    expect(application.make(Container)).toBe(application)
    expect(application.make(ConfigRepository)).toBe(application.config)
    expect(Application.getInstance()).toBe(application)
    expect(app()).toBe(application)
  })

  it('loads every file in config/ at boot, keyed by file name', async () => {
    const application = Application.configure({ basePath: fixtureApp }).create()
    await application.boot()
    expect(application.config.get('app.name')).toBe('Fixture App')
    expect(application.config.get('app.features.search.driver')).toBe('memory')
    expect(application.config.get('database.connections.sqlite.file')).toBe('database.sqlite')
    expect(config('database.default')).toBe('sqlite')
    expect(config('missing.key', 'fallback')).toBe('fallback')
    expect(config()).toBe(application.config)
  })

  it('lets preset config replace a file', async () => {
    const application = Application.configure({ basePath: fixtureApp })
      .withConfig({ database: { default: 'memory' } })
      .create()
    await application.boot()
    expect(application.config.get('database.default')).toBe('memory')
    expect(application.config.has('database.connections')).toBe(false)
  })

  it('boots without a config folder', async () => {
    const application = Application.configure({ basePath: emptyApp }).create()
    await application.boot()
    expect(application.config.all()).toEqual({})
  })
})

describe('environment', () => {
  it('is testing under Vitest (NODE_ENV=test), even when config says otherwise', async () => {
    const application = Application.configure({ basePath: fixtureApp }).create()
    await application.boot()
    expect(application.environment).toBe('testing')
    expect(application.inTesting()).toBe(true)
  })

  it('can be forced', () => {
    const application = Application.configure({ basePath: emptyApp })
      .withEnvironment('production')
      .create()
    expect(application.isProduction()).toBe(true)
    expect(application.isLocal()).toBe(false)
    expect(application.environmentIs('staging', 'production')).toBe(true)
  })
})

describe('providers and lifecycle', () => {
  it('registers every provider, then boots every provider, then runs hooks in order', async () => {
    const events: string[] = []
    class First extends ServiceProvider {
      register(): void {
        events.push('first.register')
      }
      async boot(): Promise<void> {
        events.push('first.boot')
      }
      ready(): void {
        events.push('first.ready')
      }
      shutdown(): void {
        events.push('first.shutdown')
      }
    }
    class Second extends ServiceProvider {
      register(): void {
        events.push('second.register')
      }
      boot(): void {
        events.push('second.boot')
      }
      shutdown(): void {
        events.push('second.shutdown')
      }
    }
    const application = Application.configure({ basePath: emptyApp })
      .withProviders([First, Second])
      .create()
    application.booting(() => {
      events.push('booting')
    })
    application.booted(() => {
      events.push('booted')
    })
    application.terminating(() => {
      events.push('terminating')
    })

    expect(application.state).toBe('created')
    await application.start()
    expect(application.state).toBe('ready')
    await application.terminate()
    expect(application.state).toBe('terminated')

    expect(events).toEqual([
      'first.register',
      'second.register',
      'booting',
      'first.boot',
      'second.boot',
      'booted',
      'first.ready',
      'terminating',
      'second.shutdown',
      'first.shutdown',
    ])
    expect(application.getProvider(First)).toBeInstanceOf(First)
  })

  it('boot() and terminate() run once, however often they are called', async () => {
    let boots = 0
    class Counting extends ServiceProvider {
      boot(): void {
        boots++
      }
    }
    const application = Application.configure({ basePath: emptyApp })
      .withProviders([Counting])
      .create()
    await Promise.all([application.boot(), application.boot(), application.start()])
    expect(boots).toBe(1)
    await Promise.all([application.terminate(), application.terminate()])
    await expect(application.boot()).rejects.toThrow(InvalidAppStateException)
  })

  it('a provider registered after boot boots right away', async () => {
    const events: string[] = []
    class Late extends ServiceProvider {
      register(): void {
        events.push('register')
      }
      boot(): void {
        events.push('boot')
      }
    }
    const application = Application.configure({ basePath: emptyApp }).create()
    await application.boot()
    const provider = await application.register(Late)
    expect(await application.register(Late)).toBe(provider)
    expect(events).toEqual(['register', 'boot'])
  })

  it('runs every shutdown step even when one fails, then reports all failures', async () => {
    const events: string[] = []
    class Broken extends ServiceProvider {
      shutdown(): void {
        throw new Error('redis already closed')
      }
    }
    class Fine extends ServiceProvider {
      shutdown(): void {
        events.push('fine.shutdown')
      }
    }
    const application = Application.configure({ basePath: emptyApp })
      .withProviders([Fine, Broken])
      .create()
    application.terminating(() => {
      throw new Error('server close failed')
    })
    await application.boot()
    const failure = await application.terminate().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors.map((error: Error) => error.message)).toEqual([
      'server close failed',
      'redis already closed',
    ])
    expect(events).toEqual(['fine.shutdown'])
  })
})

describe('deferred providers', () => {
  interface Mailer {
    send(to: string): string
  }
  const MailerToken: Token<Mailer> = token('Mailer')

  class MailProvider extends ServiceProvider {
    static loaded = 0
    register(): void {
      MailProvider.loaded++
      this.app.singleton(MailerToken, () => ({ send: (to: string) => `sent to ${to}` }))
    }
  }

  it('loads only when one of its tokens is first resolved', async () => {
    MailProvider.loaded = 0
    const application = Application.configure({ basePath: emptyApp })
      .withProviders([deferred([MailerToken], async () => ({ default: MailProvider }))])
      .create()
    await application.boot()
    expect(MailProvider.loaded).toBe(0)
    expect(application.bound(MailerToken)).toBe(true)

    const mailer = await application.makeAsync(MailerToken)
    expect(mailer.send('nima')).toBe('sent to nima')
    expect(MailProvider.loaded).toBe(1)
    expect(application.getProvider(MailProvider)).toBeInstanceOf(MailProvider)
    expect(application.make(MailerToken)).toBe(mailer)
  })
})

describe('signals', () => {
  const fixture = join(import.meta.dirname, 'fixtures', 'signal-app.ts')

  function run(mode: string, signals: number): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--conditions=amphion-source', fixture, mode], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let output = ''
      let sent = 0
      // Signals of one type that arrive together merge into one, so the second Ctrl+C waits
      // until shutdown has visibly started.
      const onData = (chunk: Buffer): void => {
        output += chunk.toString()
        if (sent === 0 && output.includes('ready')) {
          sent++
          child.kill('SIGINT')
        }
        if (sent === 1 && signals > 1 && output.includes('terminating')) {
          sent++
          child.kill('SIGINT')
        }
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      child.on('error', reject)
      child.on('exit', (code) => resolve({ code, output }))
    })
  }

  it('Ctrl+C terminates the app cleanly and exits with code 0', async () => {
    const { code, output } = await run('clean', 1)
    expect(output).toMatch(/ready[\s\S]*terminating[\s\S]*provider shutdown/)
    expect(code).toBe(0)
  })

  it('forces the exit when shutdown takes longer than the timeout', async () => {
    const { code, output } = await run('slow', 1)
    expect(output).toContain('Shutdown took longer than 300 ms')
    expect(code).toBe(1)
  })

  it('a second Ctrl+C exits right away', async () => {
    const { code, output } = await run('slow', 2)
    expect(output).toContain('Received SIGINT again')
    expect(code).toBe(1)
  })
})
