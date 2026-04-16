import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";

export async function doneCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      force: { type: "boolean", short: "f", default: false },
    },
  });

  if (positionals.length === 0) {
    console.error("Usage: depdo done <id> [<id2> ...] [--force]");
    process.exit(1);
  }

  const data = await loadGraph();
  const activeIds = data.tasks.filter((t) => t.doneAt == null).map((t) => t.id);
  const doneSet = new Set(data.tasks.filter((t) => t.doneAt != null).map((t) => t.id));

  for (const prefix of positionals) {
    const id = resolveId(prefix, activeIds);
    if (!id) process.exit(1);

    // Check unfinished dependencies
    const blockers = data.edges
      .filter((e) => e.to === id && !doneSet.has(e.from))
      .map((e) => e.from);

    if (blockers.length > 0 && !values.force) {
      console.error(
        `Task ${formatId(id)} is blocked by: ${blockers.map(formatId).join(", ")}. Use --force to override.`
      );
      process.exit(1);
    }

    const task = data.tasks.find((t) => t.id === id)!;
    task.doneAt = new Date().toISOString();
    doneSet.add(id);

    console.log(`Done ${formatId(id)}  ${task.title}`);

    // Find newly unblocked tasks
    const dependents = data.edges.filter((e) => e.from === id).map((e) => e.to);
    for (const depId of dependents) {
      const stillBlocked = data.edges.some((e) => e.to === depId && !doneSet.has(e.from));
      if (!stillBlocked) {
        const depTask = data.tasks.find((t) => t.id === depId);
        if (depTask && depTask.doneAt == null) {
          console.log(`  Unblocked: ${formatId(depId)}  ${depTask.title}`);
        }
      }
    }
  }

  await saveGraph(data);
}
