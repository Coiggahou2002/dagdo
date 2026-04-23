import { parseArgs } from "util";
import { loadGraph, saveGraph } from "../storage";
import { resolveId } from "../ids";
import { formatId } from "../format";
import { NOTES_MAX_CHARS } from "../graph/mutations";
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
      note: { type: "string" },
      "clear-note": { type: "boolean", default: false },
    },
  });

  const prefix = positionals[0];
  if (!prefix) {
    console.error(
      "Usage: dagdo edit <id> [--title <new>] [--priority low|med|high] [--tag <add>] [--untag <remove>] [--note <text>] [--clear-note]",
    );
    process.exit(1);
  }

  // `--note` and `--clear-note` are contradictory — reject up front rather
  // than picking an arbitrary winner.
  if (values.note !== undefined && values["clear-note"]) {
    console.error("--note and --clear-note are mutually exclusive.");
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
  if (values.note !== undefined) {
    const note = values.note as string;
    if (note.length > NOTES_MAX_CHARS) {
      console.error(`Note too long: ${note.length} chars (limit ${NOTES_MAX_CHARS}).`);
      process.exit(1);
    }
    // Empty string clears too — `--note ""` is a reasonable synonym for
    // `--clear-note`. Drop the field entirely so data.json stays tidy.
    if (note.length === 0) delete task.notes;
    else task.notes = note;
  }
  if (values["clear-note"]) {
    delete task.notes;
  }

  await saveGraph(data, `edit: ${task.title}`);
  console.log(`Updated ${formatId(id)}  ${task.title}`);
}
