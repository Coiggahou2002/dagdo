import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface DraftNodeData extends Record<string, unknown> {
  onCommit: (title: string) => void;
  onCancel: () => void;
}

/**
 * Placeholder node rendered at a Cmd/Ctrl+click point. Auto-focuses its title
 * input; Enter commits (creating the real task), Esc cancels. Clicking
 * elsewhere blurs the input but leaves the draft on-canvas — users can click
 * the input again to resume typing. Positioning and NODE_TYPES registration
 * live in App.tsx.
 */
function DraftNodeImpl(props: NodeProps) {
  const { onCommit, onCancel } = props.data as DraftNodeData;
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Belt-and-braces focus: React's `autoFocus` prop fires during commit (early
  // enough to beat pointer-event focus shuffles from the originating click),
  // and this useEffect is the backup if something re-renders around us.
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
      {/* `nodrag nopan` on the wrapper tells React Flow "hands off" for
          pointer events — without them the library's internal drag/pan
          handlers steal the click from the input and prevent focus. */}
      <div className="dagdo-node-body dagdo-node-draft nodrag nopan">
        <input
          ref={inputRef}
          autoFocus
          className="dagdo-node-input nodrag nopan"
          placeholder="Task title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          // React Flow listens for Backspace/Delete at the canvas level to
          // remove selected nodes — stop capture-phase listeners from seeing
          // keys typed into the draft input.
          onKeyDownCapture={(e) => e.stopPropagation()}
          // Belt: prevent the pane's mousedown handler from stealing focus
          // on the click that focuses this input.
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

export const DraftNode = memo(DraftNodeImpl);
