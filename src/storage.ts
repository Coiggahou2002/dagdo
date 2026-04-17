import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { GraphData } from "./types";

const GLOBAL_DATA_DIR = join(homedir(), ".dagdo");
const GLOBAL_DATA_FILE = join(GLOBAL_DATA_DIR, "data.json");

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

async function getDataFile(): Promise<string> {
  if (_dataFile) return _dataFile;
  _dataFile = await resolveDataFile();
  return _dataFile;
}

export async function loadGraph(): Promise<GraphData> {
  const dataFile = await getDataFile();
  const file = Bun.file(dataFile);
  if (!(await file.exists())) return defaultData();
  try {
    return (await file.json()) as GraphData;
  } catch {
    console.error(`Error: failed to parse ${dataFile}`);
    return defaultData();
  }
}

export async function saveGraph(data: GraphData): Promise<void> {
  const dataFile = await getDataFile();
  mkdirSync(join(dataFile, ".."), { recursive: true });
  await Bun.write(dataFile, JSON.stringify(data, null, 2) + "\n");
}
