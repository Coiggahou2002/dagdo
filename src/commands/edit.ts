import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";
import type { Priority } from "../types";

export async function editCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      title: { type: "string" },
      priority: { type: "string", short: "p" },
      tag: { type: "string", short: "t", multiple: true, default: [] },
      untag: { type: "string", multiple: true, default: [] },
    },
  });

  const prefix = positionals[0];
  if (!prefix) {
    console.error("Usage: depdo edit <id> [--title <new>] [--priority low|med|high] [--tag <add>] [--untag <remove>]");
    process.exit(1);
  }

  const data = await loadGraph();
  const allIds = data.tasks.map((t) => t.id);
  const id = resolveId(prefix, allIds);
  if (!id) process.exit(1);

  const task = data.tasks.find((t) => t.id === id)!;

  if (values.title) {
    task.title = values.title as string;
  }
  if (values.priority) {
    if (!["low", "med", "high"].includes(values.priority as string)) {
      console.error(`Invalid priority: "${values.priority}". Use: high, med, low`);
      process.exit(1);
    }
    task.priority = values.priority as Priority;
  }
  for (const t of (values.tag as string[]) ?? []) {
    if (!task.tags.includes(t)) task.tags.push(t);
  }
  for (const t of (values.untag as string[]) ?? []) {
    task.tags = task.tags.filter((tag) => tag !== t);
  }

  await saveGraph(data);
  console.log(`Updated ${formatId(id)}  ${task.title}`);
}
