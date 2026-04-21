# dagdo

Dependency-aware todo manager. Tasks form a DAG (directed acyclic graph) — topological sort tells you what to do next.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/hero-dark.svg">
  <img alt="dagdo graph" src="docs/hero.svg">
</picture>

Most todo apps treat tasks as a flat list. Real work has dependencies: you can't deploy before tests pass, can't test before the API is built. **dagdo** models your tasks as a graph and always tells you which tasks are ready to work on right now (zero in-degree nodes).

## Features

- **Dependency graph** — link tasks with `dagdo link`, cycles are automatically rejected
- **What's next?** — `dagdo next` shows tasks with no unfinished blockers (topological sort)
- **Smart completion** — `dagdo done` tells you which tasks just became unblocked
- **Visualize** — ASCII tree, Mermaid syntax, or PNG/SVG image via Graphviz
- **Priority & tags** — filter and sort by what matters
- **Prefix IDs** — type `a3f` instead of the full `a3f1b2`
- **Single binary** — compile to a standalone executable, no runtime needed

## Install

### npm

```bash
npm install -g @coiggahou2002/dagdo
```

### From source (requires [Bun](https://bun.sh))

```bash
git clone https://github.com/Coiggahou2002/dagdo.git
cd dagdo
bun install
bun run build   # produces ./dagdo binary
```

### Pre-built binaries

Download from [GitHub Releases](https://github.com/Coiggahou2002/dagdo/releases).

## Quick start

```bash
# Add tasks
dagdo add "Design database schema" --priority high --tag backend
dagdo add "Implement API" --tag backend
dagdo add "Build frontend" --tag frontend
dagdo add "Integration testing"

# Add dependencies (use ID prefixes)
dagdo link <design-id> --before <api-id>       # Design must finish before API
dagdo link <design-id> --before <frontend-id>  # Design must finish before frontend
dagdo link <api-id> --before <testing-id>      # API must finish before testing
dagdo link <frontend-id> --before <testing-id> # Frontend must finish before testing

# What can I work on right now?
dagdo next
# => Design database schema (it's the only unblocked task)

# Finish a task
dagdo done <design-id>
# => Unblocked: Implement API
# => Unblocked: Build frontend

# See the dependency graph
dagdo graph              # ASCII in terminal
dagdo graph --mermaid    # Mermaid syntax (paste into GitHub/Notion)
dagdo graph --all --png graph.png  # PNG image with done tasks grayed out
```

## Commands

| Command | Description |
|---------|-------------|
| `dagdo add <title>` | Add a task (`--priority`, `--tag`, `--after`, `--before`) |
| `dagdo done <id>` | Mark task as done, shows newly unblocked tasks |
| `dagdo next` | Show tasks ready to do (in-degree = 0) |
| `dagdo list` | List all active tasks with blocker counts |
| `dagdo link <id> --before <other>` | Add dependency edge (with cycle detection) |
| `dagdo unlink <id> <other>` | Remove dependency edge (direction-agnostic) |
| `dagdo graph` | Visualize DAG (`--mermaid`, `--png <file>`, `--dot`, `--all`) |
| `dagdo edit <id>` | Edit task (`--title`, `--priority`, `--tag`, `--untag`) |
| `dagdo rm <id>` | Remove task and its edges |
| `dagdo view` | Render full graph as SVG and open it in your browser |
| `dagdo ui` | Start a local web view with live updates (read-only for now) |
| `dagdo status` | Overview: total, done, ready, blocked |
| `dagdo sync init <url>` | Configure cloud sync with a git remote |
| `dagdo sync` | Sync global tasks (fast-forward; errors on divergence) |
| `dagdo sync status` | Show sync state (ahead/behind/diverged) |
| `dagdo upgrade` | Check for updates and upgrade |
| `dagdo help` | Show help |
| `dagdo --version` | Print version |

### ID shortcuts

Every task gets a 6-character hex ID (e.g. `a3f1b2`). You can use any unique prefix:

```bash
dagdo done a3f    # matches a3f1b2
dagdo done a      # works if only one ID starts with "a"
```

## Visualization

```bash
# ASCII tree (default)
dagdo graph

# Mermaid (copy to GitHub issues, Notion, etc.)
dagdo graph --mermaid

# PNG or SVG via Mermaid (requires mermaid-isomorphic and playwright)
dagdo graph --png output.png
dagdo graph --png output.svg
dagdo graph --all --png full.png   # include done tasks (grayed out)
dagdo graph --png output.png --dot # use Graphviz instead of Mermaid
```

## Data storage

Tasks are stored in `~/.dagdo/data.json` — one user-level todo list across all your projects. If you want the list synced across machines, see the next section.

## Web view

`dagdo ui` starts a local HTTP server on `http://localhost:3737`, opens your browser, and renders an interactive task graph. CLI changes from other terminals appear within a second; the browser can also edit: drag nodes to rearrange, drag from one node's bottom handle to another's top to create a dependency (with cycle detection), select a node/edge and press `Delete` to remove it, double-click a node title to rename it, and use the **+ New task** button in the header to add one. Click a node to open the property panel on the right — change priority, add/remove tags, or mark the task done.

```bash
dagdo ui                  # default port 3737, opens a browser tab
dagdo ui --port 8080      # pick your own port
dagdo ui --no-open        # don't auto-open — useful in remote/SSH sessions
```

Port conflicts auto-increment (e.g. a second instance will land on 3738). `Ctrl+C` stops the server.

## Cloud sync (optional)

If you use dagdo across multiple machines, you can sync your global tasks through any git remote (GitHub, GitLab, self-hosted — whatever you already use).

**Requirements:** `git` installed locally, and an empty (or existing dagdo-managed) git repository on a remote you control. Authentication is whatever your git already uses (SSH keys, credential helper) — dagdo never touches your credentials.

```bash
# On your first machine (with existing tasks)
dagdo sync init git@github.com:you/my-dagdo-tasks.git
# → pushes your local tasks to the remote

# On a second machine (fresh install)
dagdo sync init git@github.com:you/my-dagdo-tasks.git
# → clones the remote into ~/.dagdo/

# Day-to-day: after making changes, publish them
dagdo sync
# → fast-forward push (or pull, if remote is ahead)

# Check where you stand
dagdo sync status
```

**Model.** Sync assumes a single-user, one-active-device-at-a-time workflow. Each dagdo write auto-commits locally; `dagdo sync` pushes or pulls as a fast-forward. If both sides diverge (you edited on two machines without syncing in between), dagdo refuses to merge and asks you to pick a side explicitly:

```bash
dagdo sync --accept-local    # keep local, overwrite remote
dagdo sync --accept-remote   # keep remote, overwrite local
```

## Claude Code skill

dagdo ships with a [Claude Code](https://claude.ai/code) skill that lets AI agents manage your tasks. To install:

```bash
# Copy the skill to your global Claude Code skills directory
cp -r skills/dagdo ~/.claude/skills/dagdo
```

Then ask Claude: "help me plan the API refactor as dagdo tasks" — it will decompose the work, create tasks, and link dependencies automatically.

## License

MIT
