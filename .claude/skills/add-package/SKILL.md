---
name: add-package
description: Add a new package to the Amphion monorepo (packages/<name>, published as @amphion/<name>). Use when asked to create, scaffold or start a new framework package.
---

# Add a package

1. **Pick the layer.** Read `scripts/layers.ts`. Add the package name with its layer to `PACKAGE_LAYERS`. A package may depend only on packages in its own layer or a lower one. If the right layer is unclear, ask.
2. **Scaffold it.** Run:
   ```bash
   pnpm new:package <name> --description "One sentence on what it does." --deps core,http --planned "Planned for Phase N."
   ```
   Never create the folder by hand: the script keeps every package identical in shape.
3. **Install.** Run `pnpm install` so the workspace links the new package.
4. **Check.** Run `pnpm test tests/repo` (repo conventions) and `pnpm --filter @amphion/<name> typecheck`.
5. **Package rules.** If the package has rules of its own, add `packages/<name>/AGENTS.md`.
6. **Docs.** Add a docs page under `docs/` and link it in `docs/.vitepress/config.ts` once the package has a public API.

The new package starts with `"private": true` and version `0.0.0`, so it cannot be published by accident. Only remove `private` (and add a changeset with `pnpm changeset`) when the user says the package is ready for its first release.
