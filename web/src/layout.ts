import dagre from "dagre";
import type { Edge, NodeState, Task } from "./types";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;

// Gap between connected components when packed side-by-side. 120px is ~3x the
// intra-component nodesep (40px) so the break clearly reads as "separate
// subgraph" rather than "wide edge".
const COMPONENT_GAP = 120;

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  task: Task;
  state: NodeState;
}

interface ComponentLayout {
  nodes: LaidOutNode[];
  minX: number;
  maxX: number;
  // Smallest (lexicographic) task id in this component — used as a stable
  // secondary sort key so that components of equal size keep their relative
  // order when tasks are added or removed.
  sortKey: string;
}

/**
 * Dagre top-to-bottom layout, applied per connected component. Each component
 * is offset horizontally so disconnected subgraphs are visually distinct, and
 * the component order is stable (size desc, then lex-smallest task id) so that
 * mutations inside one component don't shuffle the others. See issue #20.
 */
export function layoutGraph(tasks: Task[], edges: Edge[]): LaidOutNode[] {
  if (tasks.length === 0) return [];

  const states = computeNodeStates(tasks, edges);
  const components = findComponents(tasks, edges);

  const laidOut: ComponentLayout[] = components.map((componentTasks) =>
    layoutComponent(componentTasks, edges, states),
  );

  // Stable order: larger components first, ties broken by lex-smallest id.
  laidOut.sort((a, b) => {
    if (b.nodes.length !== a.nodes.length) return b.nodes.length - a.nodes.length;
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });

  // Pack left-to-right with COMPONENT_GAP between each component's bounding box.
  const result: LaidOutNode[] = [];
  let cursorX = 0;
  for (const comp of laidOut) {
    const shift = cursorX - comp.minX;
    for (const node of comp.nodes) {
      result.push({ ...node, x: node.x + shift });
    }
    cursorX += comp.maxX - comp.minX + COMPONENT_GAP;
  }

  // Preserve the input task order in the returned array so downstream
  // consumers (e.g. App.tsx's reconciliation) can index by task.id without
  // caring about layout ordering.
  const byId = new Map(result.map((n) => [n.id, n]));
  return tasks.map((t) => {
    const n = byId.get(t.id);
    // Every task belongs to exactly one component, so this is always defined.
    if (!n) throw new Error(`layoutGraph: task ${t.id} missing from layout`);
    return n;
  });
}

/**
 * Undirected connected components over (tasks, edges). Returns each component
 * as an array of tasks in input order.
 */
function findComponents(tasks: Task[], edges: Edge[]): Task[][] {
  const taskIds = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, string[]>();
  for (const t of tasks) adj.set(t.id, []);
  for (const e of edges) {
    if (!taskIds.has(e.from) || !taskIds.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }

  const visited = new Set<string>();
  const components: Task[][] = [];
  for (const t of tasks) {
    if (visited.has(t.id)) continue;
    const bucket = new Set<string>();
    const stack = [t.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      bucket.add(id);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) stack.push(nb);
      }
    }
    // Preserve input task order inside each component for determinism.
    components.push(tasks.filter((task) => bucket.has(task.id)));
  }
  return components;
}

/**
 * Dagre layout for a single component. Returns nodes in component-local
 * coordinates plus the component's bounding-box bounds so the caller can
 * pack multiple components side-by-side.
 */
function layoutComponent(
  componentTasks: Task[],
  allEdges: Edge[],
  states: Map<string, NodeState>,
): ComponentLayout {
  const memberIds = new Set(componentTasks.map((t) => t.id));

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const t of componentTasks) {
    g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of allEdges) {
    if (memberIds.has(e.from) && memberIds.has(e.to)) {
      g.setEdge(e.from, e.to);
    }
  }

  dagre.layout(g);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let sortKey: string | null = null;

  const nodes = componentTasks.map<LaidOutNode>((t) => {
    const n = g.node(t.id);
    const x = n.x - NODE_WIDTH / 2;
    const y = n.y - NODE_HEIGHT / 2;
    if (x < minX) minX = x;
    if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
    if (sortKey === null || t.id < sortKey) sortKey = t.id;
    return {
      id: t.id,
      x,
      y,
      task: t,
      state: states.get(t.id) ?? "blocked",
    };
  });

  // componentTasks is non-empty (findComponents only emits non-empty buckets),
  // so sortKey is always assigned.
  if (sortKey === null) throw new Error("layoutComponent: empty component");

  return { nodes, minX, maxX, sortKey };
}

/**
 * Mirror of effectiveInDegree in src/graph/dag.ts — a done predecessor no
 * longer blocks its successor.
 */
function computeNodeStates(tasks: Task[], edges: Edge[]): Map<string, NodeState> {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const blockerCount = new Map<string, number>();
  for (const t of tasks) blockerCount.set(t.id, 0);
  for (const e of edges) {
    const from = taskById.get(e.from);
    if (from && from.doneAt == null) {
      blockerCount.set(e.to, (blockerCount.get(e.to) ?? 0) + 1);
    }
  }
  const states = new Map<string, NodeState>();
  for (const t of tasks) {
    if (t.doneAt != null) states.set(t.id, "done");
    else if ((blockerCount.get(t.id) ?? 0) === 0) states.set(t.id, "ready");
    else states.set(t.id, "blocked");
  }
  return states;
}
