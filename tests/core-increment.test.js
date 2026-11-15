import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, executeCommand } from "../src/lab/engine.js";
import { createSession, dispatch } from "../src/lab/guided.js";
import { createFreeSession, dispatchFree } from "../src/lab/free.js";
import {
  emptyNotebook,
  addEntry,
  editObservation,
  removeObservation,
  loadNotebook,
  saveNotebook,
  appendNotebook,
  exportNotebook,
  NOTEBOOK_KEY,
} from "../src/lab/notebook.js";
const entry = {
  id: "1",
  sessionId: "session-1",
  experiment: "Dilution",
  at: "2026-01-01T00:00:00.000Z",
  kind: "observation",
  text: "A note",
};
test("guided and free commands share normalized engine and vessel schema", () => {
  const g = createSession("neutralization");
  const gr = dispatch(g, {
    type: "perform",
    stepId: "acid",
    command: { type: "add", id: "a", stock: "acid", volume: 0.01, unit: "L" },
  });
  assert.equal(gr.ok, true);
  let f = createFreeSession("2026-01-01T00:00:00Z");
  f = dispatchFree(f, {
    type: "place",
    id: "a",
    kind: "beaker",
    position: [-1.5, 0, 0],
  }).state;
  f = dispatchFree(f, {
    type: "add",
    id: "a",
    stock: "acid",
    volume: 10,
    unit: "mL",
  }).state;
  assert.deepEqual(gr.state.core.workspace.objects.a, f.workspace.objects.a);
});
test("measurement command uses one engine and rejects invalid inputs atomically", () => {
  let w = createWorkspace();
  w = executeCommand(w, {
    type: "add",
    id: "a",
    stock: "salt",
    volume: 0.01,
    unit: "L",
  });
  const before = structuredClone(w);
  const measured = executeCommand(w, {
    type: "measure",
    id: "a",
    solute: "NaCl",
  });
  assert.match(measured.events.at(-1), /Measured NaCl: 0.1 mol\/L/);
  assert.deepEqual(w, before);
  assert.throws(() =>
    executeCommand(w, { type: "measure", id: "a", solute: "not-a-substance" }),
  );
  assert.throws(() =>
    executeCommand(w, { type: "measure", id: "b", solute: "NaCl" }),
  );
  assert.deepEqual(w, before);
});
test("notebook persists, edits and exports observations separately from undo", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => values.set(k, v),
  };
  let book = addEntry(emptyNotebook(), entry);
  saveNotebook(storage, book);
  book = loadNotebook(storage);
  book = editObservation(book, "1", "Edited");
  book = addEntry(book, {
    ...entry,
    id: "2",
    kind: "event",
    text: "Added stock",
  });
  saveNotebook(storage, book);
  assert.match(exportNotebook(loadNotebook(storage), "markdown"), /Edited/);
  assert.match(exportNotebook(book, "text"), /Added stock/);
  assert.throws(() => removeObservation(book, "2"));
  book = removeObservation(book, "1");
  assert.equal(book.entries.length, 1);
  let session = createFreeSession("2026-01-01T00:00:00Z");
  session = dispatchFree(session, {
    type: "place",
    id: "v1",
    kind: "beaker",
    position: [0, 0, 0],
  }).state;
  session = dispatchFree(session, { type: "undo" }).state;
  assert.equal(session.workspace.objects.v1, undefined);
  assert.equal(loadNotebook(storage).entries[0].text, "Edited");
});
test("invalid persisted notebook never overwritten by append", () => {
  let raw = "{broken";
  const storage = {
    getItem: (k) => (k === NOTEBOOK_KEY ? raw : null),
    setItem: (_k, v) => {
      raw = v;
    },
  };
  assert.throws(() => appendNotebook(storage, entry));
  assert.equal(raw, "{broken");
  assert.throws(() => saveNotebook(storage, { version: 2, entries: [] }));
  assert.equal(raw, "{broken");
});

test("legacy notebook import copies guided, free, oxygen and neutralization records without changing originals", async () => {
  const { importLegacyNotebook } = await import("../src/lab/import-notes.js");
  let g = createSession("neutralization");
  g = dispatch(g, { type: "observe", note: "guided observation" }).state;
  let f = createFreeSession("2026-01-01T00:00:00Z");
  f = dispatchFree(f, { type: "note", text: "free observation" }).state;
  const originals = new Map([
    ["materia-guided-v1", JSON.stringify(g)],
    ["materia-free-v1", JSON.stringify(f)],
    [
      "materia-oxygen",
      JSON.stringify({ events: ["oxygen event"], notes: "oxygen note" }),
    ],
    [
      "materia-session",
      JSON.stringify({ events: ["legacy event"], notes: "legacy note" }),
    ],
  ]);
  const values = new Map(originals);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
  let book = importLegacyNotebook(storage, "2026-01-01T00:00:00Z");
  for (const text of [
    "guided observation",
    "free observation",
    "oxygen note",
    "legacy note",
  ])
    assert.ok(book.entries.some((e) => e.text === text));
  for (const [key, value] of originals) assert.equal(values.get(key), value);
  let second = importLegacyNotebook(storage, "2026-02-01T00:00:00Z");
  assert.deepEqual(second, book);
  const saved = values.get(NOTEBOOK_KEY);
  values.set("materia-oxygen", "{broken");
  assert.throws(() => importLegacyNotebook(storage, "2026-03-01T00:00:00Z"));
  assert.equal(values.get(NOTEBOOK_KEY), saved);
  assert.equal(values.get("materia-oxygen"), "{broken");
});

test("legacy notebook import skips scientific saves already migrated to canonical sessions", async () => {
  const { importLegacyNotebook } = await import("../src/lab/import-notes.js");
  const { migrateOxygenSession, saveStore } = await import("../src/lab/session-store.js");
  const { initialOxygen } = await import("../src/oxygen.js");
  const oxygen = {
    ...structuredClone(initialOxygen),
    events: ["old oxygen event"],
    notes: "old oxygen observation",
  };
  const session = migrateOxygenSession(oxygen, "legacy-oxygen-v1", "2026-01-01T00:00:00.000Z");
  const values = new Map([
    ["materia-oxygen", JSON.stringify(oxygen)],
    [NOTEBOOK_KEY, JSON.stringify(emptyNotebook())],
  ]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  saveStore(storage, {
    version: 1,
    activeId: session.id,
    sessions: [session],
    imported: { "materia-oxygen": session.id },
  });
  const before = values.get("materia-oxygen");
  const book = importLegacyNotebook(storage, "2026-02-01T00:00:00.000Z");
  assert.equal(book.entries.length, 0);
  assert.equal(values.get("materia-oxygen"), before);
});
