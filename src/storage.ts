import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GraphData } from "./types";
import * as git from "./git";

// Paths are resolved lazily each call rather than frozen at module load, so
// `HOME=/tmp/... dagdo …` (and test harnesses that swap HOME between cases)
// work without surprising caching. `$HOME` is preferred over `homedir()`
// because Bun's `os.homedir()` on macOS reads the passwd DB directly and
// ignores the env var, which breaks `HOME=…` overrides.
export function globalDataDir(): string {
  return join(process.env.HOME || homedir(), ".dagdo");
}

export function globalDataFile(): string {
  return join(globalDataDir(), "data.json");
}

function defaultData(): GraphData {
  return { version: 1, tasks: [], edges: [] };
}

export async function loadGraph(): Promise<GraphData> {
  const file = globalDataFile();
  if (!existsSync(file)) return defaultData();
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as GraphData;
  } catch {
    console.error(`Error: failed to parse ${file}`);
    return defaultData();
  }
}

export async function saveGraph(data: GraphData, commitMessage?: string): Promise<void> {
  const dir = globalDataDir();
  const file = globalDataFile();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

  // Auto-commit when sync has been set up.
  if (!git.isRepo(dir)) return;

  try {
    await git.commit(dir, commitMessage ?? "update");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: auto-commit failed (${msg}). Run 'dagdo sync' to recover.`);
  }
}
