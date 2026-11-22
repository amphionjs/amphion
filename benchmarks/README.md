# Benchmarks

Catch performance regressions in the container, router and ORM early, while they are cheap to fix. Benchmarks are not run in CI because shared runners are too noisy; run them locally before and after a change that touches a hot path.

| Command | What it runs |
| --- | --- |
| `pnpm bench` | Every micro-benchmark in `micro/*.bench.ts` (mitata) |
| `pnpm bench token-lookup` | Only the micro-benchmarks whose file name contains `token-lookup` |
| `pnpm bench:http` | A raw `node:http` hello server under autocannon load: the baseline for the HTTP layer |

To add a micro-benchmark, create `micro/<topic>.bench.ts` and register cases with mitata's `bench()`, `group()` and `summary()`. The runner picks it up automatically.
