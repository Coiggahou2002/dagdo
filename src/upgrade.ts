import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import pkg from "../package.json";

const CACHE_FILE = join(homedir(), ".dagdo", "version-check.json");
const NPM_PACKAGE = "@coiggahou2002/dagdo";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

interface VersionCache {
  latest: string;
  checkedAt: number;
}

function loadCache(): VersionCache | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveCache(data: VersionCache): void {
  mkdirSync(join(CACHE_FILE, ".."), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data));
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version: string };
    return data.version;
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Lightweight startup check — prints a one-line notice if a newer version exists.
 * Checks at most once per day, never blocks on network failure.
 */
export async function checkForUpdate(): Promise<void> {
  if (!process.stdout.isTTY) return;

  const cache = loadCache();
  const now = Date.now();

  if (cache && now - cache.checkedAt < CHECK_INTERVAL_MS) {
    if (compareVersions(cache.latest, pkg.version) > 0) {
      console.error(`\x1b[33mUpdate available: ${pkg.version} → ${cache.latest}\x1b[0m  Run \x1b[1mdagdo upgrade\x1b[0m`);
    }
    return;
  }

  // Fire and forget — don't slow down startup
  fetchLatestVersion().then((latest) => {
    if (!latest) return;
    saveCache({ latest, checkedAt: now });
    if (compareVersions(latest, pkg.version) > 0) {
      console.error(`\x1b[33mUpdate available: ${pkg.version} → ${latest}\x1b[0m  Run \x1b[1mdagdo upgrade\x1b[0m`);
    }
  }).catch(() => {});
}

/**
 * Interactive upgrade command.
 */
export async function upgradeCommand(): Promise<void> {
  console.log(`Current version: ${pkg.version}`);
  console.log("Checking for updates...");

  const latest = await fetchLatestVersion();
  if (!latest) {
    console.error("Failed to check for updates. Check your network connection.");
    process.exit(1);
  }

  saveCache({ latest, checkedAt: Date.now() });

  if (compareVersions(latest, pkg.version) <= 0) {
    console.log("Already up to date.");
    return;
  }

  console.log(`New version available: ${latest}`);
  console.log(`Upgrading...`);

  try {
    execSync(`npm install -g ${NPM_PACKAGE}@latest`, { stdio: "inherit" });
    console.log(`\nUpgraded to ${latest}.`);
  } catch {
    console.error(`\nnpm upgrade failed. Try manually:\n  npm install -g ${NPM_PACKAGE}@latest`);
    process.exit(1);
  }
}
