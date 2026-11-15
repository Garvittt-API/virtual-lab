import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newLabSession,
  dispatchLab,
  validateLabSession,
} from "../src/lab/session.js";
import {
  migrateSession,
  loadStore,
  saveStore,
  SESSION_STORE_KEY,
} from "../src/lab/session-store.js";
import { guidedManifests, createSession, dispatch } from "../src/lab/guided.js";
import { createFreeSession, dispatchFree } from "../src/lab/free.js";
import { exportNotebook } from "../src/lab/notebook.js";
const at = "2026-01-01T00:00:00.000Z";
let sequence = 0;
function go(s, a) {
  const r = dispatchLab(s, a, at, `entry-${sequence++}`);
  assert.equal(r.ok, true, r.error);
  return r.state;
}
function memory(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
test("policy switching keeps same session and single inventory; attempts independent", () => {
  let s = newLabSession("s1", "guided", "neutralization", at),
    other = newLabSession("s2", "guided", "neutralization", at);
  s = go(s, {
    type: "perform",
    stepId: "acid",
    command: { type: "add", id: "a", stock: "acid", volume: 10, unit: "mL" },
  });
  const inventory = structuredClone(s.core.workspace);
  s = go(s, { type: "policy", mode: "free" });
  assert.equal(s.id, "s1");
  assert.deepEqual(s.core.workspace, inventory);
  s = go(s, { type: "policy", mode: "guided" });
  assert.deepEqual(s.core.workspace, inventory);
  assert.equal(s.core.experiment.step, 1);
  assert.equal(other.core.workspace.objects.a.volumeMl, 0);
  assert.ok(!("inventory" in s));
  assert.equal(validateLabSession(s), true);
});
test("all guided workflows execute via canonical commands", () => {
  for (const name of ["neutralization", "precipitation", "dilution"]) {
    let s = newLabSession(name, "guided", name, at);
    for (const step of guidedManifests[name].steps)
      s = go(s, { type: "next", stepId: step.id });
    assert.equal(s.core.experiment.step, guidedManifests[name].steps.length);
    const w = s.core.workspace;
    if (name === "neutralization")
      assert.equal(w.objects.a.solutes.NaCl, 0.0025);
    if (name === "precipitation") assert.equal(w.objects.a.solids.AgCl, 0.001);
    if (name === "dilution") {
      assert.equal(w.objects.b.volumeMl, 100);
      assert.equal(w.objects.b.solutes.NaCl, 0.001);
    }
    assert.ok(s.notebook.entries.length >= 5);
  }
});
test("free equipment and liquid commands, measurement, undo and redo", () => {
  let s = newLabSession("f", "free", null, at);
  s = go(s, { type: "place", id: "a", kind: "beaker", position: [-1, 0, 0] });
  s = go(s, { type: "place", id: "b", kind: "flask", position: [1, 0, 0] });
  s = go(s, { type: "move", id: "a", position: [-1, 0.5, 0.3] });
  s = go(s, { type: "add", id: "a", stock: "salt", volume: 0.02, unit: "L" });
  s = go(s, { type: "transfer", from: "a", to: "b", volume: 10, unit: "mL" });
  assert.equal(
    s.core.workspace.objects.a.volumeMl + s.core.workspace.objects.b.volumeMl,
    20,
  );
  assert.ok(
    Math.abs(
      s.core.workspace.objects.a.solutes.NaCl +
        s.core.workspace.objects.b.solutes.NaCl -
        0.002,
    ) < 1e-12,
  );
  s = go(s, { type: "measure-volume", id: "b" });
  s = go(s, { type: "measure", id: "b", solute: "NaCl" });
  s = go(s, { type: "mix", id: "b" });
  const before = structuredClone(s.core);
  s = go(s, { type: "undo" });
  s = go(s, { type: "redo" });
  assert.deepEqual(s.core, before);
  assert.match(exportNotebook(s.notebook, "text"), /Measured volume: 10 mL/);
  assert.ok(s.notebook.entries.every((e) => e.sessionId === "f"));
});
test("invalid operations are atomic and never log false success", () => {
  let s = newLabSession("f", "free", null, at);
  s = go(s, { type: "place", id: "a", kind: "beaker", position: [0, 0, 0] });
  const before = JSON.stringify(s);
  for (const action of [
    { type: "add", id: "a", stock: "water", volume: 251, unit: "mL" },
    { type: "add", id: "a", stock: "water", volume: -1, unit: "mL" },
    { type: "transfer", from: "a", to: "a", volume: 1, unit: "mL" },
    { type: "react", id: "a", reactionId: "oxygen" },
    { type: "policy", mode: "guided" },
  ])
    assert.equal(dispatchLab(s, action, at, `bad-${sequence++}`).ok, false);
  assert.equal(JSON.stringify(s), before);
});
test("notebook observations are separate from simulation history and support edits and export", () => {
  let s = newLabSession("f", "free", null, at);
  s = go(s, { type: "place", id: "a", kind: "beaker", position: [0, 0, 0] });
  s = go(s, { type: "note", text: "My observation" });
  const note = s.notebook.entries.find((e) => e.kind === "observation");
  s = go(s, { type: "undo" });
  assert.equal(s.core.workspace.objects.a, undefined);
  assert.ok(s.notebook.entries.some((e) => e.text === "My observation"));
  s = go(s, { type: "edit-note", id: note.id, text: "Changed" });
  assert.match(exportNotebook(s.notebook, "markdown"), /Changed/);
  s = go(s, { type: "redo" });
  assert.ok(s.core.workspace.objects.a);
  s = go(s, { type: "remove-note", id: note.id });
  assert.equal(
    s.notebook.entries.some((e) => e.id === note.id),
    false,
  );
});
test("migration copies v1 state, progress, notes and history, original unchanged and idempotent", () => {
  let g = createSession("dilution");
  g = dispatch(g, { type: "next", stepId: "stock" }).state;
  g = dispatch(g, { type: "observe", note: "guided note" }).state;
  let f = createFreeSession(at);
  f = dispatchFree(f, {
    type: "place",
    id: "x",
    kind: "beaker",
    position: [0, 0, 0],
  }).state;
  f = dispatchFree(f, { type: "note", text: "free note" }).state;
  const gr = JSON.stringify(g),
    fr = JSON.stringify(f);
  const storage = memory({ "materia-guided-v1": gr, "materia-free-v1": fr });
  const store = loadStore(storage, at);
  assert.equal(store.sessions.length, 2);
  assert.equal(store.sessions[0].core.experiment.step, 1);
  assert.deepEqual(store.sessions[0].core.workspace, g.core.workspace);
  assert.equal(store.sessions[0].past.length, g.past.length);
  assert.equal(store.sessions[1].past.length, f.past.length);
  assert.ok(
    store.sessions[0].notebook.entries.some((e) => e.text === "guided note"),
  );
  assert.ok(
    store.sessions[1].notebook.entries.some((e) => e.text === "free note"),
  );
  assert.equal(storage.getItem("materia-guided-v1"), gr);
  assert.equal(storage.getItem("materia-free-v1"), fr);
  assert.deepEqual(loadStore(storage, at), store);
  assert.deepEqual(
    migrateSession(g, "guided", "g", at),
    migrateSession(g, "guided", "g", at),
  );
});
test("corrupt, unsupported and failed writes preserve source and existing store", () => {
  for (const source of [
    "{broken",
    JSON.stringify({ ...createFreeSession(at), version: 9 }),
  ]) {
    const st = memory({ "materia-free-v1": source });
    assert.throws(() => loadStore(st, at));
    assert.equal(st.getItem("materia-free-v1"), source);
    assert.equal(st.getItem(SESSION_STORE_KEY), null);
  }
  const source = JSON.stringify(createFreeSession(at));
  const st = memory({ "materia-free-v1": source });
  st.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => loadStore(st, at));
  assert.equal(st.getItem("materia-free-v1"), source);
  assert.equal(st.getItem(SESSION_STORE_KEY), null);
});
test("multiple named sessions save and reopen without changing independent state", () => {
  let a = newLabSession("a", "free", null, at, "First"),
    b = newLabSession("b", "free", null, at, "Second");
  a = go(a, { type: "place", id: "v", kind: "beaker", position: [0, 0, 0] });
  const st = memory();
  saveStore(st, { version: 1, activeId: "a", sessions: [a, b], imported: {} });
  const restored = loadStore(st, at);
  assert.deepEqual(restored.sessions[0], a);
  assert.equal(
    Object.keys(restored.sessions[1].core.workspace.objects).length,
    0,
  );
});

test("guided variable quantities and failed prerequisite preserve state", () => {
  let s = newLabSession("g", "guided", "neutralization", at);
  const before = JSON.stringify(s);
  assert.equal(
    dispatchLab(s, { type: "next", stepId: "reaction" }, at, "bad-step").ok,
    false,
  );
  assert.equal(JSON.stringify(s), before);
  s = go(s, {
    type: "perform",
    stepId: "acid",
    command: { type: "add", id: "a", stock: "acid", volume: 0.01, unit: "L" },
  });
  s = go(s, {
    type: "perform",
    stepId: "base",
    command: { type: "add", id: "b", stock: "base", volume: 20, unit: "mL" },
  });
  s = go(s, {
    type: "perform",
    stepId: "transfer",
    command: { type: "transfer", from: "b", to: "a", volume: 20, unit: "mL" },
  });
  s = go(s, { type: "next", stepId: "mix" });
  s = go(s, { type: "next", stepId: "reaction" });
  assert.ok(Math.abs(s.core.workspace.objects.a.solutes.NaOH - 0.001) < 1e-12);
});
test("free reaction, insufficient transfer, reset undo and redo branching", () => {
  let s = newLabSession("f", "free", null, at);
  s = go(s, { type: "place", id: "a", kind: "beaker", position: [-1, 0, 0] });
  s = go(s, { type: "place", id: "b", kind: "flask", position: [1, 0, 0] });
  s = go(s, { type: "add", id: "a", stock: "silver", volume: 10, unit: "mL" });
  s = go(s, { type: "add", id: "b", stock: "salt", volume: 20, unit: "mL" });
  const before = JSON.stringify(s);
  assert.equal(
    dispatchLab(
      s,
      { type: "transfer", from: "b", to: "a", volume: 21, unit: "mL" },
      at,
      "bad-transfer",
    ).ok,
    false,
  );
  assert.equal(JSON.stringify(s), before);
  s = go(s, { type: "transfer", from: "b", to: "a", volume: 20, unit: "mL" });
  s = go(s, { type: "mix", id: "a" });
  s = go(s, { type: "react", id: "a", reactionId: "precipitation" });
  assert.equal(s.core.workspace.objects.a.solids.AgCl, 0.001);
  s = go(s, { type: "reset" });
  assert.equal(Object.keys(s.core.workspace.objects).length, 0);
  s = go(s, { type: "undo" });
  assert.equal(s.core.workspace.objects.a.solids.AgCl, 0.001);
  s = go(s, { type: "move", id: "a", position: [-2, 0, 0] });
  assert.equal(s.future.length, 0);
});
test("unknown legacy fields are rejected without overwriting source", () => {
  let old = createFreeSession(at);
  old.futureFormatField = "unknown";
  const raw = JSON.stringify(old),
    st = memory({ "materia-free-v1": raw });
  assert.throws(() => loadStore(st, at), /Unsupported legacy fields/);
  assert.equal(st.getItem("materia-free-v1"), raw);
  assert.equal(st.getItem(SESSION_STORE_KEY), null);
});

test("same persisted session can switch policies and retain contents after reopen", () => {
  const st = memory();
  let s = newLabSession("same", "guided", "dilution", at);
  s = go(s, {
    type: "perform",
    stepId: "stock",
    command: { type: "add", id: "a", stock: "salt", volume: 20, unit: "mL" },
  });
  let store = { version: 1, activeId: s.id, sessions: [s], imported: {} };
  saveStore(st, store);
  let loaded = loadStore(st, at).sessions[0];
  loaded = go(loaded, { type: "policy", mode: "free" });
  loaded = go(loaded, { type: "move", id: "a", position: [-2, 0, 0.2] });
  saveStore(st, { ...store, sessions: [loaded] });
  loaded = loadStore(st, at).sessions[0];
  assert.equal(loaded.id, "same");
  assert.equal(loaded.core.workspace.objects.a.volumeMl, 20);
  assert.equal(loaded.core.experiment.step, 1);
  loaded = go(loaded, { type: "policy", mode: "guided" });
  loaded = go(loaded, {
    type: "perform",
    stepId: "transfer",
    command: { type: "transfer", from: "a", to: "b", volume: 10, unit: "mL" },
  });
  assert.equal(loaded.core.workspace.objects.b.solutes.NaCl, 0.001);
  assert.ok(loaded.notebook.entries.every((e) => e.sessionId === "same"));
});
