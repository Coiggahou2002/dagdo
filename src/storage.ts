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

/**
 * Walk up from cwd looking for a .git directory.
 * Returns the git root path, or null if not inside a git repo.
 */
function findGitRoot(from: string): string | null {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * Resolve which data file to use:
 * - Not in a git repo → global
 * - In a git repo with existing .dagdo/data.json → project
 * - In a git repo without .dagdo/ → ask user
 */
export async function resolveDataFile(): Promise<string> {
  const gitRoot = findGitRoot(process.cwd());

  // Not a git repo — use global
  if (!gitRoot) return GLOBAL_DATA_FILE;

  const projectDataDir = join(gitRoot, ".dagdo");
  const projectDataFile = join(projectDataDir, "data.json");

  // .dagdo directory already exists — use project store regardless of whether data.json is there yet
  if (existsSync(projectDataDir)) return projectDataFile;

  // Git repo but no .dagdo — ask
  process.stdout.write(
    `Found a git repo (${gitRoot}).\nUse project-level tasks (.dagdo/) or global (~/.dagdo/)? [p/G] `
  );

  const answer = await readLine();
  if (answer.toLowerCase() === "p") {
    mkdirSync(projectDataDir, { recursive: true });
    return projectDataFile;
  }

  return GLOBAL_DATA_FILE;
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve((buf + chunk).trim());
    });
  });
}

let _dataFile: string | null = null;
let _forceGlobal = false;

export function setGlobal(value: boolean): void {
  _forceGlobal = value;
}

async function getDataFile(): Promise<string> {
  if (_dataFile) return _dataFile;
  _dataFile = _forceGlobal ? GLOBAL_DATA_FILE : await resolveDataFile();
  return _dataFile;
}

/** True when the active data file lives in the global store (~/.dagdo/). */
export async function isGlobalStorage(): Promise<boolean> {
  return (await getDataFile()) === GLOBAL_DATA_FILE;
}

export async function loadGraph(): Promise<GraphData> {
  const dataFile = await getDataFile();
  if (!existsSync(dataFile)) return defaultData();
  try {
    return JSON.parse(readFileSync(dataFile, "utf-8")) as GraphData;
  } catch {
    console.error(`Error: failed to parse ${dataFile}`);
    return defaultData();
  }
}

export async function saveGraph(data: GraphData, commitMessage?: string): Promise<void> {
  const dataFile = await getDataFile();
  mkdirSync(join(dataFile, ".."), { recursive: true });
  writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");

  // Auto-commit only for global storage when sync has been set up.
  if (dataFile !== GLOBAL_DATA_FILE) return;
  if (!git.isRepo(GLOBAL_DATA_DIR)) return;

  try {
    await git.commit(GLOBAL_DATA_DIR, commitMessage ?? "update");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: auto-commit failed (${msg}). Run 'dagdo sync' to recover.`);
  }
}
