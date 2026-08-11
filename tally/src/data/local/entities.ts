import { newId } from "@/lib/id";
import { positionAfterAll } from "@/lib/ordering";
import {
  LIST_NAME_MAX,
  NOTES_MAX,
  TITLE_MAX,
  type List,
  type NewList,
  type NewTask,
  type Task,
} from "../types";

/**
 * The rules about what a valid row looks like, kept pure and kept in one place
 * so the IndexedDB repository and the in-memory fallback cannot drift apart.
 *
 * Nothing here touches storage.
 */

const now = () => new Date().toISOString();

export function makeList(input: NewList, existing: List[]): List {
  const timestamp = now();
  return {
    id: newId(),
    name: clampName(input.name),
    isDefault: false,
    position: input.position ?? positionAfterAll(existing),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function makeInbox(): List {
  const timestamp = now();
  return {
    id: newId(),
    name: "Inbox",
    isDefault: true,
    position: 1000,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function makeTask(
  input: NewTask,
  fallbackListId: string,
  siblings: Task[],
): Task {
  const timestamp = now();
  const isComplete = input.isComplete ?? false;

  // has_time can only be true when a due date exists. The v2 database enforces
  // this with a check constraint; here it is enforced on the way in. `repeat`
  // hangs off the same date and gets the same treatment.
  const dueAt = input.dueAt ?? null;
  const hasTime = dueAt === null ? false : (input.hasTime ?? false);
  const repeat = dueAt === null ? "never" : (input.repeat ?? "never");

  return {
    id: newId(),
    listId: input.listId ?? fallbackListId,
    title: clampTitle(input.title),
    notes: clampNotes(input.notes ?? null),
    dueAt,
    hasTime,
    repeat,
    spawnedFrom: input.spawnedFrom ?? null,
    priority: input.priority ?? "none",
    isComplete,
    position: input.position ?? positionAfterAll(siblings),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: isComplete ? timestamp : null,
  };
}

/**
 * Applies a patch to a task while keeping the two invariants intact:
 * `updatedAt` always moves, and `completedAt` always agrees with `isComplete`.
 */
export function applyTaskPatch(task: Task, patch: Partial<Task>): Task {
  const timestamp = now();
  const next: Task = { ...task, ...patch, updatedAt: timestamp };

  if (patch.title !== undefined) next.title = clampTitle(patch.title);
  if (patch.notes !== undefined) next.notes = clampNotes(patch.notes);

  if (patch.isComplete !== undefined && patch.isComplete !== task.isComplete) {
    next.completedAt = patch.isComplete ? timestamp : null;
  }

  /*
   * A generated occurrence stops being ours the moment the user changes it.
   *
   * `spawnedFrom` means "we made this and nobody has touched it", which is the
   * only condition under which withdrawing it is safe. Recorded here rather
   * than inferred from `updatedAt` later: millisecond timestamps make an edit
   * in the same tick indistinguishable from no edit at all, and the failure
   * mode of that guess is deleting something a person wrote.
   *
   * Completing or un-completing is not a change of that kind, so it is the one
   * patch that leaves the link intact.
   */
  const isCompletionOnly = Object.keys(patch).every(
    (key) => key === "isComplete" || key === "completedAt",
  );
  if (!isCompletionOnly) next.spawnedFrom = null;

  // Clearing the date clears everything hanging off it. A weekly repeat on a
  // task with no date would never fire, and would sit in the UI claiming
  // otherwise.
  if (next.dueAt === null) {
    next.hasTime = false;
    next.repeat = "never";
  }

  return next;
}

export function applyListPatch(list: List, patch: Partial<List>): List {
  const next: List = { ...list, ...patch, updatedAt: now() };
  if (patch.name !== undefined) next.name = clampName(patch.name);
  // The Inbox flag is not something a patch is allowed to move around.
  next.isDefault = list.isDefault;
  return next;
}

// ── Input clamping ───────────────────────────────────────────────────────
// The UI stops the user well before these limits; this is the layer that has
// to hold when the input arrives from an imported file instead of a keyboard.

function clampTitle(title: string): string {
  return title.trim().slice(0, TITLE_MAX);
}

function clampName(name: string): string {
  return name.trim().slice(0, LIST_NAME_MAX);
}

function clampNotes(notes: string | null): string | null {
  if (notes === null) return null;
  const trimmed = notes.slice(0, NOTES_MAX);
  return trimmed.trim() === "" ? null : trimmed;
}

export function siblingsOf(tasks: Task[], listId: string): Task[] {
  return tasks.filter((t) => t.listId === listId);
}
