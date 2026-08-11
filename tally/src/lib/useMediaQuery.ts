"use client";

import { useSyncExternalStore } from "react";

/**
 * Reads a media query as React state.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the server
 * snapshot is a separate argument, so there is no first paint that renders the
 * wrong branch and then corrects itself, and React handles the tearing case
 * during concurrent renders. The subscription is the browser's own change
 * event — no polling, no resize listener firing on every pixel.
 *
 * Used only where the two layouts differ in *structure* rather than in style.
 * Anything a media query in CSS can express belongs in CSS: rendering both
 * branches and hiding one duplicates the DOM, and a screen reader reads the
 * hidden copy too.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    // On the server there is no viewport. False means the narrow layout, which
    // is the one that works at every width — the wrong guess is recoverable in
    // a way that shipping a two-column grid to a phone is not.
    () => false,
  );
}
