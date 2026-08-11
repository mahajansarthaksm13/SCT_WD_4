"use client";

import { useEffect, useRef, useState } from "react";
import { NOTES_MAX, type Task } from "@/data";
import { cn } from "@/lib/cn";
import { useTaskStore } from "@/store/useTaskStore";

/**
 * A plain textarea. Notes are stored and rendered as literal text — no
 * markdown, no HTML, no `dangerouslySetInnerHTML` anywhere near them.
 *
 * That last part is the whole of Tally's XSS defence: React escapes text by
 * default, and there is exactly one way to turn that off. So it is never
 * turned off, and there is a lint rule making sure of it.
 */
export function NotesEditor({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const editTask = useTaskStore((s) => s.editTask);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(task.notes ?? "");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autoGrow(el);
  }, []);

  function commit() {
    const next = draft.trim();
    if (next === (task.notes ?? "")) return;
    void editTask(task.id, { notes: next === "" ? null : next });
  }

  return (
    <div className="pb-3 pl-[calc(var(--spacing-gutter-sm)+2rem)] pr-2 md:pl-[calc(var(--spacing-gutter)+2rem)]">
      <label className="sr-only" htmlFor={`notes-${task.id}`}>
        Note for {task.title}
      </label>
      <textarea
        id={`notes-${task.id}`}
        ref={ref}
        value={draft}
        rows={1}
        placeholder="Add anything worth remembering about this task."
        onChange={(e) => {
          setDraft(e.target.value.slice(0, NOTES_MAX));
          autoGrow(e.target);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(task.notes ?? "");
            onClose();
          }
        }}
        className={cn(
          "well w-full resize-none rounded-md px-3 py-2",
          "text-meta leading-[18px] text-ink-2 outline-none",
          "placeholder:text-ink-3",
          "focus:border-gilt focus:text-ink",
        )}
      />
      <div className="mt-1 flex items-center justify-between px-1">
        <span className="text-meta text-ink-3">
          {draft.length > NOTES_MAX - 200
            ? `${NOTES_MAX - draft.length} characters left`
            : "Saves when you click away"}
        </span>
        <button
          type="button"
          onClick={() => {
            commit();
            onClose();
          }}
          className="rounded-sm px-1 text-meta text-ink-2 transition-colors duration-[120ms] hover:text-ink"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Grows to six lines, then scrolls. */
function autoGrow(el: HTMLTextAreaElement) {
  const maxHeight = 6 * 18 + 16; // six lines of --t-meta, plus padding
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}
