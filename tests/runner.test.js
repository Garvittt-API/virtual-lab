import { test } from "node:test";
import assert from "node:assert/strict";
import {
  manifests,
  validateManifest,
  startExperiment,
  advanceExperiment,
  recordNote,
  sessionMolarity,
} from "../src/simulation/runner.js";
import { react, reactions } from "../src/simulation/reactions.js";
function run(m) {
  let s = startExperiment(m, m.equipment, m.substances);
  for (const step of m.steps) s = advanceExperiment(m, s, step.id);
  return s;
}
test("all four declarative exercises execute deterministically", () => {
  for (const m of Object.values(manifests)) {
    assert.equal(validateManifest(m), true);
    assert.deepEqual(run(m), run(m));
    assert.equal(run(m).completed, true);
  }
});
test("requirements, order, malformed steps and completed sessions are rejected", () => {
  const m = manifests.precipitation;
  assert.throws(() => startExperiment(m, [], m.substances));
  let s = startExperiment(m, m.equipment, m.substances);
  assert.throws(() => advanceExperiment(m, s, "react"));
  s = run(m);
  assert.throws(() => advanceExperiment(m, s, "react"));
  const bad = structuredClone(m);
  bad.steps[0].species = "unobtainium";
  assert.throws(() => validateManifest(bad));
});
test("runner stoichiometry agrees with shared reaction engine", () => {
  let s = run(manifests.precipitation);
  assert.deepEqual(
    s.results[0],
    react(reactions.precipitation, { AgNO3: 0.001, NaCl: 0.002 }),
  );
  assert.equal(s.inventory.AgCl, 0.001);
  assert.equal(s.inventory.NaCl, 0.001);
  let neutral = run(manifests.neutralization);
  assert.equal(neutral.inventory.NaCl, 0.0025);
  let o = run(manifests.oxygen);
  assert.equal(o.results[0].reactionId, "oxygen");
});
test("dilution and observations are recorded without mutating session", () => {
  let s = run(manifests.dilution);
  assert.equal(sessionMolarity(s, "NaCl"), 0.01);
  let n = recordNote(s, "  observed  ");
  assert.deepEqual(s.notes, []);
  assert.deepEqual(n.notes, ["observed"]);
  assert.throws(() => recordNote(s, "  "));
});
test("tampered state and missing reactants are rejected", () => {
  const m = manifests.precipitation;
  let s = startExperiment(m, m.equipment, m.substances);
  s.step = 2;
  s.history = ["a", "b"];
  assert.throws(() => advanceExperiment(m, s, "react"), /Missing reactants/);
  s.step = 0;
  s.history = ["incorrect"];
  assert.throws(() => advanceExperiment(m, s, "silver"));
});
