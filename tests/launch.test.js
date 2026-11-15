import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EXPERIMENTS,
  experimentHash,
  parseExperimentRoute,
  initializeGuidedExperiment,
} from "../src/lab/launch.js";
import { newLabSession } from "../src/lab/session.js";
import { saveStore, SESSION_STORE_KEY } from "../src/lab/session-store.js";
import { guidedManifests } from "../src/lab/guided.js";
const at = "2026-01-01T00:00:00.000Z";
function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}
test("card launch wiring uses real IDs and corresponding workbenches", () => {
  const source = readFileSync(
    new URL("../src/main.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /open=\{\(\) => launch\("neutralization"\)\}/);
  assert.match(source, /openOxygen=\{\(\) => launch\("oxygen"\)\}/);
  assert.match(
    source,
    /<SessionWorkbench\s+initialMode="guided"\s+experimentId=\{route.id\}/,
  );
  assert.match(source, /<OxygenLab \/>/);
  assert.equal(EXPERIMENTS.neutralization.kind, "guided");
  assert.equal(EXPERIMENTS.oxygen.kind, "oxygen");
});
test("direct navigation and refresh parse valid and unknown IDs safely", () => {
  for (const id of ["neutralization", "oxygen"])
    assert.equal(parseExperimentRoute(experimentHash(id)).experiment.id, id);
  assert.equal(parseExperimentRoute("#/experiments/not-real").experiment, null);
  assert.equal(
    parseExperimentRoute("#/experiments/__proto__").experiment,
    null,
  );
  assert.equal(parseExperimentRoute(""), null);
  assert.throws(() => experimentHash("unknown"));
});
test("requested guided session created without replacing unrelated active free session and restored on refresh", () => {
  const storage = memory(),
    free = newLabSession("free", "free", null, at);
  saveStore(storage, {
    version: 1,
    activeId: free.id,
    sessions: [free],
    imported: {},
  });
  const first = initializeGuidedExperiment(
    storage,
    "neutralization",
    at,
    () => "guided",
  );
  assert.equal(first.activeId, "guided");
  assert.deepEqual(first.sessions[0], free);
  assert.equal(first.sessions[1].core.experiment.id, "neutralization");
  assert.equal(first.sessions[1].mode, "guided");
  const restored = initializeGuidedExperiment(
    storage,
    "neutralization",
    at,
    () => {
      throw Error("should restore");
    },
  );
  assert.equal(restored.activeId, "guided");
  assert.equal(restored.sessions.length, 2);
});
test("invalid manifest and unknown ID fail without changing saved bytes", () => {
  const storage = memory();
  saveStore(storage, { version: 1, activeId: "", sessions: [], imported: {} });
  const before = storage.getItem(SESSION_STORE_KEY);
  const manifest = guidedManifests.neutralization,
    original = manifest.steps;
  try {
    manifest.steps = [];
    assert.throws(
      () =>
        initializeGuidedExperiment(storage, "neutralization", at, () => "id"),
      /Invalid guided manifest/,
    );
  } finally {
    manifest.steps = original;
  }
  assert.throws(
    () => initializeGuidedExperiment(storage, "oxygen", at, () => "id"),
    /Unknown/,
  );
  assert.equal(storage.getItem(SESSION_STORE_KEY), before);
});
