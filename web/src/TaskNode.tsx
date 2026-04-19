import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeState, Task } from "./types";

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  state: NodeState;
  onRename: (id: string, title: string) => void;
}

function TaskNodeImpl(props: NodeProps) {
  const { task, state, onRename } = props.data as TaskNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
    </>
  );
}

export const TaskNode = memo(TaskNodeImpl);
