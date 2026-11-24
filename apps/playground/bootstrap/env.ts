// Typed, validated environment variables. Boot fails with one clear error if any is invalid.
import { Env } from '@amphion/core'

export default Env.create(new URL('..', import.meta.url), {
  APP_NAME: Env.string().default('Amphion Playground'),
  APP_ENV: Env.enum(['local', 'testing', 'production'] as const).default('local'),
  PORT: Env.number().default(3000),
})
