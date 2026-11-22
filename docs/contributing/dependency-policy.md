# Dependency policy

Every runtime dependency of an Amphion package is installed in every app that uses it. Fewer, well-known dependencies mean fewer supply-chain risks, so adding one is a decision, not a convenience.

## The rule: build the experience, buy the plumbing

Build what defines the developer experience (the container, router API, ORM API, CLI). Buy what is hard to get right and not unique to Amphion (SQL drivers, password hashing, SMTP, the Redis protocol, parsers). Wrap every bought library behind an Amphion interface, so it can be replaced later without changing the public API.

Prefer Node.js built-ins first: `node:crypto`, `util.parseArgs`, `util.styleText`, `util.parseEnv`, `fetch`, `node:test` utilities and so on.

## What a pull request that adds a runtime dependency must include

Fill in the "New runtime dependency" section of the pull request template:

| Question | Example |
| --- | --- |
| What does it do, and why not a built-in or our own code? | "find-my-way: radix-tree route matching with ReDoS checks" |
| Weekly downloads | From npmjs.com |
| Maintainers | Number of maintainers and whether the project is actively maintained |
| Security check | `pnpm audit` result, and the Socket.dev report for the package |
| Install scripts | Does it run a `postinstall` script? If so, why is that needed? |
| Size and transitive dependencies | How many packages it pulls in |

Development-only dependencies (build, test, docs tooling) do not ship to users, but they still run on contributors' machines and in CI: keep them few and well known, and pin them in the `catalog:` in `pnpm-workspace.yaml`.

## Guards that run automatically

- `minimumReleaseAge` in `pnpm-workspace.yaml`: pnpm refuses to install a version published less than a day ago, which blocks most hijacked releases before they reach us.
- `allowBuilds` in `pnpm-workspace.yaml`: dependency install scripts are blocked unless approved by name.
- CI runs `pnpm audit --prod` on every pull request.
- Dependabot opens weekly update pull requests for npm packages and GitHub Actions.
- GitHub Actions are pinned to full commit SHAs, not tags.
