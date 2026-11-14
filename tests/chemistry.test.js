import { test } from "node:test";
import assert from "node:assert/strict";
import { neutralization } from "../src/chemistry.js";
test("equal strong acid and base are neutral at 25 °C", () => {
  const r = neutralization(25, 25);
  assert.ok(Math.abs(r.pH - 7) < 1e-10);
  assert.ok(Math.abs(r.reactedMoles - 0.0025) < 1e-12);
});
test("excess acid and base follow stoichiometry", () => {
  assert.ok(Math.abs(neutralization(25, 0).pH - 1) < 1e-8);
  assert.ok(Math.abs(neutralization(0, 25).pH - 13) < 1e-8);
  assert.equal(neutralization(25, 10).excess, "acid");
});
test("empty and invalid states", () => {
  assert.equal(neutralization(0, 0).pH, 7);
  assert.throws(() => neutralization(-1, 0));
  assert.throws(() => neutralization(NaN, 0));
});
