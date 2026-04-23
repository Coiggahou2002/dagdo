// Mirror of src/types.ts — kept in sync by hand. Stable schema, rarely changes.

export type Priority = "low" | "med" | "high";

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  tags: string[];
  createdAt: string;
  doneAt: string | null;
  notes?: string;
}

export interface Edge {
  from: string;
  to: string;
}

export interface GraphData {
  version: 1;
  tasks: Task[];
  edges: Edge[];
}

export type NodeState = "ready" | "blocked" | "done";
