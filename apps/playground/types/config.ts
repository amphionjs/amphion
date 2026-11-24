// Types `config('app.name')` and friends. Add one line per file in config/.
import type app from '#config/app.ts'

declare module '@amphion/core' {
  interface ConfigRegistry {
    app: typeof app
  }
}
