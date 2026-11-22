# Releasing

Amphion uses [Changesets](https://github.com/changesets/changesets) for versions and changelogs, and npm **staged publishing** with trusted publishing (OIDC). No npm token is stored anywhere, and CI can never make a release public on its own: a maintainer approves every version with 2FA.

## For every change to a published package

```bash
pnpm changeset
```

Pick the packages that changed and the bump type, then write one line for the changelog. Commit the generated file in `.changeset/` with your change. Packages marked `"private": true` (every package that has not been released yet) are skipped.

## How a release goes out

1. The `Release` workflow runs on every push to `master`.
2. If there are pending changesets, it opens (or updates) a pull request named **chore: version packages** that bumps versions and writes the changelogs.
3. When that pull request is merged, the workflow builds every package and runs `scripts/stage-release.ts`. It **stages** each package version that is not on npm yet (dependencies first), with a provenance statement, and pushes a git tag such as `create-amphion@0.0.2`. The job summary lists what was staged.
4. A maintainer approves each staged version with 2FA, dependencies first:
   - on npmjs.com: open the package and approve the staged version, or
   - in a terminal: `npm stage list <package>`, then `npm stage approve <stage-id>`.

   Only then does the version become public. To refuse a staged version, use `npm stage reject <stage-id>` (and delete its git tag).

Why staged: with direct publishing, anyone who compromises the workflow (a malicious dependency in CI, a merged bad pull request, a hijacked account) could ship a malicious version to every user. With staged publishing, a release always needs a human with 2FA.

To see what would be staged without uploading anything: `node scripts/stage-release.ts --dry-run` (after a version bump).

## One-time setup per package

On npmjs.com, open the package's **Settings**, then **Trusted Publisher**:

1. Choose **GitHub Actions**. Organization or user: `amphionjs`. Repository: `amphion`. Workflow filename: `release.yml`. Environment: leave empty.
2. Leave **Allow npm publish** and **Allow npm dist-tag** unchecked, so the workflow can only stage.
3. After the first staged release is approved, set **Publishing access** to require 2FA and disallow tokens.

A brand-new `@amphion/*` package is not on npm yet, so it cannot have a trusted publisher. Publish its first version manually from a maintainer's machine with `npm publish --access public`, then configure it as above.
