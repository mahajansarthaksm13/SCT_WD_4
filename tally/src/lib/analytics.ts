"use client";

/**
 * Usage measurement, and the strict limits on it.
 *
 * Every number in the PRD's success metrics comes from the five events below.
 * Nothing else is sent, and none of them carries a word the user typed.
 *
 * ── The rule that matters ────────────────────────────────────────────────
 *
 * Never send task content. Not titles, not notes, not list names. A to-do app
 * holds things people would not say out loud — a list called "Therapy
 * appointments" is exactly the kind of string that must never leave the
 * device. So the props here are a fixed, enumerable set of strings, and
 * `list_type` says "inbox" or "custom" rather than what the list is called.
 *
 * It is off unless `NEXT_PUBLIC_ANALYTICS_DOMAIN` is set, which means
 * development never pollutes production numbers and a self-hoster who wants
 * no telemetry gets none by doing nothing at all.
 */

const DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
const ENDPOINT =
  process.env.NEXT_PUBLIC_ANALYTICS_URL || "https://plausible.io/api/event";

export type AnalyticsEvent =
  | { name: "task_created"; props: { has_due_date: Flag; has_time: Flag; list_type: ListType } }
  | { name: "task_completed"; props: { was_overdue: Flag; repeats: Flag } }
  | { name: "task_deleted"; props: { was_undone: Flag } }
  | { name: "list_created"; props?: undefined }
  | { name: "data_exported"; props?: undefined };

type Flag = "true" | "false";
type ListType = "inbox" | "custom";

export const flag = (value: boolean): Flag => (value ? "true" : "false");

/** True when telemetry is configured. Everything is a no-op when it is not. */
export function isAnalyticsEnabled(): boolean {
  return typeof DOMAIN === "string" && DOMAIN.length > 0;
}

/**
 * Records an event. Never blocks the interface, never throws, and never
 * surfaces a failure — a dropped metric is not worth a person's attention.
 */
export function track(event: AnalyticsEvent): void {
  if (!isAnalyticsEnabled()) return;
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    name: event.name,
    url: `${window.location.origin}${window.location.pathname}`,
    domain: DOMAIN,
    ...(event.props ? { props: event.props } : {}),
  });

  try {
    // `keepalive` so an event fired as the tab closes still leaves.
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Blocked by an extension, offline, or refused. None of it is the user's
    // problem, and none of it is allowed to interrupt what they were doing.
  }
}
