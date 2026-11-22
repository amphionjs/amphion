@AGENTS.md

# Claude Code notes

- All project rules live in `AGENTS.md`, which is shared with every coding agent. Add new project rules there, not here.
- This file holds only Claude Code specific notes.
- Personal preferences go in `CLAUDE.local.md` (gitignored). Personal settings go in `.claude/settings.local.json` (gitignored).
- When you learn a durable project rule during a session, propose adding it to `AGENTS.md` in the same change.
- After editing TypeScript, run `pnpm typecheck` for the affected package before moving on.
