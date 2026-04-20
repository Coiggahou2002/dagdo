import type { Priority, Task } from "./types";

/**
 * Thin fetch wrapper — matches the server routes in src/server/server.ts.
 * The API surface mirrors src/graph/mutations.ts one-to-one.
 *
 * Errors carry a `kind` discriminator so callers can distinguish user
 * mistakes (cycle, duplicate) from infrastructure failures.
 */

export type ApiErrorKind =
  | "network"
  | "cycle"
  | "already_exists"
  | "task_not_found"
  | "self_loop"
  | "invalid"
  | "unknown";

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: { error?: string; path?: string[]; id?: string } = {};
  try {
    body = await res.json();
  } catch {
    // empty body — fall through to unknown
  }
  const kind: ApiErrorKind =
    body.error === "cycle" ? "cycle" :
    body.error === "already_exists" ? "already_exists" :
    body.error === "task_not_found" ? "task_not_found" :
    body.error === "self_loop" ? "self_loop" :
    body.error ? "invalid" :
    "unknown";
  throw new ApiError(kind, body.error ?? `HTTP ${res.status}`, body);
}

export async function createTask(args: { title: string }): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await jsonOrThrow<{ task: Task }>(res);
  return body.task;
}

export interface TaskPatch {
  title?: string;
  priority?: Priority;
  tags?: string[];
  doneAt?: string | null;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await jsonOrThrow<{ task: Task }>(res);
  return body.task;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) await jsonOrThrow(res);
}

export async function createEdge(from: string, to: string): Promise<void> {
  const res = await fetch("/api/edges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) await jsonOrThrow(res);
}

export async function deleteEdge(from: string, to: string): Promise<void> {
  const res = await fetch("/api/edges", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok && res.status !== 404) await jsonOrThrow(res);
}
