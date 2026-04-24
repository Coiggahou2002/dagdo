import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Priority, Task } from "./types";

interface FocusPanelProps {
  tasks: Task[];
  onDone: (id: string) => void;
  onFocus: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  med: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  low: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function SortableItem({
  task,
  onDone,
  onFocus,
}: {
  task: Task;
  onDone: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md group",
        "hover:bg-accent/50 transition-colors",
        isDragging && "opacity-50 z-50",
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        className="flex-1 text-left min-w-0 cursor-pointer"
        onClick={() => onFocus(task.id)}
      >
        <span className="text-sm leading-snug line-clamp-2">{task.title}</span>
      </button>
      <span
        className={cn(
          "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0",
          PRIORITY_STYLE[task.priority],
        )}
      >
        {task.priority === "med" ? "med" : task.priority}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDone(task.id)}
        aria-label={`Mark "${task.title}" as done`}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function FocusPanel({ tasks, onDone, onFocus, onPriorityChange }: FocusPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    const draggedTask = tasks.find((t) => t.id === draggedId);
    if (!draggedTask || draggedTask.priority === overTask.priority) return;

    onPriorityChange(draggedId, overTask.priority);
  }

  if (tasks.length === 0) {
    return (
      <div className="w-[260px] shrink-0 border-r border-border bg-background flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Focus
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            There's no actionable tasks now. Please check your graph.
          </p>
        </div>
      </div>
    );
  }

  const groups: { priority: Priority; items: Task[] }[] = [];
  let currentPriority: Priority | null = null;
  for (const task of tasks) {
    if (task.priority !== currentPriority) {
      currentPriority = task.priority;
      groups.push({ priority: currentPriority, items: [] });
    }
    groups[groups.length - 1]!.items.push(task);
  }

  return (
    <div className="w-[260px] shrink-0 border-r border-border bg-background flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Focus
        </h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
            {groups.map((group) => (
              <div key={group.priority} className="mb-2">
                <div className="px-2 py-1">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded",
                      PRIORITY_STYLE[group.priority],
                    )}
                  >
                    {group.priority}
                  </span>
                </div>
                {group.items.map((task) => (
                  <SortableItem
                    key={task.id}
                    task={task}
                    onDone={onDone}
                    onFocus={onFocus}
                  />
                ))}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
