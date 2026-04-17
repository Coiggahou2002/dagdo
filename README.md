# depdo

Dependency-aware todo manager. Tasks form a DAG (directed acyclic graph) — topological sort tells you what to do next.

![depdo graph](docs/hero.svg)

Most todo apps treat tasks as a flat list. Real work has dependencies: you can't deploy before tests pass, can't test before the API is built. **depdo** models your tasks as a graph and always tells you which tasks are ready to work on right now (zero in-degree nodes).

## Features

- **Dependency graph** — link tasks with `depdo link`, cycles are automatically rejected
- **What's next?** — `depdo next` shows tasks with no unfinished blockers (topological sort)
- **Smart completion** — `depdo done` tells you which tasks just became unblocked
- **Visualize** — ASCII tree, Mermaid syntax, or PNG/SVG image via Graphviz
- **Priority & tags** — filter and sort by what matters
- **Prefix IDs** — type `a3f` instead of the full `a3f1b2`
- **Single binary** — compile to a standalone executable, no runtime needed

## Install

### npm

```bash
npm install -g depdo
```

### From source (requires [Bun](https://bun.sh))

```bash
git clone https://github.com/Coiggahou2002/depdo.git
cd depdo
bun install
bun run build   # produces ./depdo binary
```

### Pre-built binaries

Download from [GitHub Releases](https://github.com/Coiggahou2002/depdo/releases).

## Quick start

```bash
# Add tasks
depdo add "Design database schema" --priority high --tag backend
depdo add "Implement API" --tag backend
depdo add "Build frontend" --tag frontend
depdo add "Integration testing"

# Add dependencies (use ID prefixes)
depdo link <design-id> --before <api-id>       # Design must finish before API
depdo link <design-id> --before <frontend-id>  # Design must finish before frontend
depdo link <api-id> --before <testing-id>      # API must finish before testing
depdo link <frontend-id> --before <testing-id> # Frontend must finish before testing

# What can I work on right now?
depdo next
# => Design database schema (it's the only unblocked task)

# Finish a task
depdo done <design-id>
# => Unblocked: Implement API
# => Unblocked: Build frontend

# See the dependency graph
depdo graph              # ASCII in terminal
depdo graph --mermaid    # Mermaid syntax (paste into GitHub/Notion)
depdo graph --all --png graph.png  # PNG image with done tasks grayed out
```

## Commands

| Command | Description |
|---------|-------------|
| `depdo add <title>` | Add a task (`--priority`, `--tag`, `--after`, `--before`) |
| `depdo done <id>` | Mark task as done, shows newly unblocked tasks |
| `depdo next` | Show tasks ready to do (in-degree = 0) |
| `depdo list` | List all active tasks with blocker counts |
| `depdo link <id> --before <other>` | Add dependency edge (with cycle detection) |
| `depdo unlink <id> <other>` | Remove dependency edge (direction-agnostic) |
| `depdo graph` | Visualize DAG (`--mermaid`, `--png <file>`, `--all`) |
| `depdo edit <id>` | Edit task (`--title`, `--priority`, `--tag`, `--untag`) |
| `depdo rm <id>` | Remove task and its edges |
| `depdo status` | Overview: total, done, ready, blocked |
| `depdo help` | Show help |

### ID shortcuts

Every task gets a 6-character hex ID (e.g. `a3f1b2`). You can use any unique prefix:

```bash
depdo done a3f    # matches a3f1b2
depdo done a      # works if only one ID starts with "a"
```

## Visualization

```bash
# ASCII tree (default)
depdo graph

# Mermaid (copy to GitHub issues, Notion, etc.)
depdo graph --mermaid

# PNG or SVG (requires @hpcc-js/wasm-graphviz and @resvg/resvg-js)
depdo graph --png output.png
depdo graph --png output.svg
depdo graph --all --png full.png   # include done tasks (grayed out)
```

## Data storage

By default, tasks are stored globally in `~/.depdo/data.json`.

When you run depdo inside a **git repository**, it checks for a `.depdo/` directory in the repo root. If found, tasks are stored per-project in `.depdo/data.json`. If not, depdo prompts you to choose between project-level and global storage on first use.

This means teams can commit `.depdo/data.json` to share task graphs, or add `.depdo/` to `.gitignore` for personal use.

## License

MIT
