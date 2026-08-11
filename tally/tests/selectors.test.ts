import assert from "node:assert/strict";
import test from "node:test";

import {
  activityLevel,
  groupByCompletedDay,
  selectActivity,
  selectCompletedTasksForList,
  selectCompletedToday,
  selectOpenCount,
  selectOpenTasksForList,
  selectSearchResults,
  selectTodayCount,
  selectTodayTasks,
  splitOnMatch,
} from "../src/store/selectors.ts";
import { dateOnlyToStorage } from "../src/lib/dates.ts";
import type { Task } from "../src/data/types.ts";

const TZ = "Asia/Kolkata";
const NOW = new Date("2026-08-05T10:00:00.000Z"); // 15:30 local

let seq = 0;
function task(patch: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    listId: "inbox",
    title: `Task ${seq}`,
    notes: null,
    dueAt: null,
    hasTime: false,
    repeat: "never",
    spawnedFrom: null,
    priority: "none",
    isComplete: false,
    position: seq * 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...patch,
  };
}

// ── List views ───────────────────────────────────────────────────────────

test("a list shows only its own open tasks, in position order", () => {
  const tasks = [
    task({ listId: "uni", position: 3000, title: "Third" }),
    task({ listId: "uni", position: 1000, title: "First" }),
    task({ listId: "work", position: 2000, title: "Elsewhere" }),
    task({ listId: "uni", position: 2000, title: "Second", isComplete: true }),
  ];

  assert.deepEqual(
    selectOpenTasksForList(tasks, "uni").map((t) => t.title),
    ["First", "Third"],
  );
});

test("completed tasks surface most recently finished first", () => {
  const tasks = [
    task({ listId: "uni", isComplete: true, completedAt: "2026-08-01T10:00:00.000Z", title: "Older" }),
    task({ listId: "uni", isComplete: true, completedAt: "2026-08-04T10:00:00.000Z", title: "Newer" }),
  ];

  assert.deepEqual(
    selectCompletedTasksForList(tasks, "uni").map((t) => t.title),
    ["Newer", "Older"],
  );
});

test("the sidebar count is open tasks only, per list", () => {
  const tasks = [
    task({ listId: "uni" }),
    task({ listId: "uni", isComplete: true }),
    task({ listId: "work" }),
  ];

  assert.equal(selectOpenCount(tasks, "uni"), 1);
  assert.equal(selectOpenCount(tasks, "work"), 1);
  assert.equal(selectOpenCount(tasks, "nothing-here"), 0);
});

// ── Today ────────────────────────────────────────────────────────────────

test("Today gathers from every list and splits late from due", () => {
  const tasks = [
    task({ listId: "uni", title: "Late", dueAt: "2026-08-05T04:00:00.000Z", hasTime: true }),
    task({ listId: "work", title: "Later today", dueAt: "2026-08-05T14:00:00.000Z", hasTime: true }),
    task({ listId: "home", title: "Yesterday", dueAt: dateOnlyToStorage("2026-08-04") }),
  ];

  const { overdue, today } = selectTodayTasks(tasks, NOW, TZ);
  assert.deepEqual(overdue.map((t) => t.title), ["Yesterday", "Late"]);
  assert.deepEqual(today.map((t) => t.title), ["Later today"]);
});

test("Today never shows an undated task", () => {
  const { overdue, today } = selectTodayTasks([task({ title: "Someday" })], NOW, TZ);
  assert.equal(overdue.length + today.length, 0);
});

test("Today never shows a completed task", () => {
  const tasks = [
    task({ dueAt: "2026-08-05T04:00:00.000Z", hasTime: true, isComplete: true }),
  ];
  const { overdue, today } = selectTodayTasks(tasks, NOW, TZ);
  assert.equal(overdue.length + today.length, 0);
  assert.equal(selectTodayCount(tasks, NOW, TZ), 0);
});

test("tomorrow is not today, even for a negative-offset user", () => {
  const tomorrow = [task({ dueAt: dateOnlyToStorage("2026-08-06") })];
  const { overdue, today } = selectTodayTasks(
    tomorrow,
    new Date("2026-08-05T20:00:00.000Z"), // 13:00 in Los Angeles
    "America/Los_Angeles",
  );
  assert.equal(overdue.length + today.length, 0);
});

test("priority breaks a tie between two tasks due at the same moment", () => {
  const at = "2026-08-05T14:00:00.000Z";
  const tasks = [
    task({ title: "Low", dueAt: at, hasTime: true, priority: "low" }),
    task({ title: "High", dueAt: at, hasTime: true, priority: "high" }),
    task({ title: "Medium", dueAt: at, hasTime: true, priority: "medium" }),
  ];

  const { today } = selectTodayTasks(tasks, NOW, TZ);
  assert.deepEqual(today.map((t) => t.title), ["High", "Medium", "Low"]);
});

test("a date-only task sorts after a timed one on the same day", () => {
  const tasks = [
    task({ title: "All day", dueAt: dateOnlyToStorage("2026-08-05") }),
    task({ title: "At 18:00", dueAt: "2026-08-05T12:30:00.000Z", hasTime: true }),
  ];
  const { today } = selectTodayTasks(tasks, NOW, TZ);
  assert.deepEqual(today.map((t) => t.title), ["At 18:00", "All day"]);
});

test("the Completed shelf in Today holds only work that was due today", () => {
  const tasks = [
    task({ title: "Done today", dueAt: "2026-08-05T04:00:00.000Z", hasTime: true, isComplete: true, completedAt: "2026-08-05T09:00:00.000Z" }),
    task({ title: "Done, due next week", dueAt: dateOnlyToStorage("2026-08-20"), isComplete: true, completedAt: "2026-08-05T09:00:00.000Z" }),
  ];

  assert.deepEqual(
    selectCompletedToday(tasks, NOW, TZ).map((t) => t.title),
    ["Done today"],
  );
});

// ── Search ───────────────────────────────────────────────────────────────

test("search is case-insensitive and covers notes", () => {
  const tasks = [
    task({ title: "Read the RUST book" }),
    task({ title: "Call the bank", notes: "ask about rust-proofing" }),
    task({ title: "Nothing relevant" }),
  ];

  assert.equal(selectSearchResults(tasks, "rust").length, 2);
  assert.equal(selectSearchResults(tasks, "  ").length, 0);
});

test("search puts open tasks above finished ones", () => {
  const tasks = [
    task({ title: "rust done", isComplete: true, position: 1 }),
    task({ title: "rust open", position: 2 }),
  ];
  assert.deepEqual(
    selectSearchResults(tasks, "rust").map((t) => t.title),
    ["rust open", "rust done"],
  );
});

// ── Highlighting ─────────────────────────────────────────────────────────

test("splitOnMatch marks every occurrence and loses no characters", () => {
  const parts = splitOnMatch("Rust and more rust", "rust");
  assert.equal(parts.map((p) => p.text).join(""), "Rust and more rust");
  assert.deepEqual(
    parts.filter((p) => p.match).map((p) => p.text),
    ["Rust", "rust"],
  );
});

// ── The completed column's day headings ──────────────────────────────────

test("completed work is bucketed under the day it was actually finished", () => {
  const groups = groupByCompletedDay(
    [
      task({ isComplete: true, completedAt: "2026-08-05T09:00:00.000Z" }),
      task({ isComplete: true, completedAt: "2026-08-05T04:00:00.000Z" }),
      task({ isComplete: true, completedAt: "2026-08-04T04:00:00.000Z" }),
      task({ isComplete: true, completedAt: "2026-07-30T04:00:00.000Z" }),
    ],
    NOW,
    TZ,
  );

  assert.deepEqual(
    groups.map((g) => [g.label, g.tasks.length]),
    [
      ["Today", 2],
      ["Yesterday", 1],
      ["30 Jul", 1],
    ],
  );
});

test("the day is read in the user's timezone, not UTC", () => {
  // 20:30 UTC on the 4th is 02:00 local on the 5th in Kolkata — "Today", not
  // "Yesterday". Grouping on the raw ISO date gets this backwards every night.
  const groups = groupByCompletedDay(
    [task({ isComplete: true, completedAt: "2026-08-04T20:30:00.000Z" })],
    NOW,
    TZ,
  );
  assert.equal(groups[0]!.label, "Today");
});

test("a completed task with no timestamp is left out rather than invented", () => {
  const groups = groupByCompletedDay(
    [task({ isComplete: true, completedAt: null })],
    NOW,
    TZ,
  );
  assert.deepEqual(groups, []);
});

// ── The activity grid ────────────────────────────────────────────────────

/** The day cell for a given key, from a full year of them. */
const dayOf = (tasks: Task[], key: string) =>
  selectActivity(tasks, NOW, TZ).find((d) => d.key === key)!;

test("a day holds what was finished on it, whenever it was due", () => {
  const tasks = [
    task({
      title: "Due last week, done today",
      dueAt: dateOnlyToStorage("2026-07-29"),
      isComplete: true,
      completedAt: "2026-08-05T09:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    dayOf(tasks, "2026-08-05").completed.map((t) => t.title),
    ["Due last week, done today"],
  );
});

test("a task finished late is outstanding on its due day and completed on the day it was done", () => {
  /*
   * The whole reason the two counts are separate. Filing this task only under
   * the day it was finished would show a clean week that was not clean; filing
   * it only under its due date would hide the fact that it eventually got done.
   */
  const tasks = [
    task({
      title: "Late",
      dueAt: dateOnlyToStorage("2026-07-29"),
      isComplete: true,
      completedAt: "2026-08-05T09:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    dayOf(tasks, "2026-07-29").outstanding.map((t) => t.title),
    ["Late"],
  );
  assert.equal(dayOf(tasks, "2026-07-29").completed.length, 0);
  assert.equal(dayOf(tasks, "2026-08-05").outstanding.length, 0);
});

test("a task finished on the day it was due leaves that day owing nothing", () => {
  const tasks = [
    task({
      dueAt: dateOnlyToStorage("2026-08-04"),
      isComplete: true,
      completedAt: "2026-08-04T09:00:00.000Z",
    }),
  ];

  assert.equal(dayOf(tasks, "2026-08-04").outstanding.length, 0);
  assert.equal(dayOf(tasks, "2026-08-04").completed.length, 1);
});

test("a task still open counts against its due day", () => {
  const tasks = [task({ title: "Never done", dueAt: dateOnlyToStorage("2026-08-03") })];
  assert.deepEqual(
    dayOf(tasks, "2026-08-03").outstanding.map((t) => t.title),
    ["Never done"],
  );
});

test("an undated task never appears on the wall", () => {
  const tasks = [task({ dueAt: null })];
  const days = selectActivity(tasks, NOW, TZ);
  assert.equal(
    days.reduce((n, d) => n + d.completed.length + d.outstanding.length, 0),
    0,
  );
});

test("the day is the user's local one, not UTC", () => {
  // 20:30 UTC on the 4th is 02:00 on the 5th in Kolkata. Bucketing on the raw
  // ISO date would put the square one column to the left.
  const tasks = [
    task({ isComplete: true, completedAt: "2026-08-04T20:30:00.000Z" }),
  ];
  assert.equal(dayOf(tasks, "2026-08-05").completed.length, 1);
  assert.equal(dayOf(tasks, "2026-08-04").completed.length, 0);
});

test("the grid ends today and begins on a Monday", () => {
  const days = selectActivity([], NOW, TZ);
  assert.equal(days[days.length - 1]!.key, "2026-08-05");
  assert.equal(new Date(`${days[0]!.key}T00:00:00`).getDay(), 1);

  // The window is 53 weeks, and then the start snaps back to that week's
  // Monday — up to six days further. Every column is a whole week, which is
  // the point; the grid is allowed to be 54 columns wide because of it.
  assert.ok(days.length >= 53 * 7 && days.length <= 53 * 7 + 6, `${days.length} days`);
});

test("the future is not drawn", () => {
  const days = selectActivity([], NOW, TZ);
  assert.ok(days.every((d) => d.key <= "2026-08-05"));
});

test("shading is relative to the busiest day, and any work is visible", () => {
  // One task on a day where the best was twelve is still a mark on the wall.
  assert.equal(activityLevel(1, 12), 1);
  assert.equal(activityLevel(0, 12), 0);
  assert.equal(activityLevel(12, 12), 4);
  assert.equal(activityLevel(6, 12), 2);
  // A week with a single task on a single day is that week's best.
  assert.equal(activityLevel(1, 1), 4);
});

test("splitOnMatch treats markup as literal text, never as a pattern", () => {
  // The reason highlighting is built from nodes rather than innerHTML.
  const nasty = "<script>alert(1)</script>";
  const parts = splitOnMatch(nasty, "script");
  assert.equal(parts.map((p) => p.text).join(""), nasty);
  assert.equal(parts.filter((p) => p.match).length, 2);
});

test("an empty query leaves the text in one piece", () => {
  assert.deepEqual(splitOnMatch("Anything", ""), [
    { text: "Anything", match: false },
  ]);
});
