"use client";

import { create } from "zustand";
import { announce } from "@/lib/announcer";
import {
  getRepository,
  InboxProtectedError,
  StorageFullError,
  type DeleteListStrategy,
  type ExportBundle,
  type List,
  type NewTask,
  type Repository,
  type Task,
} from "@/data";
import {
  formatDueSummary,
  getUserTimezone,
  isOverdue,
  nextOccurrence,
} from "@/lib/dates";
import { needsRebalance, positionBetween, rebalance } from "@/lib/ordering";
import { announceChange } from "@/lib/tabSync";
import { flag, track } from "@/lib/analytics";

/**
 * Every mutating action writes to this store first and persists afterwards.
 * The user never waits on IndexedDB — and in v2, never waits on the network.
 * If the write fails, the optimistic change is rolled back and `error` is set.
 */

export const UNDO_WINDOW_MS = 5000;

interface PendingDelete {
  task: Task;
  timer: ReturnType<typeof setTimeout>;
}

interface TaskState {
  tasks: Task[];
  lists: List[];
  inboxId: string | null;

  status: "idle" | "loading" | "ready" | "failed";
  /** False when storage is unavailable and nothing will survive the tab. */
  durable: boolean;
  error: string | null;

  /** The task currently sitting behind an undo toast, if any. */
  pendingDelete: { task: Task } | null;

  loadAll: () => Promise<void>;
  /** Re-reads from storage after another tab wrote. Never shows a spinner. */
  refresh: () => Promise<void>;
  clearError: () => void;

  addTask: (input: NewTask) => Promise<Task | null>;
  editTask: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  moveTask: (id: string, listId: string) => Promise<void>;
  reorderTask: (id: string, fromIndex: number, toIndex: number, scope: Task[]) => Promise<void>;

  removeTask: (id: string) => void;
  undoRemove: () => void;
  /** Commits any deletion still waiting behind a toast. Called on tab close. */
  flushPendingDelete: () => void;

  addList: (name: string) => Promise<List | null>;
  renameList: (id: string, name: string) => Promise<void>;
  removeList: (id: string, strategy: DeleteListStrategy) => Promise<void>;

  exportAll: () => Promise<ExportBundle | null>;
  importAll: (bundle: ExportBundle, mode: "merge" | "replace") => Promise<void>;
}

/** Kept outside the store: not state, and never needs to trigger a render. */
let pending: PendingDelete | null = null;

/**
 * The occurrence that unticking `sourceId` should take back out with it, or
 * null when there is nothing to withdraw.
 *
 * Three conditions, and every one of them is a way this could destroy work
 * that was not ours to destroy:
 *
 *   • still open — a completed occurrence is a record in its own right
 *   • not itself a parent — if it has already spawned the one after it, the
 *     series has moved on and pulling this link out would orphan the rest
 *
 * The third condition — that nobody has edited it — is not checked here. It is
 * enforced in `applyTaskPatch`, which clears `spawnedFrom` on any patch that
 * is not a completion, so an edited occurrence simply stops matching.
 *
 * Fail any of them and unticking just un-completes the row, which is what it
 * did before repeats existed and is never wrong.
 */
function withdrawableOccurrence(tasks: Task[], sourceId: string): Task | null {
  const spawned = tasks.find((t) => t.spawnedFrom === sourceId);
  if (!spawned) return null;
  if (spawned.isComplete) return null;
  if (tasks.some((t) => t.spawnedFrom === spawned.id)) return null;
  return spawned;
}

async function repo(): Promise<Repository> {
  return (await getRepository()).repository;
}

/**
 * Every write goes through here rather than calling the repository directly.
 *
 * The point is the announcement afterwards: a second open tab is holding the
 * same data in memory and has no way of knowing this one just changed it. One
 * shared helper means a mutation added later cannot forget to say so — which
 * is exactly how this class of bug gets reintroduced.
 */
async function write<T>(operation: (r: Repository) => Promise<T>): Promise<T> {
  const result = await operation(await repo());
  announceChange();
  return result;
}

function describe(error: unknown): string {
  if (error instanceof StorageFullError) {
    return "Your browser's storage is full. Export your tasks to keep them safe, then remove some completed items.";
  }
  if (error instanceof InboxProtectedError) {
    return "Inbox can't be deleted — it's where tasks go when they have nowhere else.";
  }
  return "Something went wrong saving that change. Your tasks are still here.";
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  lists: [],
  inboxId: null,
  status: "idle",
  durable: true,
  error: null,
  pendingDelete: null,

  clearError: () => set({ error: null }),

  async loadAll() {
    set({ status: "loading" });
    try {
      const handle = await getRepository();
      const inbox = await handle.repository.ensureInbox();
      const [lists, tasks] = await Promise.all([
        handle.repository.getLists(),
        handle.repository.getTasks(),
      ]);

      set({
        lists,
        tasks,
        inboxId: inbox.id,
        durable: handle.durable,
        status: "ready",
      });
    } catch {
      set({
        status: "failed",
        error:
          "Something went wrong loading your tasks. Reloading the page usually clears it.",
      });
    }
  },

  /**
   * The quiet half of `loadAll`. Another tab has written, so this one re-reads
   * the database — but without touching `status`, because flashing "Opening
   * your tasks…" over a list that is already on screen would be worse than the
   * staleness it is fixing.
   *
   * A deletion still waiting behind its undo toast is left alone: it has not
   * been committed yet, and the other tab has not seen it.
   */
  async refresh() {
    if (get().status !== "ready") return;

    try {
      const repository = await repo();
      const [lists, tasks] = await Promise.all([
        repository.getLists(),
        repository.getTasks(),
      ]);

      const held = get().pendingDelete?.task.id;
      set({ lists, tasks: held ? tasks.filter((t) => t.id !== held) : tasks });
    } catch {
      // A failed refresh leaves what is on screen. It is stale, not wrong.
    }
  },

  // ── Tasks ──────────────────────────────────────────────────────────────

  async addTask(input) {
    try {
      const created = await write((r) => r.createTask(input));
      set((s) => ({ tasks: [...s.tasks, created], error: null }));

      track({
        name: "task_created",
        props: {
          has_due_date: flag(created.dueAt !== null),
          has_time: flag(created.hasTime),
          // The kind of list, never which one. See lib/analytics.
          list_type: created.listId === get().inboxId ? "inbox" : "custom",
        },
      });
      return created;
    } catch (error) {
      set({ error: describe(error) });
      return null;
    }
  },

  async editTask(id, patch) {
    const before = get().tasks;
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

    try {
      const saved = await write((r) => r.updateTask(id, patch));
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? saved : t)),
        error: null,
      }));
    } catch (error) {
      set({ tasks: before, error: describe(error) });
    }
  },

  /**
   * Ticking a repeating task does two things: the occurrence you ticked is
   * completed and keeps its own due date, and the next one is created open.
   *
   * The completed row is never rewritten — its title, notes and date are the
   * record of what was actually done, and a series that edits its own history
   * every week is a series you cannot audit. The next occurrence is a new task
   * that happens to carry the same content forward.
   */
  async toggleComplete(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const isComplete = !task.isComplete;
    const tz = getUserTimezone();

    if (!isComplete) {
      // Unticking the row that spawned an occurrence takes that occurrence back
      // out with it, so one wrong click is one undo rather than two. The link
      // is stored on the task, so this still works after a reload — which is
      // when people usually notice they ticked the wrong row.
      const spawned = withdrawableOccurrence(get().tasks, id);

      announce(`Moved back to your list: ${task.title}`);
      await get().editTask(id, { isComplete });

      if (spawned) {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== spawned.id) }));
        try {
          await write((r) => r.deleteTask(spawned.id));
        } catch (error) {
          set({ error: describe(error) });
        }
      }
      return;
    }

    track({
      name: "task_completed",
      props: {
        was_overdue: flag(isOverdue(task, new Date(), tz)),
        repeats: flag(task.repeat !== "never"),
      },
    });

    await get().editTask(id, { isComplete });

    const nextDueAt = nextOccurrence(task, tz);
    if (nextDueAt === null) {
      announce(`Completed: ${task.title}`);
      return;
    }

    const created = await get().addTask({
      title: task.title,
      notes: task.notes,
      listId: task.listId,
      dueAt: nextDueAt,
      hasTime: task.hasTime,
      repeat: task.repeat,
      priority: task.priority,
      spawnedFrom: id,
    });

    announce(
      created
        ? `Completed: ${task.title}. Next one is due ${formatDueSummary(created, tz)}.`
        : `Completed: ${task.title}`,
    );
  },

  async moveTask(id, listId) {
    const destination = get().tasks.filter((t) => t.listId === listId);
    const position =
      destination.reduce((max, t) => Math.max(max, t.position), 0) + 1000;
    await get().editTask(id, { listId, position });
  },

  /**
   * Reordering is a single-row update: the moved task takes the midpoint of
   * its two new neighbours. Only when that gap has collapsed below what a
   * double can represent does the whole list get renumbered — which in
   * practice happens approximately never, but silently scrambles the order if
   * you do not check for it.
   */
  async reorderTask(id, fromIndex, toIndex, scope) {
    if (fromIndex === toIndex) return;

    const without = scope.filter((_, i) => i !== fromIndex);
    const before = without[toIndex - 1];
    const after = without[toIndex];

    if (before && after && needsRebalance(before.position, after.position)) {
      const reordered = [...without];
      reordered.splice(toIndex, 0, scope[fromIndex]!);
      const updates = rebalance(reordered);

      const previous = get().tasks;
      const byId = new Map(updates.map((u) => [u.id, u.position]));
      set((s) => ({
        tasks: s.tasks.map((t) =>
          byId.has(t.id) ? { ...t, position: byId.get(t.id)! } : t,
        ),
      }));

      try {
        await write((r) => r.applyPositions(updates));
      } catch (error) {
        set({ tasks: previous, error: describe(error) });
      }
      return;
    }

    await get().editTask(id, {
      position: positionBetween(before?.position, after?.position),
    });
  },

  /**
   * Deletion is optimistic and reversible. The row leaves the screen at once —
   * no confirmation dialog, because a dialog punishes the ninety-nine per cent
   * of deletions that were intended in order to protect the one per cent that
   * were not. The repository write is held back until the undo toast expires.
   */
  removeTask(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    // Only ever one toast. A second delete commits the first immediately.
    get().flushPendingDelete();

    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      pendingDelete: { task },
    }));
    announce(`Deleted: ${task.title}. Undo is available for five seconds.`);

    const timer = setTimeout(() => {
      pending = null;
      set({ pendingDelete: null });
      track({ name: "task_deleted", props: { was_undone: "false" } });
      void (async () => {
        try {
          await write((r) => r.deleteTask(id));
        } catch (error) {
          set({ error: describe(error) });
        }
      })();
    }, UNDO_WINDOW_MS);

    pending = { task, timer };
  },

  undoRemove() {
    if (!pending) return;
    clearTimeout(pending.timer);

    const restored = pending.task;
    pending = null;
    // It never left the database, so putting it back in the list is enough,
    // and it lands back at exactly the position it had.
    set((s) => ({ tasks: [...s.tasks, restored], pendingDelete: null }));
    track({ name: "task_deleted", props: { was_undone: "true" } });
    announce(`Restored: ${restored.title}`);
  },

  flushPendingDelete() {
    if (!pending) return;
    clearTimeout(pending.timer);

    const { task } = pending;
    pending = null;
    set({ pendingDelete: null });

    void (async () => {
      try {
        await write((r) => r.deleteTask(task.id));
      } catch {
        // The tab is usually closing at this point; there is nobody to tell.
      }
    })();
  },

  // ── Lists ──────────────────────────────────────────────────────────────

  async addList(name) {
    try {
      const created = await write((r) => r.createList({ name }));
      set((s) => ({ lists: [...s.lists, created], error: null }));
      track({ name: "list_created" });
      return created;
    } catch (error) {
      set({ error: describe(error) });
      return null;
    }
  },

  async renameList(id, name) {
    const before = get().lists;
    set((s) => ({
      lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)),
    }));

    try {
      const saved = await write((r) => r.updateList(id, { name }));
      set((s) => ({
        lists: s.lists.map((l) => (l.id === id ? saved : l)),
        error: null,
      }));
    } catch (error) {
      set({ lists: before, error: describe(error) });
    }
  },

  async removeList(id, strategy) {
    const previousLists = get().lists;
    const previousTasks = get().tasks;
    const inboxId = get().inboxId;

    // Mirror what the repository is about to do, so the sidebar count and the
    // task list settle in the same frame the dialog closes.
    set((s) => ({
      lists: s.lists.filter((l) => l.id !== id),
      tasks:
        strategy === "delete-tasks"
          ? s.tasks.filter((t) => t.listId !== id)
          : s.tasks.map((t) =>
              t.listId === id && inboxId ? { ...t, listId: inboxId } : t,
            ),
    }));

    try {
      await write((r) => r.deleteList(id, strategy));
      // Re-read positions, which the move recalculated.
      set({ tasks: await (await repo()).getTasks(), error: null });
    } catch (error) {
      set({ lists: previousLists, tasks: previousTasks, error: describe(error) });
    }
  },

  // ── Portability ────────────────────────────────────────────────────────

  async exportAll() {
    try {
      return await (await repo()).exportAll();
    } catch (error) {
      set({ error: describe(error) });
      return null;
    }
  },

  async importAll(bundle, mode) {
    try {
      await write((r) => r.importAll(bundle, mode));
      await get().loadAll();
    } catch (error) {
      set({ error: describe(error) });
    }
  },
}));
