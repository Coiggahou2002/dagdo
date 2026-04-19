import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { generateId, resolveId } from "../ids";
import { formatId } from "../format";
import type { Priority, Task } from "../types";

export async function addCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      priority: { type: "string", short: "p", default: "med" },
      tag: { type: "string", short: "t", multiple: true, default: [] },
      after: { type: "string", multiple: true, default: [] },
      before: { type: "string", multiple: true, default: [] },
    },
  });

  const title = positionals.join(" ");
  if (!title) {
    console.error("Usage: dagdo add <title> [--priority high|med|low] [--tag <t>] [--after <id>] [--before <id>]");
    process.exit(1);
  }

  const priority = values.priority as string;
  if (!["low", "med", "high"].includes(priority)) {
    console.error(`Invalid priority: "${priority}". Use: high, med, low`);
    process.exit(1);
  }

  const data = await loadGraph();
  const activeIds = data.tasks.filter((t) => t.doneAt == null).map((t) => t.id);

  const task: Task = {
    id: generateId(),
    title,
    priority: priority as Priority,
    tags: (values.tag as string[]) ?? [],
    createdAt: new Date().toISOString(),
    doneAt: null,
  };

  data.tasks.push(task);

  // --after <id>: that task must be done before this new task
  for (const prefix of (values.after as string[]) ?? []) {
    const depId = resolveId(prefix, activeIds);
    if (!depId) process.exit(1);
    data.edges.push({ from: depId, to: task.id });
  }

  // --before <id>: this new task must be done before that task
  for (const prefix of (values.before as string[]) ?? []) {
    const depId = resolveId(prefix, activeIds);
    if (!depId) process.exit(1);
    data.edges.push({ from: task.id, to: depId });
  }

  await saveGraph(data, `add: ${task.title}`);
  console.log(`Created ${formatId(task.id)}  ${task.title}`);
}
