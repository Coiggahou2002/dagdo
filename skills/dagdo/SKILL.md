---
name: dagdo
description: Manage tasks and dependencies using the dagdo CLI. Use this skill whenever the user mentions todos, tasks, backlogs, work items, project planning, sprint planning, task dependencies, what to do next, breaking down work, tracking progress, or anything related to organizing and prioritizing work. Also use when the user says things like "remind me to", "I need to", "add that to my list", "what should I work on", "what's blocking X", or asks you to plan out a project or feature.
argument-hint: [what to do with tasks]
allowed-tools: Bash(dagdo *)
---

# dagdo — AI Task Management Skill

You are managing tasks using `dagdo`, a dependency-aware CLI todo tool. Tasks form a DAG (directed acyclic graph) — when you finish a task, its dependents become unblocked. The `next` command uses topological sort to show what's ready to work on right now (in-degree = 0).

## User's request

$ARGUMENTS

## Commands reference

### Add a task
```bash
dagdo add "<title>" [--priority high|med|low] [--tag <tag>] [--after <id>] [--before <id>]
```
- `--priority`: high, med (default), low
- `--tag`: categorize (repeatable, e.g. `--tag backend --tag urgent`)
- `--after <id>`: this task depends on `<id>` (adds edge: id → new)
- `--before <id>`: `<id>` depends on this task (adds edge: new → id)

### Link / unlink dependencies
```bash
dagdo link <id> --before <other>   # <id> must finish before <other>
dagdo link <id> --after <other>    # <id> must finish after <other>
dagdo unlink <id> <other>          # remove edge (direction-agnostic)
```
Cycle detection is automatic — dagdo rejects edges that would create a cycle.

### Complete a task
```bash
dagdo done <id>
```
Prints which tasks become unblocked. This is useful information — relay it to the user so they know what opened up.

### See what's ready
```bash
dagdo next [--limit <n>]
```
Shows tasks with zero unfinished blockers, sorted by priority then creation time.

### List tasks
```bash
dagdo list [--all] [--done] [--tag <tag>] [--priority <p>]
```

### Visualize
```bash
dagdo graph              # ASCII tree in terminal
dagdo graph --mermaid    # Mermaid syntax (for pasting into docs/issues)
dagdo graph --all        # include completed tasks (shown grayed out)
dagdo graph --png out.png          # render PNG via Mermaid
dagdo graph --png out.png --dot    # render PNG via Graphviz
```

### Edit / remove
```bash
dagdo edit <id> [--title <new>] [--priority <p>] [--tag <add>] [--untag <remove>]
dagdo rm <id> [--force]
```

### View (render and open)
```bash
dagdo view
```
Renders the full graph (including done tasks) as an SVG, wraps it in a minimal HTML page, and opens that HTML with the user's default browser. A quick way to get a zoomable visual overview.

### Interactive web view (live updates + editing)
```bash
dagdo ui                # default port 3737
dagdo ui --port 8080
dagdo ui --no-open
```
Starts a local server and opens a browser tab with a React + React Flow rendering of the graph. Supports: drag to reposition nodes (ephemeral — positions are not persisted), drag handle-to-handle to create dependencies (cycle-checked server-side, rejected with a toast on conflict), select + `Delete` to remove nodes or edges, double-click title to rename, **+ New task** button to add. Click a node to open a property panel: change priority, add/remove tags, mark as done, or delete. Each node shows a small priority dot (high=terracotta / med=gray / low=muted). All mutations go through the same `~/.dagdo/data.json` that the CLI writes, so CLI edits and UI edits converge automatically.

### Status overview
```bash
dagdo status
```

### Cloud sync (global storage only)
```bash
dagdo sync init <git-remote-url>   # one-time setup: init+push or clone
dagdo sync                         # fast-forward push or pull
dagdo sync status                  # show ahead/behind/diverged
dagdo sync --accept-local          # force-push local (on divergence)
dagdo sync --accept-remote         # force-pull remote (on divergence)
```
Sync only works with global storage. Project-level `.dagdo/` tasks are synced via the host project's own git, not dagdo's sync command. Requires `git` on PATH and a git remote the user can push to.

### Upgrade
```bash
dagdo upgrade
```
Checks npm for a newer version and upgrades if available.

### Version
```bash
dagdo --version
```

## ID shortcuts

Every task has a 6-char hex ID (e.g. `a3f1b2`). You can use any unique prefix: `a3f` or even `a` if unambiguous.

## Storage

All tasks live in `~/.dagdo/data.json` — one user-level list. There is no project-level vs global distinction; dagdo tracks everything the user is working on in a single graph, and `tags` are the right tool to separate domains (e.g. `--tag work-api`, `--tag personal`).

## How to work with dagdo

**Check before creating.** Run `dagdo list` first to see existing tasks. Users often forget what's already tracked, and duplicate tasks create confusion.

**Model dependencies when they exist.** If task B genuinely cannot start until task A is done, link them with `dagdo link A --before B`. This is what makes dagdo useful — without dependency edges, it's just a flat list. But don't over-link: tasks that *could* be done in parallel should stay unlinked.

**Use `dagdo next` to recommend work.** When the user asks what to do, `next` gives the authoritative answer — it's the set of tasks with no unfinished blockers, ranked by priority. Trust it rather than guessing.

**Relay unblock notifications.** When you run `dagdo done`, it prints which tasks just became unblocked. Tell the user — this is one of dagdo's most valuable features and helps them see the ripple effect of completing work.

**Use tags for filtering, priority for ordering.** Tags are categorical (e.g. `backend`, `frontend`, `design`). Priority expresses urgency: `high` for critical path items, `med` for normal work, `low` for nice-to-haves.

**Show the graph when planning.** After adding a batch of tasks and dependencies, run `dagdo graph` to show the user the structure. A visual confirmation helps catch mistakes in the dependency model.

## Example interactions

**User says: "I need to build a login page, but the API isn't done yet"**

```bash
dagdo list                                          # check what exists
dagdo add "Build login API" --priority high --tag backend
# (note the ID from output, e.g. a3f1b2)
dagdo add "Build login page" --tag frontend --after a3f
dagdo graph
```

**User says: "what should I work on?"**

```bash
dagdo next
```

**User says: "remind me to ask Jack for the server credentials"**

```bash
dagdo add "问 Jack 要 server 凭证" --priority high
```

**User says: "I finished the database migration"**

```bash
dagdo list                   # find the task ID
dagdo done <id>              # mark done, report unblocked tasks
```

**User says: "plan out the authentication feature"**

Break it down, create all tasks, link dependencies, then show the graph:

```bash
dagdo add "Design auth schema" --priority high --tag backend
dagdo add "Implement auth API" --tag backend --after <schema-id>
dagdo add "Build login UI" --tag frontend --after <schema-id>
dagdo add "Write auth tests" --tag testing --after <api-id> --after <ui-id>
dagdo graph
```

## Responding to the user

Execute dagdo commands and report results concisely. If the user describes a multi-step project, proactively decompose it into tasks with dependency links — this is where dagdo shines. After making changes, show the updated state (a quick `dagdo list` or `dagdo graph`) so the user has confirmation.
