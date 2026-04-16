import { parseArgs } from "util";
import { loadGraph } from "../storage";
import { formatTaskTable } from "../format";
import type { Task } from "../types";

export async function listCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      all: { type: "boolean", default: false },
      done: { type: "boolean", default: false },
      tag: { type: "string", short: "t" },
      priority: { type: "string", short: "p" },
      json: { type: "boolean", default: false },
    },
  });

  const data = await loadGraph();
  let tasks: Task[];

  if (values.done) {
    tasks = data.tasks.filter((t) => t.doneAt != null);
  } else if (values.all) {
    tasks = data.tasks;
  } else {
    tasks = data.tasks.filter((t) => t.doneAt == null);
  }

  if (values.tag) {
    tasks = tasks.filter((t) => t.tags.includes(values.tag as string));
  }
  if (values.priority) {
    tasks = tasks.filter((t) => t.priority === values.priority);
  }

  // Compute blocked-by counts for active tasks
  const blockedCounts = new Map<string, number>();
  const activeDone = new Set(data.tasks.filter((t) => t.doneAt != null).map((t) => t.id));
  for (const edge of data.edges) {
    if (!activeDone.has(edge.from)) {
      blockedCounts.set(edge.to, (blockedCounts.get(edge.to) ?? 0) + 1);
    }
  }

  if (values.json) {
    const result = tasks.map((t) => ({ ...t, blockedBy: blockedCounts.get(t.id) ?? 0 }));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatTaskTable(tasks, blockedCounts));
}
