import { parseArgs } from "util";
import { loadGraph } from "../storage";
import { buildActiveGraph } from "../graph/dag";
import { getReadyTasks } from "../graph/topo";
import { formatTaskTable } from "../format";

export async function nextCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      limit: { type: "string", short: "n", default: "10" },
      json: { type: "boolean", default: false },
    },
  });

  const limit = parseInt(values.limit as string, 10);
  const data = await loadGraph();
  const graph = buildActiveGraph(data);
  const ready = getReadyTasks(graph).slice(0, limit);

  if (values.json) {
    console.log(JSON.stringify(ready, null, 2));
    return;
  }

  if (ready.length === 0) {
    const activeCount = data.tasks.filter((t) => t.doneAt == null).length;
    if (activeCount === 0) {
      console.log("No tasks. Run `depdo add` to get started.");
    } else {
      console.log("No ready tasks — all active tasks are blocked.");
    }
    return;
  }

  console.log(formatTaskTable(ready));
}
