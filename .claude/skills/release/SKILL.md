---
name: release
description: Record changes for release with Changesets, or explain how an Amphion release goes out. Use when a change touches a published package, or when asked to prepare, cut or check a release.
---

# Release

Amphion releases with Changesets and npm staged publishing. CI (`.github/workflows/release.yml`) can only **stage** versions; a maintainer makes them public by approving them with 2FA. Never run `npm publish`, `pnpm publish`, `pnpm stage publish` or `npm stage approve` yourself, and never ask for or store an npm token.

## Record a change

Every change to a published (non-private) package needs a changeset. Write the file directly, because `pnpm changeset` is interactive:

```md
<!-- .changeset/<short-kebab-description>.md -->
---
'create-amphion': patch
---

One sentence, in the past tense, for the changelog.
```

- Bump types: `patch` for fixes, `minor` for features, `major` for breaking changes (before 1.0, breaking changes are `minor`).
- Private packages (`"private": true` in `package.json`) are never released: do not add changesets for them.
- Check the result with `pnpm changeset status --verbose`.

## How a release goes out

1. Changes with changesets are merged to `master`.
2. The Release workflow opens or updates the `chore: version packages` pull request.
3. A maintainer merges it; the workflow builds, stages the new versions on npm (`scripts/stage-release.ts`) and pushes their git tags.
4. A maintainer approves each staged version on npmjs.com or with `npm stage approve <stage-id>`.

To preview step 3 locally after a version bump: `node scripts/stage-release.ts --dry-run`. The full process is in `docs/contributing/releasing.md`.
