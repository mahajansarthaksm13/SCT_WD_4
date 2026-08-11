"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { List, Task } from "@/data";
import { cn } from "@/lib/cn";
import { getUserTimezone } from "@/lib/dates";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useNow } from "@/lib/useNow";
import { groupByCompletedDay } from "@/store/selectors";
import { useTaskStore } from "@/store/useTaskStore";
import SortableTaskList from "./SortableTaskList";
import { TaskRow } from "./TaskRow";

/**
 * A list of open tasks, with the completed ones folded away underneath.
 *
 * Rendered as a real `<ul>` of `<li>`s so a screen reader announces "list,
 * seven items" rather than reading out a wall of divs.
 */

/**
 * How many rows are rendered before the rest are held back.
 *
 * Measured, five thousand rows take about ten seconds to appear — and the cost
 * is React reconciling five thousand components, not the browser laying them
 * out, so `content-visibility` does not touch it (it also drops every offscreen
 * row out of the accessibility tree, which is a poor trade).
 *
 * A cap is the cheap fix. Two hundred rows is far more than fits on any screen,
 * every row stays a real DOM node so find-in-page and screen readers still
 * work, and the count below says plainly what is being held back. Search and
 * the sidebar totals always run over the whole set, never the visible slice.
 */
const PAGE_SIZE = 200;

/*
 * The drag list used to be lazy-loaded to keep about fifteen kilobytes off the
 * critical path. It is imported directly now: the swap from the plain list to
 * the sortable one, once the chunk arrived, was leaving the list empty, and no
 * amount of saved bandwidth is worth a screen of tasks disappearing. If the
 * bundle needs trimming, trim it somewhere that cannot take the content away.
 */

interface TaskListProps {
  tasks: Task[];
  completed: Task[];
  lists: List[];
  /** Reordering is off in views that impose their own order, like Today. */
  reorderable?: boolean;
  query?: string;
  emptyState?: React.ReactNode;
}

export function TaskList({
  tasks,
  completed,
  lists,
  reorderable = false,
  query,
  emptyState,
}: TaskListProps) {
  const reorderTask = useTaskStore((s) => s.reorderTask);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // A different list is a different page of rows.
  const listKey = tasks[0]?.listId ?? "";
  const lastKey = useRef(listKey);
  if (lastKey.current !== listKey) {
    lastKey.current = listKey;
    if (visible !== PAGE_SIZE) setVisible(PAGE_SIZE);
  }

  function moveBy(taskId: string, direction: -1 | 1) {
    const from = tasks.findIndex((t) => t.id === taskId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= tasks.length) return;
    void reorderTask(taskId, from, to, tasks);
  }

  if (tasks.length === 0 && completed.length === 0) {
    return <>{emptyState}</>;
  }

  const shown = tasks.slice(0, visible);
  const remaining = tasks.length - shown.length;

  const plainList = (
    <ul className="panel gilded overflow-hidden rounded-lg">
      {shown.map((task, index) => (
        <TaskRow
          key={task.id}
          task={task}
          lists={lists}
          query={query}
          onMove={reorderable ? (direction) => moveBy(task.id, direction) : undefined}
          canMoveUp={index > 0}
          canMoveDown={index < tasks.length - 1}
        />
      ))}
    </ul>
  );

  return (
    <SplitPane completed={completed} lists={lists} query={query}>
      {tasks.length > 0 ? (
        reorderable ? (
          <SortableTaskList tasks={shown} lists={lists} query={query} />
        ) : (
          plainList
        )
      ) : null}

      {remaining > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-4 px-2">
          <p className="text-meta text-ink-3">
            Showing {shown.length} of {tasks.length}.
          </p>
          <button
            type="button"
            onClick={() => setVisible((n) => n + PAGE_SIZE)}
            className={cn(
              "raised rounded-md border border-rule-strong px-3 py-1.5",
              "text-meta text-ink transition-[border-color,transform] duration-[140ms]",
              "hover:border-gilt active:translate-y-px",
            )}
          >
            Show {Math.min(remaining, PAGE_SIZE)} more
          </button>
        </div>
      ) : null}
    </SplitPane>
  );
}

/** The width at which a second column stops squeezing the first. */
const SPLIT_QUERY = "(min-width: 1280px)";

/**
 * Open work on the left, finished work on the right.
 *
 * Below 1280px the columns would fight: the open list needs about 560px before
 * a two-line title starts wrapping badly, and 300px is the least a record
 * column can be and still read as one. Under that the completed work goes back
 * to being a fold-down beneath the list, which is where it has always been and
 * works at every width down to 360px.
 *
 * The choice is made in JavaScript rather than CSS because the two layouts are
 * structurally different — a disclosure has an `aria-expanded` button and a
 * column does not. Rendering both and hiding one with a media query would put
 * every completed task in the accessibility tree twice.
 */
export function SplitPane({
  children,
  completed,
  lists,
  query,
}: {
  children: ReactNode;
  completed: Task[];
  lists: List[];
  query?: string;
}) {
  const isSplit = useMediaQuery(SPLIT_QUERY);
  const split = isSplit && completed.length > 0;

  return (
    <div
      className={cn(
        split && "grid grid-cols-[minmax(0,1fr)_300px] items-start gap-8",
      )}
    >
      <div className="min-w-0">{children}</div>

      {completed.length === 0 ? null : split ? (
        <CompletedColumn tasks={completed} lists={lists} query={query} />
      ) : (
        <CompletedDisclosure tasks={completed} lists={lists} query={query} />
      )}
    </div>
  );
}

/**
 * The persistent record, grouped by the day the work was actually finished.
 *
 * It scrolls inside itself rather than growing the page: a fortnight of
 * completed work would otherwise push the open list into a column three
 * screens tall with nothing in it.
 */
function CompletedColumn({
  tasks,
  lists,
  query,
}: {
  tasks: Task[];
  lists: List[];
  query?: string;
}) {
  const tz = getUserTimezone();
  const now = useNow();
  const groups = useMemo(
    () => groupByCompletedDay(tasks, now, tz),
    [tasks, now, tz],
  );

  return (
    <section aria-labelledby="completed-heading" className="max-h-[70vh] overflow-y-auto">
      <h2
        id="completed-heading"
        className="engraved px-2 pb-1.5 text-label uppercase text-ink-3"
      >
        Completed
        <span className="sr-only">
          , {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
        </span>
      </h2>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="px-2 pb-1 text-meta text-ink-3">{group.label}</h3>
            <ul className="panel gilded overflow-hidden rounded-lg">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lists={lists}
                  query={query}
                  compact
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Completed work does not vanish. It collapses down here, where it reads as a
 * record of what got done rather than as something that was thrown away.
 */
function CompletedDisclosure({
  tasks,
  lists,
  query,
}: {
  tasks: Task[];
  lists: List[];
  query?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-label uppercase lg:min-h-0",
          "text-ink-3 transition-colors duration-[120ms] hover:text-ink-2",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block transition-transform duration-[140ms]",
            open ? "rotate-90" : "rotate-0",
          )}
        >
          ›
        </span>
        Completed
        <span className="font-mono tabular">{tasks.length}</span>
      </button>

      {open ? (
        <ul className="panel gilded overflow-hidden rounded-lg">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} lists={lists} query={query} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
