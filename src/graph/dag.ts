import type { GraphData, AdjacencyGraph, TaskId } from "../types";

export function buildActiveGraph(data: GraphData): AdjacencyGraph {
  const activeTasks = data.tasks.filter((t) => t.doneAt == null);
  const activeSet = new Set(activeTasks.map((t) => t.id));

  const tasks = new Map(activeTasks.map((t) => [t.id, t]));
  const inEdges = new Map<TaskId, Set<TaskId>>();
  const outEdges = new Map<TaskId, Set<TaskId>>();

  for (const id of activeSet) {
    inEdges.set(id, new Set());
    outEdges.set(id, new Set());
  }

  for (const edge of data.edges) {
    if (activeSet.has(edge.from) && activeSet.has(edge.to)) {
      outEdges.get(edge.from)!.add(edge.to);
      inEdges.get(edge.to)!.add(edge.from);
    }
  }

  return { tasks, inEdges, outEdges };
}

export function buildFullGraph(data: GraphData): AdjacencyGraph {
  const allIds = new Set(data.tasks.map((t) => t.id));
  const tasks = new Map(data.tasks.map((t) => [t.id, t]));
  const inEdges = new Map<TaskId, Set<TaskId>>();
  const outEdges = new Map<TaskId, Set<TaskId>>();

  for (const id of allIds) {
    inEdges.set(id, new Set());
    outEdges.set(id, new Set());
  }

  for (const edge of data.edges) {
    if (allIds.has(edge.from) && allIds.has(edge.to)) {
      outEdges.get(edge.from)!.add(edge.to);
      inEdges.get(edge.to)!.add(edge.from);
    }
  }

  return { tasks, inEdges, outEdges };
}

/**
 * Check if adding edge from -> to would create a cycle.
 * Returns the cycle path if it would, null otherwise.
 */
export function wouldCreateCycle(
  graph: AdjacencyGraph,
  from: TaskId,
  to: TaskId
): TaskId[] | null {
  // If from === to, it's a self-loop
  if (from === to) return [from, to];

  // BFS from `to` following outEdges — if we reach `from`, there's a cycle
  const visited = new Set<TaskId>();
  const parent = new Map<TaskId, TaskId>();
  const queue: TaskId[] = [to];
  visited.add(to);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === from) {
      // Reconstruct path: from <- ... <- to, plus the new edge from -> to
      const path: TaskId[] = [current];
      let node = current;
      while (node !== to) {
        node = parent.get(node)!;
        path.push(node);
      }
      path.reverse();
      path.push(from); // close the cycle
      return path;
    }
    for (const neighbor of graph.outEdges.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}
