import { describe, it, expect } from "bun:test";
import {
  addEdge,
  addTask,
  removeEdge,
  removeTask,
  updateTask,
} from "../src/graph/mutations";
import type { GraphData, Task } from "../src/types";

function makeData(overrides: Partial<GraphData> = {}): GraphData {
  return { version: 1, tasks: [], edges: [], ...overrides };
}

function task(id: string, extras: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    priority: "med",
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    doneAt: null,
    ...extras,
  };
}

describe("addTask", () => {
  it("appends a new task with generated id", () => {
    const { data, task } = addTask(makeData(), { title: "t1" });
    expect(data.tasks).toHaveLength(1);
    expect(task.title).toBe("t1");
    expect(task.priority).toBe("med");
    expect(task.id).toMatch(/^[0-9a-f]{6}$/);
  });

  it("does not mutate the input", () => {
    const input = makeData();
    addTask(input, { title: "t1" });
    expect(input.tasks).toEqual([]);
  });
});

describe("updateTask", () => {
  it("patches only the provided fields", () => {
    const input = makeData({ tasks: [task("aaa", { title: "old", priority: "low" })] });
    const result = updateTask(input, "aaa", { title: "new" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.task.title).toBe("new");
    expect(result.task.priority).toBe("low"); // unchanged
  });

  it("returns task_not_found when id missing", () => {
    const result = updateTask(makeData(), "zzz", { title: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("task_not_found");
  });
});

describe("removeTask", () => {
  it("removes task and all incident edges", () => {
    const input = makeData({
      tasks: [task("aaa"), task("bbb"), task("ccc")],
      edges: [{ from: "aaa", to: "bbb" }, { from: "bbb", to: "ccc" }],
    });
    const result = removeTask(input, "bbb");
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.tasks.map((t) => t.id)).toEqual(["aaa", "ccc"]);
    expect(result.data.edges).toEqual([]);
  });
});

describe("addEdge", () => {
  it("adds a valid edge", () => {
    const input = makeData({ tasks: [task("aaa"), task("bbb")] });
    const result = addEdge(input, { from: "aaa", to: "bbb" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.edges).toEqual([{ from: "aaa", to: "bbb" }]);
  });

  it("rejects self-loop", () => {
    const result = addEdge(makeData({ tasks: [task("aaa")] }), { from: "aaa", to: "aaa" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("self_loop");
  });

  it("rejects duplicate edge", () => {
    const input = makeData({
      tasks: [task("aaa"), task("bbb")],
      edges: [{ from: "aaa", to: "bbb" }],
    });
    const result = addEdge(input, { from: "aaa", to: "bbb" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("already_exists");
  });

  it("rejects edge that would create a cycle", () => {
    const input = makeData({
      tasks: [task("a"), task("b"), task("c")],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }],
    });
    const result = addEdge(input, { from: "c", to: "a" });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "cycle") {
      expect(result.path.length).toBeGreaterThan(0);
    }
  });

  it("rejects when source task does not exist", () => {
    const input = makeData({ tasks: [task("a")] });
    const result = addEdge(input, { from: "nope", to: "a" });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "task_not_found") {
      expect(result.id).toBe("nope");
    }
  });
});

describe("removeEdge", () => {
  it("removes exactly the specified edge", () => {
    const input = makeData({
      tasks: [task("a"), task("b")],
      edges: [{ from: "a", to: "b" }],
    });
    const result = removeEdge(input, { from: "a", to: "b" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.edges).toEqual([]);
  });

  it("is strictly directional (does not remove reversed edge)", () => {
    const input = makeData({
      tasks: [task("a"), task("b")],
      edges: [{ from: "a", to: "b" }],
    });
    const result = removeEdge(input, { from: "b", to: "a" });
    expect(result.ok).toBe(false);
  });
});
