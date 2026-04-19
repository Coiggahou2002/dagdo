import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import pc from "picocolors";
import * as git from "../git";
import { globalDataDir, globalDataFile, isGlobalStorage } from "../storage";

type SyncSubcommand = "init" | "status" | null;

interface ParsedSyncArgs {
  subcommand: SyncSubcommand;
  positional: string[];
  acceptLocal: boolean;
  acceptRemote: boolean;
}

function parseSyncArgs(args: string[]): ParsedSyncArgs {
  let subcommand: SyncSubcommand = null;
  const positional: string[] = [];
  let acceptLocal = false;
  let acceptRemote = false;

  for (const arg of args) {
    if (arg === "--accept-local") acceptLocal = true;
    else if (arg === "--accept-remote") acceptRemote = true;
    else if (!subcommand && (arg === "init" || arg === "status")) subcommand = arg;
    else positional.push(arg);
  }

  return { subcommand, positional, acceptLocal, acceptRemote };
}

export async function syncCommand(args: string[]): Promise<void> {
  // Sync only applies to global storage. In project-level mode the user's own
  // project git handles sharing.
  if (!(await isGlobalStorage())) {
    console.error(
      "dagdo sync only works with global storage (~/.dagdo/).\n" +
        "Project-level tasks (.dagdo/ inside a git repo) sync via your project's own git.\n" +
        "Pass --global to force global storage.",
    );
    process.exit(1);
  }

  const parsed = parseSyncArgs(args);

  if (parsed.subcommand === "init") {
    await syncInit(parsed.positional);
    return;
  }
  if (parsed.subcommand === "status") {
    await syncStatus();
    return;
  }
  if (parsed.acceptLocal && parsed.acceptRemote) {
    console.error("--accept-local and --accept-remote are mutually exclusive.");
    process.exit(1);
  }
  await syncAuto(parsed.acceptLocal, parsed.acceptRemote);
}

// ─── sync init ─────────────────────────────────────────────────────────

async function syncInit(positional: string[]): Promise<void> {
  const url = positional[0];
  if (!url) {
    console.error("Usage: dagdo sync init <git-remote-url>");
    process.exit(1);
  }

  const dir = globalDataDir();

  if (git.isRepo(dir)) {
    await syncInitExistingRepo(dir, url);
    return;
  }

  // Decide: clone (remote has content) or init (remote empty).
  const tmpCwd = homedir();
  let remoteHasContent: boolean;
  try {
    remoteHasContent = await git.remoteHasContent(url, tmpCwd);
  } catch (err) {
    console.error(`Failed to reach remote: ${errMsg(err)}`);
    process.exit(1);
  }

  const dataFile = globalDataFile();
  const haveLocalData = existsSync(dataFile);

  if (remoteHasContent && haveLocalData) {
    console.error(
      `Cannot init sync: both local (${dataFile}) and remote have data.\n` +
        "Back up your local data.json, remove it, and re-run `dagdo sync init`, or use a fresh remote.",
    );
    process.exit(1);
  }

  if (remoteHasContent) {
    // Clone fresh
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      console.error(
        `~/.dagdo/ is not empty; cannot clone into it. Move its contents aside and retry.`,
      );
      process.exit(1);
    }
    console.log(`Cloning ${url} into ${dir}...`);
    try {
      await git.clone(url, dir);
    } catch (err) {
      console.error(`Clone failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green("Sync initialized (cloned from remote)."));
    return;
  }

  // Remote empty — init local and push
  mkdirSync(dir, { recursive: true });
  if (!existsSync(dataFile)) {
    writeFileSync(dataFile, JSON.stringify({ version: 1, tasks: [], edges: [] }, null, 2) + "\n");
  }

  try {
    await git.init(dir);
    await git.addRemote(dir, url);
    await git.commit(dir, "initial");
    await git.pushSetUpstream(dir);
  } catch (err) {
    console.error(`Failed to initialize sync: ${errMsg(err)}`);
    process.exit(1);
  }
  console.log(pc.green("Sync initialized (pushed local data to remote)."));
}

async function syncInitExistingRepo(dir: string, url: string): Promise<void> {
  const existingUrl = await git.getRemoteUrl(dir);
  if (existingUrl && existingUrl !== url) {
    console.error(
      `Sync is already configured with remote:\n  ${existingUrl}\n` +
        `Refusing to overwrite. Use 'git -C ${dir} remote set-url origin <url>' if you really want to change it.`,
    );
    process.exit(1);
  }
  if (!existingUrl) {
    await git.addRemote(dir, url);
  }
  console.log("Sync remote configured. Running sync...");
  await syncAuto(false, false);
}

// ─── sync status ───────────────────────────────────────────────────────

async function syncStatus(): Promise<void> {
  const dir = globalDataDir();
  if (!git.isRepo(dir)) {
    console.log("Sync: not configured. Run `dagdo sync init <url>` to enable.");
    return;
  }
  const url = await git.getRemoteUrl(dir);
  console.log(`Sync remote: ${url ?? "(none)"}`);

  if (!(await git.hasUpstream(dir))) {
    console.log("Status: upstream not set yet. Run `dagdo sync` to publish local commits.");
    return;
  }

  try {
    await git.fetch(dir);
  } catch (err) {
    console.error(`Fetch failed: ${errMsg(err)}`);
    process.exit(1);
  }

  const { ahead, behind } = await git.divergence(dir);
  if (ahead === 0 && behind === 0) {
    console.log(pc.green("Status: up to date."));
  } else if (ahead > 0 && behind === 0) {
    console.log(`Status: ${ahead} local commit(s) to push.`);
  } else if (ahead === 0 && behind > 0) {
    console.log(`Status: ${behind} remote commit(s) to pull.`);
  } else {
    console.log(
      pc.yellow(
        `Status: diverged — ${ahead} local / ${behind} remote. Use --accept-local or --accept-remote.`,
      ),
    );
  }
}

// ─── sync (auto) ───────────────────────────────────────────────────────

async function syncAuto(acceptLocal: boolean, acceptRemote: boolean): Promise<void> {
  const dir = globalDataDir();
  if (!git.isRepo(dir)) {
    console.error("Sync is not configured. Run `dagdo sync init <url>` first.");
    process.exit(1);
  }

  // Catch up any uncommitted changes (e.g. from a failed auto-commit earlier).
  try {
    await git.commit(dir, "sync: pending local changes");
  } catch (err) {
    console.error(`Failed to commit local changes: ${errMsg(err)}`);
    process.exit(1);
  }

  // No upstream yet — first push after init.
  if (!(await git.hasUpstream(dir))) {
    try {
      await git.pushSetUpstream(dir);
    } catch (err) {
      console.error(`Push failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green("Synced (initial push)."));
    return;
  }

  try {
    await git.fetch(dir);
  } catch (err) {
    console.error(`Fetch failed: ${errMsg(err)}`);
    process.exit(1);
  }

  const { ahead, behind } = await git.divergence(dir);

  if (acceptLocal) {
    try {
      await git.pushForce(dir);
    } catch (err) {
      console.error(`Force push failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green("Synced (remote overwritten with local)."));
    return;
  }
  if (acceptRemote) {
    try {
      await git.resetHardToRemote(dir);
    } catch (err) {
      console.error(`Reset failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green("Synced (local overwritten with remote)."));
    return;
  }

  if (ahead === 0 && behind === 0) {
    console.log(pc.green("Already up to date."));
    return;
  }
  if (ahead > 0 && behind === 0) {
    try {
      await git.pushFastForward(dir);
    } catch (err) {
      console.error(`Push failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green(`Pushed ${ahead} commit(s).`));
    return;
  }
  if (ahead === 0 && behind > 0) {
    try {
      await git.pullFastForward(dir);
    } catch (err) {
      console.error(`Pull failed: ${errMsg(err)}`);
      process.exit(1);
    }
    console.log(pc.green(`Pulled ${behind} commit(s).`));
    return;
  }

  // Diverged
  console.error(
    pc.yellow(
      `Diverged: ${ahead} local and ${behind} remote commit(s).\n` +
        "Pick one explicitly:\n" +
        "  dagdo sync --accept-local    # force-push local, discard remote changes\n" +
        "  dagdo sync --accept-remote   # force-pull remote, discard local changes",
    ),
  );
  process.exit(1);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
