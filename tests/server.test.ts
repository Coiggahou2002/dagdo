import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { GraphData } from "../src/types";

// Local dev machines may have HTTP_PROXY set, which Bun's fetch honors and
// which will 502 against our loopback server. Mask proxies for this suite.
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.http_proxy;
delete process.env.https_proxy;
process.env.NO_PROXY = "localhost,127.0.0.1";
process.env.no_proxy = "localhost,127.0.0.1";

describe("server", () => {
  let testHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    testHome = join(tmpdir(), `dagdo-server-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(join(testHome, ".dagdo"), { recursive: true });
    originalHome = process.env.HOME;
    process.env.HOME = testHome;
  });

  afterEach(() => {
    if (originalHome !== undefined) process.env.HOME = originalHome;
    rmSync(testHome, { recursive: true, force: true });
  });

  it("serves the current graph at /api/graph", async () => {
    const seed: GraphData = {
      version: 1,
      tasks: [
        {
          id: "abcdef",
          title: "seed",
          priority: "med",
          tags: ["x"],
          createdAt: "2026-01-01T00:00:00Z",
          doneAt: null,
        },
      ],
      edges: [],
    };
    writeFileSync(join(testHome, ".dagdo", "data.json"), JSON.stringify(seed));

    // Import inside the test so the module re-reads HOME each time via the
    // storage helper rather than caching from an earlier test's HOME.
    const { startServer } = await import(`../src/server/server?t=${Date.now()}`);
    const srv = await startServer({ preferredPort: 0 });

    try {
      const res = await fetch(`${srv.url}/api/graph`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as GraphData;
      expect(body.tasks.length).toBe(1);
      expect(body.tasks[0]!.title).toBe("seed");
    } finally {
      await srv.stop();
    }
  });

  it("returns an empty graph when data.json is absent", async () => {
    const { startServer } = await import(`../src/server/server?t=${Date.now()}`);
    const srv = await startServer({ preferredPort: 0 });

    try {
      const res = await fetch(`${srv.url}/api/graph`);
      const body = (await res.json()) as GraphData;
      expect(body.tasks).toEqual([]);
      expect(body.edges).toEqual([]);
    } finally {
      await srv.stop();
    }
  });

  it("picks a different port when preferredPort is in use", async () => {
    const { startServer } = await import(`../src/server/server?t=${Date.now()}`);
    const first = await startServer({ preferredPort: 0 });

    try {
      const second = await startServer({ preferredPort: first.port });
      try {
        expect(second.port).toBeGreaterThan(first.port);
      } finally {
        await second.stop();
      }
    } finally {
      await first.stop();
    }
  });

  it("responds 204 to /favicon.ico", async () => {
    const { startServer } = await import(`../src/server/server?t=${Date.now()}`);
    const srv = await startServer({ preferredPort: 0 });

    try {
      const res = await fetch(`${srv.url}/favicon.ico`);
      expect(res.status).toBe(204);
    } finally {
      await srv.stop();
    }
  });
});
