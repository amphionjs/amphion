// Claude Code PostToolUse hook: after an Edit or Write to a TypeScript file, type-check the
// project that owns the file (the nearest tsconfig.json). On errors it exits with code 2, which
// shows the errors to the agent so it fixes them before moving on.
//
// Plain JavaScript on purpose: hooks run with whatever `node` is on the PATH, which may be older
// than the Node.js 24 that the repository itself needs.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const filePath = input?.tool_input?.file_path
if (typeof filePath !== 'string' || !/\.(ts|mts|cts)$/.test(filePath)) process.exit(0)

const file = resolve(projectDir, filePath)
const rel = relative(projectDir, file)
if (rel.startsWith('..') || /(^|[\\/])(node_modules|dist)[\\/]/.test(rel)) process.exit(0)

// Find the nearest tsconfig.json between the file and the repository root.
let dir = dirname(file)
while (!existsSync(join(dir, 'tsconfig.json'))) {
  if (dir === projectDir || !dir.startsWith(projectDir + sep)) {
    dir = projectDir
    break
  }
  dir = dirname(dir)
}

const tsc = join(projectDir, 'node_modules', 'typescript', 'bin', 'tsc')
if (!existsSync(tsc)) process.exit(0) // dependencies not installed yet

try {
  execFileSync(process.execPath, [tsc, '--noEmit', '-p', dir], {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  })
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
  const project = relative(projectDir, dir) || '.'
  process.stderr.write(`Type errors in ${project} after editing ${rel}:\n${output}\n`)
  process.exit(2)
}
