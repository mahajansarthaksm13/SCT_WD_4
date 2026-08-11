"use client";

import { useMemo } from "react";
import type { List, Task } from "@/data";
import { selectSearchResults } from "@/store/selectors";
import { EmptyState } from "../tasks/EmptyState";
import { TaskRow } from "../tasks/TaskRow";

/**
 * Results are grouped by the list they came from, because "where is this
 * task?" is usually the actual question behind a search.
 */
export function SearchView({
  tasks,
  lists,
  query,
}: {
  tasks: Task[];
  lists: List[];
  query: string;
}) {
  const grouped = useMemo(() => {
    const results = selectSearchResults(tasks, query);
    return lists
      .map((list) => ({
        list,
        matches: results.filter((task) => task.listId === list.id),
      }))
      .filter((group) => group.matches.length > 0);
  }, [tasks, lists, query]);

  const total = grouped.reduce((sum, group) => sum + group.matches.length, 0);

  if (total === 0) {
    return (
      <EmptyState headline={`No tasks match "${query}"`}>
        Try a shorter search.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status">
        {total === 1 ? "1 task matches" : `${total} tasks match`} {query}
      </p>

      {grouped.map(({ list, matches }) => (
        <section key={list.id}>
          <h2 className="engraved px-2 pb-1.5 text-label uppercase text-ink-3">
            {list.name}
          </h2>
          <ul className="panel gilded overflow-hidden rounded-lg">
            {matches.map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} query={query} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
