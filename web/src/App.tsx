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
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Toaster, toast } from "sonner";
import { Sun, Moon, Plus, ArrowRightFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { layoutGraph } from "./layout";
import {
  ApiError,
  createEdge,
  createTabApi,
  createTask,
  deleteEdge,
  deleteTabApi,
  deleteTask,
  renameTabApi,
  updateTask,
  type TaskPatch,
} from "./api";
import { TaskNode, type TaskNodeData } from "./TaskNode";
import { DraftNode, type DraftNodeData } from "./DraftNode";
import { FocusPanel } from "./FocusPanel";
import { TabBar, DEFAULT_TAB_ID } from "./TabBar";
import type { GraphData, Priority, Tab } from "./types";

const EMPTY: GraphData = { version: 1, tasks: [], edges: [] };

type Status = "loading" | "connected" | "disconnected";

const NODE_TYPES: NodeTypes = { task: TaskNode, draft: DraftNode };

function hasCreateModifier(event: { altKey: boolean }): boolean {
  return event.altKey;
}

const PAN_BUTTONS_DEFAULT: number[] = [1, 2];
const PAN_BUTTONS_SPACE: number[] = [0, 1, 2];

const NODE_WIDTH = 280;
const NODE_HEIGHT = 48;
const DRAFT_NODE_ID_PREFIX = "__dagdo_draft_";
const draftNodeId = (seq: number): string => `${DRAFT_NODE_ID_PREFIX}${seq}`;
const isDraftId = (id: string): boolean => id.startsWith(DRAFT_NODE_ID_PREFIX);

type Draft = { id: number; position: { x: number; y: number } };
type Ghost = { clientX: number; clientY: number };

export function App() {
  const { resolved, theme, setTheme } = useTheme();
  const [graph, setGraph] = useState<GraphData>(EMPTY);
  const [status, setStatus] = useState<Status>("loading");
  const [nodes, setNodes] = useState<FlowNode<TaskNodeData>[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const [boxSelected, setBoxSelected] = useState<string[]>([]);

  const userPositioned = useRef(new Set<string>());
  const dragMovedRef = useRef(false);
  const flowRef = useRef<ReactFlowInstance<FlowNode<TaskNodeData | DraftNodeData>, FlowEdge> | null>(null);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftSeq = useRef(0);

  // ─── data layer ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: GraphData) => {
        if (!cancelled) setGraph(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`Failed to load graph: ${err.message}`);
      });

    const es = new EventSource("/api/events");
    es.addEventListener("open", () => setStatus("connected"));
    es.addEventListener("update", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as GraphData;
        setGraph(payload);
      } catch {
        // malformed — next update will correct
      }
    });
    es.addEventListener("error", () => setStatus("disconnected"));

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  // ─── tab-filtered view ───────────────────────────────────────────────
  const tabs = useMemo<Tab[]>(() => graph.tabs ?? [], [graph]);

  const { visibleTasks, visibleEdges } = useMemo(() => {
    if (activeTabId === DEFAULT_TAB_ID) {
      return { visibleTasks: graph.tasks, visibleEdges: graph.edges };
    }
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return { visibleTasks: graph.tasks, visibleEdges: graph.edges };
    const idSet = new Set(tab.taskIds);
    const vTasks = graph.tasks.filter((t) => idSet.has(t.id));
    const vEdges = graph.edges.filter((e) => idSet.has(e.from) && idSet.has(e.to));
    return { visibleTasks: vTasks, visibleEdges: vEdges };
  }, [graph, tabs, activeTabId]);

  // If active tab is deleted, fall back to default
  useEffect(() => {
    if (activeTabId !== DEFAULT_TAB_ID && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(DEFAULT_TAB_ID);
    }
  }, [tabs, activeTabId]);

  // ─── tab handlers ───────────────────────────────────────────────────
  const handleCreateTab = useCallback(async (name: string) => {
    try {
      const tab = await createTabApi({ name });
      setActiveTabId(tab.id);
    } catch (err) {
      toast.error(formatError("Create tab failed", err));
    }
  }, []);

  const handleRenameTab = useCallback(async (id: string, name: string) => {
    try {
      await renameTabApi(id, name);
    } catch (err) {
      toast.error(formatError("Rename tab failed", err));
    }
  }, []);

  const handleDeleteTab = useCallback(async (id: string) => {
    try {
      await deleteTabApi(id);
      if (activeTabId === id) setActiveTabId(DEFAULT_TAB_ID);
    } catch (err) {
      toast.error(formatError("Delete tab failed", err));
    }
  }, [activeTabId]);

  const handleMoveToNewTab = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    try {
      const tab = await createTabApi({ name: `Tab ${tabs.length + 1}`, taskIds });
      if (tab.id) {
        setActiveTabId(tab.id);
        toast.success(`Moved ${taskIds.length} tasks to "${tab.name}"`);
      }
    } catch (err) {
      toast.error(formatError("Move failed", err));
    }
  }, [tabs]);

  // ─── mutation handlers ───────────────────────────────────────────────
  const handleRename = useCallback((id: string, title: string) => {
    updateTask(id, { title }).catch((err: unknown) => {
      toast.error(formatError("Rename failed", err));
    });
  }, []);

  const handlePatch = useCallback((id: string, patch: TaskPatch) => {
    updateTask(id, patch).catch((err: unknown) => {
      toast.error(formatError("Update failed", err));
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteTask(id).catch((err: unknown) => {
      toast.error(formatError("Delete failed", err));
    });
    setSelectedId((sel) => (sel === id ? null : sel));
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedId(null);
  }, []);

  // ─── reconcile Flow state whenever server state or active tab changes ─
  useEffect(() => {
    const autoLayout = layoutGraph(visibleTasks, visibleEdges);
    const autoById = new Map(autoLayout.map((n) => [n.id, n]));

    setNodes((current) => {
      const positionById = new Map(current.map((n) => [n.id, n.position]));

      return visibleTasks.map<FlowNode<TaskNodeData>>((task) => {
        const auto = autoById.get(task.id);
        const autoPos = auto ? { x: auto.x, y: auto.y } : { x: 0, y: 0 };
        const preserved = userPositioned.current.has(task.id) ? positionById.get(task.id) : undefined;
        return {
          id: task.id,
          type: "task",
          position: preserved ?? autoPos,
          selected: selectedId === task.id,
          data: {
            task,
            state: auto?.state ?? "blocked",
            isPopoverOpen: selectedId === task.id,
            onRename: handleRename,
            onPatch: handlePatch,
            onDelete: handleDelete,
            onClosePopover: handleClosePopover,
          },
          draggable: true,
        };
      });
    });

    const aliveIds = new Set(visibleTasks.map((t) => t.id));
    for (const id of userPositioned.current) {
      if (!aliveIds.has(id)) userPositioned.current.delete(id);
    }
    if (selectedId && !aliveIds.has(selectedId)) {
      setSelectedId(null);
    }

    setEdges(
      visibleEdges.map<FlowEdge>((e) => {
        const fromTask = graph.tasks.find((t) => t.id === e.from);
        const dashed = fromTask?.doneAt != null;
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          animated: false,
          className: dashed ? "edge-done" : undefined,
        };
      }),
    );
  }, [graph, visibleTasks, visibleEdges, handleRename, handlePatch, handleDelete, handleClosePopover, selectedId]);

  // ─── React Flow event handlers ───────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns) as FlowNode<TaskNodeData>[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);

  const onNodeDragStart = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeDragStart"]>>(
    () => { dragMovedRef.current = false; },
    [],
  );

  const onNodeDrag = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeDrag"]>>(
    () => { dragMovedRef.current = true; },
    [],
  );

  const onNodeDragStop = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeDragStop"]>>(
    (_event, node) => {
      userPositioned.current.add(node.id);
    },
    [],
  );

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    if (conn.source === conn.target) {
      toast.error("A task can't depend on itself.");
      return;
    }
    createEdge(conn.source, conn.target).catch((err: unknown) => {
      toast.error(formatError("Can't add dependency", err));
    });
  }, []);

  const onEdgesDelete = useCallback((deleted: FlowEdge[]) => {
    for (const edge of deleted) {
      deleteEdge(edge.source, edge.target).catch((err: unknown) => {
        toast.error(formatError("Delete failed", err));
      });
    }
  }, []);

  const onNodesDelete = useCallback((deleted: FlowNode<TaskNodeData | DraftNodeData>[]) => {
    for (const node of deleted) {
      if (isDraftId(node.id)) continue;
      deleteTask(node.id).catch((err: unknown) => {
        toast.error(formatError("Delete failed", err));
      });
    }
  }, []);

  const onNodeClick = useCallback<NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeClick"]>>(
    (_event, node) => {
      if (isDraftId(node.id)) return;
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }
      setSelectedId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (hasCreateModifier(event)) {
        const flow = flowRef.current;
        if (!flow) return;
        const flowPos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const position = {
          x: flowPos.x - NODE_WIDTH / 2,
          y: flowPos.y - NODE_HEIGHT / 2,
        };
        draftSeq.current += 1;
        setDraft({ id: draftSeq.current, position });
        setGhost(null);
        return;
      }
      setSelectedId(null);
    },
    [],
  );

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
        setNodes((current) => {
          const idx = current.findIndex((n) => n.id === task.id);
          const nodeData = {
            task,
            state: "ready" as const,
            isPopoverOpen: false,
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
        toast.success(`Added "${task.title}"`);
      } catch (err) {
        toast.error(formatError("Add failed", err));
      } finally {
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

  // Space-held pan mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      e.preventDefault();
      setIsSpaceDown(true);
    }
    function onKeyUp(e: KeyboardEvent): void {
      if (e.code === "Space") setIsSpaceDown(false);
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

  // ─── box-select tracking ─────────────────────────────────────────────
  const onSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selected }) => {
    const ids = selected
      .filter((n) => !isDraftId(n.id))
      .map((n) => n.id);
    setBoxSelected(ids);
  }, []);

  // ─── "add task" button ───────────────────────────────────────────────
  const onAddTask = useCallback(async () => {
    const title = window.prompt("New task title:");
    if (title == null) return;
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    try {
      const task = await createTask({ title: trimmed });
      toast.success(`Added "${task.title}"`);
    } catch (err) {
      toast.error(formatError("Add failed", err));
    }
  }, []);

  const stats = useMemo(() => {
    const done = graph.tasks.filter((t) => t.doneAt != null).length;
    return { total: graph.tasks.length, done };
  }, [graph]);

  const readyTasks = useMemo(() => {
    const doneIds = new Set(graph.tasks.filter((t) => t.doneAt != null).map((t) => t.id));
    const blockerCount = new Map<string, number>();
    for (const t of graph.tasks) blockerCount.set(t.id, 0);
    for (const e of graph.edges) {
      if (!doneIds.has(e.from)) {
        blockerCount.set(e.to, (blockerCount.get(e.to) ?? 0) + 1);
      }
    }
    const priorityOrder: Record<Priority, number> = { high: 0, med: 1, low: 2 };
    return graph.tasks
      .filter((t) => t.doneAt == null && (blockerCount.get(t.id) ?? 0) === 0)
      .sort((a, b) => {
        const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pd !== 0) return pd;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [graph]);

  const handleFocusDone = useCallback((id: string) => {
    updateTask(id, { doneAt: new Date().toISOString() }).catch((err: unknown) => {
      toast.error(formatError("Done failed", err));
    });
  }, []);

  const handleFocusNode = useCallback((id: string) => {
    const node = nodes.find((n) => n.id === id);
    const flow = flowRef.current;
    if (!node || !flow) return;
    flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
      zoom: 1.2,
      duration: 400,
    });
    setSelectedId(id);
  }, [nodes]);

  const handleFocusPriorityChange = useCallback((id: string, priority: Priority) => {
    updateTask(id, { priority }).catch((err: unknown) => {
      toast.error(formatError("Priority change failed", err));
    });
  }, []);

  const allNodes = useMemo<FlowNode<TaskNodeData | DraftNodeData>[]>(() => {
    if (!draft) return nodes;
    const draftId = draft.id;
    const draftNode: FlowNode<DraftNodeData> = {
      id: draftNodeId(draftId),
      type: "draft",
      position: draft.position,
      draggable: false,
      selectable: false,
      measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
      data: {
        onCommit: (title: string) => void handleDraftCommit(draftId, draft.position, title),
        onCancel: () => handleDraftCancel(draftId),
      },
    };
    return [...nodes, draftNode];
  }, [nodes, draft, handleDraftCommit, handleDraftCancel]);

  // Esc closes the popover
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function cycleTheme(): void {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(theme as "light" | "dark" | "system");
    setTheme(order[(idx + 1) % order.length]!);
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
        <span className="text-base font-semibold tracking-tight">dagdo</span>
        <Button size="sm" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
        <span className="text-xs text-muted-foreground">
          {stats.total} tasks ({stats.done} done) · {graph.edges.length} edges
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
            {resolved === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <span className={`text-xs font-medium ${status === "connected" ? "text-green-500" : "text-muted-foreground"}`}>
            {status === "connected" ? "● LIVE" : status === "loading" ? "○ loading" : "○ offline"}
          </span>
        </div>
      </header>

      <Toaster
        position="top-center"
        toastOptions={{
          className: "!bg-card !text-card-foreground !border-border",
        }}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onCreate={handleCreateTab}
        onRename={handleRenameTab}
        onDelete={handleDeleteTab}
      />

      <div className="flex-1 min-h-0 flex">
        <FocusPanel
          tasks={readyTasks}
          onDone={handleFocusDone}
          onFocus={handleFocusNode}
          onPriorityChange={handleFocusPriorityChange}
        />
        {visibleTasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <p>{activeTabId === DEFAULT_TAB_ID ? "No tasks yet." : "No tasks in this tab."}</p>
            <Button onClick={onAddTask}>
              <Plus className="h-4 w-4" />
              Add your first task
            </Button>
          </div>
        ) : (
          <div className={`flex-1 h-full relative${isSpaceDown ? " dagdo-canvas is-space-down" : " dagdo-canvas"}`}>
            <ReactFlow
              nodes={allNodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onInit={onInit}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onEdgesDelete={onEdgesDelete}
              onNodesDelete={onNodesDelete}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onPaneMouseMove={onPaneMouseMove}
              onPaneMouseLeave={onPaneMouseLeave}
              onSelectionChange={onSelectionChange}
              panOnDrag={isSpaceDown ? PAN_BUTTONS_SPACE : PAN_BUTTONS_DEFAULT}
              selectionOnDrag={!isSpaceDown}
              colorMode={resolved}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
            {ghost && !draft && (
              <div
                className="dagdo-create-ghost"
                style={{ left: ghost.clientX, top: ghost.clientY }}
                aria-hidden="true"
              />
            )}
            {boxSelected.length >= 2 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <Button
                  size="sm"
                  className="shadow-lg gap-1.5"
                  onClick={() => handleMoveToNewTab(boxSelected)}
                >
                  <ArrowRightFromLine className="h-3.5 w-3.5" />
                  Move {boxSelected.length} tasks to new tab
                </Button>
              </div>
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
      case "note_too_long":
        return `${prefix}: note is too long (max 2000 characters).`;
      default:
        return `${prefix}: ${err.message}`;
    }
  }
  if (err instanceof Error) return `${prefix}: ${err.message}`;
  return `${prefix}.`;
}
