// Runs every micro-benchmark in this folder: `pnpm bench`, or one file: `pnpm bench token-lookup`.
import { readdirSync } from 'node:fs'
import { run } from 'mitata'

const filter = process.argv[2]
const files = readdirSync(import.meta.dirname)
  .filter((file) => file.endsWith('.bench.ts'))
  .filter((file) => !filter || file.includes(filter))
  .sort()

if (files.length === 0) {
  console.error(`No benchmark matches "${filter}".`)
  process.exit(1)
}

for (const file of files) {
  await import(`./${file}`)
}

await run()
