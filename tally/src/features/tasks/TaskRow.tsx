"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarIcon, FlagIcon, GripIcon, NoteIcon } from "@/components/Icon";
import { TITLE_MAX, type List, type Priority, type Repeat, type Task } from "@/data";
import { cn } from "@/lib/cn";
import {
  formatDueChip,
  formatDueForScreenReader,
  formatGutter,
  getUserTimezone,
  isOverdue,
  REPEAT_LABELS,
} from "@/lib/dates";
import { useNow } from "@/lib/useNow";
import { splitOnMatch } from "@/store/selectors";
import { useTaskStore } from "@/store/useTaskStore";
import { DueDatePicker } from "./DueDatePicker";
import { NotesEditor } from "./NotesEditor";
import { PRIORITY_LABELS, TaskRowMenu } from "./TaskRowMenu";
import { caretIndexFromPoint, useInlineEdit } from "./hooks/useInlineEdit";

/**
 * The signature component.
 *
 * Reading left to right: a fixed-width time gutter in tabular figures, then
 * the checkbox, then the title. The gutter never changes width and is never
 * omitted — a task with no time shows an em-dash aligned to the same right
 * edge, because the absence of a time is itself information and because the
 * column only reads as a spine if every single row respects it.
 */

/**
 * How long a completed row holds its place before moving.
 *
 * This pause is not decoration. Instant disappearance takes away the moment of
 * satisfaction that the PRD names as a retention driver, and it makes an
 * accidental click feel unrecoverable.
 */
const SETTLE_MS = 400;

export interface TaskRowProps {
  task: Task;
  lists: List[];
  /** Highlight term, when the row is being shown as a search result. */
  query?: string;
  /**
   * The 300px completed column rather than the full-width list.
   *
   * Two things go: the time gutter, because the column is grouped by the day
   * the work was finished and a due time is not what anyone scans a record
   * for; and the side-by-side title-and-chip layout, which at this width
   * leaves about two words for the title. Both are decisions the row already
   * makes for itself at 360px — this is the same call at the same measure,
   * arrived at from the other direction.
   */
  compact?: boolean;
  /** Reorder controls are hidden in Today, which is sorted by time. */
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  dragHandle?: ReactNode;
  isDragging?: boolean;
  /**
   * The sortable wiring, applied to the `<li>` itself.
   *
   * It cannot be a wrapper element: `<ul>` may only contain `<li>`, and
   * slipping a `<div>` in between silently strips the `listitem` role from
   * every row — the list stops being a list as far as a screen reader is
   * concerned. Handing the ref and transform down is the price of keeping the
   * markup honest.
   */
  rowRef?: (node: HTMLElement | null) => void;
  rowStyle?: React.CSSProperties;
}

export function TaskRow({
  task,
  lists,
  query,
  compact = false,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  dragHandle,
  isDragging = false,
  rowRef,
  rowStyle,
}: TaskRowProps) {
  const tz = getUserTimezone();
  const editTask = useTaskStore((s) => s.editTask);
  const toggleComplete = useTaskStore((s) => s.toggleComplete);
  const removeTask = useTaskStore((s) => s.removeTask);
  const moveTask = useTaskStore((s) => s.moveTask);

  const checkboxId = useId();
  const [notesOpen, setNotesOpen] = useState(false);

  /**
   * The tick fills the instant it is clicked; what waits is the row's move
   * into the Completed section.
   *
   * Only the *pending* half of that is state. Once the store catches up,
   * `pendingComplete` goes back to null and the row reads straight from the
   * task again — no effect mirroring a prop into state, and no window where
   * the two can disagree.
   */
  const [pendingComplete, setPendingComplete] = useState<boolean | null>(null);
  const optimisticComplete = pendingComplete ?? task.isComplete;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const {
    inputRef,
    isEditing,
    draft,
    setDraft,
    start: startEditing,
    commit: commitEdit,
    cancel: cancelEdit,
  } = useInlineEdit(task.title, (title) => void editTask(task.id, { title }));

  // Overdue has to survive a tab left open overnight, so this recomputes off
  // the app's shared clock rather than a value captured at first render.
  const now = useNow();
  const overdue = isOverdue(task, now, tz);
  const chip = formatDueChip(task, now, tz);

  function handleToggle() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const next = !optimisticComplete;
    setPendingComplete(next);

    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setPendingComplete(null);
      void toggleComplete(task.id);
    }, SETTLE_MS);
  }

  const otherLists = lists.filter((l) => l.id !== task.listId);
  const settling = pendingComplete !== null;

  return (
    <li
      ref={rowRef}
      style={rowStyle}
      className={cn(
        // A ruled line rather than a border: a groove, with a lit edge just
        // below it. Two hairlines is what an engraved rule actually looks like.
        "relative border-b border-rule px-1.5 py-0.5 last:border-b-0",
        "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px",
        "after:h-px after:bg-[var(--edge-light)] last:after:hidden",
        isDragging && "opacity-40",
      )}
    >
      <div
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-2.5",
          "transition-[background-color,box-shadow] duration-[140ms]",
          // A minimum rather than a fixed height: a title is allowed to run to
          // two lines, and the row has to grow with it instead of clipping it.
          // The gutter stays right-aligned either way, so the spine holds.
          "min-h-12 py-1.5 md:min-h-11 lg:min-h-10",
          overdue && !task.isComplete ? "bg-overdue-soft" : "bg-transparent",
          // The row lifts off the page under the cursor rather than tinting.
          "hover:bg-[color-mix(in_srgb,var(--color-ink)_5%,transparent)]",
          "lift-on-hover",
          settling && "duration-[400ms]",
        )}
      >
        {/* An overdue row is marked at its edge as well as tinted — the mark
            survives being read in greyscale, which the tint does not. */}
        {overdue && !task.isComplete ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-overdue"
          />
        ) : null}
        {/* ── The time gutter ───────────────────────────────────────────── */}
        <span
          aria-hidden="true"
          className={cn(
            compact && "hidden",
            "w-13 shrink-0 pr-1 text-right font-mono text-mono tabular md:w-16",
            task.isComplete
              ? "text-ink-3"
              : overdue
                ? "text-overdue"
                : task.hasTime
                  ? // A set time is the one number worth gilding: it is the
                    // thing the whole product is arranged around.
                    "text-gilt"
                  : "text-ink-3",
          )}
        >
          {formatGutter(task, tz)}
        </span>

        {/* ── Checkbox: a real input, with a real label ──────────────────── */}
        <span className="relative flex shrink-0 items-center">
          <input
            id={checkboxId}
            type="checkbox"
            checked={optimisticComplete}
            onChange={handleToggle}
            // Named here rather than relying on the label's text being derived
            // from an sr-only child. The label still carries the same wording
            // for anything that reads it that way.
            aria-label={`${task.title} — mark as ${optimisticComplete ? "not done" : "done"}`}
            className="peer sr-only"
          />
          <label
            htmlFor={checkboxId}
            className={cn(
              // 20px is the right size for the mark; 44px is the right size for
              // a thumb. `tap-target` reconciles the two on touch devices.
              "tap-target flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm border",
              "transition-[background-color,border-color,box-shadow] duration-[140ms]",
              "peer-focus-visible:outline peer-focus-visible:outline-2",
              "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gilt",
              optimisticComplete
                ? // Filled: a gilt stud, domed and lit from above.
                  cn(
                    "stud border-gilt bg-accent",
                  )
                : // Empty: a socket pressed into the row, waiting for one.
                  cn(
                    "socket border-rule-strong bg-surface-sunk",
                    "hover:border-gilt",
                  ),
            )}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 text-on-accent"
              aria-hidden="true"
            >
              <path
                d="M4.5 10.4 8.2 14 15.5 6.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="20"
                style={{
                  strokeDashoffset: optimisticComplete ? 0 : 20,
                  transition: "stroke-dashoffset 180ms var(--ease-tick)",
                }}
              />
            </svg>
          </label>
        </span>

        {/* ── Title, or the title becoming editable ──────────────────────── */}
        {/* On a narrow screen the due label drops below the title instead of
            competing with it for the same line. At 360px a chip sitting beside
            the text leaves room for about two words, which makes the list
            unreadable — and the title is the part someone is actually scanning. */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col justify-center gap-0.5",
            !compact && "md:flex-row md:items-center md:gap-2",
          )}
        >
          {task.priority !== "none" && !task.isComplete ? (
            <PriorityFlag priority={task.priority} />
          ) : null}

          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, TITLE_MAX))}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEdit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              aria-label="Task title"
              className={cn(
                // The text becomes editable; a form does not appear. No border,
                // just the faintest impression of the line being pressed in.
                "-mx-1.5 w-full min-w-0 rounded-sm border-0 bg-surface-sunk px-1.5",
                "text-body text-ink outline-none",
                "engrave-in",
              )}
            />
          ) : (
            <span
              onDoubleClick={(e) =>
                startEditing(caretIndexFromPoint(e.clientX, e.clientY))
              }
              title={task.title}
              className={cn(
                "clamp-2 w-full min-w-0 md:flex-1 text-body",
                task.isComplete
                  ? "text-ink line-through decoration-ink-3 opacity-55"
                  : "text-ink",
              )}
            >
              {query ? <Highlighted text={task.title} query={query} /> : task.title}
            </span>
          )}

          {chip && !isEditing ? (
            <span
              className={cn(
                "shrink-0 whitespace-nowrap rounded-sm py-0.5 text-meta",
                "px-0 md:px-2",
                chip.tone === "overdue"
                  ? cn(
                      "font-medium text-overdue",
                      "md:bg-[color-mix(in_srgb,var(--color-overdue)_14%,transparent)]",
                      "md:shadow-[inset_0_1px_0_var(--edge-light)]",
                    )
                  : "text-ink-3",
              )}
            >
              {chip.text}
            </span>
          ) : null}

          {task.repeat !== "never" && !isEditing ? (
            <RepeatChip repeat={task.repeat} />
          ) : null}

          {task.notes && !isEditing ? (
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              aria-expanded={notesOpen}
              aria-label={notesOpen ? "Hide note" : "Show note"}
              className="shrink-0 rounded-sm p-0.5 text-ink-3 transition-colors duration-[120ms] hover:text-ink"
            >
              <NoteIcon size={14} />
            </button>
          ) : null}
        </div>

        {/* ── Row actions ────────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5",
            // Hidden until hover on pointer devices; always there on touch,
            // where there is no hover to reveal them with.
            "opacity-100 transition-opacity duration-[120ms]",
            "[@media(hover:hover)]:opacity-0",
            "[@media(hover:hover)]:group-hover:opacity-100",
            "[@media(hover:hover)]:group-focus-within:opacity-100",
          )}
        >
          {dragHandle}

          <DueDatePicker
            value={{ dueAt: task.dueAt, hasTime: task.hasTime, repeat: task.repeat }}
            onChange={(due) => void editTask(task.id, due)}
            align="end"
          >
            <button
              type="button"
              aria-label={`Set a due date. ${formatDueForScreenReader(task, tz)}${
                task.repeat === "never" ? "" : `, repeats ${task.repeat}`
              }`}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-md md:h-7 md:w-7",
                "transition-colors duration-[120ms] hover:bg-rule",
                task.dueAt ? "text-ink-2" : "text-ink-3",
              )}
            >
              <CalendarIcon size={15} />
            </button>
          </DueDatePicker>
          <TaskRowMenu
            task={task}
            otherLists={otherLists}
            onRename={() => startEditing()}
            onOpenNotes={() => setNotesOpen(true)}
            onMoveToList={(listId) => void moveTask(task.id, listId)}
            onSetPriority={(priority) => void editTask(task.id, { priority })}
            onReorder={onMove}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onDelete={() => removeTask(task.id)}
          />
        </div>
      </div>

      {notesOpen ? (
        <NotesEditor task={task} onClose={() => setNotesOpen(false)} />
      ) : null}
    </li>
  );
}


/**
 * How often a task comes back, said quietly.
 *
 * Tertiary ink and no colour of its own: this is a property of the task, not a
 * state that needs acting on, and the row already spends its one loud signal
 * on being overdue. The word is real text rather than a bare ↻, so it survives
 * greyscale and reads correctly aloud.
 */
function RepeatChip({ repeat }: { repeat: Exclude<Repeat, "never"> | Repeat }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap py-0.5 text-meta text-ink-3 md:px-1"
      title={`Repeats ${repeat}`}
    >
      <span aria-hidden="true">↻ </span>
      {REPEAT_LABELS[repeat]}
    </span>
  );
}

/**
 * Priority is shown by weight and opacity, never by colour. Adding a second
 * colour would compete with the overdue signal, and the moment two things are
 * coloured neither one means anything on its own.
 */
function PriorityFlag({ priority }: { priority: Exclude<Priority, "none"> | Priority }) {
  const weight =
    priority === "high"
      ? "opacity-100 text-ink"
      : priority === "medium"
        ? "opacity-70 text-ink-2"
        : "opacity-45 text-ink-2";

  return (
    <span className={cn("shrink-0", weight)} title={`${PRIORITY_LABELS[priority]} priority`}>
      <FlagIcon size={13} strokeWidth={priority === "high" ? 2.2 : 1.6} />
      <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>
    </span>
  );
}

/** Search highlighting as real text nodes — never innerHTML. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitOnMatch(text, query).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-[3px] bg-accent-soft px-0.5 text-ink"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i} className="text-ink-2">
            {part.text}
          </span>
        ),
      )}
    </>
  );
}

/**
 * A drag handle, styled to match the other row controls.
 *
 * Deliberately kept out of the tab order and out of the accessibility tree.
 * Dragging is a pointer convenience; the keyboard route to the same thing is
 * "Move up" and "Move down" in the row menu, which are announced properly and
 * do not put an extra stop in front of every single task.
 *
 * The overrides come *after* the spread on purpose — the drag library sets its
 * own `tabIndex`, and a focusable element that is hidden from screen readers is
 * exactly the kind of trap this is meant to avoid.
 */
export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "hidden h-7 w-7 cursor-grab items-center justify-center rounded-md",
        "text-ink-3 transition-colors duration-[120ms] hover:bg-rule hover:text-ink",
        "active:cursor-grabbing lg:flex",
      )}
      {...props}
      tabIndex={-1}
      aria-hidden="true"
    >
      <GripIcon size={14} />
    </button>
  );
}
