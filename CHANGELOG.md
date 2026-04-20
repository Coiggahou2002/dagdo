# Changelog

## [Unreleased]

## [0.10.0] - 2026-04-20

- `dagdo ui` gains a property panel: click a node to open a sidebar with priority selector (high/med/low), tag chips with add/remove, a "mark as done" checkbox, and a delete button for discoverability. Each node now also shows a small priority dot so the canvas remains scannable with the panel closed. (#8 stage 3 — closes #8)

## [0.9.0] - 2026-04-19

- `dagdo ui` is now interactive: drag nodes to rearrange, handle-to-handle drag to create dependencies (server-side cycle check, 409 → toast on conflict), select + `Delete` removes nodes/edges, double-click to rename a title, **+ New task** button adds a task. Positions are session-only, deliberately not persisted. (#8 stage 2)
- Add shared `src/graph/mutations.ts` — pure `addTask` / `updateTask` / `removeTask` / `addEdge` / `removeEdge` primitives that encode domain errors (cycle, duplicate, task_not_found, self_loop) in a discriminated union. Used by the new write endpoints (`POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`, `POST /api/edges`, `DELETE /api/edges`); the CLI continues to use its own implementation for now.

## [0.8.0] - 2026-04-19

- Add `dagdo ui` — starts a local HTTP server and opens a browser tab with a live-updating graph view (React + React Flow + dagre layout). SSE pushes data changes within ~1s; read-only in this release, interactive editing to follow. (#8 stage 1, also closes #7)
- `dagdo ui --port <n>` chooses a preferred port (default 3737, auto-increments on conflict); `--no-open` suppresses the browser.
- Refactor: `globalDataDir()`/`globalDataFile()` now resolve `~/.dagdo/` lazily and honor `$HOME`, so overriding `HOME=…` works (previously Bun's macOS `os.homedir()` read passwd DB directly and ignored the env var).

## [0.7.2] - 2026-04-19

- Fix: `dagdo view` now wraps the SVG in a minimal HTML page and opens it, so it reliably lands in a browser instead of whatever handler the OS has registered for `.svg`. Also adds Windows (`start`) to the opener matrix and a clearer error when `xdg-open` is missing on Linux (#12)

## [0.7.1] - 2026-04-19

- Fix: graph rendering now excludes done predecessors from a node's effective in-degree, so tasks whose only remaining blockers are already complete are shown as ready (#9)

## [0.7.0] - 2026-04-19

- Add `dagdo sync` — optional cloud sync via any git remote
  - `dagdo sync init <url>` auto-detects whether to init+push or clone
  - `dagdo sync` does fast-forward push/pull; refuses on divergence
  - `--accept-local` / `--accept-remote` for explicit divergence resolution
  - Auto-commits after every write when `~/.dagdo/` is a git repo
- **Breaking:** Remove project-level storage. Tasks now live in `~/.dagdo/data.json` only. The `--global` flag (now a no-op) and the interactive project-vs-global prompt are gone; use tags to separate work domains, and `dagdo sync` for multi-machine syncing.

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
