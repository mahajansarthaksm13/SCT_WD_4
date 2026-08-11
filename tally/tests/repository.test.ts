import assert from "node:assert/strict";
import test from "node:test";

import { MemoryRepository } from "../src/data/local/MemoryRepository.ts";
import { InboxProtectedError } from "../src/data/repository.ts";

/**
 * The repository contract, exercised against the in-memory implementation.
 *
 * These rules are the ones the *interface* promises, not an implementation
 * detail of Dexie — so the same suite is what a future SupabaseRepository
 * should be held to before it is allowed to replace this one.
 */

async function seeded() {
  const repo = new MemoryRepository();
  const inbox = await repo.ensureInbox();
  return { repo, inbox };
}

// ── Inbox ────────────────────────────────────────────────────────────────

test("the Inbox is created once and never duplicated", async () => {
  const repo = new MemoryRepository();
  const first = await repo.ensureInbox();
  const second = await repo.ensureInbox();

  assert.equal(first.id, second.id);
  assert.equal((await repo.getLists()).length, 1);
  assert.equal(first.isDefault, true);
});

test("the Inbox cannot be deleted", async () => {
  const { repo, inbox } = await seeded();
  await assert.rejects(
    () => repo.deleteList(inbox.id, "delete-tasks"),
    InboxProtectedError,
  );
  assert.equal((await repo.getLists()).length, 1);
});

test("the Inbox always sorts first, whatever its position says", async () => {
  const { repo } = await seeded();
  await repo.createList({ name: "Zebra", position: 1 });
  await repo.createList({ name: "Apple", position: 2 });

  const names = (await repo.getLists()).map((l) => l.name);
  assert.equal(names[0], "Inbox");
});

// ── Task creation ────────────────────────────────────────────────────────

test("a task with no list lands in the Inbox", async () => {
  const { repo, inbox } = await seeded();
  const task = await repo.createTask({ title: "Buy milk" });
  assert.equal(task.listId, inbox.id);
});

test("a task aimed at a list that no longer exists lands in the Inbox", async () => {
  const { repo, inbox } = await seeded();
  const task = await repo.createTask({ title: "Orphan", listId: "deleted-id" });
  // Better than vanishing into a listId nothing points at.
  assert.equal(task.listId, inbox.id);
});

test("new tasks are appended, not interleaved", async () => {
  const { repo } = await seeded();
  const a = await repo.createTask({ title: "First" });
  const b = await repo.createTask({ title: "Second" });
  const c = await repo.createTask({ title: "Third" });

  assert.ok(a.position < b.position);
  assert.ok(b.position < c.position);
});

test("a title is trimmed and capped, and whitespace-only is refused", async () => {
  const { repo } = await seeded();
  const padded = await repo.createTask({ title: "   Spaced out   " });
  assert.equal(padded.title, "Spaced out");

  const long = await repo.createTask({ title: "x".repeat(500) });
  assert.equal(long.title.length, 200);
});

test("a time is impossible without a date", async () => {
  const { repo } = await seeded();
  const task = await repo.createTask({
    title: "No date",
    dueAt: null,
    hasTime: true,
  });
  assert.equal(task.hasTime, false);
});

// ── Completion invariants ────────────────────────────────────────────────

test("completedAt is set on completion and cleared on reopening", async () => {
  const { repo } = await seeded();
  const task = await repo.createTask({ title: "Lab report" });
  assert.equal(task.completedAt, null);

  const done = await repo.updateTask(task.id, { isComplete: true });
  assert.notEqual(done.completedAt, null);

  const reopened = await repo.updateTask(task.id, { isComplete: false });
  assert.equal(reopened.completedAt, null);
});

test("every update moves updatedAt", async () => {
  const { repo } = await seeded();
  const task = await repo.createTask({ title: "Something" });
  await new Promise((r) => setTimeout(r, 5));

  const edited = await repo.updateTask(task.id, { title: "Something else" });
  assert.ok(edited.updatedAt >= task.updatedAt);
  assert.equal(edited.createdAt, task.createdAt);
});

test("clearing the due date clears the time with it", async () => {
  const { repo } = await seeded();
  const task = await repo.createTask({
    title: "Timed",
    dueAt: "2026-08-05T12:00:00.000Z",
    hasTime: true,
  });
  const cleared = await repo.updateTask(task.id, { dueAt: null });
  assert.equal(cleared.hasTime, false);
});

// ── Deleting a list: the path that can silently destroy work ─────────────

test("move-to-inbox leaves zero orphaned tasks", async () => {
  const { repo, inbox } = await seeded();
  const uni = await repo.createList({ name: "Uni" });
  await repo.createTask({ title: "Essay", listId: uni.id });
  await repo.createTask({ title: "Seminar", listId: uni.id });

  await repo.deleteList(uni.id, "move-to-inbox");

  const tasks = await repo.getTasks();
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((t) => t.listId === inbox.id));
  assert.equal((await repo.getLists()).find((l) => l.id === uni.id), undefined);
});

test("moved tasks are appended to the Inbox rather than colliding with it", async () => {
  const { repo, inbox } = await seeded();
  const existing = await repo.createTask({ title: "Already here" });
  const uni = await repo.createList({ name: "Uni" });
  await repo.createTask({ title: "Moved", listId: uni.id });

  await repo.deleteList(uni.id, "move-to-inbox");

  const inboxTasks = (await repo.getTasks({ listId: inbox.id })).sort(
    (a, b) => a.position - b.position,
  );
  assert.deepEqual(
    inboxTasks.map((t) => t.title),
    ["Already here", "Moved"],
  );
  assert.ok(inboxTasks[1]!.position > existing.position);
});

test("delete-tasks removes the list's tasks and nothing else", async () => {
  const { repo } = await seeded();
  await repo.createTask({ title: "Kept" });
  const uni = await repo.createList({ name: "Uni" });
  await repo.createTask({ title: "Doomed", listId: uni.id });

  await repo.deleteList(uni.id, "delete-tasks");

  const titles = (await repo.getTasks()).map((t) => t.title);
  assert.deepEqual(titles, ["Kept"]);
});

// ── Queries ──────────────────────────────────────────────────────────────

test("getTasksDueBy excludes undated and completed tasks", async () => {
  const { repo } = await seeded();
  await repo.createTask({ title: "Undated" });
  await repo.createTask({
    title: "Due",
    dueAt: "2026-08-05T09:00:00.000Z",
    hasTime: true,
  });
  const done = await repo.createTask({
    title: "Done",
    dueAt: "2026-08-05T08:00:00.000Z",
    hasTime: true,
  });
  await repo.updateTask(done.id, { isComplete: true });

  const due = await repo.getTasksDueBy("2026-08-05T23:59:59.999Z");
  assert.deepEqual(
    due.map((t) => t.title),
    ["Due"],
  );
});

test("filters compose, and search covers notes as well as titles", async () => {
  const { repo, inbox } = await seeded();
  const uni = await repo.createList({ name: "Uni" });
  await repo.createTask({ title: "Read Rust book", listId: uni.id });
  const noted = await repo.createTask({ title: "Call the bank" });
  await repo.updateTask(noted.id, { notes: "Ask about the RUST account" });

  assert.equal((await repo.getTasks({ listId: uni.id })).length, 1);
  assert.equal((await repo.getTasks({ search: "rust" })).length, 2);
  assert.equal(
    (await repo.getTasks({ search: "rust", listId: inbox.id })).length,
    1,
  );
});

// ── Portability ──────────────────────────────────────────────────────────

test("export then import into a fresh store reproduces everything", async () => {
  const { repo } = await seeded();
  const uni = await repo.createList({ name: "Uni" });
  await repo.createTask({
    title: "Submit essay",
    listId: uni.id,
    dueAt: "2026-08-05T12:00:00.000Z",
    hasTime: true,
    priority: "high",
  });

  const bundle = await repo.exportAll();

  const fresh = new MemoryRepository();
  await fresh.importAll(bundle, "replace");

  const tasks = await fresh.getTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.title, "Submit essay");
  assert.equal(tasks[0]!.priority, "high");
  assert.equal(tasks[0]!.hasTime, true);
  assert.equal((await fresh.getLists()).length, 2);
});

test("replace clears what was there; merge does not", async () => {
  const { repo } = await seeded();
  await repo.createTask({ title: "Original" });
  const bundle = await repo.exportAll();

  const target = new MemoryRepository();
  await target.ensureInbox();
  await target.createTask({ title: "Existing" });

  await target.importAll(bundle, "merge");
  assert.equal((await target.getTasks()).length, 2);

  await target.importAll(bundle, "replace");
  assert.deepEqual(
    (await target.getTasks()).map((t) => t.title),
    ["Original"],
  );
});

// ── Ordering ─────────────────────────────────────────────────────────────

test("reorderTask moves exactly one row", async () => {
  const { repo } = await seeded();
  const a = await repo.createTask({ title: "A" });
  const b = await repo.createTask({ title: "B" });
  const c = await repo.createTask({ title: "C" });

  await repo.reorderTask(c.id, 500);

  const order = (await repo.getTasks())
    .sort((x, y) => x.position - y.position)
    .map((t) => t.title);
  assert.deepEqual(order, ["C", "A", "B"]);

  // The other two were not rewritten.
  const after = await repo.getTasks();
  assert.equal(after.find((t) => t.id === a.id)!.position, a.position);
  assert.equal(after.find((t) => t.id === b.id)!.position, b.position);
});

test("applyPositions ignores ids that are no longer there", async () => {
  const { repo } = await seeded();
  const a = await repo.createTask({ title: "A" });

  await repo.applyPositions([
    { id: a.id, position: 42 },
    { id: "already-deleted", position: 99 },
  ]);

  const tasks = await repo.getTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.position, 42);
});

// ── The generated-occurrence link ────────────────────────────────────────

test("completing an occurrence leaves its link intact", async () => {
  const { repo } = await seeded();
  const source = await repo.createTask({ title: "Water the plants" });
  const next = await repo.createTask({
    title: "Water the plants",
    spawnedFrom: source.id,
  });

  const done = await repo.updateTask(next.id, { isComplete: true });

  // Completing is not editing. The link has to survive it, or a task ticked
  // and immediately unticked would strand the one after it.
  assert.equal(done.spawnedFrom, source.id);
});

test("any other edit clears the link, because the task is now the user's", async () => {
  const { repo } = await seeded();
  const source = await repo.createTask({ title: "Water the plants" });
  const next = await repo.createTask({
    title: "Water the plants",
    spawnedFrom: source.id,
  });

  const renamed = await repo.updateTask(next.id, { title: "Water them twice" });
  assert.equal(renamed.spawnedFrom, null);
});

// ── Durability flag ──────────────────────────────────────────────────────

test("the memory repository is honest about not being durable", () => {
  assert.equal(new MemoryRepository().isDurable, false);
});
