import type { Priority, Task } from "@/data";
import {
  dueSortKey,
  formatCompletedDay,
  isDueByEndOfToday,
  isOverdue,
} from "@/lib/dates";

/**
 * Pure derivations over the task array. No store access, no side effects, so
 * each of these can be reasoned about — and tested — on its own.
 */

const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function selectOpenTasksForList(tasks: Task[], listId: string): Task[] {
  return tasks
    .filter((t) => t.listId === listId && !t.isComplete)
    .sort((a, b) => a.position - b.position);
}

export function selectCompletedTasksForList(
  tasks: Task[],
  listId: string,
): Task[] {
  return tasks
    .filter((t) => t.listId === listId && t.isComplete)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

export function selectOpenCount(tasks: Task[], listId: string): number {
  return tasks.reduce(
    (count, t) => (t.listId === listId && !t.isComplete ? count + 1 : count),
    0,
  );
}

export function selectTodayCount(tasks: Task[], now: Date, tz: string): number {
  return tasks.reduce(
    (count, t) =>
      !t.isComplete && isDueByEndOfToday(t, now, tz) ? count + 1 : count,
    0,
  );
}

/**
 * The Today view: everything still open across *every* list that is due before
 * tonight, split so the late work sits above the work that is merely due.
 *
 * Tasks with no due date never appear here. That is the point — Today answers
 * "what do I do now", and something with no date is not an answer to that.
 */
export function selectTodayTasks(
  tasks: Task[],
  now: Date,
  tz: string,
): { overdue: Task[]; today: Task[] } {
  const due = tasks.filter((t) => !t.isComplete && isDueByEndOfToday(t, now, tz));

  const byTime = (a: Task, b: Task) => {
    const delta = dueSortKey(a, tz) - dueSortKey(b, tz);
    if (delta !== 0) return delta;
    // Same minute: the more urgent flag breaks the tie.
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  };

  return {
    overdue: due.filter((t) => isOverdue(t, now, tz)).sort(byTime),
    today: due.filter((t) => !isOverdue(t, now, tz)).sort(byTime),
  };
}

export function selectCompletedToday(
  tasks: Task[],
  now: Date,
  tz: string,
): Task[] {
  return tasks
    .filter((t) => t.isComplete && isDueByEndOfToday(t, now, tz))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

/** Case-insensitive match across titles and notes, in every list. */
export function selectSearchResults(tasks: Task[], query: string): Task[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  return tasks
    .filter((t) =>
      `${t.title}\n${t.notes ?? ""}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      return a.position - b.position;
    });
}

/**
 * Buckets completed tasks under the day they were finished, preserving the
 * order they arrive in — the caller has already sorted most-recent-first, and
 * re-sorting here would be a second opinion about the same thing.
 *
 * A task with no `completedAt` cannot be placed on a day, so it is left out
 * rather than filed under an invented one. In practice the invariant in
 * `applyTaskPatch` means there are none.
 */
export function groupByCompletedDay(
  tasks: Task[],
  now: Date,
  tz: string,
): { label: string; tasks: Task[] }[] {
  const groups: { label: string; tasks: Task[] }[] = [];

  for (const task of tasks) {
    if (!task.completedAt) continue;
    const label = formatCompletedDay(task.completedAt, now, tz);
    const current = groups[groups.length - 1];

    if (current?.label === label) current.tasks.push(task);
    else groups.push({ label, tasks: [task] });
  }

  return groups;
}

/** Splits a string on a search term so a match can be marked up as real nodes. */
export function splitOnMatch(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [{ text, match: false }];

  const parts: { text: string; match: boolean }[] = [];
  const haystack = text.toLowerCase();
  let cursor = 0;

  for (;;) {
    const at = haystack.indexOf(needle, cursor);
    if (at === -1) break;
    if (at > cursor) parts.push({ text: text.slice(cursor, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    cursor = at + needle.length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
