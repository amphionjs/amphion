#!/usr/bin/env node
// create-amphion: scaffolds the folder structure of a new Amphion app.
// Usage: npm create amphion@latest my-app
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs, styleText } from 'node:util'

const { positionals } = parseArgs({ allowPositionals: true, strict: false })
const name = positionals[0] ?? 'my-amphion-app'

// Only allow simple folder names, so the tool can never write outside the current directory.
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes('..')) {
  console.error(
    styleText(
      'red',
      `Invalid project name "${name}". Use letters, numbers, ".", "-" and "_" only.`,
    ),
  )
  process.exit(1)
}

const root = resolve(process.cwd(), name)
if (existsSync(root) && readdirSync(root).length > 0) {
  console.error(styleText('red', `The folder "${name}" already exists and is not empty.`))
  process.exit(1)
}

const folders = [
  'app/Http/Controllers',
  'app/Http/Middleware',
  'app/Http/Requests',
  'app/Models',
  'app/Policies',
  'app/Providers',
  'app/Jobs',
  'app/Events',
  'app/Listeners',
  'app/Mail',
  'app/Notifications',
  'app/Console/Commands',
  'bootstrap',
  'config',
  'database/migrations',
  'database/seeders',
  'database/factories',
  'resources/views',
  'resources/js',
  'resources/css',
  'routes',
  'storage/app',
  'storage/logs',
  'storage/framework',
  'tests/Feature',
  'tests/Unit',
]

const files = {
  'package.json': `${JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      engines: { node: '>=24' },
      imports: { '#app/*': './app/*', '#config/*': './config/*' },
    },
    null,
    2,
  )}\n`,
  '.gitignore': 'node_modules/\n.env\nstorage/logs/*\n!storage/logs/.gitkeep\n',
  '.env.example': 'APP_NAME=Amphion\nAPP_ENV=local\nAPP_KEY=\nPORT=3000\n',
  'routes/web.ts':
    "// Your web routes will live here, for example:\n// Route.get('/', ({ view }) => view.render('welcome'))\n",
  'README.md': `# ${name}\n\nAn [Amphion](https://github.com/amphionjs/amphion) application.\n`,
}

for (const folder of folders) {
  mkdirSync(join(root, folder), { recursive: true })
  writeFileSync(join(root, folder, '.gitkeep'), '')
}
for (const [file, content] of Object.entries(files)) {
  writeFileSync(join(root, file), content)
}

console.log(styleText('green', `\nCreated ${name} with the Amphion project structure.`))
console.log(`\nNext steps:\n  cd ${name}\n  cp .env.example .env`)
console.log(
  styleText(
    'yellow',
    '\nAmphion is pre-alpha: the framework packages (@amphion/*) arrive with v0.1.',
  ),
)
console.log('Follow progress at https://github.com/amphionjs/amphion\n')
