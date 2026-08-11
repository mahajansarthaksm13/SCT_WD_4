"use client";

import { SHORTCUTS } from "@/lib/keyboard";
import { useUIStore } from "@/store/useUIStore";
import { Dialog } from "./Dialog";

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.isShortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Keyboard shortcuts"
      description="Everything in Tally can be done without touching the mouse."
    >
      <dl className="divide-y divide-rule">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.keys}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <dt className="text-meta text-ink-2">{shortcut.action}</dt>
            <dd>
              <kbd
                className={
                  "well rounded-sm px-2.5 py-1 " +
                  "font-mono text-meta text-gilt"
                }
              >
                {shortcut.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
