"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import type { List, Task } from "@/data";
import { cn } from "@/lib/cn";
import {
  formatDayKeyLong,
  formatDayKeyMonth,
  getUserTimezone,
  weekdayIndex,
} from "@/lib/dates";
import { useNow } from "@/lib/useNow";
import { activityLevel, selectActivity, type DayActivity } from "@/store/selectors";
import { EmptyState } from "../tasks/EmptyState";
import { TaskRow } from "../tasks/TaskRow";

/**
 * A year of days, one square each, darkest where the most got finished.
 *
 * The point is not the decoration. A to-do list only ever shows you the
 * present tense — what is left — and is therefore very good at making a
 * productive month feel like nothing happened. This is the other half of the
 * record: the days you cleared, and the days that ended still owing something.
 *
 * Clicking a square opens that day: what was completed on it, and what was due
 * on it and was not.
 */

/** 53 columns is a year with the partial weeks at both ends. */
const WEEKS = 53;

/** Only every other row is labelled, or the labels crowd the squares out. */
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

export function ActivityView({ tasks, lists }: { tasks: Task[]; lists: List[] }) {
  const tz = getUserTimezone();
  const now = useNow();
  const [openDay, setOpenDay] = useState<DayActivity | null>(null);

  const days = useMemo(() => selectActivity(tasks, now, tz, WEEKS), [tasks, now, tz]);
  const busiest = useMemo(
    () => days.reduce((max, day) => Math.max(max, day.completed.length), 0),
    [days],
  );

  if (tasks.length === 0) {
    return (
      <EmptyState headline="Nothing to look back on yet">
        Finish a task and it appears here, on the day you finished it.
      </EmptyState>
    );
  }

  const totalCompleted = days.reduce((sum, day) => sum + day.completed.length, 0);

  return (
    <div>
      <p className="mb-4 px-2 text-meta text-ink-2">
        {totalCompleted === 0
          ? "Nothing finished in the last year — yet."
          : `${totalCompleted} ${totalCompleted === 1 ? "task" : "tasks"} finished in the last year.`}
      </p>

      {/* The grid is wider than a phone and always will be — a year is 53
          columns. It scrolls inside itself so the page never does. */}
      <div className="panel gilded overflow-x-auto rounded-lg p-4">
        <Grid days={days} busiest={busiest} onOpen={setOpenDay} />
      </div>

      <Legend />

      <Dialog
        open={openDay !== null}
        onOpenChange={(open) => {
          if (!open) setOpenDay(null);
        }}
        title={openDay ? formatDayKeyLong(openDay.key) : ""}
        description={openDay ? summarise(openDay) : undefined}
      >
        {openDay ? <DayDetail day={openDay} lists={lists} /> : null}
      </Dialog>
    </div>
  );
}

function summarise(day: DayActivity): string {
  const done = day.completed.length;
  const left = day.outstanding.length;

  if (done === 0 && left === 0) return "Nothing was due, and nothing was finished.";
  const parts: string[] = [];
  if (done > 0) parts.push(`${done} finished`);
  if (left > 0) parts.push(`${left} left undone`);
  return `${parts.join(", ")}.`;
}

/**
 * The squares.
 *
 * One tab stop, not three hundred and seventy. A grid of buttons that each
 * took the tab key would bury everything after it on the page, so focus moves
 * inside with the arrow keys — left and right by a week, up and down by a day,
 * which is what the layout looks like it should do.
 */
function Grid({
  days,
  busiest,
  onOpen,
}: {
  days: DayActivity[];
  busiest: number;
  onOpen: (day: DayActivity) => void;
}) {
  const [focused, setFocused] = useState(days.length - 1);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);

  // The first column can start mid-week; those leading blanks keep every row a
  // weekday all the way across.
  const leading = days.length > 0 ? weekdayIndex(days[0]!.key) : 0;

  function move(to: number) {
    const next = Math.max(0, Math.min(days.length - 1, to));
    setFocused(next);
    cells.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    const delta = moves[event.key];

    if (delta !== undefined) {
      event.preventDefault();
      move(focused + delta);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      move(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      move(days.length - 1);
    }
  }

  return (
    <div className="flex gap-2">
      <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-[18px]">
        {WEEKDAYS.map((label, row) => (
          <span
            key={row}
            className="flex h-[11px] items-center text-[10px] leading-none text-ink-3"
          >
            {label}
          </span>
        ))}
      </div>

      <div>
        <MonthLabels days={days} leading={leading} />

        <div
          role="grid"
          data-tour="activity-grid"
          aria-label="Task activity by day, one square per day"
          onKeyDown={onKeyDown}
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
        >
          {Array.from({ length: leading }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden="true" className="h-[11px] w-[11px]" />
          ))}

          {days.map((day, index) => (
            <Square
              key={day.key}
              ref={(node) => {
                cells.current[index] = node;
              }}
              day={day}
              busiest={busiest}
              tabIndex={index === focused ? 0 : -1}
              onFocus={() => setFocused(index)}
              onClick={() => onOpen(day)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Square({
  ref,
  day,
  busiest,
  tabIndex,
  onFocus,
  onClick,
}: {
  ref: (node: HTMLButtonElement | null) => void;
  day: DayActivity;
  busiest: number;
  tabIndex: number;
  onFocus: () => void;
  onClick: () => void;
}) {
  const level = activityLevel(day.completed.length, busiest);
  const label = `${formatDayKeyLong(day.key)}: ${summarise(day)}`;

  return (
    <button
      ref={ref}
      type="button"
      role="gridcell"
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-[11px] w-[11px] rounded-[2px] transition-[outline-color] duration-[120ms]",
        LEVELS[level],
        // A day that ended owing something is ringed rather than recoloured.
        // A second hue here would compete with the one the grid is built on,
        // and the ring survives being read in greyscale besides.
        day.outstanding.length > 0 && "outline outline-1 outline-overdue",
      )}
    />
  );
}

/**
 * Five steps of the accent, and nothing else.
 *
 * GitHub's wall is green because green is its brand; ours is powder at night
 * and navy by day for the same reason. Level 0 is the well the squares are cut
 * into, so an empty day reads as absence rather than as a very faint presence.
 */
const LEVELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface-sunk",
  1: "bg-[color-mix(in_srgb,var(--color-accent)_22%,var(--color-surface-sunk))]",
  2: "bg-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-surface-sunk))]",
  3: "bg-[color-mix(in_srgb,var(--color-accent)_70%,var(--color-surface-sunk))]",
  4: "bg-accent",
};

/** A month's label sits above the first column that month appears in. */
function MonthLabels({ days, leading }: { days: DayActivity[]; leading: number }) {
  const labels: { column: number; text: string }[] = [];
  let previous = "";

  for (const [index, day] of days.entries()) {
    const month = formatDayKeyMonth(day.key);
    if (month === previous) continue;
    previous = month;

    const column = Math.floor((index + leading) / 7);
    // A month whose first day lands in the last few days of a column would
    // print its label over the previous month's squares.
    if (labels.length > 0 && column - labels[labels.length - 1]!.column < 3) continue;
    labels.push({ column, text: month });
  }

  return (
    <div className="relative mb-1 h-[14px]">
      {labels.map((label) => (
        <span
          key={`${label.text}-${label.column}`}
          aria-hidden="true"
          className="absolute top-0 text-[10px] leading-none text-ink-3"
          style={{ left: `${label.column * 14}px` }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex items-center justify-end gap-1.5 px-2 text-[10px] text-ink-3">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span
          key={level}
          aria-hidden="true"
          className={cn("h-[11px] w-[11px] rounded-[2px]", LEVELS[level])}
        />
      ))}
      <span>More</span>
      <span className="ml-3 inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-[11px] w-[11px] rounded-[2px] bg-surface-sunk outline outline-1 outline-overdue"
        />
        Ended undone
      </span>
    </div>
  );
}

/** One day, opened: what got finished, and what that day still owed. */
function DayDetail({ day, lists }: { day: DayActivity; lists: List[] }) {
  if (day.completed.length === 0 && day.outstanding.length === 0) {
    return (
      <p className="text-meta text-ink-2">
        A quiet day. Nothing was due, and nothing was checked off.
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] space-y-5 overflow-y-auto">
      {day.completed.length > 0 ? (
        <section aria-labelledby="day-completed">
          <h3
            id="day-completed"
            className="engraved px-2 pb-1.5 text-label uppercase text-ink-3"
          >
            Completed
            <span className="sr-only">
              , {day.completed.length === 1 ? "1 task" : `${day.completed.length} tasks`}
            </span>
          </h3>
          <ul className="panel gilded overflow-hidden rounded-lg">
            {day.completed.map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} compact />
            ))}
          </ul>
        </section>
      ) : null}

      {day.outstanding.length > 0 ? (
        <section aria-labelledby="day-outstanding">
          <h3
            id="day-outstanding"
            className="engraved px-2 pb-1.5 text-label uppercase text-ink-3"
          >
            Left undone
            <span className="sr-only">
              ,{" "}
              {day.outstanding.length === 1
                ? "1 task"
                : `${day.outstanding.length} tasks`}
            </span>
          </h3>
          <ul className="panel gilded overflow-hidden rounded-lg">
            {day.outstanding.map((task) => (
              <TaskRow key={task.id} task={task} lists={lists} compact />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
