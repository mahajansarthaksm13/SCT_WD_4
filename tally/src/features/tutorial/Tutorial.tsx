"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { useTaskStore } from "@/store/useTaskStore";
import { useUIStore } from "@/store/useUIStore";
import { TUTORIAL_STEPS } from "./steps";

/**
 * The guided tour.
 *
 * Built by hand rather than reached for from npm. Every tour library ships a
 * positioning engine, a focus trap and a theme, and this needs one screenful
 * of each — a dependency here would be more code, not less, and one more thing
 * to keep in step with a design system it knows nothing about.
 *
 * Two things it deliberately does not do. It never advances on its own: a tour
 * that moves while you are reading it is a tour you have to chase. And it never
 * touches the user's data — every step points at the real interface with real
 * contents, so nothing has to be seeded and nothing has to be cleaned up.
 */

/** Room left between the spotlight and the card that explains it. */
const GAP = 14;
const CARD_WIDTH = 340;

export function Tutorial() {
  const open = useUIStore((s) => s.isTutorialOpen);
  const index = useUIStore((s) => s.tutorialStep);
  const setStep = useUIStore((s) => s.setTutorialStep);
  const end = useUIStore((s) => s.endTutorial);

  const openToday = useUIStore((s) => s.openToday);
  const openActivity = useUIStore((s) => s.openActivity);
  const openList = useUIStore((s) => s.openList);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const inboxId = useTaskStore((s) => s.inboxId);

  const step = TUTORIAL_STEPS[index];
  const cardRef = useRef<HTMLDivElement>(null);

  // Put the app in the state this step is describing, before measuring it.
  useEffect(() => {
    if (!open || !step) return;

    if (step.view === "today") openToday();
    if (step.view === "activity") openActivity();
    if (step.view === "inbox" && inboxId) openList(inboxId);

    /*
     * The drawer stays shut, on every screen size.
     *
     * Opening it for the sidebar steps was the obvious thing and it was wrong:
     * the drawer is a Radix dialog, and Radix marks everything outside its own
     * portal `aria-hidden` — including this tour. The card stayed on screen and
     * disappeared from the accessibility tree, which is the worst of both.
     *
     * Above 1024px the sidebar is always on screen anyway, so those steps
     * spotlight correctly. Below it the target is genuinely not visible, the
     * step loses its spotlight and centres itself, and the words still explain
     * the feature. Degrading is better than lying to a screen reader.
     */
    setSidebarOpen(false);
  }, [open, step, inboxId, openToday, openActivity, openList, setSidebarOpen]);

  const rect = useTargetRect(step?.target, open, index);

  // Focus lands on the card so the step is read out and the keys below work.
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        end();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStep(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep(index - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, setStep, end]);

  if (!open || !step) return null;

  const isLast = index === TUTORIAL_STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-tour-overlay>
      {/*
       * The dim, and the hole in it.
       *
       * One element with an enormous spread on its box-shadow: the shadow
       * paints everything outside the element and nothing inside it, which is
       * a cutout without an SVG mask or four separate edge strips. It takes no
       * pointer events, so the tour's own buttons stay clickable and the app
       * underneath does not.
       */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md transition-all duration-200 ease-[var(--ease-settle)]"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgb(4 14 26 / 0.72)",
            outline: "2px solid var(--color-gilt)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[rgb(4_14_26_/_0.72)]"
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={cardPosition(rect)}
        className={cn(
          "panel gilded lifted absolute rounded-xl p-5 outline-none",
          "data-[state=open]:animate-[tally-pop-in_180ms_var(--ease-settle)]",
        )}
        data-state="open"
      >
        <p className="font-mono text-meta tabular text-ink-3">
          {index + 1} of {TUTORIAL_STEPS.length}
        </p>

        <h2 id="tour-title" className="mt-1 font-display text-title text-ink">
          {step.title}
        </h2>

        <p id="tour-body" className="mt-2 text-meta leading-relaxed text-ink-2">
          {step.body}
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={end}>
            {isLast ? "Close" : "Skip"}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep(index - 1)}
              disabled={index === 0}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => (isLast ? end() : setStep(index + 1))}
            >
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Where the card goes: under the spotlight if it fits, over it if not, and
 * centred when there is nothing to point at.
 *
 * Clamped to the viewport on both axes, because a card that has run off the
 * edge is a tour that has stopped working.
 */
function cardPosition(rect: DOMRect | null): React.CSSProperties {
  /*
   * Measured, not `100dvh`. On mobile Safari the dynamic viewport unit
   * resolves to the *expanded* height — the one you get after the address bar
   * has retracted — so a card capped with it is taller than the viewport it is
   * being centred in, and its top edge ends up above the fold.
   */
  const centred: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: Math.min(CARD_WIDTH, window.innerWidth - 32),
    maxHeight: window.innerHeight - 32,
    overflowY: "auto",
  };

  if (!rect) return centred;

  const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
  const left = Math.min(
    Math.max(16, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 16,
  );

  const roomBelow = window.innerHeight - rect.bottom - GAP - 16;
  const roomAbove = rect.top - GAP - 16;

  /*
   * Anchored to the edge nearest the spotlight and capped, rather than placed
   * by guessing how tall the card is.
   *
   * The guess was the bug: a long step measured taller than the estimate and
   * ran off the bottom of the screen. Anchoring the *bottom* edge when the card
   * sits above its target means the height never has to be known, and a
   * max-height with a scroll means it fits even when neither side has room for
   * all of it.
   */
  if (roomBelow >= roomAbove && roomBelow > 140) {
    return {
      top: rect.bottom + GAP,
      left,
      width,
      maxHeight: roomBelow,
      overflowY: "auto",
    };
  }

  if (roomAbove > 140) {
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left,
      width,
      maxHeight: roomAbove,
      overflowY: "auto",
    };
  }

  // The target fills the screen — there is no "beside" left, so sit over it.
  return centred;
}

/**
 * The live position of the element a step is pointing at.
 *
 * Re-measured for a short while after every step, not once: the step may have
 * just switched view or opened the drawer, and the thing being pointed at is
 * often still animating into place when the step begins. A settle window is
 * cruder than watching for the transition to end, and it is right in every
 * case including the ones where nothing animates at all.
 *
 * ponytail: 400ms of rAF per step. If this ever shows up in a profile, the
 * upgrade is a ResizeObserver on the target plus a transitionend listener.
 */
function useTargetRect(
  target: string | undefined,
  open: boolean,
  step: number,
): DOMRect | null {
  const [measured, setMeasured] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !target) return;

    let frame = 0;
    const until = performance.now() + 400;

    /*
     * Only commit a rect that has actually moved.
     *
     * The settle loop runs every frame for 400ms, and setting state on each of
     * them re-rendered the card sixty times to the same place. Worse, it left
     * the card permanently in motion as far as anything watching the DOM is
     * concerned — a click driven by a test harness would wait for it to hold
     * still and time out.
     */
    let last: DOMRect | null = null;
    let stable = 0;

    const remeasure = () => {
      const element = visibleTarget(target);
      const next = element ? element.getBoundingClientRect() : null;
      const unchanged = sameRect(last, next);
      last = next;
      if (!unchanged) setMeasured(next);
      return unchanged;
    };

    /*
     * Stops as soon as the target has held still for a few frames, rather than
     * always burning the full window.
     *
     * Most steps point at something that never moves, and spinning a rAF loop
     * for 400ms afterwards is both wasted work and a way to hand out one last
     * position change at an awkward moment — long enough after the step began
     * that anything waiting for the card to settle has already decided it had.
     */
    const measure = () => {
      stable = remeasure() ? stable + 1 : 0;
      if (stable < 4 && performance.now() < until) {
        frame = requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [target, open, step]);

  // Derived rather than cleared in the effect: a step with no target has no
  // rect by definition, and saying so here means the effect never has to reach
  // for setState just to undo itself.
  return open && target ? measured : null;
}

/**
 * The copy of the target that is actually on screen.
 *
 * The sidebar is rendered twice — once fixed for wide screens, once inside the
 * mobile drawer — so a bare `querySelector` finds the hidden one about half
 * the time and the spotlight lands on nothing.
 */
/** Rounded to the pixel: sub-pixel jitter is not movement anyone can see. */
function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}

function visibleTarget(target: string): HTMLElement | null {
  const matches = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const element of matches) {
    if (element.offsetParent !== null || element.getClientRects().length > 0) {
      return element;
    }
  }
  return null;
}
