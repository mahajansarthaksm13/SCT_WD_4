"use client";

import { cn } from "@/lib/cn";
import { useTaskStore } from "@/store/useTaskStore";
import { CloseIcon } from "./Icon";

/**
 * Two honest messages, neither of which blocks anything.
 *
 * The storage notice is the more important one. If the browser will not let us
 * save, the user needs to know before they trust the app with a week of work —
 * and saying so plainly earns more trust than a silent failure ever would.
 */

export function StorageNotice({ onExport }: { onExport: () => void }) {
  const durable = useTaskStore((s) => s.durable);
  const status = useTaskStore((s) => s.status);

  if (durable || status !== "ready") return null;

  return (
    <div
      role="status"
      className={cn(
        "well mb-4 rounded-lg px-4 py-3",
        "text-meta text-ink-2",
      )}
    >
      <p>
        <span className="font-medium text-ink">Heads up.</span> This browser
        isn&rsquo;t letting Tally save your tasks, so they&rsquo;ll disappear
        when you close the tab. Everything still works in the meantime.
      </p>
      <button
        type="button"
        onClick={onExport}
        className="mt-1.5 rounded-sm font-medium text-gilt underline underline-offset-2"
      >
        Export them to a file
      </button>
    </div>
  );
}

export function ErrorNotice() {
  const error = useTaskStore((s) => s.error);
  const clearError = useTaskStore((s) => s.clearError);

  if (!error) return null;

  return (
    <div
      role="alert"
      className={cn(
        "panel gilded mb-4 flex items-start gap-3 rounded-lg",
        "px-4 py-3 text-meta text-ink-2",
      )}
    >
      <p className="flex-1">{error}</p>
      <button
        type="button"
        onClick={clearError}
        aria-label="Dismiss this message"
        className="rounded-sm p-0.5 text-ink-3 transition-colors duration-[120ms] hover:text-ink"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
