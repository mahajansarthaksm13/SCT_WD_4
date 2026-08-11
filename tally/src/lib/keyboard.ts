"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

/**
 * Global shortcuts.
 *
 * The one rule that matters: a shortcut must never fire while the user is
 * typing. Someone writing "note to self" should get the letter n, not a jump
 * to the capture field — so every handler checks what has focus first.
 */
export function useGlobalShortcuts() {
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      switch (event.key) {
        case "n":
          event.preventDefault();
          focusCapture();
          break;
        case "/":
          event.preventDefault();
          focusSearch();
          break;
        case "?":
          event.preventDefault();
          setShortcutsOpen(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShortcutsOpen]);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function focusCapture() {
  document.querySelector<HTMLInputElement>("#tally-capture")?.focus();
}

export function focusSearch() {
  // The sidebar renders twice — once fixed, once inside the mobile drawer —
  // so take whichever copy is actually on screen.
  const fields = document.querySelectorAll<HTMLInputElement>("[data-tally-search]");
  for (const field of fields) {
    if (field.offsetParent !== null) {
      field.focus();
      field.select();
      return;
    }
  }
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "N", action: "Jump to the box for adding a task" },
  { keys: "/", action: "Jump to search" },
  { keys: "Enter", action: "Save the task you are typing, and stay put" },
  { keys: "Space", action: "Tick or untick the task you have selected" },
  { keys: "Alt + ↑ / ↓", action: "Move a task up or down its list" },
  { keys: "Esc", action: "Cancel what you are editing, or close what is open" },
  { keys: "?", action: "Show this list" },
];
