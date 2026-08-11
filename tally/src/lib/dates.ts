import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Repeat, Task } from "@/data/types";

/**
 * Every piece of date logic in Tally lives in this file. Nothing else may
 * import date-fns — there is a lint rule enforcing it — because timezone and
 * DST handling is the kind of thing that is subtly wrong in fourteen places if
 * you let it spread.
 *
 * ── The four rules ──────────────────────────────────────────────────────
 *
 * 1. Store UTC. Always. `dueAt` is an ISO-8601 string ending in `Z`.
 * 2. Convert at the boundary only. UTC → local when rendering, local → UTC
 *    when the user picks a date. Nothing in between touches timezones.
 * 3. `hasTime: false` means end-of-day in the user's *current* timezone,
 *    computed at read time — the user may have travelled since.
 * 4. "Today" is a local concept: local midnight to local midnight, converted
 *    to UTC for comparison. UTC midnight puts tasks in the wrong day for most
 *    of the world.
 *
 * ── How a date-only task is stored ──────────────────────────────────────
 *
 * A task due "Tuesday" has no instant attached to it — it is a calendar date.
 * We encode that date as `YYYY-MM-DDT00:00:00.000Z` and read back only its
 * *UTC* calendar fields. This matters: if we instead stored local midnight,
 * then a user who set "5 August" in Delhi and opened the app in New York would
 * find the task had slid to 4 August. Encoding the date rather than an instant
 * makes it travel-proof.
 *
 * `hasTime: true` is the opposite — `dueAt` is a genuine instant and is
 * rendered in whatever timezone the user is currently in, which is correct.
 */

/**
 * Everything that only needs to know *when* something is due — which is most
 * of this file, and lets the capture field reuse it before a task exists.
 */
export type DueLike = Pick<Task, "dueAt" | "hasTime">;

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Reads a Date's wall-clock fields as if they were in `tz`, returns the UTC instant. */
export function toUTC(local: Date, tz: string): string {
  return fromZonedTime(local, tz).toISOString();
}

/** Turns a UTC instant into a Date whose local fields show the wall clock in `tz`. */
export function fromUTC(iso: string, tz: string): Date {
  return toZonedTime(new Date(iso), tz);
}

// ─────────────────────────────────────────────────────────────────────────
// Date-only encoding
// ─────────────────────────────────────────────────────────────────────────

/** Encodes a plain calendar date (as typed into `<input type="date">`). */
export function dateOnlyToStorage(yyyyMmDd: string): string {
  return `${yyyyMmDd}T00:00:00.000Z`;
}

/** Reads the encoded calendar date back out, as `YYYY-MM-DD`. */
export function storageToDateOnly(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────
// Due-date maths
// ─────────────────────────────────────────────────────────────────────────

/**
 * The instant a task is actually due, resolved in the user's current timezone.
 *
 * A date-only task is due at the very end of its day — 23:59:59.999 local —
 * so that it stays "not yet due" for the whole of that day rather than turning
 * red at one minute past midnight.
 */
export function effectiveDueAt(due: DueLike, tz: string): Date | null {
  if (!due.dueAt) return null;
  if (due.hasTime) return new Date(due.dueAt);

  const [y, m, d] = storageToDateOnly(due.dueAt).split("-").map(Number);
  // Build the wall-clock end of that day, then resolve it in `tz`.
  const endOfDayWallClock = new Date(y!, m! - 1, d!, 23, 59, 59, 999);
  return fromZonedTime(endOfDayWallClock, tz);
}

export function isOverdue(task: Task, now: Date, tz: string): boolean {
  if (task.isComplete) return false;
  const due = effectiveDueAt(task, tz);
  return due !== null && due.getTime() < now.getTime();
}

/** Local midnight to local end-of-day, expressed as UTC instants. */
export function todayRangeUTC(
  now: Date,
  tz: string,
): { start: string; end: string } {
  const local = toZonedTime(now, tz);
  const y = local.getFullYear();
  const m = local.getMonth();
  const d = local.getDate();

  return {
    start: fromZonedTime(new Date(y, m, d, 0, 0, 0, 0), tz).toISOString(),
    end: fromZonedTime(new Date(y, m, d, 23, 59, 59, 999), tz).toISOString(),
  };
}

/** Everything the Today view holds: due at some point before tonight, or already late. */
export function isDueByEndOfToday(task: Task, now: Date, tz: string): boolean {
  const due = effectiveDueAt(task, tz);
  if (due === null) return false;
  return due.getTime() <= new Date(todayRangeUTC(now, tz).end).getTime();
}

/** True when the task's due date falls on today's calendar date, locally. */
export function isDueToday(task: Task, now: Date, tz: string): boolean {
  const due = effectiveDueAt(task, tz);
  if (due === null) return false;
  return (
    differenceInCalendarDays(toZonedTime(due, tz), toZonedTime(now, tz)) === 0
  );
}

/** Sort key. Tasks with no due date sort last. */
export function dueSortKey(task: Task, tz: string): number {
  const due = effectiveDueAt(task, tz);
  return due === null ? Number.POSITIVE_INFINITY : due.getTime();
}

// ─────────────────────────────────────────────────────────────────────────
// Recurrence
// ─────────────────────────────────────────────────────────────────────────

/**
 * The next time a repeating task is due, given the occurrence just completed.
 *
 * Three things here are not obvious, and each one is a bug that ships if it is
 * done the easy way instead:
 *
 * 1. **A day is a calendar day, not 86,400 seconds.** A daily 09:00 alarm has
 *    to stay at 09:00 across a daylight-saving boundary. Adding 24 hours to the
 *    UTC instant moves it to 08:00 or 10:00 for half the year, so the arithmetic
 *    is done on wall-clock fields in the user's timezone and converted back.
 *
 * 2. **Monthly counts from the original day, not from where it landed.** A task
 *    due the 31st clamps to the 28th in February, and then has to return to the
 *    31st in March. Advancing from the clamped date would walk it permanently
 *    down to the 28th — the same reason 29 February yearly has to remember it
 *    was the 29th.
 *
 * 3. **Completing late does not fire the backlog.** A weekly task ticked three
 *    weeks late produces one next occurrence, not three. The period is applied
 *    repeatedly until the result is in the future, which is what a person means
 *    by "weekly" and never "here are the two you missed".
 */
export function nextOccurrence(
  due: DueLike & { repeat: Repeat },
  tz: string,
  now: Date = new Date(),
): string | null {
  if (!due.dueAt || due.repeat === "never") return null;

  /*
   * Both branches step the same way — plain local field arithmetic on a Date
   * whose fields read as the wall clock we care about. Only the way in and the
   * way out differ:
   *
   *   timed      the instant, viewed in the user's timezone, and converted back
   *   date-only  the encoded calendar date, read as fields and re-encoded
   *
   * Mixing the two is the trap: a date-only task is stored as UTC midnight, so
   * reading it with local getters returns *yesterday* for every user west of
   * UTC, and the whole series slides a day.
   */
  const anchor = due.hasTime
    ? toZonedTime(new Date(due.dueAt), tz)
    : localDateFrom(storageToDateOnly(due.dueAt));

  const cutoff = due.hasTime
    ? toZonedTime(now, tz)
    : // For a date-only task, "in the future" means a later calendar date —
      // not a later instant. Compare at the start of today.
      localDateFrom(todayInputValue(now, tz));

  const originalDayOfMonth = anchor.getDate();

  let step = 0;
  let candidate = anchor;
  do {
    step += 1;
    candidate = advance(anchor, due.repeat, step, originalDayOfMonth);
  } while (candidate.getTime() <= cutoff.getTime() && step < MAX_CATCHUP_STEPS);

  return due.hasTime
    ? fromZonedTime(candidate, tz).toISOString()
    : dateOnlyToStorage(
        `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`,
      );
}

/** `YYYY-MM-DD` as midnight in the runtime's own timezone, for field maths. */
function localDateFrom(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * The ceiling on the catch-up loop above.
 *
 * A daily task last due in 2019 would otherwise spin through two thousand
 * iterations to reach today. That is still only microseconds, but an unbounded
 * loop driven by stored data is the kind of thing that turns a corrupt date
 * into a hung tab. Ten years of dailies is far past any real backlog.
 */
const MAX_CATCHUP_STEPS = 4000;

/** `anchor` plus `n` periods, keeping the original day of month intact. */
function advance(anchor: Date, repeat: Repeat, n: number, originalDay: number): Date {
  const next = new Date(anchor.getTime());

  switch (repeat) {
    case "daily":
      next.setDate(next.getDate() + n);
      break;
    case "weekly":
      next.setDate(next.getDate() + n * 7);
      break;
    case "monthly":
    case "yearly": {
      // Set the day to the 1st before moving the month, or the browser rolls
      // 31 January + 1 month over into 3 March on its own.
      next.setDate(1);
      if (repeat === "monthly") next.setMonth(next.getMonth() + n);
      else next.setFullYear(next.getFullYear() + n);
      next.setDate(Math.min(originalDay, daysInMonth(next)));
      break;
    }
    case "never":
      break;
  }

  return next;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  never: "Never",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** The plain-language echo under the picker: "Repeats every week from 11 Aug." */
export function describeRepeat(
  due: DueLike & { repeat: Repeat },
  tz: string,
): string | null {
  if (!due.dueAt || due.repeat === "never") return null;

  const every: Record<Exclude<Repeat, "never">, string> = {
    daily: "every day",
    weekly: "every week",
    monthly: "every month",
    yearly: "every year",
  };

  return `Repeats ${every[due.repeat]} from ${formatDueSummary(due, tz)}.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────

/** The em-dash shown when a task has no time. Its own kind of information. */
export const NO_TIME = "—";

/**
 * The time gutter — the signature element. 24-hour, because a 12-hour clock
 * needs an am/pm suffix that would break the fixed 64px column, and the column
 * only reads as a spine if every row is the same shape.
 */
export function formatGutter(due: DueLike, tz: string): string {
  if (!due.dueAt || !due.hasTime) return NO_TIME;
  return formatInTimeZone(new Date(due.dueAt), tz, "HH:mm");
}

/** "5 Aug" or "5 Aug at 18:00" — for confirming a date the user just chose. */
export function formatDueSummary(due: DueLike, tz: string): string {
  if (!due.dueAt) return "";
  const at = effectiveDueAt(due, tz)!;
  const day = formatInTimeZone(at, tz, "d MMM");
  return due.hasTime
    ? `${day} at ${formatInTimeZone(new Date(due.dueAt), tz, "HH:mm")}`
    : day;
}

export type DueChip = { text: string; tone: "overdue" | "muted" };

/**
 * The bit of due-date context the gutter cannot carry: how late a task is, or
 * which day it belongs to when that day is not today.
 *
 * The overdue wording here is what makes lateness perceivable in a greyscale
 * screenshot. Roughly one man in twelve cannot pick the crimson out, so the
 * colour is never allowed to be the only signal.
 */
export function formatDueChip(
  task: Task,
  now: Date,
  tz: string,
): DueChip | null {
  const due = effectiveDueAt(task, tz);
  if (due === null) return null;

  const daysLate = differenceInCalendarDays(
    toZonedTime(now, tz),
    toZonedTime(due, tz),
  );

  if (isOverdue(task, now, tz)) {
    return { text: overdueWording(daysLate, due, tz), tone: "overdue" };
  }

  // Not late, and due today — the gutter already says everything.
  if (daysLate === 0) return null;

  return { text: formatDayLabel(due, now, tz), tone: "muted" };
}

function overdueWording(daysLate: number, due: Date, tz: string): string {
  if (daysLate <= 0) return "Earlier today";
  if (daysLate === 1) return "Yesterday";
  if (daysLate < 7) return `${daysLate} days ago`;
  if (daysLate < 14) return "Last week";
  if (daysLate < 31) return `${Math.floor(daysLate / 7)} weeks ago`;
  return formatInTimeZone(due, tz, "d MMM yyyy");
}

function formatDayLabel(due: Date, now: Date, tz: string): string {
  const days = differenceInCalendarDays(
    toZonedTime(due, tz),
    toZonedTime(now, tz),
  );
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return formatInTimeZone(due, tz, "EEEE");
  return formatInTimeZone(
    due,
    tz,
    due.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy",
  );
}

/**
 * The day heading a completed task sits under in the Completed column.
 *
 * Completion is the one thing here measured from `completedAt` rather than
 * `dueAt` — the column is a record of when work actually got done, which is
 * frequently not the day it was meant to be.
 */
export function formatCompletedDay(
  completedAt: string,
  now: Date,
  tz: string,
): string {
  const at = new Date(completedAt);
  const days = differenceInCalendarDays(
    toZonedTime(now, tz),
    toZonedTime(at, tz),
  );

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return formatInTimeZone(
    at,
    tz,
    at.getFullYear() === now.getFullYear() ? "d MMM" : "d MMM yyyy",
  );
}

/** Full, unambiguous phrasing for tooltips and screen readers. */
export function formatDueForScreenReader(due: DueLike, tz: string): string {
  if (!due.dueAt) return "No due date";
  return due.hasTime
    ? `Due ${formatInTimeZone(new Date(due.dueAt), tz, "EEEE d MMMM yyyy 'at' HH:mm")}`
    : `Due ${formatInTimeZone(effectiveDueAt(due, tz)!, tz, "EEEE d MMMM yyyy")}, no set time`;
}

// ─────────────────────────────────────────────────────────────────────────
// Native picker bridge
// ─────────────────────────────────────────────────────────────────────────

/** Fills `<input type="date">` and `<input type="time">` from a task. */
export function toPickerValues(
  due: DueLike,
  tz: string,
): { date: string; time: string } {
  if (!due.dueAt) return { date: "", time: "" };
  if (!due.hasTime) return { date: storageToDateOnly(due.dueAt), time: "" };

  const at = new Date(due.dueAt);
  return {
    date: formatInTimeZone(at, tz, "yyyy-MM-dd"),
    time: formatInTimeZone(at, tz, "HH:mm"),
  };
}

/**
 * Turns what the two native inputs hold into storage form.
 *
 * A date alone is valid and means "some time that day". A time alone is not —
 * the picker disables the time field until a date exists, and this is the
 * second line of defence behind that.
 */
export function fromPickerValues(
  date: string,
  time: string,
  tz: string,
): { dueAt: string | null; hasTime: boolean } {
  if (!date) return { dueAt: null, hasTime: false };
  if (!time) return { dueAt: dateOnlyToStorage(date), hasTime: false };

  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallClock = new Date(y!, m! - 1, d!, hh ?? 0, mm ?? 0, 0, 0);

  return { dueAt: toUTC(wallClock, tz), hasTime: true };
}

/** Today's date in `YYYY-MM-DD`, for the picker's sensible default. */
export function todayInputValue(now: Date, tz: string): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

// ─────────────────────────────────────────────────────────────────────────
// Calendar days
// ─────────────────────────────────────────────────────────────────────────

/**
 * The local calendar day an instant falls on, as `YYYY-MM-DD`.
 *
 * The key the activity grid is built on. It has to be the *local* day: a task
 * finished at 01:00 in Kolkata happened on the 5th, and bucketing it by its
 * UTC date would file it under the 4th and put the wrong square on the wall.
 *
 * The format sorts lexicographically, which is why the grid can compare days
 * with `<` and never parse anything twice.
 */
export function dayKeyOf(instant: Date | string, tz: string): string {
  return formatInTimeZone(new Date(instant), tz, "yyyy-MM-dd");
}

/** `YYYY-MM-DD` shifted by whole calendar days, staying a calendar date. */
export function shiftDayKey(key: string, days: number): string {
  const date = localDateFrom(key);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday = 0 … Sunday = 6. The week the activity grid is drawn in. */
export function weekdayIndex(key: string): number {
  return (localDateFrom(key).getDay() + 6) % 7;
}

/** "5 August 2026" — the heading on a day's dialog. */
export function formatDayKeyLong(key: string): string {
  const date = localDateFrom(key);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Aug" — the column headings across the top of the grid. */
export function formatDayKeyMonth(key: string): string {
  return localDateFrom(key).toLocaleDateString(undefined, { month: "short" });
}
