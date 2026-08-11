"use client";

import { Popover } from "radix-ui";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { REPEATS, type Repeat } from "@/data";
import { cn } from "@/lib/cn";
import {
  describeRepeat,
  fromPickerValues,
  getUserTimezone,
  REPEAT_LABELS,
  toPickerValues,
  todayInputValue,
} from "@/lib/dates";

/**
 * Built on the native `<input type="date">` and `<input type="time">`.
 *
 * A custom calendar would be prettier and would also bring its own keyboard
 * handling, its own locale bugs, its own screen-reader story and its own
 * mobile behaviour. The native controls already have all four, already respect
 * the user's regional date format, and cost nothing to ship.
 */

export interface DueValue {
  dueAt: string | null;
  hasTime: boolean;
  repeat: Repeat;
}

interface DueDatePickerProps {
  value: DueValue;
  onChange: (value: DueValue) => void;
  children: ReactNode;
  align?: "start" | "end";
}

export function DueDatePicker({
  value,
  onChange,
  children,
  align = "start",
}: DueDatePickerProps) {
  const tz = getUserTimezone();
  const dateId = useId();
  const timeId = useId();
  const repeatName = useId();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  /**
   * Re-read from the task on the way open, so the fields never show a stale
   * draft from a previous visit.
   *
   * Done here rather than in an effect watching `open`: this is a thing that
   * happens *because* the user opened the popover, and writing it as the
   * event it is avoids a render pass that exists only to correct the one
   * before it.
   */
  function handleOpenChange(next: boolean) {
    if (next) {
      const current = toPickerValues(value, tz);
      setDate(current.date);
      setTime(current.time);
    }
    setOpen(next);
  }

  /**
   * Clearing the date clears the repeat with it. The alternative is a task
   * that claims to repeat weekly and has no week to count from — the picker
   * would show "Weekly" selected against an empty date field, which is a
   * promise the app cannot keep.
   */
  function commit(nextDate: string, nextTime: string, nextRepeat = value.repeat) {
    setDate(nextDate);
    setTime(nextTime);
    const due = fromPickerValues(nextDate, nextTime, tz);
    onChange({ ...due, repeat: due.dueAt === null ? "never" : nextRepeat });
  }

  function shiftDays(days: number) {
    const base = new Date();
    base.setDate(base.getDate() + days);
    commit(todayInputValue(base, tz), time);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          className={cn(
            "panel gilded lifted z-50 w-[276px] rounded-lg p-4",
            "data-[state=open]:animate-[tally-pop-in_140ms_ease-out]",
          )}
        >
          <div className="mb-3 flex gap-1.5">
            {[
              { label: "Today", days: 0 },
              { label: "Tomorrow", days: 1 },
              { label: "Next week", days: 7 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => shiftDays(option.days)}
                className={cn(
                  "flex-1 rounded-md border border-rule px-2 py-1.5 text-meta text-ink-2",
                  "raised transition-[color,border-color,box-shadow,transform] duration-[140ms]",
                  "hover:border-gilt hover:text-ink",
                  "active:translate-y-px",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label
            htmlFor={dateId}
            className="engraved mb-1 block text-label uppercase text-ink-3"
          >
            Date
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => {
              // Clearing the date has to clear the time with it, or we would be
              // storing a time that belongs to no day.
              commit(e.target.value, e.target.value ? time : "");
            }}
            className={fieldClass}
          />

          {/*
           * Unavailable, not illegible.
           *
           * These controls used to dim to 45% opacity, which multiplies the
           * contrast down with everything else: the words measured 2.6:1 in
           * the powder theme, below the point at which they can be read at
           * all. WCAG exempts disabled controls from a contrast minimum, but
           * the exemption is about enforcement, not about intent — a person
           * has to be able to read what they cannot yet use in order to know
           * what choosing a date would give them.
           *
           * So the unavailable state is carried by tokens that are legible by
           * construction, the cursor, and the sentence underneath saying why.
           * Only the decorative dots actually fade.
           */}
          <label
            htmlFor={timeId}
            className="engraved mb-1 mt-3 block text-label uppercase text-ink-3"
          >
            Time
          </label>
          <input
            id={timeId}
            type="time"
            value={time}
            disabled={!date}
            onChange={(e) => commit(date, e.target.value)}
            className={cn(fieldClass, "disabled:cursor-not-allowed disabled:text-ink-3")}
          />
          {!date ? (
            <p className="mt-1.5 text-meta text-ink-2">
              Pick a date first — a time on its own has no day to sit on.
            </p>
          ) : null}

          {/* ── Repeat ──────────────────────────────────────────────────────
              A real radio group, not five buttons: arrow keys move between
              options, the whole group is one tab stop, and "Never" is
              reachable so a repeat can always be taken back off. */}
          <fieldset
            disabled={!date}
            className={cn(
              "mt-3",
              // Words stay readable; only the dots beside them fade.
              "disabled:[&_label]:cursor-not-allowed disabled:[&_label]:text-ink-3",
              "disabled:[&_[data-dot]]:opacity-40",
            )}
          >
            <legend className="engraved mb-1 block text-label uppercase text-ink-3">
              Repeats
            </legend>
            <div className="grid grid-cols-2 gap-1">
              {REPEATS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2",
                    "text-meta text-ink-2 transition-colors duration-[120ms]",
                    "hover:text-ink has-[:checked]:text-ink",
                    "has-[:checked]:bg-accent-soft",
                    "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
                    "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gilt",
                    // "Never" takes the full first row, above the four
                    // frequencies rather than beside one of them: it is the
                    // default and the way back out, not a fifth frequency.
                    option === "never" && "col-span-2",
                  )}
                >
                  <input
                    type="radio"
                    name={repeatName}
                    value={option}
                    checked={value.repeat === option}
                    onChange={() => commit(date, time, option)}
                    className="sr-only"
                  />
                  {/* Decoration, and decoration is never allowed to take a
                      click. Without `pointer-events-none` this dot sits over
                      the sr-only input and swallows anything aimed at it. */}
                  <span
                    aria-hidden="true"
                    data-dot
                    className={cn(
                      "pointer-events-none h-2 w-2 shrink-0 rounded-full",
                      "transition-[background-color,opacity] duration-[120ms]",
                      value.repeat === option ? "bg-gilt" : "bg-rule-strong",
                    )}
                  />
                  {REPEAT_LABELS[option]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* The rule, in words. A radio labelled "Monthly" does not say which
              day of the month it means, and that is the only thing anyone
              actually wants confirmed. */}
          {describeRepeat(value, tz) ? (
            <p className="mt-2 text-meta text-ink-3">{describeRepeat(value, tz)}</p>
          ) : null}

          <div className="mt-4 flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                commit("", "");
                setOpen(false);
              }}
              disabled={!value.dueAt}
            >
              Clear
            </Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const fieldClass = cn(
  "well h-10 w-full rounded-md px-3",
  "text-body text-ink",
  "transition-[border-color,box-shadow] duration-[140ms]",
);
