/**
 * Scaffolds a new package in packages/<name> from scripts/templates/package.
 *
 * Usage:
 *   pnpm new:package <name> --description "What it does" [--deps core,http] [--planned "Planned for Phase 2."]
 *
 * The package must already be listed in scripts/layers.ts, so its layer is decided first.
 * New packages start as "private": true. Remove that flag (and add a changeset) when the
 * package is ready to publish.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, styleText } from 'node:util'
import { layerRank, PACKAGE_LAYERS } from './layers.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const templates = join(root, 'scripts', 'templates', 'package')

function fail(message: string): never {
  console.error(styleText('red', message))
  process.exit(1)
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    description: { type: 'string' },
    deps: { type: 'string', default: '' },
    planned: { type: 'string', default: 'Not implemented yet.' },
  },
})

const name = positionals[0]
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  fail('Usage: pnpm new:package <name> --description "..." [--deps core,http] [--planned "..."]')
}
const description = values.description
if (!description) fail('--description is required.')

const layer = PACKAGE_LAYERS[name]
if (!layer) fail(`"${name}" is not in scripts/layers.ts. Add it with its layer first.`)

const dir = join(root, 'packages', name)
if (existsSync(dir)) fail(`packages/${name} already exists.`)

const deps = values.deps
  .split(',')
  .map((dep) => dep.trim())
  .filter(Boolean)
for (const dep of deps) {
  const depLayer = PACKAGE_LAYERS[dep]
  if (!depLayer || !existsSync(join(root, 'packages', dep))) {
    fail(`Dependency "${dep}" does not exist in packages/.`)
  }
  if (layerRank(depLayer) > layerRank(layer)) {
    fail(`"${name}" (${layer}) cannot depend on "${dep}" (${depLayer}): that layer is higher.`)
  }
}

const manifest = {
  name: `@amphion/${name}`,
  version: '0.0.0',
  private: true,
  description: `${description} Part of the Amphion framework for Node.js.`,
  type: 'module',
  sideEffects: false,
  exports: {
    '.': {
      'amphion-source': './src/index.ts',
      types: './dist/index.d.ts',
      default: './dist/index.js',
    },
  },
  files: ['dist'],
  scripts: {
    build: 'tsc -p tsconfig.build.json',
    typecheck: 'tsc --noEmit',
    clean: 'node -e "fs.rmSync(\'dist\',{recursive:true,force:true})"',
  },
  dependencies: Object.fromEntries(deps.map((dep) => [`@amphion/${dep}`, 'workspace:^'])),
  engines: { node: '>=24' },
  keywords: ['amphion', 'framework', 'laravel', name],
  license: 'MIT',
  author: 'Nima Sayadi',
  repository: {
    type: 'git',
    url: 'git+https://github.com/amphionjs/amphion.git',
    directory: `packages/${name}`,
  },
  homepage: `https://github.com/amphionjs/amphion/tree/master/packages/${name}`,
  bugs: 'https://github.com/amphionjs/amphion/issues',
  publishConfig: {
    access: 'public',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    },
  },
}

const fill = (template: string): string =>
  readFileSync(join(templates, template), 'utf8')
    .replaceAll('{{name}}', name)
    .replaceAll('{{description}}', description)
    .replaceAll('{{planned}}', values.planned)

mkdirSync(join(dir, 'src'), { recursive: true })
writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(join(dir, 'tsconfig.json'), fill('tsconfig.json.tpl'))
writeFileSync(join(dir, 'tsconfig.build.json'), fill('tsconfig.build.json.tpl'))
writeFileSync(join(dir, 'src', 'index.ts'), fill('index.ts.tpl'))
writeFileSync(join(dir, 'README.md'), fill('README.md.tpl'))

console.log(styleText('green', `Created packages/${name} (@amphion/${name}, layer: ${layer}).`))
console.log('Next: run pnpm install, then add code in src/ and tests in test/.')
