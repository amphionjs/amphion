import { defineConfig } from 'vitest/config'

// One config for the whole repo. Narrow a run by path: `pnpm test packages/core`.
// The `amphion-source` condition makes workspace packages resolve to their `src/*.ts`,
// so tests never need a build first.
export default defineConfig({
  resolve: {
    conditions: ['amphion-source'],
  },
  ssr: {
    resolve: {
      conditions: ['amphion-source'],
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/tests/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
