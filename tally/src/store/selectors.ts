import type { Priority, Task } from "@/data";
import {
  dayKeyOf,
  dueSortKey,
  effectiveDueAt,
  formatCompletedDay,
  isDueByEndOfToday,
  isOverdue,
  shiftDayKey,
  todayInputValue,
  weekdayIndex,
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

// ── The activity grid ────────────────────────────────────────────────────

export interface DayActivity {
  /** `YYYY-MM-DD`, local. Sorts lexicographically. */
  key: string;
  /** Finished on this day, whenever it happened to be due. */
  completed: Task[];
  /**
   * Due on this day and not done by the end of it — still open now, or
   * finished on some later day.
   */
  outstanding: Task[];
}

/**
 * A year of days, ready to draw as a grid.
 *
 * The two counts answer different questions and are deliberately not two
 * halves of one number:
 *
 *   **completed** is bucketed by `completedAt` — the day the work actually
 *   got done, which is frequently not the day it was meant to.
 *
 *   **outstanding** is bucketed by the due date, and asks what that day still
 *   owed when it ended. A task due Monday and finished Thursday is
 *   outstanding on Monday *and* completed on Thursday. Counting it as neither,
 *   or as both on the same square, would make the wall lie in opposite
 *   directions.
 *
 * Days run from the Monday on or before the start of the window to today. The
 * future is not drawn: a square for a day that has not happened invites the
 * reading that nothing was done on it.
 */
export function selectActivity(
  tasks: Task[],
  now: Date,
  tz: string,
  weeks = 53,
): DayActivity[] {
  const today = todayInputValue(now, tz);

  // Walk back the full window, then back again to that week's Monday, so every
  // column is a whole week and the weekday rows line up down the grid.
  const windowStart = shiftDayKey(today, -(weeks * 7 - 1));
  const start = shiftDayKey(windowStart, -weekdayIndex(windowStart));

  const completedBy = new Map<string, Task[]>();
  const outstandingBy = new Map<string, Task[]>();
  const push = (map: Map<string, Task[]>, key: string, task: Task) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  };

  for (const task of tasks) {
    if (task.isComplete && task.completedAt) {
      push(completedBy, dayKeyOf(task.completedAt, tz), task);
    }

    const due = effectiveDueAt(task, tz);
    if (!due) continue;

    const dueKey = dayKeyOf(due, tz);
    const settledKey =
      task.isComplete && task.completedAt ? dayKeyOf(task.completedAt, tz) : null;

    // Not done by the end of its own day: either still open, or finished later.
    if (settledKey === null || settledKey > dueKey) {
      push(outstandingBy, dueKey, task);
    }
  }

  const days: DayActivity[] = [];
  for (let key = start; key <= today; key = shiftDayKey(key, 1)) {
    days.push({
      key,
      completed: completedBy.get(key) ?? [],
      outstanding: outstandingBy.get(key) ?? [],
    });
  }

  return days;
}

/**
 * Which of five shades a day is drawn in.
 *
 * Scaled against the busiest day in the window rather than against a fixed
 * count, so the wall reads the same for someone finishing three things a week
 * and someone finishing thirty. Any activity at all is at least level 1 — a
 * day you did something on must never look like a day you did not.
 */
export function activityLevel(count: number, busiest: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (busiest <= 1) return 4;

  const share = count / busiest;
  if (share <= 0.25) return 1;
  if (share <= 0.5) return 2;
  if (share <= 0.75) return 3;
  return 4;
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
