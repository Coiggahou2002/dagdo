import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Handle,
  NodeToolbar,
  Position,
  useViewport,
  type NodeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { NodeState, Task } from "./types";
import { TaskPopover } from "./TaskPopover";
import type { TaskPatch } from "./api";

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  state: NodeState;
  isPopoverOpen: boolean;
  onRename: (id: string, title: string) => void;
  onPatch: (id: string, patch: TaskPatch) => void;
  onDelete: (id: string) => void;
  onClosePopover: () => void;
}

const POPOVER_OFFSET = 10;
const VIEWPORT_MARGIN = 8;

function TaskNodeImpl(props: NodeProps) {
  const { task, state, isPopoverOpen, onRename, onPatch, onDelete, onClosePopover } = props.data as TaskNodeData;
  const selected = isPopoverOpen === true;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [popoverPosition, setPopoverPosition] = useState<Position>(Position.Bottom);
  const popoverRef = useRef<HTMLDivElement>(null);
  const viewport = useViewport();

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useLayoutEffect(() => {
    if (!selected) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const winH = window.innerHeight;

    if (popoverPosition === Position.Bottom) {
      if (rect.bottom > winH - VIEWPORT_MARGIN) {
        const overflowBelow = rect.bottom - (winH - VIEWPORT_MARGIN);
        const spaceAbove = rect.top - VIEWPORT_MARGIN;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, viewport.x, viewport.y, viewport.zoom, task.title, task.tags.length]);

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
        className={cn(
          "rounded-lg px-4 py-3 min-w-[160px] max-w-[280px] shadow-sm border cursor-pointer transition-colors",
          state === "ready" && "bg-primary text-primary-foreground",
          state === "blocked" && "bg-card text-card-foreground border-border",
          state === "done" && "bg-muted text-muted-foreground border-border",
        )}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (state !== "done") setEditing(true);
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-transparent border-none outline-none text-sm font-medium text-inherit placeholder:text-inherit/50"
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
            onKeyDownCapture={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="text-sm font-medium leading-snug">{task.title}</div>
        )}
        {task.tags.length > 0 && !editing && (
          <div className="text-xs mt-1 opacity-70">[{task.tags.join(", ")}]</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />

      <NodeToolbar
        isVisible={selected && !editing}
        position={popoverPosition}
        offset={POPOVER_OFFSET}
      >
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
