import pc from "picocolors";
import type { Task, Priority } from "./types";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: pc.red(pc.bold("HIGH")),
  med: pc.yellow("MED "),
  low: pc.dim("LOW "),
};

export function formatId(id: string): string {
  return pc.cyan(id);
}

export function formatPriority(p: Priority): string {
  return PRIORITY_LABEL[p];
}

export function formatTask(task: Task, extra?: string): string {
  const done = task.doneAt != null;
  const id = formatId(task.id);
  const pri = formatPriority(task.priority);
  const tags = task.tags.length > 0 ? pc.dim(` [${task.tags.join(", ")}]`) : "";
  const title = done ? pc.strikethrough(pc.dim(task.title)) : task.title;
  const suffix = extra ? ` ${extra}` : "";
  return `${id}  ${pri}  ${title}${tags}${suffix}`;
}

export function formatTaskTable(tasks: Task[], blockerNames?: Map<string, string[]>): string {
  if (tasks.length === 0) return pc.dim("No tasks.");
  return tasks
    .map((t) => {
      const blockers = blockerNames?.get(t.id);
      const extra = blockers && blockers.length > 0
        ? pc.red(`(blocked by: ${blockers.join(", ")})`)
        : undefined;
      return formatTask(t, extra);
    })
    .join("\n");
}
