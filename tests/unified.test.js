import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  dispatch,
  guidedManifests,
  validateSession,
  validateGuidedManifest,
} from "../src/lab/guided.js";
import {
  createWorkspace,
  execute,
  concentration,
  validateWorkspace,
} from "../src/lab/engine.js";
function run(session, action) {
  const result = dispatch(session, action);
  assert.equal(result.ok, true, result.error);
  return result.state;
}
function advance(s) {
  const m = guidedManifests[s.core.experiment.id];
  return run(s, { type: "next", stepId: m.steps[s.core.experiment.step].id });
}
function finish(id) {
  let s = createSession(id);
  while (s.core.experiment.step < guidedManifests[id].steps.length)
    s = advance(s);
  return s;
}
const near = (x, y) => assert.ok(Math.abs(x - y) < 1e-12, `${x} != ${y}`);
test("neutralization guided steps transfer actual inventory, react, and record observation", () => {
  let s = finish("neutralization"),
    a = s.core.workspace.objects.a,
    b = s.core.workspace.objects.b;
  assert.equal(a.volumeMl, 50);
  assert.equal(b.volumeMl, 0);
  near(a.solutes.NaCl, 0.0025);
  near(a.solutes.H2O, 0.0025);
  assert.equal(a.solutes.HCl, 0);
  assert.equal(a.solutes.NaOH, 0);
  s = run(s, { type: "observe", note: "Measured outcome" });
  assert.deepEqual(s.core.experiment.notes, ["Measured outcome"]);
  assert.match(s.core.workspace.events.at(-1), /Observation/);
});
test("precipitation separates solid and retains excess dissolved reactant", () => {
  let s = finish("precipitation");
  let a = s.core.workspace.objects.a;
  near(a.solids.AgCl, 0.001);
  near(a.solutes.NaCl, 0.001);
  near(a.solutes.NaNO3, 0.001);
  assert.equal(a.solutes.AgNO3, 0);
  assert.equal(a.volumeMl, 30);
});
test("dilution transfers stock and adds solvent to volumetric flask", () => {
  let s = finish("dilution"),
    b = s.core.workspace.objects.b;
  assert.equal(b.kind, "volumetric");
  assert.equal(b.volumeMl, 100);
  near(b.solutes.NaCl, 0.001);
  near(concentration(b, "NaCl"), 0.01);
  assert.match(s.core.workspace.events.at(-1), /Measured NaCl/);
});
test("undo reaction restores exact state, redo reproduces identical products", () => {
  let s = createSession("precipitation");
  for (let i = 0; i < 4; i++) s = advance(s);
  const before = structuredClone(s.core);
  s = advance(s);
  const after = structuredClone(s.core);
  s = run(s, { type: "undo" });
  assert.deepEqual(s.core, before);
  s = run(s, { type: "redo" });
  assert.deepEqual(s.core, after);
});
test("invalid steps, corrupted save, capacity and insufficient reactants fail without mutation", () => {
  let s = createSession("neutralization");
  const before = JSON.stringify(s);
  assert.equal(dispatch(s, { type: "next", stepId: "reaction" }).ok, false);
  assert.equal(JSON.stringify(s), before);
  const corrupt = structuredClone(s);
  corrupt.core.workspace.objects.a.solutes.HCl = -1;
  assert.throws(() => validateSession(corrupt));
  assert.equal(dispatch(corrupt, { type: "next", stepId: "acid" }).ok, false);
  let w = createWorkspace();
  const original = JSON.stringify(w);
  assert.throws(() =>
    execute(w, { type: "add", id: "a", stock: "acid", volumeMl: 251 }),
  );
  assert.throws(() =>
    execute(w, { type: "react", id: "a", reactionId: "neutralization" }),
  );
  assert.equal(JSON.stringify(w), original);
  const bad = structuredClone(guidedManifests.dilution);
  bad.steps[0].command.type = "unknown";
  assert.throws(() => validateGuidedManifest(bad));
});
test("versioned serialization restores consistent state and validates history", () => {
  let s = createSession("dilution");
  s = advance(s);
  s = run(s, { type: "move", id: "a", position: [1, 1, 0.2] });
  let saved = JSON.parse(JSON.stringify(s));
  assert.equal(validateSession(saved), true);
  assert.deepEqual(saved, s);
  saved.past[0].workspace.objects.a.volumeMl = -1;
  assert.throws(() => validateSession(saved));
  saved = structuredClone(s);
  saved.version = 2;
  assert.throws(() => validateSession(saved));
});
test("settled AgCl is not transferred in the simplified liquid-only transfer model", () => {
  let s = finish("precipitation");
  let w = execute(s.core.workspace, {
    type: "transfer",
    from: "a",
    to: "b",
    volumeMl: 10,
  });
  near(w.objects.a.solids.AgCl, 0.001);
  assert.deepEqual(w.objects.b.solids, {});
  assert.equal(validateWorkspace(w), true);
});

test("manifest rejects invalid stock and measured quantities", () => {
  const m = structuredClone(guidedManifests.dilution);
  m.steps[0].command.volumeMl = -1;
  assert.throws(() => validateGuidedManifest(m));
  m.steps[0].command.volumeMl = 10;
  m.steps[0].command.stock = "unknown";
  assert.throws(() => validateGuidedManifest(m));
});
