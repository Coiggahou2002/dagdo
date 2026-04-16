import { randomBytes } from "crypto";
import type { TaskId } from "./types";

export function generateId(): TaskId {
  return randomBytes(3).toString("hex");
}

export function resolveId(prefix: string, ids: TaskId[]): TaskId | null {
  const matches = ids.filter((id) => id.startsWith(prefix));
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    console.error(`Error: no task found matching "${prefix}"`);
    return null;
  }
  console.error(`Error: "${prefix}" is ambiguous, matches: ${matches.join(", ")}`);
  return null;
}
