# Playground

A real Amphion app used to try every feature by hand while the framework is built. It is private and never published.

```bash
pnpm --filter playground dev     # run with file watching; packages resolve from their TypeScript source
pnpm --filter playground smoke   # boot, request /, check the answer, shut down, check Ctrl+C
```

The `--conditions=amphion-source` flag makes `@amphion/*` imports load each package's `src/*.ts` directly, so you never need to rebuild a package to see a change here. `pnpm --filter playground start` runs against the built `dist/` instead (run `pnpm build` first).

## Layout

It follows the app skeleton from the plan:

| Path | What it shows |
| --- | --- |
| `bootstrap/app.ts` | Builds the `Application` (Laravel 11 style) |
| `bootstrap/providers.ts` | The provider list |
| `bootstrap/env.ts` | Typed, validated environment variables (copy `.env.example` to `.env` to change them) |
| `config/app.ts` | A config file built from the env |
| `types/config.ts` | Types the `config('app.name')` paths |
| `app/Providers/AppServiceProvider.ts` | Registers services; logs on shutdown |
| `app/Services/Greeter.ts` | Constructor injection with `static inject` |
| `server.ts` | Boots the app and serves with plain `node:http` until `@amphion/http` exists (Phase 2) |
