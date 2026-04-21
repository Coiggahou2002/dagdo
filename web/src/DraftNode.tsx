import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface DraftNodeData extends Record<string, unknown> {
  onCommit: (title: string) => void;
  onCancel: () => void;
}

/**
 * Placeholder node rendered at a Cmd/Ctrl+click point. Auto-focuses its title
 * input; Enter commits (creating the real task), Esc or blur cancels.
 * Positioning and NODE_TYPES registration live in App.tsx.
 */
function DraftNodeImpl(props: NodeProps) {
  const { onCommit, onCancel } = props.data as DraftNodeData;
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(): void {
    const next = title.trim();
    if (next.length === 0) onCancel();
    else onCommit(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }

  return (
    <>
      {/* Handles mirror a real task node's layout so the ghost→draft→task
          transition feels like the same object evolving, but they're not
          connectable — there is no task yet to link. */}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="dagdo-node-body dagdo-node-draft">
        <input
          ref={inputRef}
          className="dagdo-node-input"
          placeholder="Task title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          // React Flow eats Backspace/Delete at the canvas level to remove
          // selected nodes — stop the capture-phase listener from seeing keys
          // typed into the draft input.
          onKeyDownCapture={(e) => e.stopPropagation()}
          // Blur = click-outside = cancel. Matches Linear/Notion's
          // new-item-input convention: explicit Enter required to commit.
          onBlur={onCancel}
        />
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

export const DraftNode = memo(DraftNodeImpl);
