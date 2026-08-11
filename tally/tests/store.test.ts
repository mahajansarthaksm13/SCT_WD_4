import assert from "node:assert/strict";
import test from "node:test";

import { useTaskStore } from "../src/store/useTaskStore.ts";
import { __setRepositoryForTests, __resetRepository } from "../src/data/index.ts";
import { MemoryRepository } from "../src/data/local/MemoryRepository.ts";
import type { Repository } from "../src/data/repository.ts";
import { StorageFullError } from "../src/data/repository.ts";

/**
 * The store, driven against a real in-memory repository.
 *
 * What matters here is not that a task gets added — the repository tests
 * already cover that. It is the *optimistic* half: the store paints the change
 * before the write lands, and has to put the screen back exactly as it was if
 * the write then fails. That rollback is the only place in the app where the
 * UI and the database can disagree, and until now nothing checked it.
 */

const initial = useTaskStore.getState();

async function fresh(repository: Repository = new MemoryRepository()) {
  __setRepositoryForTests(repository);
  useTaskStore.setState({
    ...initial,
    tasks: [],
    lists: [],
    inboxId: null,
    status: "idle",
    error: null,
    pendingDelete: null,
  });
  await useTaskStore.getState().loadAll();
  return useTaskStore.getState();
}

/** A repository that works until it is told to start failing. */
function breakable() {
  const inner = new MemoryRepository();
  let failing = false;
  const repo = new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const writes = ["createTask", "updateTask", "deleteTask", "deleteList", "updateList", "applyPositions"];
        if (failing && writes.includes(String(prop))) {
          return Promise.reject(new StorageFullError());
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as Repository;

  return { repo, breakIt: () => { failing = true; } };
}

test.after(() => __resetRepository());

// ── Loading ──────────────────────────────────────────────────────────────

test("loadAll seeds the Inbox and reports storage durability", async () => {
  await fresh();
  const s = useTaskStore.getState();

  assert.equal(s.status, "ready");
  assert.equal(s.lists.length, 1);
  assert.equal(s.lists[0]!.name, "Inbox");
  assert.equal(s.inboxId, s.lists[0]!.id);
  assert.equal(s.durable, false); // MemoryRepository is honest about this
});

// ── Optimistic writes, and putting them back ─────────────────────────────

test("an edit appears immediately and is reconciled with what was stored", async () => {
  await fresh();
  const created = await useTaskStore.getState().addTask({ title: "Draft essay" });
  assert.ok(created);

  await useTaskStore.getState().editTask(created.id, { title: "Draft the essay" });

  const stored = useTaskStore.getState().tasks.find((t) => t.id === created.id)!;
  assert.equal(stored.title, "Draft the essay");
  assert.ok(stored.updatedAt >= created.updatedAt);
});

test("a failed edit is rolled back and the failure is explained", async () => {
  const { repo, breakIt } = breakable();
  await fresh(repo);

  const created = await useTaskStore.getState().addTask({ title: "Original" });
  assert.ok(created);
  breakIt();

  await useTaskStore.getState().editTask(created.id, { title: "Never saved" });

  const s = useTaskStore.getState();
  assert.equal(s.tasks.find((t) => t.id === created.id)!.title, "Original");
  assert.match(s.error!, /storage is full/i);
});

test("a failed create leaves the list untouched", async () => {
  const { repo, breakIt } = breakable();
  await fresh(repo);
  breakIt();

  const created = await useTaskStore.getState().addTask({ title: "Doomed" });

  assert.equal(created, null);
  assert.equal(useTaskStore.getState().tasks.length, 0);
  assert.notEqual(useTaskStore.getState().error, null);
});

test("a failed rename puts the old list name back", async () => {
  const { repo, breakIt } = breakable();
  await fresh(repo);
  const list = await useTaskStore.getState().addList("Uni");
  assert.ok(list);
  breakIt();

  await useTaskStore.getState().renameList(list.id, "University");

  assert.equal(
    useTaskStore.getState().lists.find((l) => l.id === list.id)!.name,
    "Uni",
  );
});

test("a failed list deletion restores both the list and its tasks", async () => {
  const { repo, breakIt } = breakable();
  await fresh(repo);
  const list = await useTaskStore.getState().addList("Uni");
  assert.ok(list);
  await useTaskStore.getState().addTask({ title: "Essay", listId: list.id });
  breakIt();

  await useTaskStore.getState().removeList(list.id, "delete-tasks");

  const s = useTaskStore.getState();
  assert.equal(s.lists.filter((l) => l.id === list.id).length, 1);
  assert.equal(s.tasks.filter((t) => t.listId === list.id).length, 1);
  assert.notEqual(s.error, null);
});

test("clearError dismisses the message without touching the data", async () => {
  const { repo, breakIt } = breakable();
  await fresh(repo);
  breakIt();
  await useTaskStore.getState().addTask({ title: "Doomed" });
  assert.notEqual(useTaskStore.getState().error, null);

  useTaskStore.getState().clearError();
  assert.equal(useTaskStore.getState().error, null);
});

// ── Completion and moving ────────────────────────────────────────────────

test("toggleComplete flips both ways and keeps completedAt honest", async () => {
  await fresh();
  const created = await useTaskStore.getState().addTask({ title: "Lab report" });
  assert.ok(created);

  await useTaskStore.getState().toggleComplete(created.id);
  let stored = useTaskStore.getState().tasks.find((t) => t.id === created.id)!;
  assert.equal(stored.isComplete, true);
  assert.notEqual(stored.completedAt, null);

  await useTaskStore.getState().toggleComplete(created.id);
  stored = useTaskStore.getState().tasks.find((t) => t.id === created.id)!;
  assert.equal(stored.isComplete, false);
  assert.equal(stored.completedAt, null);
});

// ── Repeating tasks ──────────────────────────────────────────────────────

/** A weekly task, dated well in the past so the next one is unambiguous. */
async function weekly(title = "Water the plants") {
  const created = await useTaskStore.getState().addTask({
    title,
    dueAt: "2026-08-05T00:00:00.000Z",
    hasTime: false,
    repeat: "weekly",
  });
  assert.ok(created);
  return created;
}

test("completing a repeating task leaves the record and opens the next one", async () => {
  await fresh();
  const created = await weekly();

  await useTaskStore.getState().toggleComplete(created.id);
  const tasks = useTaskStore.getState().tasks;

  // The occurrence that was ticked keeps its own date. Rewriting it would
  // destroy the record of what was actually done and when.
  const done = tasks.find((t) => t.id === created.id)!;
  assert.equal(done.isComplete, true);
  assert.equal(done.dueAt, "2026-08-05T00:00:00.000Z");

  const next = tasks.find((t) => t.id !== created.id)!;
  assert.equal(next.title, "Water the plants");
  assert.equal(next.isComplete, false);
  assert.equal(next.repeat, "weekly");
  assert.notEqual(next.dueAt, created.dueAt);
});

test("the next occurrence carries the content forward but is its own task", async () => {
  await fresh();
  const uni = await useTaskStore.getState().addList("Uni");
  assert.ok(uni);
  const created = await useTaskStore.getState().addTask({
    title: "Weekly reading",
    notes: "Chapters 4 to 6",
    listId: uni.id,
    dueAt: "2026-08-05T00:00:00.000Z",
    hasTime: false,
    repeat: "weekly",
    priority: "high",
  });
  assert.ok(created);

  await useTaskStore.getState().toggleComplete(created.id);
  const next = useTaskStore.getState().tasks.find((t) => t.id !== created.id)!;

  assert.equal(next.notes, "Chapters 4 to 6");
  assert.equal(next.listId, uni.id);
  assert.equal(next.priority, "high");
  assert.notEqual(next.id, created.id);
});

test("unticking takes the occurrence it created back out again", async () => {
  await fresh();
  const created = await weekly();

  await useTaskStore.getState().toggleComplete(created.id);
  assert.equal(useTaskStore.getState().tasks.length, 2);

  await useTaskStore.getState().toggleComplete(created.id);
  const tasks = useTaskStore.getState().tasks;

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.id, created.id);
  assert.equal(tasks[0]!.isComplete, false);
});

test("the link is on the task, so it survives a reload", async () => {
  const repository = new MemoryRepository();
  await fresh(repository);
  const created = await weekly();
  await useTaskStore.getState().toggleComplete(created.id);

  // Same storage, new store: everything held only in memory is gone, which is
  // exactly what a reload does and what the old transient link could not
  // survive.
  await fresh(repository);
  assert.equal(useTaskStore.getState().tasks.length, 2);

  await useTaskStore.getState().toggleComplete(created.id);

  const tasks = useTaskStore.getState().tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.id, created.id);
  assert.equal(tasks[0]!.isComplete, false);
  // And it is gone from storage, not merely from the screen.
  assert.equal((await repository.getTasks()).length, 1);
});

test("an occurrence the user has edited is theirs, and is left alone", async () => {
  await fresh();
  const created = await weekly();
  await useTaskStore.getState().toggleComplete(created.id);

  const next = useTaskStore.getState().tasks.find((t) => t.id !== created.id)!;
  await useTaskStore.getState().editTask(next.id, { title: "Water the plants twice" });

  await useTaskStore.getState().toggleComplete(created.id);

  assert.equal(useTaskStore.getState().tasks.length, 2);
  assert.ok(useTaskStore.getState().tasks.some((t) => t.id === next.id));
});

test("an occurrence that has been completed itself is a record, and stays", async () => {
  await fresh();
  const created = await weekly();
  await useTaskStore.getState().toggleComplete(created.id);

  // Tick the next one too, which both completes it and starts a third.
  const second = useTaskStore.getState().tasks.find((t) => t.id !== created.id)!;
  await useTaskStore.getState().toggleComplete(second.id);
  assert.equal(useTaskStore.getState().tasks.length, 3);

  // Unticking the first must not reach past it into a series that moved on.
  await useTaskStore.getState().toggleComplete(created.id);
  assert.equal(useTaskStore.getState().tasks.length, 3);
});

test("only the occurrence belonging to this task is withdrawn", async () => {
  await fresh();
  const plants = await weekly("Water the plants");
  const bins = await weekly("Take the bins out");

  await useTaskStore.getState().toggleComplete(plants.id);
  await useTaskStore.getState().toggleComplete(bins.id);
  assert.equal(useTaskStore.getState().tasks.length, 4);

  await useTaskStore.getState().toggleComplete(plants.id);

  const titles = useTaskStore.getState().tasks.map((t) => t.title);
  assert.equal(titles.filter((t) => t === "Water the plants").length, 1);
  assert.equal(titles.filter((t) => t === "Take the bins out").length, 2);
});

test("unticking a plain completed task never removes anything", async () => {
  await fresh();
  const plain = await useTaskStore.getState().addTask({ title: "One-off" });
  const repeating = await weekly();
  assert.ok(plain && repeating);

  await useTaskStore.getState().toggleComplete(repeating.id);
  // Untick the *other* task. The spawn belongs to the repeating one, and must
  // not be dragged out by an unrelated row changing state.
  await useTaskStore.getState().toggleComplete(plain.id);
  await useTaskStore.getState().toggleComplete(plain.id);

  assert.equal(useTaskStore.getState().tasks.length, 3);
});

test("a task that does not repeat produces nothing when completed", async () => {
  await fresh();
  const created = await useTaskStore.getState().addTask({
    title: "Send the invoice",
    dueAt: "2026-08-05T00:00:00.000Z",
    hasTime: false,
  });
  assert.ok(created);

  await useTaskStore.getState().toggleComplete(created.id);
  assert.equal(useTaskStore.getState().tasks.length, 1);
});

test("moving a task appends it to the destination rather than colliding", async () => {
  await fresh();
  const uni = await useTaskStore.getState().addList("Uni");
  assert.ok(uni);
  const sitting = await useTaskStore.getState().addTask({ title: "Already there", listId: uni.id });
  const moving = await useTaskStore.getState().addTask({ title: "Moving" });
  assert.ok(sitting && moving);

  await useTaskStore.getState().moveTask(moving.id, uni.id);

  const stored = useTaskStore.getState().tasks.find((t) => t.id === moving.id)!;
  assert.equal(stored.listId, uni.id);
  assert.ok(stored.position > sitting.position);
});

// ── Delete, and the undo window ──────────────────────────────────────────

test("a deleted task leaves the screen at once but is not yet committed", async () => {
  await fresh();
  const created = await useTaskStore.getState().addTask({ title: "Mistake" });
  assert.ok(created);

  useTaskStore.getState().removeTask(created.id);

  assert.equal(useTaskStore.getState().tasks.length, 0);
  assert.equal(useTaskStore.getState().pendingDelete?.task.id, created.id);

  useTaskStore.getState().undoRemove();
  assert.equal(useTaskStore.getState().tasks.length, 1);
  assert.equal(useTaskStore.getState().pendingDelete, null);
});

test("undo puts the task back at the position it held", async () => {
  await fresh();
  const a = await useTaskStore.getState().addTask({ title: "A" });
  const b = await useTaskStore.getState().addTask({ title: "B" });
  const c = await useTaskStore.getState().addTask({ title: "C" });
  assert.ok(a && b && c);

  useTaskStore.getState().removeTask(b.id);
  useTaskStore.getState().undoRemove();

  const order = [...useTaskStore.getState().tasks]
    .sort((x, y) => x.position - y.position)
    .map((t) => t.title);
  assert.deepEqual(order, ["A", "B", "C"]);
});

test("deleting a second task commits the first — only ever one toast", async () => {
  await fresh();
  const first = await useTaskStore.getState().addTask({ title: "First" });
  const second = await useTaskStore.getState().addTask({ title: "Second" });
  assert.ok(first && second);

  useTaskStore.getState().removeTask(first.id);
  useTaskStore.getState().removeTask(second.id);

  assert.equal(useTaskStore.getState().pendingDelete?.task.id, second.id);

  // The first is now gone for good; undo only reaches the second.
  useTaskStore.getState().undoRemove();
  const titles = useTaskStore.getState().tasks.map((t) => t.title);
  assert.deepEqual(titles, ["Second"]);
});

test("flushing commits the pending deletion to storage", async () => {
  const repository = new MemoryRepository();
  await fresh(repository);
  const created = await useTaskStore.getState().addTask({ title: "Going" });
  assert.ok(created);

  useTaskStore.getState().removeTask(created.id);
  useTaskStore.getState().flushPendingDelete();
  await new Promise((r) => setTimeout(r, 20));

  assert.equal((await repository.getTasks()).length, 0);
  assert.equal(useTaskStore.getState().pendingDelete, null);
});

// ── Reordering ───────────────────────────────────────────────────────────

test("reordering moves a task and touches only that row", async () => {
  await fresh();
  const a = await useTaskStore.getState().addTask({ title: "A" });
  const b = await useTaskStore.getState().addTask({ title: "B" });
  const c = await useTaskStore.getState().addTask({ title: "C" });
  assert.ok(a && b && c);

  const scope = [a, b, c];
  await useTaskStore.getState().reorderTask(c.id, 2, 0, scope);

  const order = [...useTaskStore.getState().tasks]
    .sort((x, y) => x.position - y.position)
    .map((t) => t.title);
  assert.deepEqual(order, ["C", "A", "B"]);
});

test("a collapsed gap triggers a rebalance instead of scrambling the order", async () => {
  await fresh();
  const a = await useTaskStore.getState().addTask({ title: "A", position: 1000 });
  const b = await useTaskStore.getState().addTask({ title: "B", position: 1000.00001 });
  const c = await useTaskStore.getState().addTask({ title: "C", position: 4000 });
  assert.ok(a && b && c);

  // Dropping C between A and B, whose positions are already indistinguishable.
  await useTaskStore.getState().reorderTask(c.id, 2, 1, [a, b, c]);

  const rows = [...useTaskStore.getState().tasks].sort(
    (x, y) => x.position - y.position,
  );
  assert.deepEqual(rows.map((t) => t.title), ["A", "C", "B"]);
  // Every gap is wide again.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i]!.position - rows[i - 1]!.position > 1);
  }
});

// ── Import ───────────────────────────────────────────────────────────────

test("importing replaces the store's view of the world", async () => {
  const repository = new MemoryRepository();
  await fresh(repository);
  await useTaskStore.getState().addTask({ title: "Before" });

  const bundle = await new MemoryRepository().exportAll();
  bundle.lists = [
    {
      id: "imported-list",
      name: "Imported",
      isDefault: false,
      position: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  bundle.tasks = [
    {
      id: "imported-task",
      listId: "imported-list",
      title: "After",
      notes: null,
      dueAt: null,
      hasTime: false,
      repeat: "never",
      spawnedFrom: null,
      priority: "none",
      isComplete: false,
      position: 1000,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    },
  ];

  await useTaskStore.getState().importAll(bundle, "replace");

  assert.deepEqual(
    useTaskStore.getState().tasks.map((t) => t.title),
    ["After"],
  );
});
