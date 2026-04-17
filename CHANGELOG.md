# Changelog

## 0.4.0 (unreleased)

- Offer `dd` shell alias after 3+ invocations
- Add `--version` / `-v` flag
- Auto-set package.json version from git tag in CI (no manual bump needed)

## 0.3.0

- Add `--global` flag to always use global storage, skipping git repo detection
- Add Claude Code skill for AI-driven task management (`skills/dagdo/`)
- Replace Bun-specific APIs (`Bun.file`, `Bun.write`) with Node.js `fs` for compatibility
- Add storage unit tests (overwrite, unicode, nested dirs, binary buffer)
- Gate release workflow on test + typecheck passing

## 0.2.0

- Fix `bin/dagdo` symlink resolution for `npm install -g`
- Publish to npm as `@coiggahou2002/dagdo` with provenance
- Add npm publish job to release workflow
- Rename from `depdo` to `dagdo`

## 0.1.0

Initial release.

- Add, edit, remove, and complete tasks
- Dependency linking with automatic cycle detection
- `dagdo next` — show tasks ready to work on (zero in-degree)
- `dagdo done` — mark complete, shows newly unblocked tasks
- `dagdo graph` — ASCII tree, Mermaid syntax, PNG/SVG via Graphviz
- Priority levels (high/med/low) and tags
- Prefix ID matching (`a3f` instead of `a3f1b2`)
- Project-level storage for git repos, global storage otherwise
- `dagdo status` — summary with progress bar
- Single-binary distribution via `bun build --compile`
