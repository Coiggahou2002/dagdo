import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface DraftNodeData extends Record<string, unknown> {
  onCommit: (title: string) => void;
  onCancel: () => void;
}

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
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <div className="dagdo-node-draft nodrag nopan">
        <input
          ref={inputRef}
          autoFocus
          className="nodrag nopan"
          placeholder="Task title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

export const DraftNode = memo(DraftNodeImpl);
