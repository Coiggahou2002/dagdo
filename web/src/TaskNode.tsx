import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useViewport,
  type NodeProps,
} from "@xyflow/react";
import type { NodeState, Task } from "./types";
import { TaskPopover } from "./TaskPopover";
import type { TaskPatch } from "./api";

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  state: NodeState;
  onRename: (id: string, title: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onClosePopover: () => void;
}

const POPOVER_OFFSET = 10;
/** How close the popover can get to a viewport edge before we flip it. */
const VIEWPORT_MARGIN = 8;

function TaskNodeImpl(props: NodeProps) {
  const { task, state, onRename, onPatch, onDelete, onClosePopover } = props.data as TaskNodeData;
  const selected = props.selected === true;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Popover placement: prefer below the node; flip to above if the popover
  // would overflow the viewport's bottom edge. Recomputed whenever the
  // viewport changes (pan/zoom) or the popover opens.
  const [popoverPosition, setPopoverPosition] = useState<Position>(Position.Bottom);
  const popoverRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // After the popover paints (or the viewport moves), check whether it fits
  // where we placed it. If the currently-chosen edge overflows the viewport
  // and the opposite edge has room, flip.
  useLayoutEffect(() => {
    if (!selected) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const winH = window.innerHeight;
    const winW = window.innerWidth;

    if (popoverPosition === Position.Bottom) {
      if (rect.bottom > winH - VIEWPORT_MARGIN) {
        // Only flip if there's actually more room above — otherwise stay put
        // and let the popover scroll/clip rather than dance between sides.
        const overflowBelow = rect.bottom - (winH - VIEWPORT_MARGIN);
        const spaceAbove = rect.top - VIEWPORT_MARGIN; // current top, pre-flip
        if (spaceAbove > overflowBelow) {
          setPopoverPosition(Position.Top);
        }
      }
    } else if (popoverPosition === Position.Top) {
      if (rect.top < VIEWPORT_MARGIN) {
        const overflowAbove = VIEWPORT_MARGIN - rect.top;
        const spaceBelow = winH - VIEWPORT_MARGIN - rect.bottom;
        if (spaceBelow > overflowAbove) {
          setPopoverPosition(Position.Bottom);
        }
      }
    }

    // Horizontal overflow: NodeToolbar centers the popover over the node, so
    // if the node is near a viewport edge the popover may still clip. There's
    // no Position.Top-Left in the typed enum; we leave horizontal handling to
    // the CSS max-width — the popover is only ~260px wide and the canvas is
    // unlikely to scroll this into a dead corner in practice.
    void winW;
  }, [selected, popoverPosition, viewport.x, viewport.y, viewport.zoom, task.title, task.tags.length]);

  // Reset to preferred side each time the popover opens on a (possibly new)
  // node, so moving between nodes doesn't carry over a stale flip.
  useEffect(() => {
    if (selected) setPopoverPosition(Position.Bottom);
  }, [selected, task.id]);

  function commit(): void {
    setEditing(false);
    const next = draft.trim();
    if (next.length > 0 && next !== task.title) {
      onRename(task.id, next);
    } else {
      setDraft(task.title);
    }
  }

  function cancel(): void {
    setDraft(task.title);
    setEditing(false);
  }

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`dagdo-node-body dagdo-node-${state}`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (state !== "done") setEditing(true);
        }}
      >
        <span
          className={`dagdo-node-pri dagdo-node-pri-${task.priority}`}
          title={`priority: ${task.priority}`}
          aria-label={`priority ${task.priority}`}
        />
        {editing ? (
          <input
            ref={inputRef}
            className="dagdo-node-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            // React Flow intercepts some keys at the canvas level; stop them
            // from bubbling so Backspace doesn't trigger node deletion.
            onKeyDownCapture={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="dagdo-node-title">{task.title}</div>
        )}
        {task.tags.length > 0 && !editing && (
          <div className="dagdo-node-tags">[{task.tags.join(", ")}]</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />

      <NodeToolbar
        isVisible={selected && !editing}
        position={popoverPosition}
        offset={POPOVER_OFFSET}
      >
        {/* NodeToolbar's typed props don't expose ref; wrap in a plain div so
            the flip-logic effect can measure the popover's rendered rect. */}
        <div ref={popoverRef}>
          <TaskPopover
            task={task}
            onChange={(patch) => onPatch(task.id, patch)}
            onDelete={() => onDelete(task.id)}
            onClose={onClosePopover}
          />
        </div>
      </NodeToolbar>
    </>
  );
}

export const TaskNode = memo(TaskNodeImpl);
