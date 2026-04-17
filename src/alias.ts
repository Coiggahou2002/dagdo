import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const USAGE_FILE = join(homedir(), ".dagdo", "usage.json");
const ALIAS_THRESHOLD = 3;

interface UsageData {
  count: number;
  aliasOffered: boolean;
}

function loadUsage(): UsageData {
  if (!existsSync(USAGE_FILE)) return { count: 0, aliasOffered: false };
  try {
    return JSON.parse(readFileSync(USAGE_FILE, "utf-8"));
  } catch {
    return { count: 0, aliasOffered: false };
  }
}

function saveUsage(data: UsageData): void {
  mkdirSync(join(USAGE_FILE, ".."), { recursive: true });
  writeFileSync(USAGE_FILE, JSON.stringify(data));
}

function getShellRc(): string | null {
  const shell = process.env.SHELL ?? "";
  if (shell.endsWith("/zsh")) return join(homedir(), ".zshrc");
  if (shell.endsWith("/bash")) {
    const profile = join(homedir(), ".bash_profile");
    if (existsSync(profile)) return profile;
    return join(homedir(), ".bashrc");
  }
  return null;
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve(String(chunk).trim());
    });
  });
}

export async function checkAliasOffer(): Promise<void> {
  // Only prompt in interactive terminals
  if (!process.stdout.isTTY) return;

  const usage = loadUsage();
  usage.count++;
  saveUsage(usage);

  if (usage.count <= ALIAS_THRESHOLD || usage.aliasOffered) return;

  const rcFile = getShellRc();
  if (!rcFile) return;

  process.stdout.write(
    `\nTip: You've used dagdo ${usage.count} times. Add a shorter alias?\n` +
    `  alias dd="dagdo"\n` +
    `Add to ${rcFile}? [y/N] `
  );

  const answer = await readLine();
  usage.aliasOffered = true;
  saveUsage(usage);

  if (answer.toLowerCase() === "y") {
    appendFileSync(rcFile, `\n# dagdo shortcut\nalias dd="dagdo"\n`);
    console.log(`Added! Run \`source ${rcFile}\` or open a new terminal to use \`dd\`.`);
  }
}
