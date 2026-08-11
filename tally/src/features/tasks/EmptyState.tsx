import type { ReactNode } from "react";

/**
 * An empty screen is an invitation, not a failure. Every one of these says
 * what to do next, in a tone that assumes nothing has gone wrong — because
 * nothing has.
 *
 * No illustration, no icon, no mascot. The design direction is quiet, and a
 * cartoon here would be the loudest thing on the page.
 */
export function EmptyState({
  headline,
  children,
}: {
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-20 text-center">
      <h2 className="engraved font-display text-display text-ink">{headline}</h2>
      {/* A short gilt rule under the line, the way a title page is set. */}
      <span
        aria-hidden="true"
        className="mx-auto mt-5 block h-px w-16 bg-[linear-gradient(90deg,transparent,var(--color-gilt),transparent)]"
      />
      <p className="mx-auto mt-5 max-w-[42ch] text-meta text-ink-2">{children}</p>
    </div>
  );
}

export const EMPTY_STATES = {
  firstRun: {
    headline: "Start with one thing",
    body: "Type it above and press Enter. Add a time if it has a deadline.",
  },
  todayClear: {
    headline: "Nothing due today",
    body: "Anything without a date is waiting in Inbox.",
  },
  emptyList: {
    headline: "This list is empty",
    body: "Add your first task above.",
  },
} as const;
