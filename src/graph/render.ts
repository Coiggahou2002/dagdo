import pc from "picocolors";
import type { AdjacencyGraph, GraphLayout, LayoutNode, LayoutEdge, TaskId, Priority } from "../types";
import { topologicalSort } from "./topo";

/**
 * Compute the graph layout — pure data, no rendering.
 * This separation allows future renderers (e.g. image/SVG) to reuse the same layout.
 */
export function computeLayout(graph: AdjacencyGraph): GraphLayout {
  const { levels } = topologicalSort(graph);

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const levelGroups = new Map<number, TaskId[]>();

  for (const [id, task] of graph.tasks) {
    const level = levels.get(id) ?? 0;
    const blocked = graph.inEdges.get(id)?.size ?? 0;
    const blocking = graph.outEdges.get(id)?.size ?? 0;
    nodes.push({ task, level, blocked, blocking });

    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  }

  for (const [id] of graph.tasks) {
    for (const to of graph.outEdges.get(id) ?? []) {
      edges.push({ from: id, to });
    }
  }

  return { nodes, edges, levels: levelGroups };
}

/**
 * Render the DAG as ASCII tree(s) in the terminal.
 */
export function renderAscii(graph: AdjacencyGraph): string {
  if (graph.tasks.size === 0) return pc.dim("Empty graph.");

  const layout = computeLayout(graph);
  const lines: string[] = [];
  const rendered = new Set<TaskId>();

  // Find roots (level 0 / no in-edges)
  const roots = layout.nodes
    .filter((n) => n.blocked === 0)
    .sort((a, b) => {
      const priOrder: Record<Priority, number> = { high: 0, med: 1, low: 2 };
      return priOrder[a.task.priority] - priOrder[b.task.priority] || a.task.createdAt.localeCompare(b.task.createdAt);
    });

  function formatNode(id: TaskId): string {
    const task = graph.tasks.get(id)!;
    const done = task.doneAt != null;
    if (done) {
      return pc.dim(`${id} ${pc.strikethrough(task.title)} done`);
    }
    const priColor: Record<Priority, (s: string) => string> = {
      high: pc.red,
      med: pc.yellow,
      low: pc.dim,
    };
    const pri = priColor[task.priority](`${task.priority}`);
    const tags = task.tags.length > 0 ? pc.dim(` [${task.tags.join(", ")}]`) : "";
    return `${pc.cyan(id)} ${task.title} ${pri}${tags}`;
  }

  function renderTree(id: TaskId, prefix: string, isLast: boolean, isRoot: boolean): void {
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const nodePrefix = isRoot ? "" : prefix + connector;

    if (rendered.has(id)) {
      lines.push(`${nodePrefix}${pc.dim(`→ ${id} (see above)`)}`);
      return;
    }

    rendered.add(id);
    lines.push(`${nodePrefix}${formatNode(id)}`);

    const children = [...(graph.outEdges.get(id) ?? [])];
    const childPrefix = isRoot ? prefix : prefix + (isLast ? "    " : "│   ");

    for (let i = 0; i < children.length; i++) {
      renderTree(children[i]!, childPrefix, i === children.length - 1, false);
    }
  }

  for (let i = 0; i < roots.length; i++) {
    if (i > 0) lines.push("");
    renderTree(roots[i]!.task.id, "", true, true);
  }

  // Render any orphan nodes not reached from roots (shouldn't happen in a DAG, but safety)
  for (const [id] of graph.tasks) {
    if (!rendered.has(id)) {
      lines.push("");
      renderTree(id, "", true, true);
    }
  }

  return lines.join("\n");
}

/**
 * Render the DAG as a Mermaid flowchart definition.
 */
export function renderMermaid(graph: AdjacencyGraph): string {
  if (graph.tasks.size === 0) return "graph TD\n    empty[No tasks]";

  // Anthropic-inspired warm palette
  const theme = `%%{init: {'theme': 'base', 'themeVariables': {
    'primaryColor': '#faf9f5',
    'primaryTextColor': '#141413',
    'primaryBorderColor': '#e8e6dc',
    'lineColor': '#87867f',
    'secondaryColor': '#f5f4ed',
    'tertiaryColor': '#f0eee6',
    'background': '#f5f4ed',
    'mainBkg': '#faf9f5',
    'nodeBorder': '#e8e6dc',
    'clusterBkg': '#f5f4ed',
    'clusterBorder': '#e8e6dc',
    'titleColor': '#141413',
    'edgeLabelBackground': '#f5f4ed',
    'nodeTextColor': '#141413',
    'fontFamily': 'Georgia, serif'
  }}}%%`;

  const lines: string[] = [theme, "graph TD"];

  const doneIds: string[] = [];
  const activeIds: string[] = [];
  const readyIds: string[] = [];

  for (const [id, task] of graph.tasks) {
    const done = task.doneAt != null;
    if (done) {
      doneIds.push(id);
      lines.push(`    ${id}("${task.title} ✓")`);
    } else {
      const tags = task.tags.length > 0 ? ` [${task.tags.join(", ")}]` : "";
      lines.push(`    ${id}("${task.title}${tags}")`);
      // Check if ready (in-degree = 0 among active tasks)
      const blockers = graph.inEdges.get(id);
      const isReady = !blockers || blockers.size === 0;
      if (isReady) {
        readyIds.push(id);
      } else {
        activeIds.push(id);
      }
    }
  }

  for (const [id] of graph.tasks) {
    const done = graph.tasks.get(id)!.doneAt != null;
    for (const to of graph.outEdges.get(id) ?? []) {
      if (done) {
        lines.push(`    ${id} -.-> ${to}`);
      } else {
        lines.push(`    ${id} --> ${to}`);
      }
    }
  }

  // Done: muted warm gray
  for (const id of doneIds) {
    lines.push(`    style ${id} fill:#f0eee6,color:#87867f,stroke:#e8e6dc`);
  }
  // Ready (in-degree 0): terracotta accent
  for (const id of readyIds) {
    lines.push(`    style ${id} fill:#c96442,color:#faf9f5,stroke:#b5573a`);
  }
  // Blocked: ivory with warm border
  for (const id of activeIds) {
    lines.push(`    style ${id} fill:#faf9f5,color:#141413,stroke:#e8e6dc`);
  }

  return lines.join("\n");
}

/**
 * Render the DAG as Graphviz DOT format (used internally for PNG generation).
 */
export function renderDot(graph: AdjacencyGraph): string {
  if (graph.tasks.size === 0) return 'digraph G {\n  label="No tasks"\n}';

  const lines: string[] = [
    "digraph G {",
    '  rankdir=TB',
    '  node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=12, margin="0.3,0.15"]',
    '  edge [color="#666666"]',
  ];

  for (const [id, task] of graph.tasks) {
    const done = task.doneAt != null;
    const tags = task.tags.length > 0 ? `\\n[${task.tags.join(", ")}]` : "";
    if (done) {
      const label = `${task.title}\\n(done)`;
      lines.push(`  "${id}" [label="${label}", fillcolor="#dddddd", fontcolor="#999999", style="rounded,filled,dashed"]`);
    } else {
      const label = `${task.title}${tags}`;
      const color =
        task.priority === "high" ? '#ff6666", fontcolor="#ffffff'
        : task.priority === "low" ? '#cccccc", fontcolor="#333333'
        : '#88bbff", fontcolor="#000000';
      lines.push(`  "${id}" [label="${label}", fillcolor="${color}"]`);
    }
  }

  for (const [id] of graph.tasks) {
    const done = graph.tasks.get(id)!.doneAt != null;
    for (const to of graph.outEdges.get(id) ?? []) {
      if (done) {
        lines.push(`  "${id}" -> "${to}" [color="#cccccc", style=dashed]`);
      } else {
        lines.push(`  "${id}" -> "${to}"`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}
