import assert from "node:assert/strict";
import test from "node:test";

import { parseBundle, reidentify } from "../src/data/bundle.ts";
import type { ExportBundle, List, Task } from "../src/data/types.ts";

// The bundle parser is the one place untrusted data enters the data layer, so
// these tests are less about happy paths and more about what it refuses.

function list(patch: Partial<List> = {}): List {
  return {
    id: "list-1",
    name: "Uni",
    isDefault: false,
    position: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

function task(patch: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    listId: "list-1",
    title: "Submit lab report",
    notes: null,
    dueAt: "2026-08-05T12:30:00.000Z",
    hasTime: true,
    repeat: "never",
    spawnedFrom: null,
    priority: "high",
    isComplete: false,
    position: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...patch,
  };
}

function bundle(patch: Partial<ExportBundle> = {}): ExportBundle {
  return {
    version: 1,
    exportedAt: "2026-08-05T10:00:00.000Z",
    lists: [list(), list({ id: "inbox", name: "Inbox", isDefault: true })],
    tasks: [task()],
    ...patch,
  };
}

const json = (value: unknown) => JSON.stringify(value);

// ── The round trip ───────────────────────────────────────────────────────

test("an export survives a round trip with no data loss", () => {
  const result = parseBundle(json(bundle()));
  assert.ok(result.ok);
  assert.deepEqual(result.bundle, bundle());
});

test("every id is rebuilt on import, and references follow", () => {
  const parsed = parseBundle(json(bundle()));
  assert.ok(parsed.ok);

  const fresh = reidentify(parsed.bundle, "existing-inbox");

  // The file's Inbox folds into the one already on this device.
  assert.equal(fresh.lists.length, 1);
  assert.equal(fresh.lists[0]!.name, "Uni");
  assert.notEqual(fresh.lists[0]!.id, "list-1");
  assert.equal(fresh.lists[0]!.isDefault, false);

  // The task still points at the list it came from, under its new id.
  assert.equal(fresh.tasks.length, 1);
  assert.notEqual(fresh.tasks[0]!.id, "task-1");
  assert.equal(fresh.tasks[0]!.listId, fresh.lists[0]!.id);
  assert.equal(fresh.tasks[0]!.title, "Submit lab report");
});

test("a task whose list is missing from the file lands in Inbox, not nowhere", () => {
  const parsed = parseBundle(
    json(bundle({ lists: [], tasks: [task({ listId: "gone" })] })),
  );
  assert.ok(parsed.ok);

  const fresh = reidentify(parsed.bundle, "existing-inbox");
  assert.equal(fresh.tasks[0]!.listId, "existing-inbox");
});

// ── What it refuses ──────────────────────────────────────────────────────

test("a malformed file is rejected whole", () => {
  for (const input of ["", "not json", "[]", "null", json({ version: 1 })]) {
    const result = parseBundle(input);
    assert.equal(result.ok, false, `should have rejected: ${input}`);
  }
});

test("a future export format is refused rather than half-understood", () => {
  const result = parseBundle(json(bundle({ version: 2 as unknown as 1 })));
  assert.equal(result.ok, false);
});

test("one bad row rejects the file — never a partial import", () => {
  const result = parseBundle(
    json(bundle({ tasks: [task(), task({ title: "" })] })),
  );
  assert.equal(result.ok, false);
});

test("unknown fields are refused, not quietly ignored", () => {
  const withExtra = { ...task(), injectedField: "surprise" };
  const result = parseBundle(json(bundle({ tasks: [withExtra as Task] })));
  assert.equal(result.ok, false);
});

test("a file over 5 MB is refused before it is parsed", () => {
  const result = parseBundle("x".repeat(5 * 1024 * 1024 + 1));
  assert.equal(result.ok, false);
  assert.match((result as { error: string }).error, /larger than 5 MB/);
});

// ── Invariants the database would otherwise have to defend ───────────────

test("a time with no date is impossible, however the file was written", () => {
  const result = parseBundle(
    json(bundle({ tasks: [task({ dueAt: null, hasTime: true })] })),
  );
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.hasTime, false);
});

test("completion state and its timestamp are forced to agree", () => {
  const stillOpen = parseBundle(
    json(bundle({ tasks: [task({ isComplete: false, completedAt: "2026-01-02T00:00:00.000Z" })] })),
  );
  assert.ok(stillOpen.ok);
  assert.equal(stillOpen.bundle.tasks[0]!.completedAt, null);

  const done = parseBundle(
    json(bundle({ tasks: [task({ isComplete: true, completedAt: null })] })),
  );
  assert.ok(done.ok);
  assert.notEqual(done.bundle.tasks[0]!.completedAt, null);
});

test("an unrecognised priority falls back rather than being stored", () => {
  const result = parseBundle(
    json(bundle({ tasks: [task({ priority: "URGENT!!" as Task["priority"] })] })),
  );
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.priority, "none");
});

test("a repeat link is remapped to the imported task's new id", () => {
  const parsed = parseBundle(
    json(
      bundle({
        lists: [list()],
        tasks: [
          task({ id: "done", isComplete: true, completedAt: "2026-08-05T09:00:00.000Z" }),
          // Points backwards at a task that appears earlier, and forwards is
          // just as legal — hence the two passes in reidentify.
          task({ id: "next", spawnedFrom: "done" }),
        ],
      }),
    ),
  );
  assert.ok(parsed.ok);

  const fresh = reidentify(parsed.bundle, null);
  const done = fresh.tasks[0]!;
  const next = fresh.tasks[1]!;

  assert.notEqual(done.id, "done");
  assert.equal(next.spawnedFrom, done.id);
});

test("a link to a task the file did not contain is dropped, not left dangling", () => {
  const parsed = parseBundle(
    json(bundle({ tasks: [task({ spawnedFrom: "a-task-from-another-machine" })] })),
  );
  assert.ok(parsed.ok);

  const fresh = reidentify(parsed.bundle, null);
  assert.equal(fresh.tasks[0]!.spawnedFrom, null);
});

test("an unrecognised repeat falls back rather than being stored", () => {
  const result = parseBundle(
    json(bundle({ tasks: [task({ repeat: "fortnightly" as Task["repeat"] })] })),
  );
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.repeat, "never");
});

test("an export made before repeats existed still imports", () => {
  // The field is simply absent. Rejecting the file for that would strand every
  // user who exported last week.
  const older = task();
  delete (older as Partial<Task>).repeat;

  const result = parseBundle(json(bundle({ tasks: [older] })));
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.repeat, "never");
});

test("a repeat on a task with no due date is dropped", () => {
  // Nothing to count from. The same invariant `hasTime` has.
  const result = parseBundle(
    json(bundle({ tasks: [task({ dueAt: null, repeat: "daily" })] })),
  );
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.repeat, "never");
});

test("over-long text is truncated to the documented limits", () => {
  const result = parseBundle(
    json(
      bundle({
        lists: [list({ name: "L".repeat(200) })],
        tasks: [task({ title: "T".repeat(500), notes: "N".repeat(5000) })],
      }),
    ),
  );
  assert.ok(result.ok);
  assert.equal(result.bundle.lists[0]!.name.length, 40);
  assert.equal(result.bundle.tasks[0]!.title.length, 200);
  assert.equal(result.bundle.tasks[0]!.notes!.length, 2000);
});

test("a title that looks like markup stays literal text", () => {
  const nasty = "<script>alert(1)</script>";
  const result = parseBundle(json(bundle({ tasks: [task({ title: nasty })] })));
  assert.ok(result.ok);
  assert.equal(result.bundle.tasks[0]!.title, nasty);
});
