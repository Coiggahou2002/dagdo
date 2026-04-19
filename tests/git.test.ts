import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as git from "../src/git";

// Integration tests: use real git against tmp dirs.
// `bareRemote` plays the role of the cloud (a bare repo); `local` is a working clone.

interface Env {
  root: string;
  bareRemote: string;
  local: string;
}

function makeEnv(): Env {
  const root = join(tmpdir(), `dagdo-git-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  const bareRemote = join(root, "remote.git");
  const local = join(root, "local");
  mkdirSync(bareRemote);
  mkdirSync(local);
  return { root, bareRemote, local };
}

async function initBareRemote(path: string): Promise<void> {
  const proc = Bun.spawn(["git", "init", "--bare", "-q", "-b", "main", path]);
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error("failed to init bare repo");
}

async function writeAndCommit(dir: string, filename: string, contents: string, message: string) {
  writeFileSync(join(dir, filename), contents);
  await git.commit(dir, message);
}

describe("git wrapper", () => {
  let env: Env;

  beforeEach(async () => {
    env = makeEnv();
  });

  afterEach(() => {
    rmSync(env.root, { recursive: true, force: true });
  });

  it("isRepo detects .git directory", async () => {
    expect(git.isRepo(env.local)).toBe(false);
    await git.init(env.local);
    expect(git.isRepo(env.local)).toBe(true);
  });

  it("commit returns false when tree is clean, true when dirty", async () => {
    await git.init(env.local);
    // Need at least one commit before status is meaningful, so make an initial commit.
    writeFileSync(join(env.local, "a.txt"), "a");
    const first = await git.commit(env.local, "first");
    expect(first).toBe(true);
    const second = await git.commit(env.local, "no-op");
    expect(second).toBe(false);
  });

  it("remoteHasContent distinguishes empty vs populated remotes", async () => {
    await initBareRemote(env.bareRemote);
    expect(await git.remoteHasContent(env.bareRemote, env.root)).toBe(false);

    // Populate the remote by pushing from a local repo.
    await git.init(env.local);
    await git.addRemote(env.local, env.bareRemote);
    writeFileSync(join(env.local, "data.json"), "{}");
    await git.commit(env.local, "init");
    await git.pushSetUpstream(env.local);

    expect(await git.remoteHasContent(env.bareRemote, env.root)).toBe(true);
  });

  it("divergence reports 0/0 when in sync", async () => {
    await initBareRemote(env.bareRemote);
    await git.init(env.local);
    await git.addRemote(env.local, env.bareRemote);
    await writeAndCommit(env.local, "f.txt", "1", "c1");
    await git.pushSetUpstream(env.local);
    await git.fetch(env.local);
    expect(await git.divergence(env.local)).toEqual({ ahead: 0, behind: 0 });
  });

  it("divergence reports ahead when local has new commits", async () => {
    await initBareRemote(env.bareRemote);
    await git.init(env.local);
    await git.addRemote(env.local, env.bareRemote);
    await writeAndCommit(env.local, "f.txt", "1", "c1");
    await git.pushSetUpstream(env.local);
    await writeAndCommit(env.local, "f.txt", "2", "c2");
    await git.fetch(env.local);
    expect(await git.divergence(env.local)).toEqual({ ahead: 1, behind: 0 });
  });

  it("divergence reports behind when remote has new commits", async () => {
    await initBareRemote(env.bareRemote);
    // Set up two clones of the same remote so we can simulate "remote moved ahead".
    const a = env.local;
    const b = join(env.root, "local-b");
    mkdirSync(b);

    await git.init(a);
    await git.addRemote(a, env.bareRemote);
    await writeAndCommit(a, "f.txt", "1", "c1");
    await git.pushSetUpstream(a);

    await git.clone(env.bareRemote, b);

    // B pushes a new commit
    await writeAndCommit(b, "f.txt", "2", "c2");
    await git.pushFastForward(b);

    // A fetches and should be behind by 1
    await git.fetch(a);
    expect(await git.divergence(a)).toEqual({ ahead: 0, behind: 1 });
  });

  it("divergence reports both ahead and behind on true divergence", async () => {
    await initBareRemote(env.bareRemote);
    const a = env.local;
    const b = join(env.root, "local-b");
    mkdirSync(b);

    await git.init(a);
    await git.addRemote(a, env.bareRemote);
    await writeAndCommit(a, "f.txt", "1", "c1");
    await git.pushSetUpstream(a);

    await git.clone(env.bareRemote, b);

    // B moves ahead on remote
    await writeAndCommit(b, "f.txt", "2-remote", "c2-remote");
    await git.pushFastForward(b);

    // A moves ahead locally (without fetching)
    await writeAndCommit(a, "f.txt", "2-local", "c2-local");

    await git.fetch(a);
    expect(await git.divergence(a)).toEqual({ ahead: 1, behind: 1 });
  });

  it("pushFastForward fails when remote has diverged, pushForce succeeds", async () => {
    await initBareRemote(env.bareRemote);
    const a = env.local;
    const b = join(env.root, "local-b");
    mkdirSync(b);

    await git.init(a);
    await git.addRemote(a, env.bareRemote);
    await writeAndCommit(a, "f.txt", "1", "c1");
    await git.pushSetUpstream(a);

    await git.clone(env.bareRemote, b);
    await writeAndCommit(b, "f.txt", "2-remote", "c2-remote");
    await git.pushFastForward(b);

    await writeAndCommit(a, "f.txt", "2-local", "c2-local");

    // Fast-forward push from A must fail (remote diverged)
    let ffFailed = false;
    try {
      await git.pushFastForward(a);
    } catch {
      ffFailed = true;
    }
    expect(ffFailed).toBe(true);

    // A needs to know about remote before force-with-lease works
    await git.fetch(a);
    await git.pushForce(a);
    // After force-push, A should now be in sync with remote
    await git.fetch(a);
    expect(await git.divergence(a)).toEqual({ ahead: 0, behind: 0 });
  });

  it("resetHardToRemote discards local commits", async () => {
    await initBareRemote(env.bareRemote);
    const a = env.local;
    const b = join(env.root, "local-b");
    mkdirSync(b);

    await git.init(a);
    await git.addRemote(a, env.bareRemote);
    await writeAndCommit(a, "f.txt", "1", "c1");
    await git.pushSetUpstream(a);

    await git.clone(env.bareRemote, b);
    await writeAndCommit(b, "f.txt", "remote-wins", "c2-remote");
    await git.pushFastForward(b);

    await writeAndCommit(a, "f.txt", "local-loses", "c2-local");

    await git.resetHardToRemote(a);
    const contents = await Bun.file(join(a, "f.txt")).text();
    expect(contents).toBe("remote-wins");
  });
});
