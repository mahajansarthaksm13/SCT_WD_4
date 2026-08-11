"use client";

import { DropdownMenu as Radix } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronIcon } from "./Icon";

/**
 * The row action menu. Keyboard navigable by arrow keys with Escape to close,
 * which comes free with the Radix primitive and is the reason for using it.
 */

const panel = cn(
  "panel gilded lifted z-50 min-w-[196px] overflow-hidden rounded-lg p-1.5",
  "data-[state=open]:animate-[tally-pop-in_140ms_ease-out]",
);

const item = cn(
  "relative flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5",
  "text-meta text-ink-2 outline-none transition-colors duration-[100ms]",
  // The highlighted row lifts rather than just tinting: a gilt left edge and
  // a faint inner top light, so it reads as the row nearest the cursor.
  "data-[highlighted]:bg-accent-soft data-[highlighted]:text-ink",
  "data-[highlighted]:shadow-[inset_0_1px_0_var(--edge-light),inset_2px_0_0_var(--color-gilt)]",
  // Unavailable, not illegible — the same rule the picker and the buttons
  // follow. Dimming the whole row to 40% takes the label's contrast down with
  // it; stepping the ink down one level leaves a word someone can still read
  // and decide they need.
  "data-[disabled]:pointer-events-none data-[disabled]:text-ink-3",
);

export const Menu = Radix.Root;
export const MenuTrigger = Radix.Trigger;

export function MenuContent({
  children,
  align = "end",
  ...props
}: ComponentPropsWithoutRef<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content align={align} sideOffset={6} className={panel} {...props}>
        {children}
      </Radix.Content>
    </Radix.Portal>
  );
}

export function MenuItem({
  icon,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Radix.Item> & { icon?: ReactNode }) {
  return (
    <Radix.Item className={item} {...props}>
      {icon ? <span className="text-ink-3">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
    </Radix.Item>
  );
}

export function MenuSub({
  label,
  icon,
  children,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Radix.Sub>
      <Radix.SubTrigger className={item} disabled={disabled}>
        {icon ? <span className="text-ink-3">{icon}</span> : null}
        <span className="flex-1">{label}</span>
        <ChevronIcon size={13} className="text-ink-3" />
      </Radix.SubTrigger>
      <Radix.Portal>
        <Radix.SubContent
          sideOffset={4}
          alignOffset={-4}
          className={cn(panel, "max-h-[min(320px,60vh)] overflow-y-auto")}
        >
          {children}
        </Radix.SubContent>
      </Radix.Portal>
    </Radix.Sub>
  );
}

export function MenuSeparator() {
  // A ruled line, not a border: dark groove above, light edge below.
  return (
    <Radix.Separator className="my-1.5 h-px bg-rule shadow-[0_1px_0_var(--edge-light)]" />
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <Radix.Label className="engraved px-2.5 pb-1 pt-2 text-label uppercase text-ink-3">
      {children}
    </Radix.Label>
  );
}
