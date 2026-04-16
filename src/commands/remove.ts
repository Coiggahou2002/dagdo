import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";

export async function removeCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      force: { type: "boolean", short: "f", default: false },
    },
  });

  const prefix = positionals[0];
  if (!prefix) {
    console.error("Usage: todo-dag rm <id> [--force]");
    process.exit(1);
  }

  const data = await loadGraph();
  const allIds = data.tasks.map((t) => t.id);
  const id = resolveId(prefix, allIds);
  if (!id) process.exit(1);

  const task = data.tasks.find((t) => t.id === id)!;

  // Check if other tasks depend on this one
  const dependents = data.edges.filter((e) => e.from === id).map((e) => e.to);
  if (dependents.length > 0 && !values.force) {
    console.error(`Task ${formatId(id)} blocks ${dependents.length} other task(s). Use --force to remove.`);
    process.exit(1);
  }

  data.tasks = data.tasks.filter((t) => t.id !== id);
  data.edges = data.edges.filter((e) => e.from !== id && e.to !== id);

  await saveGraph(data);
  console.log(`Removed ${formatId(id)}  ${task.title}`);
}
