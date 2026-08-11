import assert from "node:assert/strict";
import test from "node:test";

import {
  GAP,
  needsRebalance,
  positionAfterAll,
  positionBetween,
  positionForMove,
  rebalance,
} from "../src/lib/ordering.ts";

test("an empty list starts at the gap", () => {
  assert.equal(positionBetween(undefined, undefined), GAP);
});

test("appending to either end steps by a whole gap", () => {
  assert.equal(positionBetween(3000, undefined), 4000);
  assert.equal(positionBetween(undefined, 1000), 0);
});

test("inserting between two neighbours takes their midpoint", () => {
  assert.equal(positionBetween(1000, 2000), 1500);
});

test("a move is a single-row update", () => {
  const rows = [
    { id: "a", position: 1000 },
    { id: "b", position: 2000 },
    { id: "c", position: 3000 },
  ];
  // Drag "c" to the top.
  const { position, rebalance: needed } = positionForMove(rows, 2, 0);
  assert.equal(position, 0);
  assert.equal(needed, false);
});

test("precision exhaustion is caught before the order can scramble", () => {
  // Repeatedly drop a new item into the same gap. Doubles run out of room
  // after roughly fifty of these; the guard has to fire before that.
  let before = 1000;
  const after = 2000;
  let fired = false;

  for (let i = 0; i < 60; i++) {
    if (needsRebalance(before, after)) {
      fired = true;
      break;
    }
    before = positionBetween(before, after);
  }

  assert.ok(fired, "needsRebalance should fire within 60 midpoint insertions");
  // And it must fire while the two values are still genuinely distinct.
  assert.notEqual(before, after);
});

test("rebalance reassigns clean positions and preserves order", () => {
  const items = [
    { id: "a", position: 1000 },
    { id: "b", position: 1000.00001 },
    { id: "c", position: 1000.00002 },
  ];
  const updates = rebalance(items);

  assert.deepEqual(updates, [
    { id: "b", position: 2000 },
    { id: "c", position: 3000 },
  ]);
  // "a" was already at 1000, so it is not rewritten.
  assert.equal(updates.find((u) => u.id === "a"), undefined);
});

test("rebalance on an already-clean list writes nothing", () => {
  const items = [
    { id: "a", position: 1000 },
    { id: "b", position: 2000 },
  ];
  assert.deepEqual(rebalance(items), []);
});

test("a new task lands after everything already present", () => {
  assert.equal(positionAfterAll([]), GAP);
  assert.equal(positionAfterAll([{ position: 1000 }, { position: 5000 }]), 6000);
});
