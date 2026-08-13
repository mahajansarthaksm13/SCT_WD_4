"use client";

import { create } from "zustand";
import { TUTORIAL_STEPS } from "@/features/tutorial/steps";

const TUTORIAL_LAST_STEP = TUTORIAL_STEPS.length - 1;

/** Mahogany is the default ground; porcelain is the same room in daylight. */
export type Theme = "mahogany" | "porcelain";

export type ActiveView =
  | { type: "today" }
  | { type: "activity" }
  | { type: "list"; listId: string }
  | { type: "search" };

const THEME_KEY = "tally-theme";

/**
 * Applying a saved theme choice, as early as it can possibly be applied.
 *
 * The stylesheet already handles the ordinary case with a `prefers-color-scheme`
 * rule, so anyone following their system sees the right theme at the first
 * paint with no JavaScript involved at all. This only exists for the minority
 * who deliberately chose the opposite of their system.
 *
 * It runs at module evaluation — the earliest point available to us — rather
 * than in an effect. The genuinely flash-free alternative is an inline script
 * in the document head, and that is ruled out: production ships
 * `script-src 'self'`, and weakening the policy to `'unsafe-inline'` in order
 * to smooth a background colour on a near-empty page would be a bad trade.
 */
if (typeof document !== "undefined") {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "mahogany" || stored === "porcelain") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch {
    // Private mode can refuse localStorage; the system preference still applies.
  }
}

interface UIState {
  activeView: ActiveView;
  isSidebarOpen: boolean;
  theme: Theme;
  searchQuery: string;
  /** The view to return to when the search box is cleared. */
  viewBeforeSearch: ActiveView | null;
  isShortcutsOpen: boolean;

  isTutorialOpen: boolean;
  tutorialStep: number;

  openToday: () => void;
  openActivity: () => void;
  openList: (listId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setSearchQuery: (query: string) => void;
  setShortcutsOpen: (open: boolean) => void;

  startTutorial: () => void;
  setTutorialStep: (step: number) => void;
  /** Closes the tour and records that it has been offered. */
  endTutorial: () => void;
}

const TOUR_KEY = "tally-tour-seen";

/**
 * Whether the tour has already been offered on this device.
 *
 * Read defensively: private mode can refuse localStorage outright, and the
 * failure mode of assuming "not seen" is showing a tour twice, which is far
 * better than the failure mode of assuming "seen" and never showing it at all.
 */
export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * What the user is actually looking at right now.
 *
 * An explicit choice sits on the document as `data-theme`; with no choice made
 * the stylesheet is following the system, so that is what we report. Reading
 * the rendered state rather than localStorage means the toggle can never
 * disagree with the page.
 */
function initialTheme(): Theme {
  if (typeof document === "undefined") return "mahogany";

  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "mahogany" || chosen === "porcelain") return chosen;

  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "porcelain"
    : "mahogany";
}

export const useUIStore = create<UIState>((set, get) => ({
  activeView: { type: "today" },
  isSidebarOpen: false,
  theme: initialTheme(),
  searchQuery: "",
  viewBeforeSearch: null,
  isShortcutsOpen: false,
  isTutorialOpen: false,
  tutorialStep: 0,

  openToday: () => set({ activeView: { type: "today" }, isSidebarOpen: false }),

  openActivity: () =>
    set({ activeView: { type: "activity" }, isSidebarOpen: false }),

  openList: (listId) =>
    set({ activeView: { type: "list", listId }, isSidebarOpen: false }),

  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  toggleTheme: () => {
    const theme: Theme = get().theme === "mahogany" ? "porcelain" : "mahogany";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode can refuse this. The theme still applies for this session.
    }
    set({ theme });
  },

  setSearchQuery: (searchQuery) => {
    const { activeView, viewBeforeSearch } = get();

    if (searchQuery.trim() === "") {
      set({
        searchQuery: "",
        activeView: viewBeforeSearch ?? activeView,
        viewBeforeSearch: null,
      });
      return;
    }

    set({
      searchQuery,
      viewBeforeSearch:
        activeView.type === "search" ? viewBeforeSearch : activeView,
      activeView: { type: "search" },
    });
  },

  setShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),

  // ── The tour ───────────────────────────────────────────────────────────

  startTutorial: () => set({ isTutorialOpen: true, tutorialStep: 0 }),

  /** Clamped rather than guarded at the call sites, which are keys and buttons. */
  setTutorialStep: (step) =>
    set({ tutorialStep: Math.max(0, Math.min(step, TUTORIAL_LAST_STEP)) }),

  endTutorial: () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // Private mode. The tour will offer itself again next visit, which is
      // the right way round to be wrong.
    }
    set({ isTutorialOpen: false, tutorialStep: 0 });
  },
}));
