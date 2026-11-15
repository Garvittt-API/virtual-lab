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
