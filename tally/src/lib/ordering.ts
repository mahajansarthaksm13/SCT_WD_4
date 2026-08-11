/**
 * Fractional positioning.
 *
 * With an integer `order` column, moving one task means rewriting every row
 * after it. That is fine at twenty tasks and unacceptable at two thousand, and
 * it makes offline reordering conflict-prone. Instead `position` is a float and
 * a move is the midpoint of its two new neighbours — a single-row update.
 */

export const GAP = 1000;

/**
 * The float precision floor. Doubles run out of room after roughly fifty
 * consecutive midpoint insertions into the same gap, at which point two
 * positions become indistinguishable and the order silently scrambles.
 */
const MIN_GAP = 0.0001;

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}

/** True when `before` and `after` are too close to safely insert between. */
export function needsRebalance(before: number, after: number): boolean {
  return Math.abs(after - before) < MIN_GAP;
}

/**
 * Reassigns clean, evenly-spaced positions while preserving the order the
 * caller passed in. Returns only the rows whose position actually changed, so
 * a rebalance that is already a no-op costs nothing.
 */
export function rebalance<T extends { id: string; position: number }>(
  items: T[],
): { id: string; position: number }[] {
  return items
    .map((item, index) => ({ id: item.id, position: (index + 1) * GAP }))
    .filter((next, index) => next.position !== items[index]!.position);
}

/** The position a brand new item should take: after everything present. */
export function positionAfterAll(items: { position: number }[]): number {
  if (items.length === 0) return GAP;
  return Math.max(...items.map((i) => i.position)) + GAP;
}

/**
 * Works out the position for moving `fromIndex` to `toIndex` within an ordered
 * list, and reports whether the surrounding gap has collapsed far enough that
 * the caller should rebalance instead.
 */
export function positionForMove<T extends { position: number }>(
  ordered: T[],
  fromIndex: number,
  toIndex: number,
): { position: number; rebalance: boolean } {
  const without = ordered.filter((_, i) => i !== fromIndex);
  const before = without[toIndex - 1];
  const after = without[toIndex];

  if (before && after && needsRebalance(before.position, after.position)) {
    return { position: positionBetween(before.position, after.position), rebalance: true };
  }
  return {
    position: positionBetween(before?.position, after?.position),
    rebalance: false,
  };
}
