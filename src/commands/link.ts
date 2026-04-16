import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";
import { buildActiveGraph, wouldCreateCycle } from "../graph/dag";

export async function linkCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      before: { type: "string" },
      after: { type: "string" },
    },
  });

  const id = positionals[0];
  if (!id || (!values.before && !values.after)) {
    console.error("Usage: depdo link <id> --before <other>");
    console.error("       depdo link <id> --after <other>");
    console.error("  --before: <id> must be done before <other>");
    console.error("  --after:  <id> must be done after <other>");
    process.exit(1);
  }

  const data = await loadGraph();
  const activeIds = data.tasks.filter((t) => t.doneAt == null).map((t) => t.id);

  const taskId = resolveId(id, activeIds);
  if (!taskId) process.exit(1);

  // Resolve from/to based on --before or --after
  let fromId: string;
  let toId: string;

  if (values.before) {
    const otherId = resolveId(values.before as string, activeIds);
    if (!otherId) process.exit(1);
    fromId = taskId;
    toId = otherId;
  } else {
    const otherId = resolveId(values.after as string, activeIds);
    if (!otherId) process.exit(1);
    fromId = otherId;
    toId = taskId;
  }

  if (data.edges.some((e) => e.from === fromId && e.to === toId)) {
    console.error("This dependency already exists.");
    process.exit(1);
  }

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
  console.log(`Linked: ${formatId(fromId)} ${fromTask.title}  →  ${formatId(toId)} ${toTask.title}`);
}
