import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";

export async function unlinkCommand(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error("Usage: dagdo unlink <id-a> <id-b>");
    console.error("  Removes the dependency between the two tasks (any direction).");
    process.exit(1);
  }

  const data = await loadGraph();
  const allIds = data.tasks.map((t) => t.id);

  const idA = resolveId(args[0]!, allIds);
  if (!idA) process.exit(1);
  const idB = resolveId(args[1]!, allIds);
  if (!idB) process.exit(1);

  // Find the edge in either direction
  const idx = data.edges.findIndex(
    (e) => (e.from === idA && e.to === idB) || (e.from === idB && e.to === idA)
  );

  if (idx === -1) {
    console.error(`No dependency between ${formatId(idA)} and ${formatId(idB)}.`);
    process.exit(1);
  }

  const edge = data.edges[idx]!;
  const fromTask = data.tasks.find((t) => t.id === edge.from)!;
  const toTask = data.tasks.find((t) => t.id === edge.to)!;

  data.edges.splice(idx, 1);
  await saveGraph(data);
  console.log(`Unlinked: ${formatId(edge.from)} ${fromTask.title}  ✕  ${formatId(edge.to)} ${toTask.title}`);
}
