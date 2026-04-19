import { existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class GitNotInstalledError extends Error {
  constructor() {
    super("git is not installed or not in PATH");
    this.name = "GitNotInstalledError";
  }
}

export class GitCommandError extends Error {
  constructor(
    public args: string[],
    public result: GitResult,
  ) {
    super(
      `git ${args.join(" ")} failed (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
    this.name = "GitCommandError";
  }
}

function run(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(new GitNotInstalledError());
      else reject(err);
    });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
}

async function runOk(args: string[], cwd: string): Promise<string> {
  const result = await run(args, cwd);
  if (result.code !== 0) throw new GitCommandError(args, result);
  return result.stdout;
}

export function isRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

export async function init(dir: string): Promise<void> {
  await runOk(["init", "-q", "-b", "main"], dir);
}

export async function clone(url: string, dir: string): Promise<void> {
  // Clone into parent; git creates the target dir.
  const parent = join(dir, "..");
  const target = dir.split("/").pop() ?? dir;
  await runOk(["clone", "-q", url, target], parent);
}

export async function hasRemote(dir: string, name = "origin"): Promise<boolean> {
  const result = await run(["remote", "get-url", name], dir);
  return result.code === 0;
}

export async function addRemote(dir: string, url: string, name = "origin"): Promise<void> {
  await runOk(["remote", "add", name, url], dir);
}

export async function setRemoteUrl(dir: string, url: string, name = "origin"): Promise<void> {
  await runOk(["remote", "set-url", name, url], dir);
}

export async function getRemoteUrl(dir: string, name = "origin"): Promise<string | null> {
  const result = await run(["remote", "get-url", name], dir);
  if (result.code !== 0) return null;
  return result.stdout.trim();
}

/** Returns true if the remote has at least one ref. */
export async function remoteHasContent(url: string, cwd: string): Promise<boolean> {
  const result = await run(["ls-remote", url], cwd);
  if (result.code !== 0) throw new GitCommandError(["ls-remote", url], result);
  return result.stdout.trim().length > 0;
}

export async function stageAll(dir: string): Promise<void> {
  await runOk(["add", "-A"], dir);
}

/** Returns true if a commit was made, false if there was nothing to commit. */
export async function commit(dir: string, message: string): Promise<boolean> {
  await stageAll(dir);
  const status = await runOk(["status", "--porcelain"], dir);
  if (status.trim().length === 0) return false;
  await runOk(["commit", "-q", "-m", message], dir);
  return true;
}

export async function fetch(dir: string, remote = "origin"): Promise<void> {
  await runOk(["fetch", "-q", remote], dir);
}

export async function currentBranch(dir: string): Promise<string> {
  return (await runOk(["rev-parse", "--abbrev-ref", "HEAD"], dir)).trim();
}

export async function hasUpstream(dir: string): Promise<boolean> {
  const result = await run(["rev-parse", "--abbrev-ref", "@{upstream}"], dir);
  return result.code === 0;
}

export interface DivergenceStatus {
  ahead: number;  // local commits not on remote
  behind: number; // remote commits not on local
}

export async function divergence(dir: string, remote = "origin"): Promise<DivergenceStatus> {
  const branch = await currentBranch(dir);
  const output = await runOk(
    ["rev-list", "--left-right", "--count", `${remote}/${branch}...HEAD`],
    dir,
  );
  const [behindStr, aheadStr] = output.trim().split(/\s+/);
  return {
    behind: parseInt(behindStr ?? "0", 10),
    ahead: parseInt(aheadStr ?? "0", 10),
  };
}

export async function pushFastForward(dir: string, remote = "origin"): Promise<void> {
  const branch = await currentBranch(dir);
  await runOk(["push", "-q", remote, branch], dir);
}

export async function pushForce(dir: string, remote = "origin"): Promise<void> {
  const branch = await currentBranch(dir);
  await runOk(["push", "-q", "--force-with-lease", remote, branch], dir);
}

/** Set upstream and push. Used for the very first push after init. */
export async function pushSetUpstream(dir: string, remote = "origin"): Promise<void> {
  const branch = await currentBranch(dir);
  await runOk(["push", "-q", "-u", remote, branch], dir);
}

export async function pullFastForward(dir: string, remote = "origin"): Promise<void> {
  await runOk(["pull", "-q", "--ff-only", remote], dir);
}

export async function resetHardToRemote(dir: string, remote = "origin"): Promise<void> {
  const branch = await currentBranch(dir);
  await runOk(["fetch", "-q", remote], dir);
  await runOk(["reset", "-q", "--hard", `${remote}/${branch}`], dir);
}
