/**
 * The v1 data model. Deliberately flat: no parent/child on Task, no join
 * tables, no self-references. A user has lists; a list has tasks. That is all.
 *
 * The moment tags or subtasks arrive, that stops being true — which is exactly
 * why the PRD defers both.
 */

export type Priority = "none" | "low" | "medium" | "high";

export const PRIORITIES: readonly Priority[] = [
  "none",
  "low",
  "medium",
  "high",
] as const;

/**
 * How often a task comes back.
 *
 * Four frequencies and an off switch. "never" has to be a value rather than an
 * absence: without it a repeat could be set and never cleared.
 *
 * There is no interval and no end date on purpose. "Every 3 weeks until March"
 * is a scheduling language, not a field, and the moment it exists so does the
 * question of what happens when you edit occurrence four of eleven.
 */
export type Repeat = "never" | "daily" | "weekly" | "monthly" | "yearly";

export const REPEATS: readonly Repeat[] = [
  "never",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

export interface List {
  id: string;
  /** 1–40 characters. Duplicates are allowed; people have their reasons. */
  name: string;
  /** True only for Inbox, and only ever on one row. */
  isDefault: boolean;
  /** Sidebar sort order. Fractional — see lib/ordering. */
  position: number;
  /** ISO-8601 UTC. */
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  listId: string;
  /** 1–200 characters. */
  title: string;
  notes: string | null;
  /** ISO-8601 UTC. null means no due date at all. */
  dueAt: string | null;
  /**
   * False means the task is due on a date but at no particular time. Without
   * this flag a date-only task renders as "12:00 AM", which is wrong and looks
   * broken. It can only be true when dueAt is set.
   */
  hasTime: boolean;
  /**
   * Can only be anything other than "never" when `dueAt` is set. A repeat with
   * no due date has no anchor to repeat from, so the invariant is enforced on
   * the way in — the same shape as `hasTime`.
   */
  repeat: Repeat;
  /**
   * The completed occurrence that created this one, for a repeating task.
   *
   * Null for everything else, which is almost everything. It exists so that
   * unticking a repeating task can take back the occurrence that ticking it
   * produced — a link that has to outlive the tab, because "I ticked the wrong
   * row" is frequently noticed after a reload rather than before one.
   *
   * Not a foreign key and never followed for rendering: the row it points at
   * may have been deleted, and a dangling id here is harmless.
   */
  spawnedFrom: string | null;
  priority: Priority;
  isComplete: boolean;
  /** Manual ordering within its list. */
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskFilter {
  listId?: string;
  isComplete?: boolean;
  /** ISO-8601 UTC upper bound on dueAt, exclusive. */
  dueBefore?: string;
  search?: string;
}

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  lists: List[];
  tasks: Task[];
}

export type NewTask = Pick<Task, "title"> &
  Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

export type NewList = Pick<List, "name"> & Partial<Pick<List, "position">>;

/** How a list's tasks are dealt with when the list itself goes away. */
export type DeleteListStrategy = "move-to-inbox" | "delete-tasks";

export const TITLE_MAX = 200;
export const LIST_NAME_MAX = 40;
export const NOTES_MAX = 2000;
