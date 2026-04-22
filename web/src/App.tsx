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
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutGraph } from "./layout";
import {
  ApiError,
  createEdge,
  createTask,
  deleteEdge,
  deleteTask,
  updateTask,
  type TaskPatch,
} from "./api";
import { TaskNode, type TaskNodeData } from "./TaskNode";
import { DraftNode, type DraftNodeData } from "./DraftNode";
import type { GraphData } from "./types";

const EMPTY: GraphData = { version: 1, tasks: [], edges: [] };

type Status = "loading" | "connected" | "disconnected";
type Toast = { kind: "error" | "info"; text: string } | null;

const NODE_TYPES: NodeTypes = { task: TaskNode, draft: DraftNode };

// Option (macOS) / Alt (everywhere else) — same `altKey` on every platform, no
// branching needed. Chosen over Cmd/Ctrl to stay out of the way of the
// browser's Cmd/Ctrl + scroll-to-zoom gesture on the canvas.
function hasCreateModifier(event: { altKey: boolean }): boolean {
  return event.altKey;
}

// While Space is held: include left-mouse (button 0) so left-drag pans the
// viewport. Default keeps middle/right only, leaving plain left-drag free
// for future box-selection or other gestures.
const PAN_BUTTONS_DEFAULT: number[] = [1, 2];
const PAN_BUTTONS_SPACE: number[] = [0, 1, 2];

// Node CSS nominal dimensions — kept in sync with `.dagdo-node-body` in styles.css.
// Used to centre a new node on the click cursor (and match the preview ghost).
const NODE_WIDTH = 200;
const NODE_HEIGHT = 48;
// Per-session id so React Flow unmounts the previous draft component (and its
// local input state) when the user Cmd-clicks again at a new spot.
const DRAFT_NODE_ID_PREFIX = "__dagdo_draft_";
const draftNodeId = (seq: number): string => `${DRAFT_NODE_ID_PREFIX}${seq}`;
const isDraftId = (id: string): boolean => id.startsWith(DRAFT_NODE_ID_PREFIX);

type Draft = { id: number; position: { x: number; y: number } };
type Ghost = { clientX: number; clientY: number };

export function App() {
  const [graph, setGraph] = useState<GraphData>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [toast, setToast] = useState<Toast>(null);
  const [nodes, setNodes] = useState<FlowNode<TaskNodeData>[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // IDs of nodes the user has manually dragged or placed via Option/Alt+click —
  // their positions should survive SSE-driven rebuilds rather than snapping back
  // to the dagre layout. Pristine nodes pick up fresh dagre coordinates each time
  // the topology changes.
  const userPositioned = useRef(new Set<string>());

  // React Flow instance (captured via onInit). Needed for screenToFlowPosition
  // so Option/Alt+click can translate a viewport pixel coordinate back into the
  // flow's world coordinate system, regardless of current pan/zoom. The
  // generic widens to the union because `<ReactFlow nodes={allNodes}>` infers
  // its node type from the passed nodes, which include an optional draft.
  const flowRef = useRef<ReactFlowInstance<FlowNode<TaskNodeData | DraftNodeData>, FlowEdge> | null>(null);

  // True while the user holds Space. Gated here rather than in CSS because
  // React Flow's `panOnDrag` prop needs the live value — CSS alone can't toggle
  // pan behavior. Reset on window blur so releasing Space outside the window
  // doesn't leave the canvas stuck in pan mode.
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  // Ghost preview shown under the cursor while the user holds the create
  // modifier (Cmd/Ctrl) over the canvas. Stored as raw client coords so the
  // overlay can render via `position: fixed` without recomputing on pan/zoom.
  const [ghost, setGhost] = useState<Ghost | null>(null);

  // In-flight "draft" node: a placeholder rendered at the click position with a
  // focused input. Only one can exist at a time. `id` bumps on every new draft
  // so a stale in-flight createTask never clobbers a newer draft.
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftSeq = useRef(0);

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

  const handlePatch = useCallback((id: string, patch: TaskPatch) => {
    updateTask(id, patch).catch((err: unknown) => {
      showToast({ kind: "error", text: formatError("Update failed", err) });
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteTask(id).catch((err: unknown) => {
      showToast({ kind: "error", text: formatError("Delete failed", err) });
    });
    setSelectedId((sel) => (sel === id ? null : sel));
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedId(null);
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
          selected: selectedId === task.id,
          data: {
            task,
            state: auto?.state ?? "blocked",
            onRename: handleRename,
            onPatch: handlePatch,
            onDelete: handleDelete,
            onClosePopover: handleClosePopover,
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
    // If the selected task was removed elsewhere, drop the selection so the
    // popover closes rather than lingering on stale data.
    if (selectedId && !aliveIds.has(selectedId)) {
      setSelectedId(null);
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
            ? { strokeDasharray: "4 4", stroke: "#8a8f98" }
            : { stroke: "#62666d" },
        };
      }),
    );
  }, [graph, handleRename, handlePatch, handleDelete, handleClosePopover, selectedId]);

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

  const onNodesDelete = useCallback((deleted: FlowNode<TaskNodeData | DraftNodeData>[]) => {
    for (const node of deleted) {
      // Draft nodes are non-selectable so this shouldn't fire for them, but
      // guard — calling DELETE /api/tasks/__dagdo_draft_N would 404 noisily.
      if (isDraftId(node.id)) continue;
      deleteTask(node.id).catch((err: unknown) => {
        showToast({ kind: "error", text: formatError("Delete failed", err) });
      });
    }
  }, []);

  const onNodeClick = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeClick"]>>(
    (_event, node) => {
      // Clicks inside the draft node's input bubble up as node clicks — don't
      // let them open a popover for a task that doesn't exist yet.
      if (isDraftId(node.id)) return;
      setSelectedId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Option (macOS) / Alt (elsewhere) + click on empty pane drops a "draft"
      // node at the click point. The node body auto-focuses its title input;
      // Enter inside the draft commits, Esc/blur cancels. A second Cmd+click
      // while a draft is already open replaces it with one at the new spot.
      if (hasCreateModifier(event)) {
        const flow = flowRef.current;
        if (!flow) return;
        const flowPos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        // Centre the node on the cursor. At any zoom level, shifting the flow
        // position by half the node's CSS size (in flow units) lands the node
        // centred on the click — zoom drops out of the math because
        // screenToFlowPosition has already accounted for it.
        const position = {
          x: flowPos.x - NODE_WIDTH / 2,
          y: flowPos.y - NODE_HEIGHT / 2,
        };
        draftSeq.current += 1;
        setDraft({ id: draftSeq.current, position });
        // Hide the ghost: the draft's own box now represents the pending node.
        setGhost(null);
        return;
      }
      setSelectedId(null);
    },
    [],
  );

  // onPaneMouseMove / onPaneMouseLeave drive the dashed ghost preview that
  // appears under the cursor while the create-modifier is held. React Flow
  // only fires these while the pointer is over the pane (empty canvas), so
  // the ghost naturally hides when hovering nodes, handles, or controls.
  const onPaneMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hasCreateModifier(event)) {
        setGhost({ clientX: event.clientX, clientY: event.clientY });
      } else if (ghost !== null) {
        setGhost(null);
      }
    },
    [ghost],
  );

  const onPaneMouseLeave = useCallback(() => {
    setGhost(null);
  }, []);

  // ─── draft task handlers ─────────────────────────────────────────────
  const handleDraftCommit = useCallback(
    async (draftId: number, position: { x: number; y: number }, title: string) => {
      try {
        const task = await createTask({ title });
        userPositioned.current.add(task.id);
        // Seed / correct the local node at the draft's position. We tolerate
        // an SSE broadcast that races ahead of the POST: if the reconcile
        // effect already inserted the task at a dagre coord, update its
        // position here; otherwise append it.
        setNodes((current) => {
          const idx = current.findIndex((n) => n.id === task.id);
          const nodeData = {
            task,
            state: "ready" as const,
            onRename: handleRename,
            onPatch: handlePatch,
            onDelete: handleDelete,
            onClosePopover: handleClosePopover,
          };
          if (idx >= 0) {
            const next = [...current];
            next[idx] = { ...next[idx], position, data: nodeData };
            return next;
          }
          return [
            ...current,
            {
              id: task.id,
              type: "task",
              position,
              selected: false,
              draggable: true,
              data: nodeData,
            },
          ];
        });
        showToast({ kind: "info", text: `Added "${task.title}"` });
      } catch (err) {
        showToast({ kind: "error", text: formatError("Add failed", err) });
      } finally {
        // Only clear the draft if the slot still belongs to this invocation —
        // a second Cmd+click during the await creates a new draft we must not
        // clobber.
        setDraft((cur) => (cur && cur.id === draftId ? null : cur));
      }
    },
    [handleRename, handlePatch, handleDelete, handleClosePopover],
  );

  const handleDraftCancel = useCallback((draftId: number) => {
    setDraft((cur) => (cur && cur.id === draftId ? null : cur));
  }, []);

  const onInit = useCallback(
    (instance: ReactFlowInstance<FlowNode<TaskNodeData | DraftNodeData>, FlowEdge>) => {
      flowRef.current = instance;
    },
    [],
  );

  // Space-held pan mode. Key listeners live on window so the shortcut works
  // even when focus is on a nested element. We also reset on blur to avoid a
  // "stuck in pan mode" state if the user releases Space outside the window.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.code !== "Space") return;
      // If the user is typing in an input (task title, tag editor, etc.), don't
      // hijack Space. contentEditable covers the rename input and any future
      // rich-text fields.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      // Prevent the default page-scroll that Space triggers on some browsers.
      e.preventDefault();
      setIsSpaceDown(true);
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.code === "Space") setIsSpaceDown(false);
      // Clear the ghost immediately on modifier release — onPaneMouseMove is
      // only sampled on movement, so without this the ghost would linger until
      // the next mousemove event.
      if (!e.altKey) setGhost(null);
    }
    function onBlur(): void {
      setIsSpaceDown(false);
      setGhost(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
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

  // Merge the real nodes with an optional draft node. Kept as a derived value
  // (rather than stuffing the draft into `nodes` state) so the reconcile
  // effect stays a clean task↔node mapping and never accidentally persists
  // the draft through a graph refresh.
  const allNodes = useMemo<FlowNode<TaskNodeData | DraftNodeData>[]>(() => {
    if (!draft) return nodes;
    const draftId = draft.id;
    const draftNode: FlowNode<DraftNodeData> = {
      id: draftNodeId(draftId),
      type: "draft",
      position: draft.position,
      // Non-interactive: users commit via Enter and cancel via Esc, not
      // by dragging or selecting the placeholder.
      draggable: false,
      selectable: false,
      // Pre-declare dimensions so React Flow skips the "render invisible,
      // measure, then unhide" dance. Without this, the draft stays
      // visibility:hidden forever: the measurement change lands in
      // onNodesChange, but applyNodeChanges is running against `nodes`
      // state (which does not contain the draft) and silently drops it,
      // so the node is never un-hidden and its input can't receive focus
      // or pointer events.
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data: {
        onCommit: (title: string) => void handleDraftCommit(draftId, draft.position, title),
        onCancel: () => handleDraftCancel(draftId),
      },
    };
    return [...nodes, draftNode];
  }, [nodes, draft, handleDraftCommit, handleDraftCancel]);

  // Esc closes the popover. Bound at the window so the key works regardless of
  // whether focus is on the canvas or elsewhere; only active while a task is
  // selected to avoid interfering with other keyboard handling.
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

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

      <div className="dagdo-body">
        {graph.tasks.length === 0 ? (
          <div className="dagdo-empty">
            <p>No tasks yet.</p>
            <button className="dagdo-add-button" onClick={onAddTask}>
              + Add your first task
            </button>
          </div>
        ) : (
          <div className={`dagdo-canvas${isSpaceDown ? " is-space-down" : ""}`}>
            <ReactFlow
              nodes={allNodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onInit={onInit}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onEdgesDelete={onEdgesDelete}
              onNodesDelete={onNodesDelete}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onPaneMouseMove={onPaneMouseMove}
              onPaneMouseLeave={onPaneMouseLeave}
              panOnDrag={isSpaceDown ? PAN_BUTTONS_SPACE : PAN_BUTTONS_DEFAULT}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e6e6e6" gap={20} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable maskColor="rgba(247, 248, 248, 0.7)" />
            </ReactFlow>
            {ghost && !draft && (
              // pointer-events: none in CSS — never blocks the click it previews.
              <div
                className="dagdo-create-ghost"
                style={{ left: ghost.clientX, top: ghost.clientY }}
                aria-hidden="true"
              />
            )}
          </div>
        )}

      </div>
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
