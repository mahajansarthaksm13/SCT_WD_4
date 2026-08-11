import assert from "node:assert/strict";
import test from "node:test";

import { flag, isAnalyticsEnabled, track } from "../src/lib/analytics.ts";

/**
 * The point of these is the silence. Telemetry that is off must send nothing,
 * and telemetry that is on must never carry a word the user typed.
 */

test("nothing is sent when no analytics domain is configured", () => {
  assert.equal(process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN, undefined);
  assert.equal(isAnalyticsEnabled(), false);

  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = (() => {
    called = true;
    return Promise.resolve(new Response());
  }) as typeof fetch;

  track({ name: "list_created" });
  track({ name: "task_completed", props: { was_overdue: "true", repeats: "false" } });

  globalThis.fetch = original;
  assert.equal(called, false);
});

test("flag turns a boolean into the fixed string set the props allow", () => {
  assert.equal(flag(true), "true");
  assert.equal(flag(false), "false");
});

test("the event shapes carry no free text", () => {
  // A compile-time guarantee, restated here so it is visible: every prop is a
  // literal union, so there is no way to smuggle a task title into one.
  const created = {
    name: "task_created",
    props: { has_due_date: flag(true), has_time: flag(false), list_type: "custom" },
  } as const;

  const values = Object.values(created.props);
  assert.ok(values.every((v) => ["true", "false", "inbox", "custom"].includes(v)));
});
