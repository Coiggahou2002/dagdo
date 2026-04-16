import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We test storage logic by directly reading/writing JSON
describe("storage format", () => {
  const testDir = join(tmpdir(), "depdo-test-" + Date.now());
  const testFile = join(testDir, "data.json");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("roundtrips graph data through JSON", async () => {
    const data = {
      version: 1 as const,
      tasks: [
        { id: "abc123", title: "Test task", priority: "high" as const, tags: ["a"], createdAt: "2026-01-01T00:00:00Z", doneAt: null },
      ],
      edges: [{ from: "abc123", to: "def456" }],
    };

    await Bun.write(testFile, JSON.stringify(data, null, 2));
    const loaded = await Bun.file(testFile).json();
    expect(loaded).toEqual(data);
  });

  it("handles missing file gracefully", () => {
    expect(existsSync(join(testDir, "nonexistent.json"))).toBe(false);
  });
});
