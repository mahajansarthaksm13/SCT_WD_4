"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { List, Task } from "@/data";
import { useTaskStore } from "@/store/useTaskStore";
import { DragHandle, TaskRow } from "./TaskRow";

/**
 * Drag-to-reorder, kept in its own module so the drag library is not part of
 * the JavaScript the page needs before someone can type their first task.
 * `TaskList` loads this after hydration and shows a plain, fully working list
 * in the meantime.
 *
 * Dragging is never the only way to reorder. "Move up" and "Move down" live in
 * every row's menu, on Alt+↑ and Alt+↓ — a drag-only implementation would shut
 * out anyone not using a mouse.
 */
export default function SortableTaskList({
  tasks,
  lists,
  query,
}: {
  tasks: Task[];
  lists: List[];
  query?: string;
}) {
  const reorderTask = useTaskStore((s) => s.reorderTask);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so a click on the handle is
    // still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over || active.id === over.id) return;

    const from = tasks.findIndex((t) => t.id === active.id);
    const to = tasks.findIndex((t) => t.id === over.id);
    if (from === -1 || to === -1) return;

    void reorderTask(String(active.id), from, to, tasks);
  }

  function moveBy(taskId: string, direction: -1 | 1) {
    const from = tasks.findIndex((t) => t.id === taskId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= tasks.length) return;
    void reorderTask(taskId, from, to, tasks);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={(e) => setDraggingId(String(e.active.id))}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="panel gilded overflow-hidden rounded-lg">
          {tasks.map((task, index) => (
            <SortableRow
              key={task.id}
              task={task}
              lists={lists}
              query={query}
              isDragging={draggingId === task.id}
              onMove={(direction) => moveBy(task.id, direction)}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  task,
  lists,
  query,
  isDragging,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  task: Task;
  lists: List[];
  query?: string;
  isDragging: boolean;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  // The sortable node is the `<li>` itself. Wrapping it in a positioned div
  // would put a non-`<li>` child inside a `<ul>`, and the accessibility tree
  // drops the whole list structure when that happens.
  return (
    <TaskRow
      task={task}
      lists={lists}
      query={query}
      isDragging={isDragging}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      dragHandle={<DragHandle {...attributes} {...listeners} />}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative", zIndex: 10 } : {}),
      }}
    />
  );
}
