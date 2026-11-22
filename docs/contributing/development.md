# Development setup

This page is for people working on the Amphion repository itself.

## Requirements

- Node.js 24 or newer (CI tests 24 and 26)
- pnpm 12 (the exact version is pinned in `packageManager` in the root `package.json`; Corepack picks it up)

```bash
git clone https://github.com/amphionjs/amphion.git
cd amphion
pnpm install
```

## Commands

Run from the repository root:

| Command | What it does |
| --- | --- |
| `pnpm build` | Compiles every package with `tsc` into `dist/` (Turborepo, cached and in dependency order) |
| `pnpm typecheck` | Type-checks every package, app and repo script without emitting |
| `pnpm test` | Runs all tests with Vitest |
| `pnpm test packages/core` | Runs only the tests under one path |
| `pnpm --filter @amphion/core typecheck` | Type-checks one package |
| `pnpm lint` | Lint and format check with Biome |
| `pnpm format` | Applies Biome's formatting and safe fixes |
| `pnpm bench` | Runs the micro-benchmarks (`pnpm bench:http` for the HTTP baseline) |
| `pnpm docs:dev` | Starts this documentation site locally |
| `pnpm new:package <name>` | Scaffolds a new package (see below) |
| `pnpm changeset` | Records a change for the next release (see [Releasing](./releasing)) |

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/<name>/` | One npm package per folder, published as `@amphion/<name>` (the installer is `create-amphion`) |
| `apps/playground/` | A real app for trying every feature by hand |
| `docs/` | This site |
| `benchmarks/` | mitata micro-benchmarks and autocannon HTTP benchmarks |
| `scripts/` | Repo scripts, the package template and the layer map (`scripts/layers.ts`) |
| `tests/repo/` | Tests for repository conventions |

## How packages are built and resolved

- Framework packages are written in TypeScript and published as compiled `.js` plus `.d.ts`, one output file per source file, because Node.js refuses to strip types inside `node_modules`.
- Inside the repository you never need to build before testing. Every package's `exports` has an `amphion-source` condition that points to `src/index.ts`. TypeScript (`customConditions`), Vitest and the playground (`node --conditions=amphion-source`) all use it, so they read the source directly.
- `pnpm build` uses `tsconfig.build.json`, which turns the condition off, so each package is compiled against the `dist/` output of the packages it depends on. Turborepo builds them in dependency order.
- On publish, pnpm replaces `exports` with `publishConfig.exports`, which has no source condition.

## Layers

Each package belongs to one layer, listed in `scripts/layers.ts`:

`kernel` → `transport` → `data` → `security` → `presentation` → `services` → `tooling`

A package may depend only on packages in its own layer or a lower one. `tests/repo/packages.test.ts` enforces this and checks every package's `package.json` against the conventions.

## Adding a package

1. Add the package name and its layer to `scripts/layers.ts`.
2. Run `pnpm new:package <name> --description "What it does." --deps core,http`.
3. Run `pnpm install`, then write code in `src/` and tests in `test/`.

New packages start with `"private": true` and version `0.0.0`, so they can never be published by accident. When a package is ready for its first release, remove `private` and add a changeset.
