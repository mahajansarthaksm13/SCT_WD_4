"use client";

import { useEffect, useRef, useState } from "react";
import { LIST_NAME_MAX } from "@/data";
import { cn } from "@/lib/cn";

/**
 * Creating and renaming both happen in place — the button becomes a field, the
 * name becomes editable. No modal for something this small.
 *
 * Duplicate names are allowed and are not flagged. Someone with "Work" under
 * two different clients has a reason, and inventing an error for it would be
 * the app deciding it knows better.
 */
export function NewListInput({
  initialValue = "",
  placeholder = "List name",
  onCommit,
  onCancel,
}: {
  initialValue?: string;
  placeholder?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }

  return (
    <div className="px-1">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setAtLimit(next.length > LIST_NAME_MAX);
          setValue(next.slice(0, LIST_NAME_MAX));
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className={cn(
          "well h-8 w-full rounded-md px-2",
          "text-body text-ink placeholder:text-ink-3",
          "transition-[border-color,box-shadow] duration-[140ms]",
        )}
      />
      {atLimit ? (
        // Guidance, not an alarm — and deliberately not crimson, which belongs
        // to overdue and to nothing else.
        <p className="mt-1 px-1 text-meta text-ink-2">
          List names are limited to {LIST_NAME_MAX} characters.
        </p>
      ) : null}
    </div>
  );
}
