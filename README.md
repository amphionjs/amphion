# Amphion
 
**A TypeScript-first Node.js framework with the developer experience of Laravel.**
 
In Greek myth, Amphion built the walls of Thebes by playing his lyre, and the stones moved into place by themselves. That is the idea behind this framework: you write expressive code, and the heavy lifting falls into place.
 
Amphion brings Laravel's ideas to Node.js: a service container, service providers, an Eloquent-style ORM, Artisan-style commands, queues, events, mail and more. It is built for modern Node.js, with TypeScript, ES modules and secure defaults from the start.
 
> **Status: pre-alpha.** Amphion is in early development and is not ready for production. The APIs shown below are the target design and may change before the first release.
 
## Why Amphion?
 
- **Feels like Laravel.** The same folder structure, naming and fluent APIs. If you know Laravel, you already know most of Amphion.
- **Type-safe end to end.** Routes, config, environment variables, validation output and model attributes are all typed, so many mistakes are caught before your code runs.
- **Secure by default.** Escaped templates, CSRF protection, encrypted cookies, argon2id password hashing, strict CORS and no stack traces in production. To turn security features off, you have to opt out explicitly.
- **No build step in development.** Your app's `.ts` files run directly through Node.js's built-in type stripping. Restarts are instant.
- **Built for long-running processes.** Request state is isolated with `AsyncLocalStorage`, so data from one user's request never leaks into another's.
## Requirements
 
- Node.js 24 LTS or newer
- pnpm, npm or yarn
- PostgreSQL, MySQL/MariaDB or SQLite
- Redis (optional, for queues, cache and sessions)
## Getting started
 
Available with the first release (v0.1):
 
```bash
npm create amphion@latest my-app
cd my-app
node lyre.ts serve
```
 
All official packages live under the `@amphion` scope on npm. The unscoped `amphion` package on npm is an unrelated project.
 
## Quick look
 
### Routes
 
```ts
// routes/web.ts
import { Route } from '@amphion/http'
import PostsController from '#app/Http/Controllers/PostsController.ts'
 
Route.get('/', ({ view }) => view.render('welcome'))
 
Route.group({ prefix: '/dashboard', middleware: ['auth'] }, () => {
  Route.resource('posts', PostsController)
  Route.get('/posts/{post}/publish', [PostsController, 'publish'])
    .name('posts.publish')
})
```
 
### Controllers
 
```ts
// app/Http/Controllers/PostsController.ts
import type { HttpContext } from '@amphion/http'
import Post from '#app/Models/Post.ts'
import StorePostRequest from '#app/Http/Requests/StorePostRequest.ts'
 
export default class PostsController {
  async index({ view }: HttpContext) {
    const posts = await Post.query()
      .with('author')
      .latest()
      .paginate(15)
 
    return view.render('posts.index', { posts })
  }
 
  async store({ auth, response }: HttpContext, request: StorePostRequest) {
    const data = await request.validated()
    const post = await auth.user().related('posts').create(data)
 
    return response.redirect().route('posts.show', { post: post.id })
  }
}
```
 
### Validation with Form Requests
 
```ts
// app/Http/Requests/StorePostRequest.ts
import { FormRequest, vine } from '@amphion/validator'
 
export default class StorePostRequest extends FormRequest {
  authorize() {
    return this.auth.check()
  }
 
  rules() {
    return vine.object({
      title: vine.string().trim().minLength(3).maxLength(120),
      body: vine.string().minLength(10),
      published_at: vine.date().optional(),
    })
  }
}
```
 
### Models
 
```ts
// app/Models/Post.ts
import { Model, belongsTo, hasMany } from '@amphion/orm'
import User from '#app/Models/User.ts'
import Comment from '#app/Models/Comment.ts'
 
export default class Post extends Model {
  static fillable = ['title', 'body', 'published_at']
  static casts = { published_at: 'datetime' } as const
 
  declare id: number
  declare title: string
  declare body: string
  declare published_at: Date | null
 
  author() {
    return belongsTo(this, User, 'user_id')
  }
 
  comments() {
    return hasMany(this, Comment)
  }
}
```
 
### Migrations
 
```ts
// database/migrations/2026_11_22_000000_create_posts_table.ts
import { Migration, Schema } from '@amphion/database'
 
export default class extends Migration {
  async up() {
    await Schema.create('posts', (table) => {
      table.id()
      table.foreignId('user_id').constrained().cascadeOnDelete()
      table.string('title')
      table.text('body')
      table.timestamp('published_at').nullable()
      table.timestamps()
    })
  }
 
  async down() {
    await Schema.dropIfExists('posts')
  }
}
```
 
### Dependency injection without decorators
 
```ts
// app/Services/ReportService.ts
import { Logger } from '@amphion/logger'
import { Cache } from '@amphion/cache'
 
export default class ReportService {
  static inject = [Logger, Cache] as const
 
  log: Logger
  cache: Cache
 
  constructor(log: Logger, cache: Cache) {
    this.log = log
    this.cache = cache
  }
}
```
 
The container reads `static inject` to resolve constructor arguments. Amphion avoids decorators so your code runs with Node.js's native type stripping, with no compiler in between.
 
### Queued jobs
 
```ts
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@amphion/queue'
import { Mail } from '@amphion/mail'
import WelcomeMail from '#app/Mail/WelcomeMail.ts'
import User from '#app/Models/User.ts'
 
export default class SendWelcomeEmail extends Job {
  static tries = 3
  static backoff = [10, 60, 300]
 
  userId: number
 
  constructor(userId: number) {
    super()
    this.userId = userId
  }
 
  async handle() {
    const user = await User.findOrFail(this.userId)
    await Mail.to(user.email).send(new WelcomeMail(user))
  }
}
 
// Anywhere in your app:
await dispatch(new SendWelcomeEmail(user.id)).onQueue('mail').delay('5m')
```
 
### The CLI
 
Amphion's command line is called **lyre**, after Amphion's lyre. It is the counterpart of Laravel's `artisan`.
 
```bash
node lyre.ts make:model Post --migration --factory
node lyre.ts make:controller Posts --resource
node lyre.ts migrate
node lyre.ts route:list
node lyre.ts queue:work
node lyre.ts tinker
```
 
## Project structure
 
```text
my-app/
  app/
    Http/Controllers/  Http/Middleware/  Http/Requests/
    Models/  Policies/  Providers/  Jobs/  Events/  Listeners/
    Mail/  Notifications/  Console/Commands/  Exceptions/
  bootstrap/app.ts
  config/
  database/migrations/  database/seeders/  database/factories/
  resources/views/  resources/js/  resources/css/
  routes/web.ts  routes/api.ts  routes/console.ts  routes/channels.ts
  storage/
  tests/Feature/  tests/Unit/
  .env
  lyre.ts               # the CLI, like Laravel's artisan
  server.ts
```
 
## Features
 
| Area | Planned features |
| --- | --- |
| Core | Service container, service providers, typed config and env, request context |
| HTTP | Router with named routes, groups, resources and model binding, middleware, controllers, signed URLs |
| Validation | Form Requests powered by VineJS, Standard Schema support |
| Database | Query builder, migrations, seeders, factories, transactions |
| ORM | Eloquent-style models, relations, eager loading, casts, scopes, soft deletes, events |
| Security | Sessions, CSRF, encryption, hashing, auth guards, API tokens, 2FA, passkeys, gates and policies, rate limiting |
| Frontend | Edge templates, Vite integration, Inertia adapter for Vue, React and Svelte |
| Services | Events, cache, queues, scheduler, mail, notifications, file storage, logging, HTTP client |
| Realtime | Broadcasting with a Pusher-compatible WebSocket server (works with Laravel Echo) |
| Testing | In-process HTTP testing, database refresh, fakes for mail, queues, events and storage |
| CLI | Generators, migrations, route list, queue worker, scheduler, REPL |
 
## Roadmap
 
| Milestone | Scope |
| --- | --- |
| v0.1 alpha | Core kernel, HTTP layer, CLI |
| v0.5 beta | Database, ORM, security and authentication |
| v0.9 public beta | Views, frontend, application services, testing, realtime |
| v1.0 | Installer, starter kits, full documentation |
 
## Coming from Laravel
 
| Laravel | Amphion |
| --- | --- |
| `php artisan make:model` | `node lyre.ts make:model` |
| `Route::get()` | `Route.get()` |
| `User::where('active', 1)->get()` | `await User.where('active', true).get()` |
| `$request->validated()` | `await request.validated()` |
| `auth()->user()` | `auth.user()` |
| `dispatch(new Job)` | `await dispatch(new Job())` |
| `Cache::remember()` | `await Cache.remember()` |
| `.env` + `config()` | `.env` + typed `config.get()` |
 
The biggest difference: database, cache and queue calls are asynchronous in Node.js, so they need `await`.
 
## Security
 
Security is a core feature of Amphion, not an add-on. If you find a security vulnerability, **please do not open a public issue.** Report it privately through [GitHub Security Advisories](../../security/advisories/new) on this repository. You will get a response as quickly as possible, and the fix will be credited to you if you wish.
 
## Contributing
 
Amphion is not accepting outside contributions yet, while the core design is still settling. Issues with feedback, ideas and bug reports are welcome. Contribution guidelines will be published before the first public beta.
 
## License
 
Amphion is open-source software licensed under the [MIT license](LICENSE).
 
Copyright (c) 2026 Nima Sayadi
 