import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,
  createObject,
  execute,
  concentration,
  validateWorkspace,
} from "../src/lab/engine.js";
import { equipment, stocks } from "../src/lab/registry.js";
import { oxygenReaction, oxygenYield } from "../src/oxygen.js";
test("registry has unique IDs, realistic positive capacity and allowed operations", () => {
  for (const [id, d] of Object.entries(equipment)) {
    assert.equal(id, d.id);
    assert.ok(d.dimensionsM.every((x) => x > 0));
    assert.ok(d.operations.length);
    assert.ok(d.capacityMl >= 0);
  }
  for (const [id, s] of Object.entries(stocks)) {
    assert.equal(id, s.id);
    assert.ok(s.hazard);
  }
});
test("transfer conserves volume and amount, and dilution follows moles/volume", () => {
  let s = createWorkspace();
  s = execute(s, { type: "add", id: "a", stock: "salt", volumeMl: 100 });
  s = execute(s, { type: "transfer", from: "a", to: "b", volumeMl: 40 });
  s = execute(s, { type: "add", id: "b", stock: "water", volumeMl: 40 });
  assert.equal(s.objects.a.volumeMl + s.objects.b.volumeMl, 140);
  assert.ok(
    Math.abs(s.objects.a.solutes.NaCl + s.objects.b.solutes.NaCl - 0.01) <
      1e-12,
  );
  assert.ok(Math.abs(concentration(s.objects.b, "NaCl") - 0.05) < 1e-12);
});
test("rejects invalid transfer atomically and respects capacity", () => {
  let s = createWorkspace();
  s = execute(s, { type: "add", id: "a", stock: "water", volumeMl: 10 });
  const before = JSON.stringify(s);
  for (const amount of [-1, NaN, 11])
    assert.throws(() =>
      execute(s, { type: "transfer", from: "a", to: "b", volumeMl: amount }),
    );
  assert.throws(() =>
    execute(s, { type: "add", id: "a", stock: "water", volumeMl: 241 }),
  );
  assert.throws(() =>
    execute(s, { type: "transfer", from: "a", to: "a", volumeMl: 1 }),
  );
  assert.equal(JSON.stringify(s), before);
});
test("compatible connection, occupation, invalid ports and disconnection", () => {
  let s = createWorkspace();
  s = execute(s, { type: "connect", a: "f", ap: "stem", b: "a", bp: "mouth" });
  assert.throws(() =>
    execute(s, { type: "connect", a: "f", ap: "stem", b: "b", bp: "mouth" }),
  );
  assert.throws(() =>
    execute(s, { type: "connect", a: "a", ap: "mouth", b: "b", bp: "mouth" }),
  );
  s = execute(s, { type: "disconnect", id: "f", port: "stem" });
  s = execute(s, { type: "connect", a: "f", ap: "stem", b: "b", bp: "mouth" });
  assert.equal(s.connections.length, 1);
});
test("restored state validation rejects corrupted amounts and placement", () => {
  let s = createWorkspace();
  s.objects.a.volumeMl = -1;
  assert.throws(() => validateWorkspace(s));
  s = createWorkspace();
  s.objects.a.position = [Infinity, 0, 0];
  assert.throws(() => validateWorkspace(s));
  assert.throws(() =>
    execute(createWorkspace(), { type: "move", id: "a", position: [5, 0, 0] }),
  );
});
test("emptying a vessel leaves no phantom solute", () => {
  let s = createWorkspace();
  s = execute(s, { type: "add", id: "a", stock: "salt", volumeMl: 10 });
  s = execute(s, { type: "transfer", from: "a", to: "b", volumeMl: 10 });
  assert.equal(s.objects.a.volumeMl, 0);
  assert.deepEqual(s.objects.a.solutes, {});
  assert.equal(concentration(s.objects.b, "NaCl"), 0.1);
});

test("tiny transfer from empty source must not create NaN", () => {
  assert.throws(() =>
    execute(createWorkspace(), {
      type: "transfer",
      from: "a",
      to: "b",
      volumeMl: 1e-12,
    }),
  );
});

test("independent compatible port pairs can coexist", () => {
  let s = createWorkspace();
  s.objects.f2 = createObject("f2", "funnel", [2, 1, 0]);
  s = execute(s, { type: "connect", a: "f", ap: "stem", b: "a", bp: "mouth" });
  s = execute(s, { type: "connect", a: "f2", ap: "stem", b: "b", bp: "mouth" });
  assert.equal(s.connections.length, 2);
  assert.throws(() =>
    execute(s, {
      type: "connect",
      a: "f",
      ap: "__proto__",
      b: "b",
      bp: "mouth",
    }),
  );
});

test("invalid persisted solute containers are rejected", () => {
  const s = createWorkspace();
  s.objects.a.solutes = [];
  assert.throws(() => validateWorkspace(s));
});

test("gas generation stays in the source without a typed path and collection obeys capacity and conservation", () => {
  let s = { objects: {
    tube: createObject("tube", "reactionVessel", [-1, 0, 0]),
    burner: createObject("burner", "burner", [-1, 1, 0]),
    delivery: createObject("delivery", "deliveryTube", [0, 1.5, 0]),
    jar: createObject("jar", "collectionJar", [1.5, 0, 0]),
  }, connections: [], events: [] };
  s = execute(s, { type: "add-solid", id: "tube", stock: "chlorate", massG: 2 });
  const unconnected = execute(s, { type: "heat", id: "tube", burnerId: "burner", fraction: 1 });
  const expected = oxygenYield(2, 1).oxygenMoles;
  assert.ok(Math.abs(unconnected.objects.tube.gases.O2 - expected) < 1e-12);
  assert.equal(unconnected.objects.jar.gases.O2 || 0, 0);
  const unchanged = JSON.stringify(unconnected);
  assert.throws(() => execute(unconnected, { type: "heat", id: "tube", burnerId: "burner", fraction: 0.1 }));
  assert.equal(JSON.stringify(unconnected), unchanged);
  let connected = execute(unconnected, { type: "connect", a: "tube", ap: "gasOutlet", b: "delivery", bp: "inlet" });
  connected = execute(connected, { type: "connect", a: "delivery", ap: "outlet", b: "jar", bp: "gasInlet" });
  assert.ok(connected.objects.tube.gases.O2 > 0);
  const collected = connected.objects.jar.gases.O2;
  assert.ok(Math.abs(collected * oxygenReaction.molarGasVolume * 1000 - 500) < 1e-8);
  const gasBalance = (connected.objects.jar.gases.O2 || 0) + (connected.objects.tube.gases.O2 || 0);
  assert.ok(Math.abs(gasBalance - expected) < 1e-12);
  assert.ok(connected.objects.tube.gases.O2 > 0);
  assert.ok(Math.abs(connected.objects.tube.solids.KClO3 + connected.objects.tube.solids.KCl - 2 / oxygenReaction.potassiumChlorateMolarMass) < 1e-12);
  assert.equal(validateWorkspace(connected), true);
});

test("dispensing equipment requires a compatible connection and transfers liquid atomically", () => {
  let s = createWorkspace();
  s = execute(s, { type: "place", id: "p", kind: "pipette", position: [-3, 1.5, 0] });
  s = execute(s, { type: "add", id: "p", stock: "acid", volumeMl: 10 });
  const before = JSON.stringify(s);
  assert.throws(() => execute(s, { type: "transfer", from: "p", to: "b", volumeMl: 5 }));
  assert.equal(JSON.stringify(s), before);
  s = execute(s, { type: "connect", a: "p", ap: "tip", b: "b", bp: "mouth" });
  s = execute(s, { type: "transfer", from: "p", to: "b", volumeMl: 5 });
  assert.equal(s.objects.p.volumeMl, 5);
  assert.equal(s.objects.b.volumeMl, 5);
  assert.equal(s.objects.p.solutes.HCl + s.objects.b.solutes.HCl, 0.001);
});

test("funnel routing validates the receiver connection and preserves substance amount", () => {
  let s = createWorkspace();
  s = execute(s, { type: "add", id: "a", stock: "silver", volumeMl: 10 });
  const before = JSON.stringify(s);
  assert.throws(() => execute(s, { type: "transfer", from: "a", to: "b", via: "f", volumeMl: 5 }));
  assert.equal(JSON.stringify(s), before);
  s = execute(s, { type: "connect", a: "f", ap: "stem", b: "b", bp: "mouth" });
  s = execute(s, { type: "transfer", from: "a", to: "b", via: "f", volumeMl: 5 });
  assert.equal(s.objects.b.volumeMl, 5);
  assert.equal(s.objects.a.solutes.AgNO3 + s.objects.b.solutes.AgNO3, 0.001);
});
