"use client";

import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A dialog is an interruption; it has to earn it. Tally opens exactly two —
 * deleting a list that still has tasks in it, and the keyboard shortcut sheet.
 * Everything else happens inline or in a dropdown.
 *
 * Built on the Radix primitive rather than by hand. Focus trapping, focus
 * restoration, scroll locking and the escape/overlay behaviour are all
 * deceptively hard, and every hand-rolled version of them has bugs.
 */

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Right-aligned, secondary before primary. */
  footer?: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-[rgb(4_14_26_/_0.62)] backdrop-blur-[6px]",
            "data-[state=open]:animate-[tally-fade-in_150ms_ease-out]",
          )}
        />
        <RadixDialog.Content
          // Radix hides the rest of the document from assistive tech rather
          // than announcing modality on the element itself. Both is better:
          // some screen reader and browser pairings only honour the attribute.
          aria-modal="true"
          className={cn(
            // Bottom sheet on small screens, centred card from md upwards.
            "panel gilded lifted fixed z-50",
            "inset-x-0 bottom-0 rounded-t-xl p-6 pb-8",
            "data-[state=open]:animate-[tally-slide-up_240ms_var(--ease-settle)]",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2",
            "md:w-[440px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2",
            "md:rounded-xl md:p-6",
            "md:data-[state=open]:animate-[tally-pop-in_180ms_var(--ease-settle)]",
          )}
        >
          <RadixDialog.Title className="font-display text-title text-ink">
            {title}
          </RadixDialog.Title>

          {description ? (
            <RadixDialog.Description className="mt-2 max-w-[40ch] text-meta text-ink-2">
              {description}
            </RadixDialog.Description>
          ) : (
            // Radix warns without one, and a dialog with no explanation is
            // a dialog that should not have opened.
            <RadixDialog.Description className="sr-only">
              {title}
            </RadixDialog.Description>
          )}

          {children ? <div className="mt-5">{children}</div> : null}

          {footer ? (
            <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
