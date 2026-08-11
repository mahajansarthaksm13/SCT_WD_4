import { InboxProtectedError, type Repository } from "../repository";
import type {
  DeleteListStrategy,
  ExportBundle,
  List,
  NewList,
  NewTask,
  Task,
  TaskFilter,
} from "../types";
import {
  applyListPatch,
  applyTaskPatch,
  makeInbox,
  makeList,
  makeTask,
  siblingsOf,
} from "./entities";

/**
 * The fallback for browsers that will not give us IndexedDB — private windows,
 * blocked storage, hardened privacy settings.
 *
 * The app stays completely usable; it simply forgets everything when the tab
 * closes. That is a far better outcome than a white screen, and the UI is
 * honest about it: a persistent banner says so and points at export.
 */
export class MemoryRepository implements Repository {
  readonly isDurable = false;

  private lists: List[] = [];
  private tasks: Task[] = [];

  async ensureInbox(): Promise<List> {
    const existing = this.lists.find((l) => l.isDefault);
    if (existing) return existing;

    const inbox = makeInbox();
    this.lists.push(inbox);
    return inbox;
  }

  async getLists(): Promise<List[]> {
    return sortLists(this.lists);
  }

  async createList(input: NewList): Promise<List> {
    const list = makeList(input, this.lists);
    this.lists.push(list);
    return list;
  }

  async updateList(id: string, patch: Partial<List>): Promise<List> {
    const index = this.lists.findIndex((l) => l.id === id);
    if (index === -1) throw new Error(`No list with id ${id}`);

    const next = applyListPatch(this.lists[index]!, patch);
    this.lists[index] = next;
    return next;
  }

  async deleteList(id: string, strategy: DeleteListStrategy): Promise<void> {
    const list = this.lists.find((l) => l.id === id);
    if (!list) return;
    if (list.isDefault) throw new InboxProtectedError();

    if (strategy === "move-to-inbox") {
      const inbox = this.lists.find((l) => l.isDefault);
      if (!inbox) throw new Error("No Inbox list to move tasks into.");

      let next = this.tasks
        .filter((t) => t.listId === inbox.id)
        .reduce((max, t) => Math.max(max, t.position), 0);

      this.tasks = this.tasks.map((task) =>
        task.listId === id
          ? applyTaskPatch(task, { listId: inbox.id, position: (next += 1000) })
          : task,
      );
    } else {
      this.tasks = this.tasks.filter((t) => t.listId !== id);
    }

    this.lists = this.lists.filter((l) => l.id !== id);
  }

  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    return this.tasks.filter((task) => matchesFilter(task, filter));
  }

  async getTasksDueBy(endISO: string): Promise<Task[]> {
    return this.tasks
      .filter((t) => !t.isComplete && t.dueAt !== null && t.dueAt <= endISO)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  }

  async createTask(input: NewTask): Promise<Task> {
    const inbox = await this.ensureInbox();
    const targetId =
      input.listId && this.lists.some((l) => l.id === input.listId)
        ? input.listId
        : inbox.id;

    const task = makeTask(
      { ...input, listId: targetId },
      inbox.id,
      siblingsOf(this.tasks, targetId),
    );
    this.tasks.push(task);
    return task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`No task with id ${id}`);

    const next = applyTaskPatch(this.tasks[index]!, patch);
    this.tasks[index] = next;
    return next;
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }

  async reorderTask(id: string, newPosition: number): Promise<Task> {
    return this.updateTask(id, { position: newPosition });
  }

  async applyPositions(
    updates: { id: string; position: number }[],
  ): Promise<void> {
    for (const update of updates) {
      const index = this.tasks.findIndex((t) => t.id === update.id);
      if (index !== -1) {
        this.tasks[index] = applyTaskPatch(this.tasks[index]!, {
          position: update.position,
        });
      }
    }
  }

  async exportAll(): Promise<ExportBundle> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      lists: sortLists(this.lists),
      tasks: [...this.tasks].sort((a, b) => a.position - b.position),
    };
  }

  async importAll(
    bundle: ExportBundle,
    mode: "merge" | "replace",
  ): Promise<void> {
    if (mode === "replace") {
      this.lists = [];
      this.tasks = [];
    }
    this.lists = upsert(this.lists, bundle.lists);
    this.tasks = upsert(this.tasks, bundle.tasks);
  }
}

function upsert<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()];
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
    if (!`${task.title}\n${task.notes ?? ""}`.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

function sortLists(lists: List[]): List[] {
  return [...lists].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.position - b.position;
  });
}
