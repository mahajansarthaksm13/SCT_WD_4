"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, CloseIcon } from "@/components/Icon";
import { TITLE_MAX } from "@/data";
import { cn } from "@/lib/cn";
import {
  formatDueForScreenReader,
  formatDueSummary,
  getUserTimezone,
} from "@/lib/dates";
import { useTaskStore } from "@/store/useTaskStore";
import { DueDatePicker, type DueValue } from "./DueDatePicker";

const EMPTY_DUE: DueValue = { dueAt: null, hasTime: false, repeat: "never" };

/**
 * The always-visible capture field, and the single most important component in
 * the product. Everything about it is in service of one number: the seconds
 * between wanting to record a task and having recorded it.
 *
 * That is why Enter commits and keeps focus, why an empty submission is
 * silently ignored rather than answered with an error, and why the date is
 * optional and set from a popover rather than a second screen.
 */
export function TaskInput({ listId }: { listId: string | null }) {
  const addTask = useTaskStore((s) => s.addTask);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueValue>(EMPTY_DUE);
  const tz = getUserTimezone();

  // Focus on mount so the very first keystroke lands in the right place, and
  // again whenever the user moves to another list.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      inputRef.current?.focus();
    }
  }, [listId]);

  async function submit() {
    const trimmed = title.trim();
    // Nothing typed is not an error. It is nothing typed.
    if (trimmed === "") return;

    setTitle("");
    setDue(EMPTY_DUE);
    inputRef.current?.focus();

    await addTask({
      title: trimmed,
      listId: listId ?? undefined,
      dueAt: due.dueAt,
      hasTime: due.hasTime,
      repeat: due.repeat,
    });
  }

  const dueSummary = due.dueAt ? formatDueForScreenReader(due, tz) : null;

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="tally-capture" className="sr-only">
          Add a task
        </label>
        <input
          id="tally-capture"
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          // Handled explicitly rather than left to the browser's implicit form
          // submission, which quietly does nothing in some engines when the
          // form has no submit button. This is the one interaction the entire
          // product rests on; it does not get to depend on a subtlety.
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void submit();
          }}
          placeholder="Add a task"
          autoComplete="off"
          spellCheck
          className={cn(
            // The deepest well on the page. It is the one thing you are meant
            // to reach for, so it is the one place the surface gives way.
            "well well--hero h-14 w-full rounded-lg",
            "pl-6 pr-14",
            // Exactly 16px. Below that iOS Safari zooms the viewport on focus
            // and never zooms back out, which is the most common mobile polish
            // bug there is — and it lands squarely on the capture goal.
            "text-input text-ink placeholder:text-ink-3",
            // Focus lights the well from inside, like a lamp coming on —
            // see `.well--hero` in globals.
            "transition-[border-color,box-shadow] duration-[160ms]",
          )}
        />

        <DueDatePicker value={due} onChange={setDue} align="end">
          <button
            type="button"
            aria-label={dueSummary ?? "Add a due date"}
            className={cn(
              "absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 md:h-9 md:w-9",
              "items-center justify-center rounded-md",
              "transition-[color,background-color,box-shadow] duration-[140ms]",
              "hover:bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)]",
              due.dueAt
                ? "text-gilt"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            <CalendarIcon size={17} />
          </button>
        </DueDatePicker>
      </form>

      {/* Once a date is attached, say so plainly rather than leaving the user
          to guess from a highlighted icon. */}
      {due.dueAt ? (
        <div className="mt-2 flex items-center gap-2 pl-1">
          <span className="text-meta text-ink-2">
            Due{" "}
            <span className="font-mono tabular text-gilt">
              {formatDueSummary(due, tz)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setDue(EMPTY_DUE)}
            aria-label="Remove the due date"
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-sm text-ink-3",
              "transition-colors duration-[120ms] hover:bg-surface-sunk hover:text-ink",
            )}
          >
            <CloseIcon size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
