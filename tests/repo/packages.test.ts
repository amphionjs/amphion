/**
 * Repository conventions. These checks keep every package in packages/ consistent and enforce
 * the layer rule: a package depends only on packages in its own layer or a lower one.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { layerRank, PACKAGE_LAYERS } from '../../scripts/layers.ts'

const root = join(import.meta.dirname, '..', '..')
const packagesDir = join(root, 'packages')
const REPO_URL = 'git+https://github.com/amphionjs/amphion.git'

interface Manifest {
  name: string
  version: string
  private?: boolean
  type?: string
  license?: string
  engines?: { node?: string }
  files?: string[]
  exports?: Record<string, Record<string, string>>
  scripts?: Record<string, string>
  repository?: { type?: string; url?: string; directory?: string }
  publishConfig?: { access?: string; exports?: Record<string, Record<string, string>> }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const folders = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const manifests = new Map<string, Manifest>(
  folders.map((folder) => [
    folder,
    JSON.parse(readFileSync(join(packagesDir, folder, 'package.json'), 'utf8')) as Manifest,
  ]),
)

const folderByName = new Map([...manifests].map(([folder, manifest]) => [manifest.name, folder]))

/** Folder names of the internal packages that a package depends on, in any dependency field. */
function internalDeps(manifest: Manifest): string[] {
  const all = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  }
  return Object.keys(all)
    .map((name) => folderByName.get(name))
    .filter((folder): folder is string => folder !== undefined)
}

describe('package layers', () => {
  it('lists every package folder in scripts/layers.ts', () => {
    const missing = folders.filter((folder) => !(folder in PACKAGE_LAYERS))
    expect(missing, 'add these to PACKAGE_LAYERS in scripts/layers.ts').toEqual([])
  })

  it('has no stale entries in scripts/layers.ts', () => {
    const stale = Object.keys(PACKAGE_LAYERS).filter((name) => !folders.includes(name))
    expect(stale, 'remove these from PACKAGE_LAYERS or create the package').toEqual([])
  })

  it('has no dependency cycles between packages', () => {
    const state = new Map<string, 'visiting' | 'done'>()
    const visit = (folder: string, path: string[]): void => {
      if (state.get(folder) === 'done') return
      if (state.get(folder) === 'visiting') {
        throw new Error(`Dependency cycle: ${[...path, folder].join(' -> ')}`)
      }
      state.set(folder, 'visiting')
      const manifest = manifests.get(folder)
      if (manifest) {
        for (const dep of internalDeps(manifest)) visit(dep, [...path, folder])
      }
      state.set(folder, 'done')
    }
    for (const folder of folders) visit(folder, [])
  })
})

describe.each(folders)('packages/%s', (folder) => {
  const manifest = manifests.get(folder) as Manifest
  const isInstaller = folder === 'create-amphion'

  it('is named after its folder', () => {
    expect(manifest.name).toBe(isInstaller ? 'create-amphion' : `@amphion/${folder}`)
  })

  it('is an ES module for Node.js 24 or newer, MIT licensed', () => {
    expect(manifest.type).toBe('module')
    expect(manifest.engines?.node).toBe('>=24')
    expect(manifest.license).toBe('MIT')
  })

  it('points to its folder in the amphionjs/amphion repository', () => {
    expect(manifest.repository?.url).toBe(REPO_URL)
    expect(manifest.repository?.directory).toBe(`packages/${folder}`)
  })

  it('depends on internal packages through the workspace, never on a higher layer', () => {
    const layer = PACKAGE_LAYERS[folder]
    expect(layer).toBeDefined()
    const all = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies,
    }
    for (const [name, range] of Object.entries(all)) {
      if (!name.startsWith('@amphion/')) continue
      const depFolder = folderByName.get(name)
      expect(depFolder, `${name} is not a package in packages/`).toBeDefined()
      expect(range, `${name} must use a workspace: range`).toMatch(/^workspace:/)
      const depLayer = PACKAGE_LAYERS[depFolder as string]
      if (layer && depLayer) {
        expect(
          layerRank(depLayer),
          `${folder} (${layer}) must not depend on ${depFolder} (${depLayer})`,
        ).toBeLessThanOrEqual(layerRank(layer))
      }
    }
  })

  if (isInstaller) return

  it('ships only compiled output from dist/', () => {
    expect(manifest.files).toEqual(['dist'])
    expect(manifest.scripts?.build).toBe('tsc -p tsconfig.build.json')
    expect(manifest.scripts?.typecheck).toBe('tsc --noEmit')
    expect(existsSync(join(packagesDir, folder, 'src', 'index.ts'))).toBe(true)
  })

  it('resolves to source in the workspace and to dist when published', () => {
    expect(manifest.exports?.['.']).toEqual({
      'amphion-source': './src/index.ts',
      types: './dist/index.d.ts',
      default: './dist/index.js',
    })
    expect(manifest.publishConfig?.access).toBe('public')
    const published = manifest.publishConfig?.exports ?? {}
    for (const [subpath, conditions] of Object.entries(manifest.exports ?? {})) {
      const { 'amphion-source': _source, ...rest } = conditions
      expect(published[subpath], `publishConfig.exports["${subpath}"]`).toEqual(rest)
    }
  })

  it('stays private until it is released (version 0.0.0 means unreleased)', () => {
    if (manifest.version === '0.0.0') expect(manifest.private).toBe(true)
  })
})
