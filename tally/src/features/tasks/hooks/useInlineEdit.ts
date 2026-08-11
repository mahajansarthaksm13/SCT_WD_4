"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Editing a task title in place.
 *
 * The goal is that the text simply becomes editable — no border appearing, no
 * form materialising, no jump in row height. Committing on blur as well as on
 * Enter matters: someone who clicks away mid-edit meant to keep what they
 * typed, and losing it would be the single most annoying bug in the app.
 *
 * Clearing the field reverts rather than deleting. Delete is its own action,
 * with its own undo; an empty title should never be a way to reach it by
 * accident.
 */
export function useInlineEdit(
  value: string,
  onCommit: (next: string) => void,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const caretRef = useRef<number | null>(null);

  const start = useCallback(
    (caretIndex?: number | null) => {
      setDraft(value);
      caretRef.current = caretIndex ?? null;
      setEditing(true);
    },
    [value],
  );

  // Place the caret before the browser paints, so it never visibly jumps from
  // the end of the text to where the user actually clicked.
  useLayoutEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;

    input.focus();
    const at = caretRef.current;
    const position = at === null ? input.value.length : Math.min(at, input.value.length);
    input.setSelectionRange(position, position);
  }, [isEditing]);

  const commit = useCallback(() => {
    if (!isEditing) return;
    setEditing(false);

    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === value) return;
    onCommit(trimmed);
  }, [draft, isEditing, onCommit, value]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(value);
  }, [value]);

  return { inputRef, isEditing, draft, setDraft, start, commit, cancel };
}

/**
 * Where in the string a click landed, so editing starts at the word the user
 * pointed at rather than at the end of the line.
 *
 * Two APIs for the same thing: `caretPositionFromPoint` is the standard,
 * `caretRangeFromPoint` is what WebKit and Blink shipped first. Either is fine
 * and neither is required — a null result just means "caret at the end".
 */
export function caretIndexFromPoint(x: number, y: number): number | null {
  type LegacyDocument = Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const standard = document.caretPositionFromPoint?.(x, y);
  if (standard) return standard.offset;

  const legacy = (document as LegacyDocument).caretRangeFromPoint?.(x, y);
  return legacy ? legacy.startOffset : null;
}
