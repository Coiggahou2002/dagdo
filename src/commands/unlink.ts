import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";

export async function unlinkCommand(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error("Usage: todo-dag unlink <from-id> <to-id>");
    process.exit(1);
  }

  const data = await loadGraph();
  const activeIds = data.tasks.filter((t) => t.doneAt == null).map((t) => t.id);

  const fromId = resolveId(args[0]!, activeIds);
  if (!fromId) process.exit(1);
  const toId = resolveId(args[1]!, activeIds);
  if (!toId) process.exit(1);

  const idx = data.edges.findIndex((e) => e.from === fromId && e.to === toId);
  if (idx === -1) {
    console.error(`No dependency from ${formatId(fromId)} to ${formatId(toId)} exists.`);
    process.exit(1);
  }

  data.edges.splice(idx, 1);
  await saveGraph(data);
  console.log(`Unlinked: ${formatId(fromId)}  -x-  ${formatId(toId)}`);
}
