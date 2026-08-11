import assert from "node:assert/strict";
import test from "node:test";

import { describeRepeat, nextOccurrence } from "../src/lib/dates.ts";
import type { Repeat } from "../src/data/types.ts";

/**
 * Recurrence arithmetic.
 *
 * Every case in here is one that a naive implementation gets wrong and that no
 * amount of clicking around finds: they need a specific timezone, a specific
 * day of the month, or a clock wound forward past a boundary. That is exactly
 * the shape of thing that belongs in a unit test rather than in an e2e run.
 */

const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST
const NEW_YORK = "America/New_York"; // observes DST
const LOS_ANGELES = "America/Los_Angeles"; // UTC-8, west of UTC

function due(dueAt: string | null, hasTime: boolean, repeat: Repeat) {
  return { dueAt, hasTime, repeat };
}

// ── The off switch ───────────────────────────────────────────────────────

test("a task that does not repeat has no next occurrence", () => {
  assert.equal(
    nextOccurrence(due("2026-08-11T09:30:00.000Z", true, "never"), KOLKATA),
    null,
  );
});

test("a repeat with no due date has nothing to count from", () => {
  assert.equal(nextOccurrence(due(null, false, "weekly"), KOLKATA), null);
});

// ── Daily, and the DST trap ──────────────────────────────────────────────

test("daily moves one calendar day and keeps the wall-clock time", () => {
  // 09:30 in Kolkata on 11 August.
  const next = nextOccurrence(
    due("2026-08-11T04:00:00.000Z", true, "daily"),
    KOLKATA,
    new Date("2026-08-11T05:00:00.000Z"),
  );
  assert.equal(next, "2026-08-12T04:00:00.000Z");
});

test("daily across a spring-forward boundary stays at the same clock time", () => {
  /*
   * 08:00 New York on 7 March 2027. The clocks go forward on 14 March, so the
   * occurrence on the 14th is 12:00 UTC where every earlier one was 13:00.
   * Adding 24 hours to the instant would land it at 09:00 local instead, which
   * is the bug this test exists for.
   */
  const seventh = "2027-03-07T13:00:00.000Z";
  let cursor = seventh;
  for (let day = 8; day <= 14; day += 1) {
    cursor = nextOccurrence(
      due(cursor, true, "daily"),
      NEW_YORK,
      new Date(`2027-03-${String(day - 1).padStart(2, "0")}T20:00:00.000Z`),
    )!;
  }

  assert.equal(cursor, "2027-03-14T12:00:00.000Z");
});

// ── Date-only tasks, and the timezone trap ───────────────────────────────

test("a date-only weekly task lands on the same weekday, west of UTC too", () => {
  // Stored as UTC midnight. Read with local getters in Los Angeles this is
  // 4 August at 17:00 — and the whole series slides a day if you let it.
  const next = nextOccurrence(
    due("2026-08-05T00:00:00.000Z", false, "weekly"),
    LOS_ANGELES,
    new Date("2026-08-05T18:00:00.000Z"),
  );
  assert.equal(next, "2026-08-12T00:00:00.000Z");
});

test("a date-only task due today advances rather than returning today", () => {
  const next = nextOccurrence(
    due("2026-08-11T00:00:00.000Z", false, "daily"),
    KOLKATA,
    new Date("2026-08-11T03:00:00.000Z"),
  );
  assert.equal(next, "2026-08-12T00:00:00.000Z");
});

// ── Month ends ───────────────────────────────────────────────────────────

test("monthly on the 31st clamps to February and then returns to the 31st", () => {
  const january = "2027-01-31T00:00:00.000Z";

  const february = nextOccurrence(
    due(january, false, "monthly"),
    KOLKATA,
    new Date("2027-01-31T06:00:00.000Z"),
  );
  assert.equal(february, "2027-02-28T00:00:00.000Z");

  // The series counts from the original day, so March is the 31st again —
  // advancing from the clamped date would walk it down to the 28th forever.
  const march = nextOccurrence(
    due(february, false, "monthly"),
    KOLKATA,
    new Date("2027-02-28T06:00:00.000Z"),
  );
  assert.equal(march, "2027-03-28T00:00:00.000Z");
});

test("yearly on 29 February falls back to the 28th in a common year", () => {
  const next = nextOccurrence(
    due("2028-02-29T00:00:00.000Z", false, "yearly"),
    KOLKATA,
    new Date("2028-02-29T06:00:00.000Z"),
  );
  assert.equal(next, "2029-02-28T00:00:00.000Z");
});

// ── Completing late ──────────────────────────────────────────────────────

test("finishing three weeks late produces one occurrence, not three", () => {
  const next = nextOccurrence(
    due("2026-08-05T00:00:00.000Z", false, "weekly"),
    KOLKATA,
    // Ticked on 25 August: the 12th and the 19th are gone, not queued up.
    new Date("2026-08-25T06:00:00.000Z"),
  );
  assert.equal(next, "2026-08-26T00:00:00.000Z");
});

test("the catch-up loop terminates on a date left behind years ago", () => {
  const next = nextOccurrence(
    due("2016-01-01T00:00:00.000Z", false, "daily"),
    KOLKATA,
    new Date("2026-08-11T06:00:00.000Z"),
  );
  // The ceiling is 4000 daily steps, which 2016 sits inside — the point is
  // that it returns at all rather than spinning.
  assert.equal(next, "2026-08-12T00:00:00.000Z");
});

// ── The words under the picker ───────────────────────────────────────────

test("the repeat is described in plain language, anchored to its date", () => {
  assert.equal(
    describeRepeat(due("2026-08-11T00:00:00.000Z", false, "weekly"), KOLKATA),
    "Repeats every week from 11 Aug.",
  );
});

test("nothing is described when nothing repeats", () => {
  assert.equal(
    describeRepeat(due("2026-08-11T00:00:00.000Z", false, "never"), KOLKATA),
    null,
  );
});
