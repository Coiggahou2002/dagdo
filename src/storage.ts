import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GraphData } from "./types";

const DATA_DIR = join(homedir(), ".todo-dag");
const DATA_FILE = join(DATA_DIR, "data.json");

function defaultData(): GraphData {
  return { version: 1, tasks: [], edges: [] };
}

export async function loadGraph(): Promise<GraphData> {
  const file = Bun.file(DATA_FILE);
  if (!(await file.exists())) return defaultData();
  try {
    return (await file.json()) as GraphData;
  } catch {
    console.error(`Error: failed to parse ${DATA_FILE}`);
    return defaultData();
  }
}

export async function saveGraph(data: GraphData): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });
  await Bun.write(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
}
