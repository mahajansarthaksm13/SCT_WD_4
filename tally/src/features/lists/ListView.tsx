"use client";

import { useMemo } from "react";
import type { List, Task } from "@/data";
import {
  selectCompletedTasksForList,
  selectOpenTasksForList,
} from "@/store/selectors";
import { EmptyState, EMPTY_STATES } from "../tasks/EmptyState";
import { TaskList } from "../tasks/TaskList";

export function ListView({
  list,
  tasks,
  lists,
  isFirstRun,
}: {
  list: List;
  tasks: Task[];
  lists: List[];
  /** The very first visit, before a single task has ever existed. */
  isFirstRun: boolean;
}) {
  const open = useMemo(
    () => selectOpenTasksForList(tasks, list.id),
    [tasks, list.id],
  );
  const completed = useMemo(
    () => selectCompletedTasksForList(tasks, list.id),
    [tasks, list.id],
  );

  const empty = isFirstRun ? EMPTY_STATES.firstRun : EMPTY_STATES.emptyList;

  return (
    <TaskList
      tasks={open}
      completed={completed}
      lists={lists}
      reorderable
      emptyState={
        <EmptyState headline={empty.headline}>{empty.body}</EmptyState>
      }
    />
  );
}
