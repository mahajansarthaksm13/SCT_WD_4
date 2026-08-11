import Dexie, { type Table } from "dexie";
import type { List, Task } from "../types";

const DB_NAME = process.env.NEXT_PUBLIC_DB_NAME || "tally";

export class TallyDB extends Dexie {
  tasks!: Table<Task, string>;
  lists!: Table<List, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    /**
     * Indexed fields are the ones we filter or sort by.
     *
     * Note what is *not* indexed: `isComplete`. IndexedDB keys may only be
     * numbers, strings, Dates, ArrayBuffers or Arrays — a boolean is not a
     * valid key, so any index containing one silently skips every row rather
     * than failing loudly. Rows would simply go missing from query results,
     * which looks exactly like data loss.
     *
     * Completion is therefore filtered in memory after an indexed `listId`
     * lookup. At the scale this app is built for — the PRD's own worst case is
     * five thousand tasks — that is a sub-millisecond pass over an array.
     */
    this.version(1).stores({
      lists: "id, position, name",
      tasks: "id, listId, dueAt, position",
    });

    /**
     * `repeat` arrives in v2. It is not indexed — nothing queries by it — so
     * the store definitions are unchanged and this version exists purely for
     * the upgrade.
     *
     * The backfill is the point. Dexie hands back exactly what was stored, so
     * without it every task written before this release would come back with
     * `repeat: undefined` while the type says otherwise, and the defaulting
     * would have to be repeated at every read site until one of them forgot.
     * One pass, once, at the boundary where the data actually changes shape.
     */
    this.version(2)
      .stores({
        lists: "id, position, name",
        tasks: "id, listId, dueAt, position",
      })
      .upgrade((tx) =>
        tx
          .table<Task>("tasks")
          .toCollection()
          .modify((task) => {
            task.repeat ??= "never";
          }),
      );

    /**
     * `spawnedFrom` arrives in v3, and is deliberately not indexed either.
     *
     * The only lookup is "which open task did this completed one create", and
     * the store already holds every task in memory — a filter over an array
     * that tops out at five thousand entries is cheaper than the index write
     * on every single task created, almost none of which have a value here.
     */
    this.version(3)
      .stores({
        lists: "id, position, name",
        tasks: "id, listId, dueAt, position",
      })
      .upgrade((tx) =>
        tx
          .table<Task>("tasks")
          .toCollection()
          .modify((task) => {
            task.spawnedFrom ??= null;
          }),
      );
  }
}

export const db = new TallyDB();

/**
 * IndexedDB refuses to open in some private-browsing modes and can be blocked
 * outright by browser settings. Callers need to know that before they trust it
 * with someone's tasks.
 */
export async function canOpenDatabase(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the browser to keep our data rather than evicting it under storage
 * pressure. It is free to say no, and that is a supported outcome — it is one
 * of the reasons export is a must-have feature rather than a nicety.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** True when the browser rejected a write because there is no room left. */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(error.message)
  );
}
