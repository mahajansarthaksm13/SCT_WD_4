"use client";

/**
 * Keeping two open tabs from quietly overwriting each other.
 *
 * Both tabs read the whole dataset into memory on load and write through the
 * same IndexedDB. Without this, a task added in tab A is invisible to tab B,
 * and the moment B saves anything it does so from a stale picture — the
 * security document calls this out by name as the edge case that "bites
 * people", and it fails silently, which is the worst way for it to fail.
 *
 * The fix is deliberately small. Whichever tab makes a change announces it;
 * the others reload from the database. IndexedDB is already the single source
 * of truth and reloading it is milliseconds, so there is nothing to merge and
 * no conflict resolution to get wrong. Anything cleverer would be inventing a
 * sync algorithm for a problem that does not have one.
 */

const CHANNEL = "tally-sync";

/** Broadcast is fire-and-forget; a tab that cannot hear it simply misses out. */
let channel: BroadcastChannel | null = null;

function open(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;

  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}

/** Tells every other tab that this one has written something. */
export function announceChange(): void {
  try {
    open()?.postMessage("changed");
  } catch {
    // A closed or unavailable channel is not worth interrupting a write for.
  }
}

/**
 * Runs `onChange` when another tab reports a write.
 *
 * Also fires when this tab is brought back to the front, which covers the
 * browsers that do not implement BroadcastChannel at all — they end up
 * refreshing a moment later than the others rather than never.
 */
export function subscribeToOtherTabs(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const bus = open();
  const handleMessage = () => onChange();
  const handleVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };

  bus?.addEventListener("message", handleMessage);
  document.addEventListener("visibilitychange", handleVisible);

  return () => {
    bus?.removeEventListener("message", handleMessage);
    document.removeEventListener("visibilitychange", handleVisible);
  };
}
