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

export function formatTaskTable(tasks: Task[], blockerIds?: Map<string, string[]>): string {
  if (tasks.length === 0) return pc.dim("No tasks.");

  // Compute the display width of each task's title+tags (visible characters only)
  const titleWidths: number[] = [];
  const titles: string[] = [];
  for (const t of tasks) {
    const tags = t.tags.length > 0 ? ` [${t.tags.join(", ")}]` : "";
    const title = t.doneAt != null ? t.title + " ✓" : t.title + tags;
    titles.push(title);
    titleWidths.push(visualWidth(title));
  }
  const maxTitleWidth = Math.max(...titleWidths);

  // ID(6) + 2 spaces + PRI(4) + 2 spaces = fixed prefix, then title column + blocked column
  return tasks
    .map((t, i) => {
      const blockers = blockerIds?.get(t.id);
      const blockedCount = blockers ? blockers.length : 0;
      const padding = " ".repeat(maxTitleWidth - titleWidths[i]!);
      const blockedCol = blockedCount > 0 ? `  ${pc.red(`⏳ ${blockedCount}`)}` : "";

      const id = formatId(t.id);
      const pri = formatPriority(t.priority);
      const done = t.doneAt != null;
      const title = done ? pc.strikethrough(pc.dim(titles[i]!)) : titles[i]!;

      return `${id}  ${pri}  ${title}${padding}${blockedCol}`;
    })
    .join("\n");
}

/** Estimate visible width, accounting for CJK characters as width 2. */
function visualWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    // CJK Unified Ideographs, CJK Compatibility, Fullwidth forms, etc.
    if (
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0x20000 && code <= 0x2fa1f)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}
