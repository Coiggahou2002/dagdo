import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutGraph } from "./layout";
import { ApiError, createEdge, createTask, deleteEdge, deleteTask, updateTask } from "./api";
import { TaskNode, type TaskNodeData } from "./TaskNode";
import type { GraphData } from "./types";

const EMPTY: GraphData = { version: 1, tasks: [], edges: [] };

type Status = "loading" | "connected" | "disconnected";
type Toast = { kind: "error" | "info"; text: string } | null;

const NODE_TYPES: NodeTypes = { task: TaskNode };

export function App() {
  const [graph, setGraph] = useState<GraphData>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [toast, setToast] = useState<Toast>(null);
  const [nodes, setNodes] = useState<FlowNode<TaskNodeData>[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);

  // IDs of nodes the user has manually dragged — their positions should survive
  // SSE-driven rebuilds rather than snapping back to the dagre layout. Pristine
  // nodes pick up fresh dagre coordinates each time the topology changes.
  const userPositioned = useRef(new Set<string>());

  // ─── data layer: fetch initial + subscribe to SSE ────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: GraphData) => {
        if (!cancelled) setGraph(data);
      })
      .catch((err) => {
        if (!cancelled) showToast({ kind: "error", text: `Failed to load graph: ${err.message}` });
      });

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setStatus("connected"));
    es.addEventListener("update", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as GraphData;
        setGraph(payload);
      } catch {
        // malformed payload — next update will correct
      }
    });
    es.addEventListener("error", () => setStatus("disconnected"));

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  // ─── mutation handlers ───────────────────────────────────────────────
  const handleRename = useCallback((id: string, title: string) => {
    updateTask(id, { title }).catch((err: unknown) => {
      showToast({ kind: "error", text: formatError("Rename failed", err) });
    });
  }, []);

  // ─── reconcile Flow state whenever server state changes ──────────────
  useEffect(() => {
    const autoLayout = layoutGraph(graph.tasks, graph.edges);
    const autoById = new Map(autoLayout.map((n) => [n.id, n]));

    setNodes((current) => {
      const positionById = new Map(current.map((n) => [n.id, n.position]));

      return graph.tasks.map<FlowNode<TaskNodeData>>((task) => {
        const auto = autoById.get(task.id);
        const autoPos = auto ? { x: auto.x, y: auto.y } : { x: 0, y: 0 };
        // Preserve positions only for nodes the user actually dragged; new or
        // pristine nodes always get fresh dagre coordinates so newly-linked
        // structure lays out sensibly.
        const preserved = userPositioned.current.has(task.id) ? positionById.get(task.id) : undefined;
        return {
          id: task.id,
          type: "task",
          position: preserved ?? autoPos,
          data: {
            task,
            state: auto?.state ?? "blocked",
            onRename: handleRename,
          },
          // Draggable always; deletable via backspace/delete.
          draggable: true,
        };
      });
    });

    // Clean up stale userPositioned entries (task removed).
    const aliveIds = new Set(graph.tasks.map((t) => t.id));
    for (const id of userPositioned.current) {
      if (!aliveIds.has(id)) userPositioned.current.delete(id);
    }

    setEdges(
      graph.edges.map<FlowEdge>((e) => {
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
      }),
    );
  }, [graph, handleRename]);

  // ─── React Flow event handlers ───────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns) as FlowNode<TaskNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);

  const onNodeDragStop = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeDragStop"]>>(
    (_event, node) => {
      userPositioned.current.add(node.id);
    },
    [],
  );

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    if (conn.source === conn.target) {
      showToast({ kind: "error", text: "A task can't depend on itself." });
      return;
    }
    createEdge(conn.source, conn.target).catch((err: unknown) => {
      showToast({ kind: "error", text: formatError("Can't add dependency", err) });
    });
    // Optimism intentionally off: we wait for the SSE broadcast to reflect
    // the new edge. A dropped connection just disappears visually.
  }, []);

  const onEdgesDelete = useCallback((deleted: FlowEdge[]) => {
    for (const edge of deleted) {
      deleteEdge(edge.source, edge.target).catch((err: unknown) => {
        showToast({ kind: "error", text: formatError("Delete failed", err) });
      });
    }
  }, []);

  const onNodesDelete = useCallback((deleted: FlowNode<TaskNodeData>[]) => {
    for (const node of deleted) {
      deleteTask(node.id).catch((err: unknown) => {
        showToast({ kind: "error", text: formatError("Delete failed", err) });
      });
    }
  }, []);

  // ─── "add task" button ───────────────────────────────────────────────
  const onAddTask = useCallback(async () => {
    const title = window.prompt("New task title:");
    if (title == null) return;
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    try {
      const task = await createTask({ title: trimmed });
      showToast({ kind: "info", text: `Added "${task.title}"` });
    } catch (err) {
      showToast({ kind: "error", text: formatError("Add failed", err) });
    }
  }, []);

  // ─── toast plumbing ──────────────────────────────────────────────────
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(next: Toast) {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (next) {
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    }
  }

  const stats = useMemo(() => {
    const done = graph.tasks.filter((t) => t.doneAt != null).length;
    return { total: graph.tasks.length, done };
  }, [graph]);

  return (
    <div className="dagdo-root">
      <header className="dagdo-header">
        <div className="dagdo-title">dagdo</div>
        <button className="dagdo-add-button" onClick={onAddTask}>
          + New task
        </button>
        <div className="dagdo-stats">
          {stats.total} tasks ({stats.done} done) · {graph.edges.length} edges
        </div>
        <div className={`dagdo-status dagdo-status-${status}`}>
          {status === "connected" ? "● live" : status === "loading" ? "○ loading" : "○ offline"}
        </div>
      </header>

      {toast && (
        <div className={`dagdo-toast dagdo-toast-${toast.kind}`} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      {graph.tasks.length === 0 ? (
        <div className="dagdo-empty">
          <p>No tasks yet.</p>
          <button className="dagdo-add-button" onClick={onAddTask}>
            + Add your first task
          </button>
        </div>
      ) : (
        <div className="dagdo-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
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

function formatError(prefix: string, err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "cycle":
        return `${prefix}: that would create a dependency cycle.`;
      case "already_exists":
        return `${prefix}: that dependency already exists.`;
      case "self_loop":
        return `${prefix}: a task can't depend on itself.`;
      case "task_not_found":
        return `${prefix}: task not found (maybe it was just deleted).`;
      default:
        return `${prefix}: ${err.message}`;
    }
  }
  if (err instanceof Error) return `${prefix}: ${err.message}`;
  return `${prefix}.`;
}

