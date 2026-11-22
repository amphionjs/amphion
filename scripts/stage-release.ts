/**
 * Stages every publishable package whose current version is not on npm yet.
 *
 * Amphion uses npm staged publishing: CI can only stage a version, and a maintainer makes it
 * public by approving it with 2FA (on npmjs.com or with `npm stage approve <id>`). A compromised
 * workflow can therefore never put a release in front of users on its own.
 *
 * Run by `pnpm release` in .github/workflows/release.yml after a "version packages" pull request
 * is merged. Locally, use `--dry-run` to see what would be staged; nothing is uploaded or tagged.
 *
 * Usage: node scripts/stage-release.ts [--dry-run]
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Manifest {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface Publishable {
  dir: string
  name: string
  version: string
  deps: string[]
}

const root = join(import.meta.dirname, '..')
const dryRun = process.argv.includes('--dry-run')
const inCi = process.env.GITHUB_ACTIONS === 'true'

function run(command: string, args: string[], cwd = root): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() }
}

/** All non-private packages in packages/, dependencies before dependents. */
function publishablePackages(): Publishable[] {
  const packagesDir = join(root, 'packages')
  const all = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(packagesDir, entry.name)
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
      return { dir, manifest }
    })
    .filter(({ manifest }) => !manifest.private)

  const names = new Set(all.map(({ manifest }) => manifest.name))
  const byName = new Map<string, Publishable>(
    all.map(({ dir, manifest }) => [
      manifest.name,
      {
        dir,
        name: manifest.name,
        version: manifest.version,
        deps: Object.keys({
          ...manifest.dependencies,
          ...manifest.peerDependencies,
          ...manifest.optionalDependencies,
        }).filter((dep) => names.has(dep)),
      },
    ]),
  )

  const ordered: Publishable[] = []
  const seen = new Set<string>()
  const visit = (name: string): void => {
    if (seen.has(name)) return
    seen.add(name)
    const pkg = byName.get(name)
    if (!pkg) return
    for (const dep of pkg.deps) visit(dep)
    ordered.push(pkg)
  }
  for (const name of [...byName.keys()].sort()) visit(name)
  return ordered
}

/** True when this exact version is public on npm. Throws on registry errors, so CI never guesses. */
function isPublished(name: string, version: string): boolean {
  const { ok, output } = run('npm', ['view', `${name}@${version}`, 'version', '--json'])
  if (ok) return output.length > 0
  if (/E404|404 Not Found/.test(output)) return false // the package does not exist on npm yet
  throw new Error(`Could not check ${name}@${version} on npm:\n${output}`)
}

const staged: Publishable[] = []
const alreadyStaged: Publishable[] = []

for (const pkg of publishablePackages()) {
  const label = `${pkg.name}@${pkg.version}`
  if (isPublished(pkg.name, pkg.version)) {
    console.log(`= ${label} is already published.`)
    continue
  }

  const args = ['stage', 'publish', '--access', 'public', '--no-git-checks']
  if (inCi) args.push('--provenance')
  if (dryRun) args.push('--dry-run')

  console.log(`> Staging ${label}${dryRun ? ' (dry run)' : ''}`)
  const { ok, output } = run('pnpm', args, pkg.dir)
  console.log(output)

  if (ok) {
    staged.push(pkg)
  } else if (/already|exists|E409|\b409\b|cannot publish over/i.test(output)) {
    // A previous run staged this version and it is still waiting for approval.
    console.log(`= ${label} is already staged and waiting for approval.`)
    alreadyStaged.push(pkg)
  } else {
    throw new Error(`Staging ${label} failed.`)
  }
}

// Tag the commit each newly staged version was built from, like `changeset publish` does.
if (inCi && !dryRun) {
  for (const pkg of staged) {
    const tag = `${pkg.name}@${pkg.version}`
    const created = run('git', ['tag', tag])
    if (!created.ok) throw new Error(`Could not create tag ${tag}:\n${created.output}`)
    const pushed = run('git', ['push', 'origin', `refs/tags/${tag}`])
    if (!pushed.ok) throw new Error(`Could not push tag ${tag}:\n${pushed.output}`)
  }
}

const heading = dryRun ? '## Dry run: would stage' : '## Staged on npm: waiting for approval'
const lines = [
  staged.length > 0 || alreadyStaged.length > 0 ? heading : '## Nothing to stage',
  '',
  ...staged.map(
    (pkg) => `- \`${pkg.name}@${pkg.version}\`${dryRun ? '' : ' (staged by this run)'}`,
  ),
  ...alreadyStaged.map((pkg) => `- \`${pkg.name}@${pkg.version}\` (staged earlier)`),
]
if (!dryRun && (staged.length > 0 || alreadyStaged.length > 0)) {
  lines.push(
    '',
    'Nothing is public yet. A maintainer approves each version with 2FA, dependencies first:',
    '',
    '- on npmjs.com: open the package and approve the staged version, or',
    '- in a terminal: `npm stage list <package>`, then `npm stage approve <stage-id>`.',
  )
}
const summary = `${lines.join('\n')}\n`
console.log(`\n${summary}`)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
