import assert from "node:assert/strict";
import test from "node:test";

import {
  dateOnlyToStorage,
  dueSortKey,
  effectiveDueAt,
  formatDueChip,
  formatGutter,
  fromPickerValues,
  isDueByEndOfToday,
  isOverdue,
  toPickerValues,
  todayRangeUTC,
} from "../src/lib/dates.ts";
import type { Task } from "../src/data/types.ts";

const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST
const NEW_YORK = "America/New_York"; // observes DST

function task(patch: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    title: "Test task",
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
    ...patch,
  };
}

// ── Daylight saving, in both directions ─────────────────────────────────
// New York springs forward on 8 March 2026 and falls back on 1 November 2026.
// Same wall-clock time either side of each transition, different UTC instant.

test("spring forward: 07:00 local resolves to the correct UTC instant", () => {
  const before = fromPickerValues("2026-03-07", "07:00", NEW_YORK); // EST, UTC-5
  const after = fromPickerValues("2026-03-08", "07:00", NEW_YORK); // EDT, UTC-4

  assert.equal(before.dueAt, "2026-03-07T12:00:00.000Z");
  assert.equal(after.dueAt, "2026-03-08T11:00:00.000Z");
  assert.equal(after.hasTime, true);
});

test("fall back: 07:00 local resolves to the correct UTC instant", () => {
  const before = fromPickerValues("2026-10-31", "07:00", NEW_YORK); // EDT, UTC-4
  const after = fromPickerValues("2026-11-01", "07:00", NEW_YORK); // EST, UTC-5

  assert.equal(before.dueAt, "2026-10-31T11:00:00.000Z");
  assert.equal(after.dueAt, "2026-11-01T12:00:00.000Z");
});

test("a time survives a round trip through the picker across a DST boundary", () => {
  for (const date of ["2026-03-08", "2026-11-01"]) {
    const stored = fromPickerValues(date, "18:30", NEW_YORK);
    const back = toPickerValues(
      { dueAt: stored.dueAt, hasTime: stored.hasTime },
      NEW_YORK,
    );
    assert.deepEqual(back, { date, time: "18:30" });
  }
});

// ── Date-only tasks ──────────────────────────────────────────────────────

test("a date-only task never renders as a time", () => {
  const t = task({ dueAt: dateOnlyToStorage("2026-08-05"), hasTime: false });
  assert.equal(formatGutter(t, KOLKATA), "—");
  assert.equal(formatGutter(t, NEW_YORK), "—");
});

test("a date-only task keeps its date wherever the user opens the app", () => {
  const t = task({ dueAt: dateOnlyToStorage("2026-08-05"), hasTime: false });

  // Due at the very end of 5 August, in whichever timezone is current.
  assert.equal(
    effectiveDueAt(t, KOLKATA)!.toISOString(),
    "2026-08-05T18:29:59.999Z", // 23:59:59.999 +05:30
  );
  assert.equal(
    effectiveDueAt(t, NEW_YORK)!.toISOString(),
    "2026-08-06T03:59:59.999Z", // 23:59:59.999 -04:00
  );
});

test("a date-only task sorts after a timed task on the same day", () => {
  const timed = task({ dueAt: "2026-08-05T12:30:00.000Z", hasTime: true });
  const allDay = task({ dueAt: dateOnlyToStorage("2026-08-05"), hasTime: false });

  assert.ok(dueSortKey(timed, KOLKATA) < dueSortKey(allDay, KOLKATA));
});

test("a task with no due date sorts last", () => {
  assert.equal(dueSortKey(task(), KOLKATA), Number.POSITIVE_INFINITY);
});

test("a date-only task is not overdue until its day is fully over", () => {
  const t = task({ dueAt: dateOnlyToStorage("2026-08-05"), hasTime: false });

  const middayIST = new Date("2026-08-05T06:30:00.000Z"); // noon in Kolkata
  const justBeforeMidnight = new Date("2026-08-05T18:29:00.000Z");
  const justAfterMidnight = new Date("2026-08-05T18:31:00.000Z");

  assert.equal(isOverdue(t, middayIST, KOLKATA), false);
  assert.equal(isOverdue(t, justBeforeMidnight, KOLKATA), false);
  assert.equal(isOverdue(t, justAfterMidnight, KOLKATA), true);
});

// ── "Today" is local, never UTC ──────────────────────────────────────────

test("todayRangeUTC brackets the local day for a UTC+5:30 user", () => {
  const now = new Date("2026-08-05T10:00:00.000Z"); // 15:30 in Kolkata
  const { start, end } = todayRangeUTC(now, KOLKATA);

  assert.equal(start, "2026-08-04T18:30:00.000Z");
  assert.equal(end, "2026-08-05T18:29:59.999Z");
});

test("a task due at exactly local midnight belongs to that day", () => {
  const midnight = fromPickerValues("2026-08-05", "00:00", KOLKATA);
  assert.equal(midnight.dueAt, "2026-08-04T18:30:00.000Z");

  const t = task({ dueAt: midnight.dueAt, hasTime: true });
  const now = new Date("2026-08-05T10:00:00.000Z"); // 15:30 local, same day

  assert.equal(isDueByEndOfToday(t, now, KOLKATA), true);
  assert.equal(isOverdue(t, now, KOLKATA), true); // midnight has passed
});

test("tomorrow's date-only task is excluded for a negative-offset user", () => {
  // The trap: stored as 2026-08-06T00:00Z, which is numerically inside a Los
  // Angeles end-of-today bound. Comparing raw timestamps would wrongly include it.
  const tomorrow = task({
    dueAt: dateOnlyToStorage("2026-08-06"),
    hasTime: false,
    repeat: "never",
    spawnedFrom: null,
  });
  const now = new Date("2026-08-05T20:00:00.000Z"); // 13:00 in Los Angeles

  assert.equal(isDueByEndOfToday(tomorrow, now, "America/Los_Angeles"), false);
});

// ── Overdue wording — the part that works without colour ─────────────────

test("overdue wording is specific and reads as plain English", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");
  const chipFor = (dueAt: string, hasTime: boolean) =>
    formatDueChip(task({ dueAt, hasTime }), now, "UTC");

  assert.deepEqual(chipFor("2026-08-05T09:00:00.000Z", true), {
    text: "Earlier today",
    tone: "overdue",
  });
  assert.deepEqual(chipFor(dateOnlyToStorage("2026-08-04"), false), {
    text: "Yesterday",
    tone: "overdue",
  });
  assert.deepEqual(chipFor(dateOnlyToStorage("2026-08-02"), false), {
    text: "3 days ago",
    tone: "overdue",
  });
  assert.deepEqual(chipFor(dateOnlyToStorage("2026-07-29"), false), {
    text: "Last week",
    tone: "overdue",
  });
});

test("a task due today and still in the future carries no chip", () => {
  const now = new Date("2026-08-05T09:00:00.000Z");
  const t = task({ dueAt: "2026-08-05T18:00:00.000Z", hasTime: true });
  assert.equal(formatDueChip(t, now, "UTC"), null);
});

test("a future task is labelled by the day it falls on", () => {
  const now = new Date("2026-08-05T09:00:00.000Z"); // a Wednesday
  const chip = (d: string) =>
    formatDueChip(task({ dueAt: dateOnlyToStorage(d), hasTime: false }), now, "UTC");

  assert.deepEqual(chip("2026-08-06"), { text: "Tomorrow", tone: "muted" });
  assert.deepEqual(chip("2026-08-08"), { text: "Saturday", tone: "muted" });
  assert.deepEqual(chip("2026-09-20"), { text: "20 Sep", tone: "muted" });
});

test("a completed task is never overdue", () => {
  const t = task({
    dueAt: dateOnlyToStorage("2020-01-01"),
    hasTime: false,
    repeat: "never",
    spawnedFrom: null,
    isComplete: true,
  });
  assert.equal(isOverdue(t, new Date("2026-08-05T12:00:00.000Z"), KOLKATA), false);
});
