import { newId } from "@/lib/id";
import {
  LIST_NAME_MAX,
  NOTES_MAX,
  PRIORITIES,
  REPEATS,
  TITLE_MAX,
  type ExportBundle,
  type List,
  type Priority,
  type Repeat,
  type Task,
} from "./types";

/**
 * Validation for imported files.
 *
 * An import is the one place untrusted data enters Tally's data layer, so it
 * gets treated like one: the entire file is checked before a single row is
 * written, unknown fields are rejected rather than quietly ignored, and every
 * id, timestamp and relationship in the file is rebuilt rather than trusted.
 *
 * This is hand-written rather than reached for from npm on purpose. The schema
 * is two flat shapes that will not change, the rules fit on one screen, and
 * every dependency not installed is a supply-chain risk not taken — which the
 * security document names as one of the two threats actually worth defending
 * against.
 */

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5MB

export type ParseResult =
  | { ok: true; bundle: ExportBundle }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "That file doesn't look like a Tally export. Nothing was changed.";

const LIST_FIELDS = new Set([
  "id",
  "name",
  "isDefault",
  "position",
  "createdAt",
  "updatedAt",
]);

const TASK_FIELDS = new Set([
  "id",
  "listId",
  "title",
  "notes",
  "dueAt",
  "hasTime",
  // Absent in files exported before repeats existed. The reader defaults it,
  // so an older export still imports cleanly rather than being rejected for a
  // field it had no way of knowing about.
  "repeat",
  "spawnedFrom",
  "priority",
  "isComplete",
  "position",
  "createdAt",
  "updatedAt",
  "completedAt",
]);

export function parseBundle(text: string): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: "That file is larger than 5 MB. Nothing was changed.",
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  if (!isRecord(raw)) return { ok: false, error: GENERIC_ERROR };
  if (raw.version !== 1) {
    return {
      ok: false,
      error:
        "That export was made by a different version of Tally. Nothing was changed.",
    };
  }
  if (!Array.isArray(raw.lists) || !Array.isArray(raw.tasks)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const lists: List[] = [];
  for (const entry of raw.lists) {
    const list = readList(entry);
    if (!list) return { ok: false, error: GENERIC_ERROR };
    lists.push(list);
  }

  const tasks: Task[] = [];
  for (const entry of raw.tasks) {
    const task = readTask(entry);
    if (!task) return { ok: false, error: GENERIC_ERROR };
    tasks.push(task);
  }

  return {
    ok: true,
    bundle: { version: 1, exportedAt: isoOrNow(raw.exportedAt), lists, tasks },
  };
}

/**
 * Rewrites every id in the bundle so an import can never collide with — or
 * silently overwrite — a task the user already has. List references are
 * remapped alongside; a task pointing at a list the file did not contain is
 * dropped rather than left dangling.
 *
 * `keepInboxId` lets the caller fold the file's Inbox into the existing one
 * instead of ending up with two.
 */
export function reidentify(
  bundle: ExportBundle,
  keepInboxId: string | null,
): ExportBundle {
  const listIdMap = new Map<string, string>();
  const lists: List[] = [];

  for (const list of bundle.lists) {
    if (list.isDefault && keepInboxId) {
      // Merge the imported Inbox into the one already on this device.
      listIdMap.set(list.id, keepInboxId);
      continue;
    }
    const id = newId();
    listIdMap.set(list.id, id);
    lists.push({ ...list, id, isDefault: false });
  }

  /*
   * Task ids are rewritten too, so `spawnedFrom` has to be rewritten with
   * them. Left alone it would point at an id from the file — which, after the
   * rest of the import, belongs to nothing at all, and would make unticking a
   * completed occurrence silently do nothing.
   *
   * Two passes rather than one: a task may point at another that appears
   * later in the file, so every id has to exist before any of them is read.
   */
  const taskIdMap = new Map<string, string>();
  for (const task of bundle.tasks) taskIdMap.set(task.id, newId());

  const tasks: Task[] = [];
  for (const task of bundle.tasks) {
    const listId = listIdMap.get(task.listId) ?? keepInboxId;
    if (!listId) continue; // Orphan: its list was not in the file.
    tasks.push({
      ...task,
      id: taskIdMap.get(task.id)!,
      listId,
      // A link to a task the file did not contain is dropped rather than kept
      // as a dangling id.
      spawnedFrom: task.spawnedFrom ? (taskIdMap.get(task.spawnedFrom) ?? null) : null,
    });
  }

  return { ...bundle, lists, tasks };
}

// ── Field readers ────────────────────────────────────────────────────────

function readList(value: unknown): List | null {
  if (!isRecord(value)) return null;
  if (hasUnknownFields(value, LIST_FIELDS)) return null;

  const name = readString(value.name, LIST_NAME_MAX);
  if (name === undefined || name.trim() === "") return null;

  return {
    id: readId(value.id) ?? newId(),
    name: name.trim(),
    isDefault: value.isDefault === true,
    position: readNumber(value.position) ?? 1000,
    createdAt: isoOrNow(value.createdAt),
    updatedAt: isoOrNow(value.updatedAt),
  };
}

function readTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  if (hasUnknownFields(value, TASK_FIELDS)) return null;

  const title = readString(value.title, TITLE_MAX);
  if (title === undefined || title.trim() === "") return null;

  const listId = readId(value.listId);
  if (listId === null) return null;

  const dueAt = readNullableISO(value.dueAt);
  if (dueAt === undefined) return null;

  const isComplete = value.isComplete === true;
  const notes = value.notes === null ? null : readString(value.notes, NOTES_MAX);
  if (notes === undefined) return null;

  return {
    id: readId(value.id) ?? newId(),
    listId,
    title: title.trim(),
    notes: notes === null || notes.trim() === "" ? null : notes,
    dueAt,
    // The invariant the v2 database enforces with a check constraint:
    // a time is only meaningful when there is a date to attach it to. Neither
    // is a repeat — it has nothing to count from.
    hasTime: dueAt === null ? false : value.hasTime === true,
    repeat: dueAt === null ? "never" : readRepeat(value.repeat),
    spawnedFrom: readId(value.spawnedFrom),
    priority: readPriority(value.priority),
    isComplete,
    position: readNumber(value.position) ?? 1000,
    createdAt: isoOrNow(value.createdAt),
    updatedAt: isoOrNow(value.updatedAt),
    // The other check constraint: completedAt and isComplete must agree.
    completedAt: isComplete
      ? (readNullableISO(value.completedAt) ?? new Date().toISOString())
      : null,
  };
}

// ── Primitives ───────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
): boolean {
  return Object.keys(value).some((key) => !allowed.has(key));
}

/** Returns the (truncated) string, or `undefined` if it was not a string. */
function readString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.slice(0, max);
}

function readId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64
    ? value
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPriority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "none";
}

function readRepeat(value: unknown): Repeat {
  return REPEATS.includes(value as Repeat) ? (value as Repeat) : "never";
}

/** Returns the ISO string, `null` for an absent value, or `undefined` if invalid. */
function readNullableISO(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function isoOrNow(value: unknown): string {
  const parsed = readNullableISO(value);
  return typeof parsed === "string" ? parsed : new Date().toISOString();
}
