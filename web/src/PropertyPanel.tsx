import { useEffect, useState, type KeyboardEvent } from "react";
import type { Priority, Task } from "./types";

interface PropertyPanelProps {
  task: Task;
  onChange: (patch: { priority?: Priority; tags?: string[]; doneAt?: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["high", "med", "low"];

export function PropertyPanel({ task, onChange, onDelete, onClose }: PropertyPanelProps) {
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
      setTagDraft("");
    }
  }

  const done = task.doneAt != null;

  return (
    <aside className="dagdo-panel">
      <div className="dagdo-panel-head">
        <span className="dagdo-panel-title">Task</span>
        <button className="dagdo-panel-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <div className="dagdo-panel-row">
        <div className="dagdo-panel-label">Title</div>
        <div className="dagdo-panel-value dagdo-panel-title-readonly">{task.title}</div>
        <div className="dagdo-panel-hint">Double-click the node to rename.</div>
      </div>

      <div className="dagdo-panel-row">
        <div className="dagdo-panel-label">Priority</div>
        <div className="dagdo-panel-segmented">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={`dagdo-panel-seg ${task.priority === p ? "is-active" : ""} dagdo-panel-seg-${p}`}
              onClick={() => {
                if (task.priority !== p) onChange({ priority: p });
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="dagdo-panel-row">
        <div className="dagdo-panel-label">Tags</div>
        <div className="dagdo-panel-tags">
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
          {task.tags.length === 0 && <span className="dagdo-panel-empty">no tags</span>}
        </div>
        <input
          className="dagdo-panel-input"
          placeholder="add tag (Enter)"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={() => addTag(tagDraft)}
        />
      </div>

      <div className="dagdo-panel-row">
        <label className="dagdo-panel-checkbox">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => onChange({ doneAt: e.target.checked ? new Date().toISOString() : null })}
          />
          <span>Mark as done</span>
        </label>
        {done && task.doneAt && (
          <div className="dagdo-panel-hint">Completed {formatDate(task.doneAt)}</div>
        )}
      </div>

      <div className="dagdo-panel-row">
        <div className="dagdo-panel-label">Created</div>
        <div className="dagdo-panel-value dagdo-panel-created">{formatDate(task.createdAt)}</div>
        <div className="dagdo-panel-hint dagdo-panel-id">{task.id}</div>
      </div>

      <div className="dagdo-panel-footer">
        <button className="dagdo-panel-delete" onClick={onDelete}>
          Delete task
        </button>
      </div>
    </aside>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
