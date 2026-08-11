"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Three variants. There is deliberately no fourth — a fourth button style is
 * how a design system starts meaning nothing.
 *
 * Each one is a physical object: lit along its top edge, shadowed underneath,
 * and genuinely depressed on press — the highlight and the shadow swap sides
 * and the whole thing shifts down a pixel. That swap is the entire trick; a
 * button that only darkens on click reads as a picture of a button.
 *
 * Note what is missing: a destructive variant. "Delete list" is an ordinary
 * primary button, and the weight of the action lives in the wording, which is
 * where a person actually reads it.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // `raised` carries the sheen, the lit top edge and the press — see globals.
  primary: "raised bg-accent text-on-accent border-transparent hover:bg-accent-hover",
  secondary: "raised bg-surface text-ink border-rule-strong hover:border-gilt",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-sunk hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-meta",
  md: "h-10 px-4.5 text-body font-medium",
  lg: "h-12 px-5 text-body font-medium",
  icon: "h-9 w-9 justify-center",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "secondary", size = "md", className, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border",
          "transition-[background-color,color,transform,border-color,box-shadow]",
          "duration-[140ms]",
          "active:translate-y-px active:duration-[70ms]",
          /*
           * Unavailable, not illegible. `opacity-40` multiplies the label's
           * contrast down along with everything else — "Clear" measured under
           * 3:1 on the powder theme, which is not a state, it is a smudge.
           * The label steps down to tertiary ink, which is legible by
           * construction, and the missing hover and the dead pointer carry
           * the rest.
           */
          "disabled:pointer-events-none disabled:text-ink-3",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
