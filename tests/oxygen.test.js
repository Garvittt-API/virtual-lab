import { test } from "node:test";
import assert from "node:assert/strict";
import { oxygenYield, oxygenTransition, initialOxygen } from "../src/oxygen.js";
test("balanced decomposition gives 1.5 mol oxygen per mol KClO3", () => {
  const r = oxygenYield(122.55, 1);
  assert.equal(r.reactantMoles, 1);
  assert.equal(r.oxygenMoles, 1.5);
  assert.equal(r.potassiumChlorideMoles, 1);
  assert.ok(Math.abs(r.oxygenMl - 33621) < 1e-8);
});
test("partial conversion scales theoretical yield; invalid inputs rejected", () => {
  assert.equal(oxygenYield(1, 0).oxygenMl, 0);
  assert.ok(Math.abs(oxygenYield(1, 0.5).oxygenMl - 137.1734) < 0.01);
  assert.throws(() => oxygenYield(-1, 1));
  assert.throws(() => oxygenYield(1, 1.1));
});
test("heating requires loading and connection, and conversion is bounded", () => {
  let s = initialOxygen;
  assert.equal(oxygenTransition(s, { type: "heat" }), s);
  s = oxygenTransition(s, { type: "load" });
  assert.equal(oxygenTransition(s, { type: "heat" }), s);
  s = oxygenTransition(s, { type: "connect" });
  for (let i = 0; i < 9; i++) s = oxygenTransition(s, { type: "heat" });
  assert.equal(s.steps, 5);
  assert.equal(s.events.length, 7);
  let disconnected = oxygenTransition(s, { type: "disconnect" });
  assert.equal(oxygenTransition(disconnected, { type: "heat" }), disconnected);
});
test("equipment moves validate IDs and bench bounds", () => {
  assert.equal(
    oxygenTransition(initialOxygen, {
      type: "move",
      id: "no",
      position: [0, 0, 0],
    }),
    initialOxygen,
  );
  assert.equal(
    oxygenTransition(initialOxygen, {
      type: "move",
      id: "tube",
      position: [NaN, 0, 0],
    }),
    initialOxygen,
  );
  assert.deepEqual(
    oxygenTransition(initialOxygen, {
      type: "move",
      id: "tube",
      position: [1, 2, 0],
    }).positions.tube,
    [1, 2, 0],
  );
});

test("a distant burner cannot initiate a conversion step", () => {
  let s = oxygenTransition(initialOxygen, { type: "load" });
  s = oxygenTransition(s, { type: "connect" });
  s = oxygenTransition(s, { type: "move", id: "burner", position: [4, 2, 0] });
  assert.equal(oxygenTransition(s, { type: "heat" }), s);
});

test("published example: 100 g KClO3 gives approximately 1.224 mol O2 at full conversion", () => {
  assert.ok(Math.abs(oxygenYield(100, 1).oxygenMoles - 1.224) < 0.001);
});
