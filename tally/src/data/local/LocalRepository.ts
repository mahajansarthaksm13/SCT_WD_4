import {
  InboxProtectedError,
  StorageFullError,
  type Repository,
} from "../repository";
import type {
  DeleteListStrategy,
  ExportBundle,
  List,
  NewList,
  NewTask,
  Task,
  TaskFilter,
} from "../types";
import { TallyDB, db as defaultDb, isQuotaError } from "./db";
import {
  applyListPatch,
  applyTaskPatch,
  makeInbox,
  makeList,
  makeTask,
  siblingsOf,
} from "./entities";

/**
 * The v1 repository: IndexedDB by way of Dexie.
 *
 * IndexedDB rather than localStorage, deliberately. localStorage is
 * synchronous so every write blocks the main thread, stores strings only so
 * every read re-parses the entire dataset, caps out around 5MB, and has no
 * indexes at all. IndexedDB is asynchronous, transactional, indexed, and
 * measured in hundreds of megabytes. Dexie exists to make its API bearable.
 */
export class LocalRepository implements Repository {
  readonly isDurable = true;

  // Written out rather than declared as a constructor parameter property:
  // Node's type stripping runs the tests without a compiler, and that is one
  // of the few TypeScript-only constructs it cannot simply erase.
  private readonly db: TallyDB;

  constructor(db: TallyDB = defaultDb) {
    this.db = db;
  }

  // ── Lists ──────────────────────────────────────────────────────────────

  async getLists(): Promise<List[]> {
    const lists = await this.db.lists.toArray();
    return sortLists(lists);
  }

  /**
   * Creates the Inbox on first run, and only on first run.
   *
   * The read and the write share one read-write transaction, which IndexedDB
   * serialises against other read-write transactions on the same store. That
   * is what stops two tabs opened at the same moment from racing each other
   * into two separate Inboxes.
   */
  async ensureInbox(): Promise<List> {
    return this.write(() =>
      this.db.transaction("rw", this.db.lists, async () => {
        const existing = await this.db.lists.toArray();
        const inbox = existing.find((l) => l.isDefault);
        if (inbox) return inbox;

        const created = makeInbox();
        await this.db.lists.add(created);
        return created;
      }),
    );
  }

  async createList(input: NewList): Promise<List> {
    return this.write(() =>
      this.db.transaction("rw", this.db.lists, async () => {
        const existing = await this.db.lists.toArray();
        const list = makeList(input, existing);
        await this.db.lists.add(list);
        return list;
      }),
    );
  }

  async updateList(id: string, patch: Partial<List>): Promise<List> {
    return this.write(() =>
      this.db.transaction("rw", this.db.lists, async () => {
        const current = await this.db.lists.get(id);
        if (!current) throw new Error(`No list with id ${id}`);

        const next = applyListPatch(current, patch);
        await this.db.lists.put(next);
        return next;
      }),
    );
  }

  /**
   * Removing a list must never silently orphan its tasks. With
   * `move-to-inbox`, every task is reassigned *before* the list row goes — the
   * two steps share a transaction, so there is no window in which a task
   * points at a list that no longer exists.
   */
  async deleteList(id: string, strategy: DeleteListStrategy): Promise<void> {
    await this.write(() =>
      this.db.transaction("rw", this.db.lists, this.db.tasks, async () => {
        const list = await this.db.lists.get(id);
        if (!list) return;
        if (list.isDefault) throw new InboxProtectedError();

        const tasks = await this.db.tasks.where("listId").equals(id).toArray();

        if (strategy === "move-to-inbox") {
          const inbox = (await this.db.lists.toArray()).find((l) => l.isDefault);
          if (!inbox) throw new Error("No Inbox list to move tasks into.");

          const destination = await this.db.tasks
            .where("listId")
            .equals(inbox.id)
            .toArray();

          let next = maxPosition(destination);
          const moved = tasks.map((task) => {
            next += 1000;
            return applyTaskPatch(task, { listId: inbox.id, position: next });
          });
          await this.db.tasks.bulkPut(moved);
        } else {
          await this.db.tasks.bulkDelete(tasks.map((t) => t.id));
        }

        await this.db.lists.delete(id);
      }),
    );
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    const tasks =
      filter?.listId !== undefined
        ? await this.db.tasks.where("listId").equals(filter.listId).toArray()
        : await this.db.tasks.toArray();

    return tasks.filter((task) => matchesFilter(task, filter));
  }

  async getTasksDueBy(endISO: string): Promise<Task[]> {
    const due = await this.db.tasks
      .where("dueAt")
      .belowOrEqual(endISO)
      .toArray();

    // Tasks with a null dueAt never enter the index, so they are already out.
    return due
      .filter((task) => !task.isComplete)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  }

  async createTask(input: NewTask): Promise<Task> {
    return this.write(() =>
      this.db.transaction("rw", this.db.lists, this.db.tasks, async () => {
        const lists = await this.db.lists.toArray();
        const inbox = lists.find((l) => l.isDefault);
        if (!inbox) throw new Error("No Inbox list. The database is not seeded.");

        // A task aimed at a list that has since been deleted lands in Inbox
        // rather than vanishing into a listId nothing points at.
        const targetId =
          input.listId && lists.some((l) => l.id === input.listId)
            ? input.listId
            : inbox.id;

        const existing = await this.db.tasks.toArray();
        const task = makeTask(
          { ...input, listId: targetId },
          inbox.id,
          siblingsOf(existing, targetId),
        );

        await this.db.tasks.add(task);
        return task;
      }),
    );
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    return this.write(() =>
      this.db.transaction("rw", this.db.tasks, async () => {
        const current = await this.db.tasks.get(id);
        if (!current) throw new Error(`No task with id ${id}`);

        const next = applyTaskPatch(current, patch);
        await this.db.tasks.put(next);
        return next;
      }),
    );
  }

  async deleteTask(id: string): Promise<void> {
    await this.write(() => this.db.tasks.delete(id));
  }

  async reorderTask(id: string, newPosition: number): Promise<Task> {
    return this.updateTask(id, { position: newPosition });
  }

  async applyPositions(
    updates: { id: string; position: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;

    await this.write(() =>
      this.db.transaction("rw", this.db.tasks, async () => {
        const rows = await this.db.tasks.bulkGet(updates.map((u) => u.id));
        const next = rows
          .map((row, i) =>
            row ? applyTaskPatch(row, { position: updates[i]!.position }) : null,
          )
          .filter((row): row is Task => row !== null);

        await this.db.tasks.bulkPut(next);
      }),
    );
  }

  // ── Data portability ───────────────────────────────────────────────────

  async exportAll(): Promise<ExportBundle> {
    const [lists, tasks] = await Promise.all([
      this.db.lists.toArray(),
      this.db.tasks.toArray(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: sortLists(lists),
      tasks: tasks.sort((a, b) => a.position - b.position),
    };
  }

  /**
   * The whole import runs inside one transaction, so a failure part-way
   * through changes nothing at all. A half-applied import would be worse than
   * a rejected one.
   */
  async importAll(
    bundle: ExportBundle,
    mode: "merge" | "replace",
  ): Promise<void> {
    await this.write(() =>
      this.db.transaction("rw", this.db.lists, this.db.tasks, async () => {
        if (mode === "replace") {
          await this.db.lists.clear();
          await this.db.tasks.clear();
        }
        await this.db.lists.bulkPut(bundle.lists);
        await this.db.tasks.bulkPut(bundle.tasks);
      }),
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * A full disk is a normal thing that happens, not a crash. Turning it into a
   * typed error lets the UI say something useful and offer an export instead
   * of dying with a DOMException in the console.
   */
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isQuotaError(error)) throw new StorageFullError();
      throw error;
    }
  }
}

function matchesFilter(task: Task, filter?: TaskFilter): boolean {
  if (!filter) return true;
  if (filter.listId !== undefined && task.listId !== filter.listId) return false;
  if (filter.isComplete !== undefined && task.isComplete !== filter.isComplete) {
    return false;
  }
  if (filter.dueBefore !== undefined) {
    if (task.dueAt === null || task.dueAt >= filter.dueBefore) return false;
  }
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    const haystack = `${task.title}\n${task.notes ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** Inbox always sits at the top, whatever its position value says. */
function sortLists(lists: List[]): List[] {
  return [...lists].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.position - b.position;
  });
}

function maxPosition(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.position), 0);
}
