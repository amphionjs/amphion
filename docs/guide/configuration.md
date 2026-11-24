# Configuration

## Environment variables

Declare your environment variables once, with types, in `bootstrap/env.ts`:

```ts
// bootstrap/env.ts
import { Env } from '@amphion/core'

export default Env.create(new URL('..', import.meta.url), {
  APP_NAME: Env.string(),
  APP_KEY: Env.string(),
  APP_ENV: Env.enum(['local', 'testing', 'production'] as const).default('local'),
  PORT: Env.number().default(3000),
  DEBUG: Env.boolean().default(false),
  APP_URL: Env.url().optional(),
})
```

| Rule | Accepts | Type |
| --- | --- | --- |
| `Env.string()` | Any non-empty string | `string` |
| `Env.number()` | A finite number | `number` |
| `Env.boolean()` | `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off` | `boolean` |
| `Env.enum([...] as const)` | One of the listed values | A union of the values |
| `Env.url()` | An absolute URL | `string` |

Add `.default(value)` for a fallback, or `.optional()` to allow the variable to be missing (its type gains `undefined`). An empty value counts as missing.

**How values are loaded.** `.env` is read first, then `.env.<APP_ENV>` (for example `.env.testing` when `APP_ENV=testing` or `NODE_ENV=test`). Real environment variables win over both files. Files are parsed with Node's built-in `util.parseEnv`, so there is no `dotenv` dependency.

**`process.env` is never changed.** Values from `.env` stay inside the `Env` object, so secrets do not leak into child processes you spawn.

**Boot fails early, with every problem at once.** One `E_INVALID_ENV` error lists every missing or invalid variable. It shows names and reasons, never values:

```text
E_INVALID_ENV: Invalid environment variables:
  - APP_KEY is missing
  - PORT must be a number
 Set them in .env (see .env.example) or in the process environment.
```

Commit `.env.example`; never commit `.env`.

## Config files

Each file in `config/` exports one object with `defineConfig()`. Config files read the typed env:

```ts
// config/app.ts
import { defineConfig } from '@amphion/core'
import env from '#bootstrap/env.ts'

export default defineConfig({
  name: env.get('APP_NAME'),
  env: env.get('APP_ENV'),
  port: env.get('PORT'),
})
```

`app.boot()` loads every file in `config/`, keyed by file name. Read values with dot paths through the `config()` helper (Laravel's `config()`), or inject `ConfigRepository`:

```ts
import { config } from '@amphion/core'

config('app.name') // string
config('database.connections.pg.port') // number
config('cache.ttl', 60) // with a default
```

```ts
import { ConfigRepository } from '@amphion/core'

export default class Greeter {
  static inject = [ConfigRepository] as const
  config: ConfigRepository
  constructor(config: ConfigRepository) {
    this.config = config
  }
}
```

Config loads once at boot, and the process stays alive, so there is no `config:cache` command.

### Typed config paths

Add one line per config file to `types/config.ts`. After that, every `config()` path is checked: a typo is a compile error, and the value has the right type.

```ts
// types/config.ts
import type app from '#config/app.ts'
import type database from '#config/database.ts'

declare module '@amphion/core' {
  interface ConfigRegistry {
    app: typeof app
    database: typeof database
  }
}
```

```ts
config('app.prot') // error: '"app.prot"' is not assignable to ...
```

Until you add this file, `config()` accepts any string and returns `unknown`.

### Changing config in tests

```ts
const app = Application.configure({ basePath })
  .withConfig({ mail: { driver: 'memory' } }) // replaces config/mail.ts
  .create()

app.config.set('app.name', 'Test')
```
