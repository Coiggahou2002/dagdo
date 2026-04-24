# Changelog

## [Unreleased]

## [0.16.0] - 2026-04-24

- `dagdo ui` adds a Focus panel on the left side showing ready tasks (in-degree = 0), grouped by priority. Click a task to pan the canvas to it and open its popover; hover to reveal a check button that marks it done; drag tasks between priority groups to change priority. Empty state shows a hint when no tasks are actionable. (#42)

## [0.15.2] - 2026-04-23

- `dagdo ui` popover: replace "Mark as done" checkbox with a **Done** primary button (right side of footer) and move **Delete** to a secondary outline button beside it. Already-done tasks show an **Undo** button instead. (#40)

## [0.15.1] - 2026-04-23

- Fix: `dagdo ui` failed with "bundle not found" when installed via `npm i -g` because the bundled `dist/cli.js` resolved `import.meta.url` to `dist/` instead of `src/server/`, breaking the relative path to `dist/web/index.html`. Path resolution now tries both layouts (bundled and source) with a fallback.

## [0.15.0] - 2026-04-23

- npm package now runs on Node.js — no Bun required. CLI entry (`bin/dagdo`) executes a pre-bundled `dist/cli.js` via `node` instead of running TypeScript source via `bun`. Build step (`bun build --target=node`) added to both release and alpha CI. `src/` removed from the published package; `engines` changed from `bun >=1.0.0` to `node >=18`. Development (`bun run dev`) and standalone binary (`bun build --compile`) are unchanged. (#2)

## [0.14.3] - 2026-04-23

- Alpha workflow skips test + publish when a push only touches workflow files, markdown, docs, LICENSE, or skills — avoids wasting CI minutes and publishing identical alpha packages. (#28)

## [0.14.2] - 2026-04-23

## [0.14.1] - 2026-04-23

- README: fix stale `dagdo done` / `dagdo next` example output to match actual CLI format, update Features list (add notes, web view, cloud sync, dark mode), fix `dagdo ui` command description, and restructure into "For Humans" / "For Agents" sections with the Claude Code skill install and usage guidance in its own section. (#30)

## [0.14.0] - 2026-04-23

- `dagdo ui` migrates to shadcn/ui component library + Tailwind CSS v4. All hand-written CSS replaced with Tailwind utilities and shadcn's default zinc palette. Adds light/dark/system theme toggle (persisted to localStorage) with React Flow `colorMode` integration so canvas, nodes, controls, and minimap all follow the theme. Toast notifications switch from hand-rolled to Sonner. Popover form controls use shadcn `Button`, `Input`, `Textarea`, and `Badge`. Old `styles.css` removed entirely.

## [0.13.1] - 2026-04-23

- Fix: dragging a node no longer spuriously opens its edit popover. Root cause: ReactFlow's `selectNodesOnDrag=true` (default) sets `node.selected=true` on drag-start via `onNodesChange`, and `TaskNode` was using `props.selected` to control the popover. Fix: `TaskNode` now reads `data.isPopoverOpen` (set only when the user explicitly clicks a node) instead of `props.selected`. A `dragMovedRef` guard in `onNodeClick` provides a secondary defence against the trailing click that follows a drag-end. (#29)

## [0.13.0] - 2026-04-23

- Tasks now carry a plain-text `notes` field — a place to jot acceptance criteria, a link, or why the task exists without stuffing it into the title. Edit via the `dagdo ui` popover (new Notes textarea below Tags, commits on blur) or the CLI (`dagdo edit <id> --note "…"` / `--clear-note`). Soft limit 2000 chars, enforced on both ends; the popover textarea uses `maxLength` so you see the cap locally and the server rejects oversize writes with a clear toast. Notes stay out of `dagdo list` / `dagdo graph` output to keep the scannable views tidy — they only surface where you went looking for them. Existing `~/.dagdo/data.json` loads without migration (field is optional). (#31)

## [0.12.0] - 2026-04-22

- `dagdo ui` replaces the sidebar property panel with a compact popover anchored next to the selected node — less mouse travel for quick edits, stays glued to the node as you pan/zoom, flips from below-node to above when it would overflow the viewport, and dismisses on Esc or by clicking elsewhere. The popover now also lets you rename the task inline (the node's double-click rename still works). (#18)
- `dagdo ui` adds two canvas shortcuts borrowed from Figma/Sketch: hold Space + left-drag to pan the canvas (grab cursor while held, resets cleanly on blur), and Option (macOS) / Alt (other platforms) + click on empty canvas to create a new task exactly at the cursor. Holding the modifier previews a dashed ghost where the new node will land; the click drops a draft node at that spot with its title input focused — type, press Enter to commit (Esc to cancel). No more `window.prompt`. Chose Option/Alt (not Cmd/Ctrl) so the shortcut doesn't clash with Cmd/Ctrl + scroll-to-zoom on the canvas. (#21)

## [0.11.2] - 2026-04-21

- Alpha publish workflow now leaves a sticky comment on the associated PR with the `npm i -g @coiggahou2002/dagdo@<version>` command for the just-published alpha. The comment updates in place on every subsequent push, so reviewers can install and smoke-test a branch without hunting through run logs for the version string.
- Fix `check-label` CI so labels added after PR open take effect — the workflow now also triggers on `labeled` / `unlabeled` events instead of reading a stale payload from the PR-open event. Label-only events skip the `test` job to save runner time; `check-label` itself no longer runs in merge-queue contexts where there is no `pull_request` payload.

## [0.11.1] - 2026-04-21

- `dagdo ui` now has a 20×20 hit area around each node connection handle (visible dot still 8×8), making it much easier to start a manual edge drag — especially on trackpads and high-DPI displays. Adjacent-rank zones stay well clear with dagre's 70px ranksep, and the node body's double-click-to-edit remains reliable. (#19)

## [0.11.0] - 2026-04-21

- `dagdo ui` now lays out each disconnected subgraph in its own region, packing connected components left-to-right with a 120px gap instead of letting dagre fuse them into one oddly-shaped blob. Component order is stable (size desc, then lex-smallest task id), so adding or removing a node in one component no longer reshuffles the others. (#20)

## [0.10.3] - 2026-04-21

- Add dark-mode hero (`docs/hero-dark.svg`) and wire the README via a `<picture>` element with `prefers-color-scheme`, so the graph no longer looks like a bright slab on GitHub's dark theme. Regenerate both via `bun run scripts/gen-hero.ts [dark]`.

## [0.10.2] - 2026-04-21

- Redraw README hero graph in the Linear palette with a richer 10-task topology (2 done roots → 2 ready → 4 blocked → integration hub → release), replacing the 4-task Slate-themed placeholder. Regenerate via `bun run scripts/gen-hero.ts > docs/hero.svg`.
- Update Mermaid theme for `dagdo graph --png` to match: white cards with indigo `#5e6ad2` ready nodes, muted-panel done nodes, `system-ui` font.

## [0.10.1] - 2026-04-21

- Restyle `dagdo ui` with a Linear-inspired light theme: indigo CTA (`#5e6ad2` hover `#7170ff`), ring-shadow cards replacing hard 1px borders, 6px radius buttons, chip-style pill tags, and mono uppercase labels for metadata. System UI font (`system-ui` stack) — no web fonts fetched.

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
