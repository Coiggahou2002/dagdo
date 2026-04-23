import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Priority, Task } from "./types";

interface TaskPopoverProps {
  task: Task;
  onChange: (patch: {
    title?: string;
    priority?: Priority;
    tags?: string[];
    doneAt?: string | null;
    notes?: string | null;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["high", "med", "low"];
const NOTES_MAX_CHARS = 2000;

export function TaskPopover({ task, onChange, onDelete, onClose }: TaskPopoverProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? "");

  useEffect(() => {
    setTagDraft("");
    setTitleDraft(task.title);
    setNotesDraft(task.notes ?? "");
  }, [task.id, task.title, task.notes]);

  function commitTitle(): void {
    const next = titleDraft.trim();
    if (next.length === 0 || next === task.title) {
      setTitleDraft(task.title);
      return;
    }
    onChange({ title: next });
  }

  function commitNotes(): void {
    const next = notesDraft;
    const current = task.notes ?? "";
    if (next === current) return;
    onChange({ notes: next.length === 0 ? null : next });
  }

  function onTitleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setTitleDraft(task.title);
      e.currentTarget.blur();
    }
  }

  function addTag(raw: string): void {
    const tag = raw.trim();
    if (tag.length === 0 || task.tags.includes(tag)) return;
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
      if (tagDraft.length > 0) {
        e.stopPropagation();
        setTagDraft("");
      }
    }
  }

  const done = task.doneAt != null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      className="nowheel w-[280px] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
      role="dialog"
      aria-label={`Edit task ${task.title}`}
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Task
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Title */}
      <div className="space-y-1.5 mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Title
        </label>
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={onTitleKeyDown}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onBlur={commitTitle}
          aria-label="Task title"
          className="h-8 text-sm font-medium"
        />
      </div>

      {/* Priority */}
      <div className="space-y-1.5 mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Priority
        </label>
        <div className="flex gap-1">
          {PRIORITIES.map((p) => (
            <Button
              key={p}
              variant={task.priority === p ? "default" : "outline"}
              size="sm"
              className="flex-1 text-xs capitalize"
              onClick={() => {
                if (task.priority !== p) onChange({ priority: p });
              }}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5 mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 cursor-pointer"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {task.tags.length === 0 && (
            <span className="text-xs text-muted-foreground">no tags</span>
          )}
        </div>
        <Input
          placeholder="add tag (Enter)"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={onTagKeyDown}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onBlur={() => addTag(tagDraft)}
          className="h-8 text-xs"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5 mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notes
        </label>
        <Textarea
          placeholder="Plain text — acceptance criteria, a link, why this task exists…"
          value={notesDraft}
          maxLength={NOTES_MAX_CHARS}
          onChange={(e) => setNotesDraft(e.target.value)}
          onKeyDownCapture={(e) => e.stopPropagation()}
          onBlur={commitNotes}
          aria-label="Task notes"
          className="text-xs max-h-[18em]"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground" title={task.id}>
          {formatDate(task.createdAt)}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDelete}>
            Delete
          </Button>
          <Button
            size="sm"
            variant={done ? "secondary" : "default"}
            onClick={() => onChange({ doneAt: done ? null : new Date().toISOString() })}
          >
            {done ? "Undo" : "Done"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
