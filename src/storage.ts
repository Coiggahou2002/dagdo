import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GraphData } from "./types";
import * as git from "./git";

const GLOBAL_DATA_DIR = join(homedir(), ".dagdo");
const GLOBAL_DATA_FILE = join(GLOBAL_DATA_DIR, "data.json");

export function globalDataDir(): string {
  return GLOBAL_DATA_DIR;
}

export function globalDataFile(): string {
  return GLOBAL_DATA_FILE;
}

function defaultData(): GraphData {
  return { version: 1, tasks: [], edges: [] };
}

export async function loadGraph(): Promise<GraphData> {
  if (!existsSync(GLOBAL_DATA_FILE)) return defaultData();
  try {
    return JSON.parse(readFileSync(GLOBAL_DATA_FILE, "utf-8")) as GraphData;
  } catch {
    console.error(`Error: failed to parse ${GLOBAL_DATA_FILE}`);
    return defaultData();
  }
}

export async function saveGraph(data: GraphData, commitMessage?: string): Promise<void> {
  mkdirSync(GLOBAL_DATA_DIR, { recursive: true });
  writeFileSync(GLOBAL_DATA_FILE, JSON.stringify(data, null, 2) + "\n");

  // Auto-commit when sync has been set up.
  if (!git.isRepo(GLOBAL_DATA_DIR)) return;

  try {
    await git.commit(GLOBAL_DATA_DIR, commitMessage ?? "update");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: auto-commit failed (${msg}). Run 'dagdo sync' to recover.`);
  }
}
