export type TaskId = string;

export type Priority = "low" | "med" | "high";

export interface Task {
  id: TaskId;
  title: string;
  priority: Priority;
  tags: string[];
  createdAt: string;
  doneAt: string | null;
}

export interface Edge {
  from: TaskId;
  to: TaskId;
}

export interface GraphData {
  version: 1;
  tasks: Task[];
  edges: Edge[];
}

export interface AdjacencyGraph {
  inEdges: Map<TaskId, Set<TaskId>>;
  outEdges: Map<TaskId, Set<TaskId>>;
  tasks: Map<TaskId, Task>;
}

/** Layout node for rendering — separates layout computation from output format */
export interface LayoutNode {
  task: Task;
  level: number;
  blocked: number;   // number of unfinished blockers
  blocking: number;  // number of tasks this blocks
}

export interface LayoutEdge {
  from: TaskId;
  to: TaskId;
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  levels: Map<number, TaskId[]>;
}
