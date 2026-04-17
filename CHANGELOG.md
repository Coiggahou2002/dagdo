# Changelog

## 0.1.0

Initial release.

- Add, edit, remove, and complete tasks
- Dependency linking with automatic cycle detection
- `depdo next` — show tasks ready to work on (zero in-degree)
- `depdo done` — mark complete, shows newly unblocked tasks
- `depdo graph` — ASCII tree, Mermaid syntax, PNG/SVG via Graphviz
- Priority levels (high/med/low) and tags
- Prefix ID matching (`a3f` instead of `a3f1b2`)
- Project-level storage for git repos, global storage otherwise
- `depdo status` — summary with progress bar
- Single-binary distribution via `bun build --compile`
