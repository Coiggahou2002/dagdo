import { describe, it, expect } from "bun:test";
import { buildActiveGraph, wouldCreateCycle } from "../src/graph/dag";
import type { GraphData } from "../src/types";

function makeData(taskIds: string[], edges: [string, string][], doneIds: string[] = []): GraphData {
  const doneSet = new Set(doneIds);
  return {
    version: 1,
    tasks: taskIds.map((id) => ({
      id,
      title: `Task ${id}`,
      priority: "med" as const,
      tags: [],
      createdAt: "2026-01-01T00:00:00Z",
      doneAt: doneSet.has(id) ? "2026-01-02T00:00:00Z" : null,
    })),
    edges: edges.map(([from, to]) => ({ from, to })),
  };
}

describe("buildActiveGraph", () => {
  it("excludes done tasks", () => {
    const data = makeData(["a", "b", "c"], [["a", "b"]], ["a"]);
    const graph = buildActiveGraph(data);
    expect(graph.tasks.size).toBe(2);
    expect(graph.tasks.has("a")).toBe(false);
  });

  it("excludes edges involving done tasks", () => {
    const data = makeData(["a", "b"], [["a", "b"]], ["a"]);
    const graph = buildActiveGraph(data);
    expect(graph.inEdges.get("b")!.size).toBe(0);
  });
});

describe("wouldCreateCycle", () => {
  it("detects a self-loop", () => {
    const data = makeData(["a"], []);
    const graph = buildActiveGraph(data);
    expect(wouldCreateCycle(graph, "a", "a")).not.toBeNull();
  });

  it("detects a direct cycle", () => {
    const data = makeData(["a", "b"], [["a", "b"]]);
    const graph = buildActiveGraph(data);
    expect(wouldCreateCycle(graph, "b", "a")).not.toBeNull();
  });

  it("detects an indirect cycle", () => {
    const data = makeData(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    const graph = buildActiveGraph(data);
    expect(wouldCreateCycle(graph, "c", "a")).not.toBeNull();
  });

  it("allows valid edges", () => {
    const data = makeData(["a", "b", "c"], [["a", "b"]]);
    const graph = buildActiveGraph(data);
    expect(wouldCreateCycle(graph, "b", "c")).toBeNull();
  });

  it("allows diamond DAG (not a cycle)", () => {
    // a -> b, a -> c, b -> d, c -> d
    const data = makeData(["a", "b", "c", "d"], [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]]);
    const graph = buildActiveGraph(data);
    // Adding a -> d is redundant but not a cycle
    expect(wouldCreateCycle(graph, "a", "d")).toBeNull();
  });
});
