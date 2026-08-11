"use client";

import { useMemo } from "react";
import type { List, Task } from "@/data";
import { getUserTimezone } from "@/lib/dates";
import { useNow } from "@/lib/useNow";
import { selectCompletedToday, selectTodayTasks } from "@/store/selectors";
import { EmptyState, EMPTY_STATES } from "../tasks/EmptyState";
import { SplitPane } from "../tasks/TaskList";
import { TaskRow } from "../tasks/TaskRow";

/**
 * The app's answer to "what do I do now", and the single highest-leverage
 * screen in it.
 *
 * Everything still open across *every* list that is due before tonight, with
 * the late work pulled out and put on top. Tasks with no due date never appear
 * — something undated is not an answer to the question this view asks.
 *
 * It recomputes off the shared clock, so a tab left open past midnight rolls
 * over on its own rather than sitting on yesterday until someone refreshes.
 */
export function TodayView({ tasks, lists }: { tasks: Task[]; lists: List[] }) {
  const tz = getUserTimezone();
  const now = useNow();

  const { overdue, today } = useMemo(
    () => selectTodayTasks(tasks, now, tz),
    [tasks, now, tz],
  );
  const completed = useMemo(
    () => selectCompletedToday(tasks, now, tz),
    [tasks, now, tz],
  );

  if (overdue.length === 0 && today.length === 0 && completed.length === 0) {
    return (
      <EmptyState headline={EMPTY_STATES.todayClear.headline}>
        {EMPTY_STATES.todayClear.body}
      </EmptyState>
    );
  }

  return (
    <SplitPane completed={completed} lists={lists}>
      <div className="space-y-6">
        {overdue.length > 0 ? (
          <section aria-labelledby="overdue-heading">
            <h2
              id="overdue-heading"
              className="engraved px-2 pb-1.5 text-label uppercase text-overdue"
            >
              Overdue
              <span className="sr-only">
                , {overdue.length === 1 ? "1 task" : `${overdue.length} tasks`}
              </span>
            </h2>
            <ul className="panel gilded overflow-hidden rounded-lg">
              {overdue.map((task) => (
                <TaskRow key={task.id} task={task} lists={lists} />
              ))}
            </ul>
          </section>
        ) : null}

        {today.length > 0 ? (
          <section aria-labelledby="today-heading">
            <h2
              id="today-heading"
              className="engraved px-2 pb-1.5 text-label uppercase text-ink-3"
            >
              Due today
            </h2>
            <ul className="panel gilded overflow-hidden rounded-lg">
              {today.map((task) => (
                <TaskRow key={task.id} task={task} lists={lists} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </SplitPane>
  );
}
