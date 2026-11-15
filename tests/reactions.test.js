import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reactions,
  react,
  validateReaction,
} from "../src/simulation/reactions.js";
import {
  substances,
  parseFormula,
  molarMass,
  massToMoles,
  molesToMass,
  molarity,
  dilute,
  convertVolume,
} from "../src/simulation/substances.js";
import { neutralization } from "../src/chemistry.js";
import { oxygenYield } from "../src/oxygen.js";
const approx = (a, b, t = 1e-12) =>
  assert.ok(Math.abs(a - b) <= t, `${a} != ${b}`);
test("supported formula parser and conversion utilities validate inputs", () => {
  assert.deepEqual(parseFormula("KClO3"), { K: 1, Cl: 1, O: 3 });
  for (const bad of ["", "H0", "Na(OH)", "Xy2", "H2O+", "2H2O"])
    assert.throws(() => parseFormula(bad));
  approx(molesToMass(massToMoles(5, "NaCl"), "NaCl"), 5);
  approx(molarity(0.001, 0.1), 0.01);
  approx(dilute(0.1, 10, 100), 0.01);
  assert.equal(convertVolume(1, "L", "mL"), 1000);
  assert.throws(() => massToMoles(-1, "NaCl"));
  assert.throws(() => molarity(1, 0));
  assert.throws(() => dilute(0.1, 10, 9));
  assert.throws(() => convertVolume(1, "g", "mL"));
});
test("catalog equations are consistent and atom balanced; unbalanced definitions rejected", () => {
  for (const r of Object.values(reactions))
    assert.equal(validateReaction(r), true);
  const r = structuredClone(reactions.oxygen);
  r.products[1].coefficient = 2;
  r.equation = "2 KClO3 -> 2 KCl + 2 O2";
  assert.throws(() => validateReaction(r), /Unbalanced/);
  r.equation = "not an equation";
  assert.throws(() => validateReaction(r), /Equation/);
});
test("neutralization limiting, excess and original pH agree with common engine", () => {
  const r = react(reactions.neutralization, { HCl: 0.0025, NaOH: 0.001 });
  approx(r.extent, 0.001);
  approx(r.inventory.HCl, 0.0015);
  approx(r.produced.NaCl, 0.001);
  approx(neutralization(25, 10).reactedMoles, r.extent);
  assert.deepEqual(r.limiting, ["NaOH"]);
  assert.ok(neutralization(25, 10).pH < 7);
});
test("ideal precipitation tracks solid and excess dissolved material", () => {
  const r = react(reactions.precipitation, { AgNO3: 0.001, NaCl: 0.002 });
  approx(r.produced.AgCl, 0.001);
  approx(r.inventory.NaCl, 0.001);
  assert.equal(substances.AgCl.state, "solid");
  assert.equal(substances.NaNO3.state, "aqueous");
  assert.match(reactions.precipitation.limitations, /Ksp/);
});
test("oxygen existing workflow and partial reaction use same engine", () => {
  const r = react(reactions.oxygen, { KClO3: 1 / 122.55 }, 0.4);
  approx(r.produced.O2, oxygenYield(1, 0.4).oxygenMoles);
  approx(r.produced.KCl, oxygenYield(1, 0.4).potassiumChlorideMoles);
});
test("mass conservation for catalog using same rounded atomic weights", () => {
  for (const r of Object.values(reactions)) {
    const input = Object.fromEntries(
      r.reactants.map((t) => [t.species, t.coefficient * 0.02]),
    );
    const output = react(r, input);
    const mass = (inventory) =>
      Object.entries(inventory).reduce(
        (s, [id, n]) => s + n * molarMass(substances[id].formula),
        0,
      );
    approx(mass(input), mass(output.inventory), 1e-10);
  }
});
test("zero, tiny and invalid quantities are deterministic and do not become negative", () => {
  for (const input of [0, 1e-20, 1e-300]) {
    const inv = { HCl: input, NaOH: input };
    const a = react(reactions.neutralization, inv),
      b = react(reactions.neutralization, inv);
    assert.deepEqual(a, b);
    assert.ok(
      Object.values(a.inventory).every((x) => Number.isFinite(x) && x >= 0),
    );
    approx(a.produced.NaCl, input, Math.max(input * 1e-14, Number.MIN_VALUE));
  }
  for (const bad of [-1, NaN, Infinity])
    assert.throws(() => react(reactions.neutralization, { HCl: bad }));
  assert.throws(() => react(reactions.oxygen, { KClO3: 1 }, 1.1));
  assert.throws(() => react(reactions.oxygen, { unknown: 1 }));
});
