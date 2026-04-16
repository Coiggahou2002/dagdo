import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";
import { buildActiveGraph, wouldCreateCycle } from "../graph/dag";

export async function linkCommand(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error("Usage: todo-dag link <from-id> <to-id>");
    console.error("  Meaning: <from> must be done before <to>");
    process.exit(1);
  }

  const data = await loadGraph();
  const activeIds = data.tasks.filter((t) => t.doneAt == null).map((t) => t.id);

  const fromId = resolveId(args[0]!, activeIds);
  if (!fromId) process.exit(1);
  const toId = resolveId(args[1]!, activeIds);
  if (!toId) process.exit(1);

  // Check if edge already exists
  if (data.edges.some((e) => e.from === fromId && e.to === toId)) {
    console.error("This dependency already exists.");
    process.exit(1);
  }

  // Check for cycles
  const graph = buildActiveGraph(data);
  const cycle = wouldCreateCycle(graph, fromId, toId);
  if (cycle) {
    console.error(`Cannot add: would create a cycle: ${cycle.map(formatId).join(" -> ")}`);
    process.exit(1);
  }

  data.edges.push({ from: fromId, to: toId });
  await saveGraph(data);

  const fromTask = data.tasks.find((t) => t.id === fromId)!;
  const toTask = data.tasks.find((t) => t.id === toId)!;
  console.log(`Linked: ${formatId(fromId)} ${fromTask.title}  ->  ${formatId(toId)} ${toTask.title}`);
}
