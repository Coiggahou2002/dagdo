import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Priority, Task } from "./types";

interface TaskPopoverProps {
  task: Task;
  onChange: (patch: { priority?: Priority; tags?: string[]; doneAt?: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["high", "med", "low"];

/**
 * Compact, in-canvas editor for a single task. Rendered inside a React Flow
 * <NodeToolbar>, so positioning / zoom-tracking is handled upstream — this
 * component is pure UI.
 */
export function TaskPopover({ task, onChange, onDelete, onClose }: TaskPopoverProps) {
  const [tagDraft, setTagDraft] = useState("");

  // Reset the tag draft when switching between tasks so input doesn't leak.
  useEffect(() => {
    setTagDraft("");
  }, [task.id]);

  function addTag(raw: string): void {
    const tag = raw.trim();
    if (tag.length === 0) return;
    if (task.tags.includes(tag)) return;
    onChange({ tags: [...task.tags, tag] });
    setTagDraft("");
  }

  function removeTag(tag: string): void {
    onChange({ tags: task.tags.filter((t) => t !== tag) });
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Let the wrapper's Esc-handler close the popover only if the draft is empty;
      // otherwise consume Escape to clear the draft.
      if (tagDraft.length > 0) {
        e.stopPropagation();
        setTagDraft("");
      }
    }
  }

  const done = task.doneAt != null;

  // Swallow pointer events so clicks inside the popover don't bubble up to the
  // React Flow pane handler (which would close the popover via onPaneClick).
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      className="dagdo-popover"
      role="dialog"
      aria-label={`Edit task ${task.title}`}
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
    >
      <div className="dagdo-popover-head">
        <span className="dagdo-popover-title">Task</span>
        <button className="dagdo-popover-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="dagdo-popover-row">
        <div className="dagdo-popover-label">Priority</div>
        <div className="dagdo-popover-segmented">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={`dagdo-popover-seg ${task.priority === p ? "is-active" : ""} dagdo-popover-seg-${p}`}
              onClick={() => {
                if (task.priority !== p) onChange({ priority: p });
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="dagdo-popover-row">
        <div className="dagdo-popover-label">Tags</div>
        <div className="dagdo-popover-tags">
          {task.tags.map((tag) => (
            <span key={tag} className="dagdo-chip">
              {tag}
              <button
                className="dagdo-chip-remove"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          {task.tags.length === 0 && <span className="dagdo-popover-empty">no tags</span>}
        </div>
        <input
          className="dagdo-popover-input"
          placeholder="add tag (Enter)"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={() => addTag(tagDraft)}
        />
      </div>

      <div className="dagdo-popover-row">
        <label className="dagdo-popover-checkbox">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => onChange({ doneAt: e.target.checked ? new Date().toISOString() : null })}
          />
          <span>Mark as done</span>
        </label>
        {done && task.doneAt && (
          <div className="dagdo-popover-hint">Completed {formatDate(task.doneAt)}</div>
        )}
      </div>

      <div className="dagdo-popover-footer">
        <span className="dagdo-popover-hint dagdo-popover-id" title={task.id}>
          {formatDate(task.createdAt)}
        </span>
        <button className="dagdo-popover-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
