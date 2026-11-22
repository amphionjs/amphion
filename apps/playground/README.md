# Playground

A real Amphion app used to try every feature by hand while the framework is built. It is private and never published.

```bash
pnpm --filter playground dev     # run with file watching; packages resolve from their TypeScript source
pnpm --filter playground smoke   # boot, request /, check the answer, exit
```

The `--conditions=amphion-source` flag makes `@amphion/*` imports load each package's `src/*.ts` directly, so you never need to rebuild a package to see a change here.
