"use client";

import { Toast as Radix } from "radix-ui";
import { UNDO_WINDOW_MS, useTaskStore } from "@/store/useTaskStore";
import { cn } from "@/lib/cn";

/**
 * The undo affordance behind every delete.
 *
 * There is no confirmation dialog anywhere in Tally. A dialog taxes the
 * ninety-nine deletions out of a hundred that were meant, in order to guard
 * the one that was not. A five-second undo protects the same mistake and
 * charges nobody for it.
 *
 * Exactly one toast exists at a time: deleting a second task commits the first
 * and replaces the message rather than stacking up a pile of them.
 */
export function UndoToast() {
  const pendingDelete = useTaskStore((s) => s.pendingDelete);
  const undoRemove = useTaskStore((s) => s.undoRemove);
  const flush = useTaskStore((s) => s.flushPendingDelete);

  return (
    <Radix.Provider duration={UNDO_WINDOW_MS} swipeDirection="down">
      <Radix.Root
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          // Radix closes the toast when its timer runs out or it is swiped
          // away; either way the deletion should stop waiting around.
          if (!open) flush();
        }}
        className={cn(
          "panel gilded lifted group relative overflow-hidden rounded-lg",
          "flex items-center gap-4 py-3 pl-4 pr-3",
          "data-[state=open]:animate-[tally-toast-in_200ms_ease-out]",
          "data-[state=closed]:animate-[tally-fade-in_150ms_ease-in_reverse]",
          "data-[swipe=end]:animate-[tally-fade-in_150ms_ease-in_reverse]",
        )}
      >
        <Radix.Title className="flex-1 text-meta text-ink">
          Task deleted
        </Radix.Title>

        <Radix.Action asChild altText="Undo deleting this task">
          <button
            onClick={undoRemove}
            className={cn(
              "-my-1 rounded-md px-3 py-1.5 text-meta font-medium text-gilt",
              "border border-transparent transition-[background-color,border-color,transform]",
              "duration-[140ms] hover:border-gilt",
              "hover:bg-[color-mix(in_srgb,var(--color-gilt)_14%,transparent)]",
              "active:translate-y-px",
            )}
          >
            Undo
          </button>
        </Radix.Action>

        {/* A hairline draining along the bottom edge, so the five seconds are
            visible rather than a surprise. Pauses with the timer on hover. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 bottom-0 h-px origin-left bg-gilt",
            "animate-[tally-drain_5000ms_linear_forwards]",
            "group-hover:[animation-play-state:paused]",
            "group-focus-within:[animation-play-state:paused]",
          )}
        />
      </Radix.Root>

      <Radix.Viewport
        className={cn(
          "fixed z-50 flex w-full flex-col outline-none",
          "bottom-4 left-1/2 max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2",
        )}
      />
    </Radix.Provider>
  );
}
