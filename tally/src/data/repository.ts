import type {
  DeleteListStrategy,
  ExportBundle,
  List,
  NewList,
  NewTask,
  Task,
  TaskFilter,
} from "./types";

/**
 * The one boundary that matters.
 *
 * No component, hook, or store action may reference Dexie, IndexedDB, or
 * localStorage. Everything goes through here. v1 wires this to IndexedDB; v2
 * swaps in a Supabase implementation and not one UI file changes.
 *
 * Get this wrong — let `db.tasks.put` appear inside a React component — and v2
 * is a rewrite instead of a two-week project. There is a lint rule enforcing
 * it so a tired-at-midnight version of us cannot quietly break it.
 */
export interface Repository {
  /** True when writes actually survive a reload. See MemoryRepository. */
  readonly isDurable: boolean;

  // ── Lists ──────────────────────────────────────────────────────────────
  /**
   * Returns the Inbox, creating it on first run. Every task needs a home, and
   * forcing the user to pick a list before they can type would defeat the
   * whole point of the capture field.
   */
  ensureInbox(): Promise<List>;
  getLists(): Promise<List[]>;
  createList(input: NewList): Promise<List>;
  updateList(id: string, patch: Partial<List>): Promise<List>;
  /** Throws if the list is the default Inbox. */
  deleteList(id: string, strategy: DeleteListStrategy): Promise<void>;

  // ── Tasks ──────────────────────────────────────────────────────────────
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  /** Powers the Today view. Open tasks only, ordered by due time. */
  getTasksDueBy(endISO: string): Promise<Task[]>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTask(id: string, newPosition: number): Promise<Task>;
  /** Applies a batch of position changes after a rebalance. */
  applyPositions(updates: { id: string; position: number }[]): Promise<void>;

  // ── Data portability ───────────────────────────────────────────────────
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle, mode: "merge" | "replace"): Promise<void>;
}

/** Thrown when a caller tries to remove the Inbox. Every task needs a home. */
export class InboxProtectedError extends Error {
  constructor() {
    super("The Inbox list cannot be deleted.");
    this.name = "InboxProtectedError";
  }
}

/** Thrown when the browser refuses a write because its storage is full. */
export class StorageFullError extends Error {
  constructor() {
    super("Browser storage is full.");
    this.name = "StorageFullError";
  }
}
