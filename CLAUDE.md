@AGENTS.md

# Claude Code notes

- All project rules live in `AGENTS.md`, which is shared with every coding agent. Add new project rules there, not here.
- This file holds only Claude Code specific notes.
- Personal preferences go in `CLAUDE.local.md` (gitignored). Personal settings go in `.claude/settings.local.json` (gitignored).
- When you learn a durable project rule during a session, propose adding it to `AGENTS.md` in the same change.
- A PostToolUse hook (`.claude/hooks/typecheck-after-edit.mjs`, set up in `.claude/settings.json`) type-checks the project that owns a `.ts` file after every Edit or Write, and shows the errors. Fix them before moving on.
- Skills in `.claude/skills/`: `add-package` (scaffold a new package) and `release` (changesets and how releases go out).
