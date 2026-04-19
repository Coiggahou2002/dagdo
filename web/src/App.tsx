import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutGraph } from "./layout";
import type { GraphData, Task } from "./types";

const EMPTY: GraphData = { version: 1, tasks: [], edges: [] };

export function App() {
  const [graph, setGraph] = useState<GraphData>(EMPTY);
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: GraphData) => {
        if (!cancelled) setGraph(data);
      })
      .catch((err) => {
        if (!cancelled) setError(`Failed to load graph: ${err.message}`);
      });

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setStatus("connected"));
    es.addEventListener("update", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as GraphData;
        setGraph(payload);
      } catch {
        // malformed payload — ignore, next update will correct
      }
    });
    es.addEventListener("error", () => setStatus("disconnected"));

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  const { nodes, flowEdges } = useMemo(() => {
    const laidOut = layoutGraph(graph.tasks, graph.edges);
    const nodes: Node[] = laidOut.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      data: { label: nodeLabel(n.task), state: n.state },
      draggable: true,
      selectable: true,
      className: `dagdo-node dagdo-node-${n.state}`,
      style: {}, // styling via className + CSS; see styles.css
    }));
    const flowEdges: FlowEdge[] = graph.edges.map((e) => {
      const fromTask = graph.tasks.find((t) => t.id === e.from);
      const dashed = fromTask?.doneAt != null;
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        animated: false,
        style: dashed
          ? { strokeDasharray: "4 4", stroke: "#b5ada0" }
          : { stroke: "#87867f" },
      };
    });
    return { nodes, flowEdges };
  }, [graph]);

  return (
    <div className="dagdo-root">
      <header className="dagdo-header">
        <div className="dagdo-title">dagdo</div>
        <div className="dagdo-stats">
          {graph.tasks.length} tasks · {graph.edges.length} edges
        </div>
        <div className={`dagdo-status dagdo-status-${status}`}>
          {status === "connected" ? "● live" : status === "loading" ? "○ loading" : "○ offline"}
        </div>
      </header>

      {error && <div className="dagdo-error">{error}</div>}

      {graph.tasks.length === 0 ? (
        <div className="dagdo-empty">
          <p>No tasks yet.</p>
          <p>
            <code>dagdo add "your first task"</code>
          </p>
        </div>
      ) : (
        <div className="dagdo-canvas">
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e8e6dc" gap={20} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(245, 244, 237, 0.7)" />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}

function nodeLabel(t: Task): string {
  const parts = [t.title];
  if (t.tags.length > 0) parts.push(`[${t.tags.join(", ")}]`);
  return parts.join("\n");
}
