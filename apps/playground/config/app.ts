import { defineConfig } from '@amphion/core'
import env from '#bootstrap/env.ts'

export default defineConfig({
  name: env.get('APP_NAME'),
  env: env.get('APP_ENV'),
  port: env.get('PORT'),
})
