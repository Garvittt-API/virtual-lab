import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  dispatch,
  guidedManifests,
  validateSession,
} from "../src/lab/guided.js";
import {
  createFreeSession,
  dispatchFree,
  validateFreeSession,
  exportFreeNotebook,
} from "../src/lab/free.js";
import { concentration } from "../src/lab/engine.js";
import { equipment } from "../src/lab/registry.js";
import { createWorkspace, executeCommand } from "../src/lab/engine.js";
const date = "2026-01-01T00:00:00.000Z";
function go(s, a) {
  const r = dispatchFree(s, a);
  assert.equal(r.ok, true, r.error);
  return r.state;
}
function step(s, command) {
  const spec =
    guidedManifests[s.core.experiment.id].steps[s.core.experiment.step];
  const r = dispatch(s, { type: "perform", stepId: spec.id, command });
  assert.equal(r.ok, true, r.error);
  return r.state;
}
test("student-controlled quantities use real inventories and units in neutralization", () => {
  let s = createSession("neutralization");
  s = step(s, { type: "add", id: "a", stock: "acid", volume: 0.01, unit: "L" });
  s = step(s, { type: "add", id: "b", stock: "base", volume: 20, unit: "mL" });
  s = step(s, { type: "transfer", from: "b", to: "a", volume: 20, unit: "mL" });
  s = step(s, { type: "mix", id: "a" });
  s = step(s, { type: "react", id: "a", reactionId: "neutralization" });
  const a = s.core.workspace.objects.a;
  assert.equal(a.volumeMl, 30);
  assert.ok(Math.abs(a.solutes.NaOH - 0.001) < 1e-12);
  assert.ok(Math.abs(a.solutes.NaCl - 0.001) < 1e-12);
  assert.equal(s.core.experiment.step, 5);
});
test("student-selected dilution uses measured concentration rather than preset value", () => {
  let s = createSession("dilution");
  s = step(s, { type: "add", id: "a", stock: "salt", volume: 20, unit: "mL" });
  s = step(s, { type: "transfer", from: "a", to: "b", volume: 10, unit: "mL" });
  s = step(s, { type: "add", id: "b", stock: "water", volume: 40, unit: "mL" });
  s = step(s, { type: "mix", id: "b" });
  s = step(s, { type: "measure", id: "b", solute: "NaCl" });
  assert.ok(
    Math.abs(concentration(s.core.workspace.objects.b, "NaCl") - 0.02) < 1e-12,
  );
});
test("guided command mismatches and invalid volume fail atomically", () => {
  let s = createSession("neutralization"),
    b = JSON.stringify(s);
  for (const command of [
    { type: "add", id: "b", stock: "acid", volume: 10, unit: "mL" },
    { type: "add", id: "a", stock: "acid", volume: -1, unit: "mL" },
    { type: "add", id: "a", stock: "acid", volume: 1, unit: "kg" },
    { type: "add", id: "a", stock: "acid", volume: 0, unit: "mL" },
    { type: "add", id: "a", stock: "acid", volume: 1, unit: "L" },
  ])
    assert.equal(
      dispatch(s, { type: "perform", stepId: "acid", command }).ok,
      false,
    );
  assert.equal(JSON.stringify(s), b);
});
test("existing guided v1 session restores and accepts new student commands", () => {
  let old = createSession("precipitation");
  old = dispatch(old, { type: "next", stepId: "silver" }).state;
  let saved = JSON.parse(JSON.stringify(old));
  assert.equal(validateSession(saved), true);
  saved = step(saved, {
    type: "add",
    id: "b",
    stock: "salt",
    volume: 15,
    unit: "mL",
  });
  assert.equal(saved.core.experiment.step, 2);
});
test("free exploration places, transfers, mixes and reacts deterministically", () => {
  let s = createFreeSession(date);
  s = go(s, { type: "place", id: "v1", kind: "beaker", position: [-1, 0, 0] });
  s = go(s, { type: "place", id: "v2", kind: "flask", position: [1, 0, 0] });
  s = go(s, { type: "add", id: "v1", stock: "silver", volume: 10, unit: "mL" });
  s = go(s, { type: "add", id: "v2", stock: "salt", volume: 0.02, unit: "L" });
  s = go(s, { type: "transfer", from: "v2", to: "v1", volume: 20, unit: "mL" });
  s = go(s, { type: "mix", id: "v1" });
  s = go(s, { type: "react", id: "v1", reactionId: "precipitation" });
  assert.ok(Math.abs(s.workspace.objects.v1.solids.AgCl - 0.001) < 1e-12);
  assert.ok(Math.abs(s.workspace.objects.v1.solutes.NaCl - 0.001) < 1e-12);
  let after = structuredClone(s.workspace);
  s = go(s, { type: "undo" });
  assert.deepEqual(s.workspace.objects.v1.solids, {});
  s = go(s, { type: "redo" });
  assert.deepEqual(s.workspace, after);
});
test("free placement, removal and transfer reject invalid actions atomically", () => {
  let s = createFreeSession(date);
  s = go(s, { type: "place", id: "v1", kind: "beaker", position: [0, 0, 0] });
  const before = JSON.stringify(s);
  for (const action of [
    { type: "place", id: "v2", kind: "flask", position: [0, 0, 0] },
    { type: "place", id: "v1", kind: "flask", position: [1, 0, 0] },
    { type: "place", id: "__proto__", kind: "flask", position: [1, 0, 0] },
    { type: "transfer", from: "v1", to: "v2", volume: 1, unit: "mL" },
    { type: "react", id: "v1", reactionId: "oxygen" },
  ])
    assert.equal(dispatchFree(s, action).ok, false);
  assert.equal(JSON.stringify(s), before);
  s = go(s, { type: "add", id: "v1", stock: "water", volume: 1, unit: "mL" });
  assert.equal(dispatchFree(s, { type: "remove", id: "v1" }).ok, false);
});
test("free notes persist independently of undo and reset, and export captures history", () => {
  let s = createFreeSession(date);
  s = go(s, { type: "place", id: "v1", kind: "beaker", position: [0, 0, 0] });
  s = go(s, { type: "note", text: "  observation  " });
  s = go(s, { type: "undo" });
  assert.deepEqual(s.notes, ["observation"]);
  s = go(s, { type: "redo" });
  const text = exportFreeNotebook(s);
  assert.match(text, /Placed Beaker/);
  assert.match(text, /observation/);
  s = go(s, { type: "reset" });
  assert.deepEqual(s.notes, ["observation"]);
  let saved = JSON.parse(JSON.stringify(s));
  assert.equal(validateFreeSession(saved), true);
  saved.workspace.objects.bad = {
    id: "bad",
    kind: "beaker",
    position: [0, 0, 0],
    volumeMl: -1,
    solutes: {},
  };
  assert.throws(() => validateFreeSession(saved));
});

test("student-controlled precipitation preserves excess for non-default volumes", () => {
  let s = createSession("precipitation");
  s = step(s, { type: "add", id: "a", stock: "silver", volume: 5, unit: "mL" });
  s = step(s, { type: "add", id: "b", stock: "salt", volume: 10, unit: "mL" });
  s = step(s, { type: "transfer", from: "b", to: "a", volume: 10, unit: "mL" });
  s = step(s, { type: "mix", id: "a" });
  s = step(s, { type: "react", id: "a", reactionId: "precipitation" });
  assert.ok(Math.abs(s.core.workspace.objects.a.solids.AgCl - 0.0005) < 1e-12);
  assert.ok(Math.abs(s.core.workspace.objects.a.solutes.NaCl - 0.0005) < 1e-12);
});

test("expanded 3D equipment library exposes dimensions, capacities, operations and typed ports", () => {
  for (const kind of ["beaker", "flask", "testTube", "cylinder", "volumetric", "funnel", "dropper", "pipette", "burette", "stand", "clamp", "glassRod", "watchGlass", "reagentBottle", "roundBottom", "deliveryTube", "collectionJar", "condenser"]) {
    const def = equipment[kind];
    assert.ok(def.name && def.model && def.dimensionsM.length === 3);
    assert.ok(Number.isFinite(def.capacityMl) && Array.isArray(def.operations));
    assert.ok(def.ports && typeof def.ports === "object");
  }
});

test("canonical workspace snaps movement, rotates, and validates compatible apparatus links atomically", () => {
  let w = createWorkspace();
  w = executeCommand(w, { type: "move", id: "a", position: [-1.37, 0.12, 0] });
  assert.deepEqual(w.objects.a.position, [-1.25, 0, 0]);
  w = executeCommand(w, { type: "rotate", id: "a", radians: Math.PI / 4 });
  assert.equal(w.objects.a.position[2], Math.PI / 4);
  w = executeCommand(w, { type: "connect", a: "f", ap: "stem", b: "a", bp: "mouth" });
  assert.equal(w.connections.length, 1);
  w = executeCommand(w, { type: "place", id: "t1", kind: "reactionVessel", position: [0, 1.5, 0] });
  w = executeCommand(w, { type: "place", id: "d1", kind: "deliveryTube", position: [2.5, 1.5, 0] });
  w = executeCommand(w, { type: "place", id: "jar1", kind: "collectionJar", position: [3.5, 1.5, 0] });
  w = executeCommand(w, { type: "connect", a: "t1", ap: "gasOutlet", b: "d1", bp: "inlet" });
  w = executeCommand(w, { type: "connect", a: "d1", ap: "outlet", b: "jar1", bp: "gasInlet" });
  assert.equal(w.connections.length, 3);
  const snapshot = JSON.stringify(w);
  assert.throws(() => executeCommand(w, { type: "connect", a: "f", ap: "stem", b: "b", bp: "mouth" }));
  assert.equal(JSON.stringify(w), snapshot);
});

test("free additions accept a specified concentration and reject invalid concentrations atomically", () => {
  let s = createFreeSession(date);
  s = go(s, { type: "place", id: "a", kind: "beaker", position: [0, 0, 0] });
  s = go(s, { type: "add", id: "a", stock: "acid", concentration: 0.25, volume: 10, unit: "mL" });
  assert.equal(s.workspace.objects.a.solutes.HCl, 0.0025);
  const before = JSON.stringify(s);
  assert.equal(dispatchFree(s, { type: "add", id: "a", stock: "acid", concentration: 30, volume: 1, unit: "mL" }).ok, false);
  assert.equal(JSON.stringify(s), before);
});
