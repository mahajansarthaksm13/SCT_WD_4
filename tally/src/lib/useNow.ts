"use client";

import { useSyncExternalStore } from "react";

/**
 * One clock for the whole app.
 *
 * Overdue state is a function of the current time, so every row needs to know
 * when the minute changes — but a `setInterval` inside each row would mean
 * hundreds of timers doing the same work. This is a single ticker that every
 * subscriber shares.
 *
 * It also ticks on focus and on visibility change, which is what makes a tab
 * left open overnight correct the moment someone comes back to it rather than
 * up to a minute later.
 */

const TICK_MS = 30_000;

let current = new Date();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = new Date();
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);

  if (timer === null) {
    timer = setInterval(tick, TICK_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
  }

  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    }
  };
}

/** Server render has no clock; the first client tick supplies the real one. */
const serverSnapshot = new Date(0);

export function useNow(): Date {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => serverSnapshot,
  );
}
