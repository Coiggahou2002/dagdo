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

  // Compute blocker names for active tasks
  const taskMap = new Map(data.tasks.map((t) => [t.id, t]));
  const activeDone = new Set(data.tasks.filter((t) => t.doneAt != null).map((t) => t.id));
  const blockerNames = new Map<string, string[]>();
  for (const edge of data.edges) {
    if (!activeDone.has(edge.from)) {
      const fromTask = taskMap.get(edge.from);
      const name = fromTask ? fromTask.title : edge.from;
      if (!blockerNames.has(edge.to)) blockerNames.set(edge.to, []);
      blockerNames.get(edge.to)!.push(name);
    }
  }

  if (values.json) {
    const result = tasks.map((t) => ({ ...t, blockedBy: blockerNames.get(t.id) ?? [] }));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatTaskTable(tasks, blockerNames));
}
