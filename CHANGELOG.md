# Changelog

## [Unreleased]

- Add `dagdo sync` — optional cloud sync of global tasks via any git remote
  - `dagdo sync init <url>` auto-detects whether to init+push or clone
  - `dagdo sync` does fast-forward push/pull; refuses on divergence
  - `--accept-local` / `--accept-remote` for explicit divergence resolution
  - Auto-commits after every write when `~/.dagdo/` is a git repo
  - Sync only applies to global storage; project-level tasks use host project's git

## [0.6.0] - 2026-04-19

- Overhaul release workflow: MR label-driven versioning, automated bump/tag/publish
- Add alpha package publishing on feature branch push
- Enforce branch protection: all changes via feature branch + MR
- Fix compiled binary version: CI sets version before build
- Remove release-it (replaced by CI automation)
- Remove pre-push hook (replaced by CI label check)

## [0.5.3]

- List tasks in topological order (unblocked first, deeper dependencies later)
- Right-aligned blocked count column with ⏳ icon, replacing inline "(blocked by ...)"
- CJK-aware column alignment

## [0.5.2]

- Fix release build: move rendering deps to optionalDependencies and exclude from binary compilation
- Binary users get core CLI; mermaid/graphviz rendering requires npm install of optional deps

## [0.5.1]

- Add `dagdo upgrade` command — checks npm for newer version and upgrades
- Startup version check (once per day, non-blocking) with update notice

## [0.5.0]

- Switch PNG/SVG rendering from Graphviz to Mermaid (via mermaid-isomorphic + Playwright)
- Anthropic-inspired warm color palette for graph output (parchment, terracotta, ivory)
- Highlight ready tasks (in-degree zero) with terracotta accent, blocked tasks in ivory, done in muted gray
- `dagdo view` now opens SVG instead of PNG for crisp rendering
- Add `--dot` flag to use Graphviz as fallback renderer
- Old Graphviz renderer preserved via `dagdo graph --png file --dot`

## [0.4.2]

- Sync README and skill with all current CLI commands (view, --global, --version)
- Add CLAUDE.md project rules

## [0.4.1]

- Add `dagdo view` — render full graph as PNG and open with system image viewer

## [0.4.0]

- Offer `dd` shell alias after 3+ invocations
- Add `--version` / `-v` flag
- Auto-set package.json version from git tag in CI (no manual bump needed)
- Require CHANGELOG entry before release (CI check + local pre-push hook)

## [0.3.0]

- Add `--global` flag to always use global storage, skipping git repo detection
- Add Claude Code skill for AI-driven task management (`skills/dagdo/`)
- Replace Bun-specific APIs (`Bun.file`, `Bun.write`) with Node.js `fs` for compatibility
- Add storage unit tests (overwrite, unicode, nested dirs, binary buffer)
- Gate release workflow on test + typecheck passing

## [0.2.0]

- Fix `bin/dagdo` symlink resolution for `npm install -g`
- Publish to npm as `@coiggahou2002/dagdo` with provenance
- Add npm publish job to release workflow
- Rename from `depdo` to `dagdo`

## [0.1.0]

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
