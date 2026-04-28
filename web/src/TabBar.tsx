import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tab } from "./types";

const DEFAULT_TAB_ID = "__default__";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export { DEFAULT_TAB_ID };

export function TabBar({ tabs, activeTabId, onSelect, onCreate, onRename, onDelete }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditDraft(currentName);
  }

  function commitRename(id: string) {
    const name = editDraft.trim();
    if (name.length > 0 && name !== getTabName(id)) {
      onRename(id, name);
    }
    setEditingId(null);
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  }

  function getTabName(id: string): string {
    if (id === DEFAULT_TAB_ID) return "All";
    return tabs.find((t) => t.id === id)?.name ?? "Tab";
  }

  function handleCreate() {
    const name = `Tab ${tabs.length + 1}`;
    onCreate(name);
  }

  return (
    <div className="flex items-center gap-0.5 px-4 py-1 border-b border-border bg-background shrink-0 overflow-x-auto">
      {/* Default tab */}
      <TabItem
        id={DEFAULT_TAB_ID}
        name="All"
        active={activeTabId === DEFAULT_TAB_ID}
        editing={editingId === DEFAULT_TAB_ID}
        editDraft={editDraft}
        inputRef={editingId === DEFAULT_TAB_ID ? inputRef : undefined}
        onSelect={() => onSelect(DEFAULT_TAB_ID)}
        onDoubleClick={() => {}}
        onEditChange={setEditDraft}
        onEditKeyDown={(e) => onEditKeyDown(e, DEFAULT_TAB_ID)}
        onEditBlur={() => setEditingId(null)}
        closable={false}
      />

      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          id={tab.id}
          name={tab.name}
          active={activeTabId === tab.id}
          editing={editingId === tab.id}
          editDraft={editDraft}
          inputRef={editingId === tab.id ? inputRef : undefined}
          onSelect={() => onSelect(tab.id)}
          onDoubleClick={() => startRename(tab.id, tab.name)}
          onEditChange={setEditDraft}
          onEditKeyDown={(e) => onEditKeyDown(e, tab.id)}
          onEditBlur={() => commitRename(tab.id)}
          closable
          onClose={() => onDelete(tab.id)}
        />
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 ml-1"
        onClick={handleCreate}
        aria-label="New tab"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface TabItemProps {
  id: string;
  name: string;
  active: boolean;
  editing: boolean;
  editDraft: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onSelect: () => void;
  onDoubleClick: () => void;
  onEditChange: (v: string) => void;
  onEditKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onEditBlur: () => void;
  closable: boolean;
  onClose?: () => void;
}

function TabItem({
  name,
  active,
  editing,
  editDraft,
  inputRef,
  onSelect,
  onDoubleClick,
  onEditChange,
  onEditKeyDown,
  onEditBlur,
  closable,
  onClose,
}: TabItemProps) {
  return (
    <button
      className={`
        group relative flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md
        transition-colors select-none cursor-pointer
        ${active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }
      `}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={editDraft}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={onEditKeyDown}
          onBlur={onEditBlur}
          className="bg-transparent border-none outline-none text-xs font-medium w-16 min-w-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate max-w-[120px]">{name}</span>
      )}
      {closable && !editing && (
        <span
          role="button"
          tabIndex={-1}
          className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-foreground/10 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          aria-label={`Close tab ${name}`}
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
