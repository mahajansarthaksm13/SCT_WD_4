/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx` — this is the whole of what we use, and the security
 * document is clear that every dependency not installed is a risk not taken.
 */
export function cn(
  ...values: (string | false | null | undefined)[]
): string {
  return values.filter(Boolean).join(" ");
}
