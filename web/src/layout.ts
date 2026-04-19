import dagre from "dagre";
import type { Edge, NodeState, Task } from "./types";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  task: Task;
  state: NodeState;
}

/**
 * Dagre top-to-bottom layout. Positions are recomputed on every graph change
 * — keeps things simple since Stage 1 is read-only. User-driven layout goes
 * in Stage 2.
 */
export function layoutGraph(tasks: Task[], edges: Edge[]): LaidOutNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const t of tasks) g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) {
    if (tasks.find((t) => t.id === e.from) && tasks.find((t) => t.id === e.to)) {
      g.setEdge(e.from, e.to);
    }
  }

  dagre.layout(g);

  const states = computeNodeStates(tasks, edges);
  return tasks.map((t) => {
    const n = g.node(t.id);
    return {
      id: t.id,
      x: n.x - NODE_WIDTH / 2,
      y: n.y - NODE_HEIGHT / 2,
      task: t,
      state: states.get(t.id) ?? "blocked",
    };
  });
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
