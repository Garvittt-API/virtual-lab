import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPERIMENT_SCHEMA_VERSION, EXPERIMENT_STORE_KEY, createDraftManifest,
  duplicateExperimentManifest, emptyExperimentStore, exportExperimentManifest,
  importExperimentManifest, loadExperimentStore, migrateExperimentManifest,
  saveExperimentStore, searchExperimentLibrary, validateExperimentManifest,
  createWorkspaceFromManifest,
} from "../src/lab/experiment-authoring.js";
import { newAuthoredExperimentSession, dispatchLab } from "../src/lab/session.js";

const validManifest = () => {
  const manifest = createDraftManifest("2026-11-15T00:00:00.000Z", "author-neutralization-demo");
  manifest.title = "Neutralization model";
  manifest.description = "Compare acid and base amounts with the deterministic neutralization model.";
  manifest.topic = "Acid-base chemistry";
  manifest.apparatus = [{ id: "vessel", kind: "beaker", position: [0, 0, 0] }];
  manifest.initialChemicals = [
    { equipmentId: "vessel", stockId: "acid", volumeMl: 10, concentrationM: 0.1 },
    { equipmentId: "vessel", stockId: "base", volumeMl: 10, concentrationM: 0.1 },
  ];
  manifest.instructions = [
    { id: "mix", instruction: "Mix the solutions.", command: { type: "mix", id: "vessel" } },
    { id: "react", instruction: "Run the supported neutralization model.", command: { type: "react", id: "vessel", reactionId: "neutralization" } },
  ];
  manifest.supportedOperations = ["mix", "react"];
  manifest.reactionIds = ["neutralization"];
  manifest.expectedObservations = ["The supported model consumes equal acid and base amounts."];
  manifest.measurements = ["concentration"];
  return manifest;
};

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}

test("validates supported manifests and builds the shared engine workspace", () => {
  const manifest = validManifest();
  const result = validateExperimentManifest(manifest);
  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.equal(result.manifest.schemaVersion, EXPERIMENT_SCHEMA_VERSION);
  const workspace = createWorkspaceFromManifest(manifest);
  assert.equal(workspace.objects.vessel.volumeMl, 20);
  assert.equal(workspace.objects.vessel.solutes.HCl, 0.001);
  assert.equal(workspace.objects.vessel.solutes.NaOH, 0.001);
});

test("initializes a real authored session and executes its deterministic workflow", () => {
  const manifest = validManifest();
  const session = newAuthoredExperimentSession("session-authoring", manifest, "2026-11-15T00:00:00Z");
  const mixed = dispatchLab(session, { type: "perform", stepId: "mix", command: { type: "mix", id: "vessel" } }, "2026-11-15T00:00:01Z", "event-mix");
  assert.equal(mixed.ok, true, mixed.error);
  const reacted = dispatchLab(mixed.state, { type: "perform", stepId: "react", command: { type: "react", id: "vessel", reactionId: "neutralization" } }, "2026-11-15T00:00:02Z", "event-react");
  assert.equal(reacted.ok, true, reacted.error);
  assert.equal(reacted.state.core.experiment.step, 2);
  assert.ok(reacted.state.core.workspace.events.some((event) => event.includes("Reaction neutralization")));
  assert.equal(reacted.state.core.experiment.result, null, "custom experiment does not fabricate the built-in pH result");
});

test("runs only the declared gas-inventory measurement model for compatible equipment", () => {
  const manifest = createDraftManifest("2026-11-15T00:00:00.000Z", "author-gas-readout");
  manifest.apparatus = [{ id: "jar", kind: "collectionJar", position: [0, 0, 0] }];
  manifest.supportedOperations = ["measure-gas"];
  manifest.measurements = ["gas-inventory"];
  manifest.instructions = [{ id: "read-gas", instruction: "Measure the gas inventory.", command: { type: "measure-gas", id: "jar" } }];
  assert.equal(validateExperimentManifest(manifest).valid, true);
  const session = newAuthoredExperimentSession("session-gas", manifest, "2026-11-15T00:00:00Z");
  const result = dispatchLab(session, { type: "perform", stepId: "read-gas", command: { type: "measure-gas", id: "jar" } }, "2026-11-15T00:00:01Z", "gas-event");
  assert.equal(result.ok, true, result.error);
  assert.match(result.state.core.workspace.events.at(-1), /no collected gas/);
});

test("rejects unknown chemical/equipment, incompatible connections, operations and quantities", () => {
  const unknownStock = validManifest();
  unknownStock.initialChemicals[0].stockId = "made-up";
  assert.match(validateExperimentManifest(unknownStock).errors.join(" "), /unavailable/);
  const unknownKind = validManifest();
  unknownKind.apparatus[0].kind = "custom-vessel";
  assert.match(validateExperimentManifest(unknownKind).errors.join(" "), /not in the equipment registry/);
  const unsupported = validManifest();
  unsupported.instructions[0].command = { type: "run-script", code: "alert(1)" };
  assert.match(validateExperimentManifest(unsupported).errors.join(" "), /unsupported command/);
  const tooMuch = validManifest();
  tooMuch.initialChemicals[0].volumeMl = 251;
  assert.match(validateExperimentManifest(tooMuch).errors.join(" "), /Capacity exceeded/);
  const badConnection = validManifest();
  badConnection.apparatus.push({ id: "funnel", kind: "funnel", position: [1, 0, 0] });
  badConnection.initialConnections = [{ a: "vessel", ap: "bad-port", b: "funnel", bp: "stem" }];
  assert.match(validateExperimentManifest(badConnection).errors.join(" "), /Invalid connection/);
});

test("validates reaction declarations and step reachability", () => {
  const manifest = validManifest();
  manifest.reactionIds = ["unsupported"];
  assert.match(validateExperimentManifest(manifest).errors.join(" "), /Only engine-supported/);
  const unreachable = validManifest();
  unreachable.instructions[0] = { id: "react-first", instruction: "React first.", command: { type: "react", id: "vessel", reactionId: "neutralization" } };
  assert.match(validateExperimentManifest(unreachable).errors.join(" "), /cannot execute from the declared starting inventory/);
});

test("migrates v1 definitions and rejects unknown versions safely", () => {
  const source = validManifest();
  const v1 = { ...source, schemaVersion: 1, educationLevel: undefined, level: "undergraduate" };
  const migrated = migrateExperimentManifest(v1);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.educationLevel, "undergraduate");
  assert.throws(() => migrateExperimentManifest({ schemaVersion: 8 }), /Unsupported/);
  assert.equal(validateExperimentManifest({ ...source, reactionIds: {} }).valid, false);
  assert.match(validateExperimentManifest({ ...source, id: "neutralization" }).errors.join(" "), /reserved by the built-in/);
});

test("imports and exports strict JSON envelopes without executable content", () => {
  const manifest = validManifest();
  const text = exportExperimentManifest(manifest);
  assert.deepEqual(importExperimentManifest(text), { ...manifest, status: "draft" });
  assert.throws(() => importExperimentManifest(text.replace('"exportVersion": 1', '"exportVersion": 3')), /Unsupported/);
  assert.throws(() => importExperimentManifest("x".repeat(1_000_001)), /1 MB/);
  const payload = JSON.parse(text);
  payload.manifest.script = "globalThis.pwned=true";
  assert.throws(() => importExperimentManifest(JSON.stringify(payload)), /unsupported field/);
});

test("stores drafts and publications with duplicate ID protection and publish validation", () => {
  const storage = new MemoryStorage();
  const draft = validManifest();
  const store = emptyExperimentStore();
  store.drafts.push(draft);
  saveExperimentStore(storage, store);
  assert.equal(loadExperimentStore(storage).drafts[0].id, draft.id);
  assert.throws(() => saveExperimentStore(storage, { ...store, published: [{ ...draft, status: "published" }] }), /duplicated/);
  assert.throws(() => saveExperimentStore(storage, { version: 1, drafts: [], published: [{ ...draft, status: "published", initialChemicals: [] }] }), /requires a valid/);
  assert.equal(storage.getItem(EXPERIMENT_STORE_KEY) !== null, true);
});

test("migrates stored schema v1 records when loading the local library", () => {
  const storage = new MemoryStorage();
  const legacy = { ...validManifest(), schemaVersion: 1, educationLevel: undefined, level: "high-school", metadata: { author: "Old author" } };
  storage.setItem(EXPERIMENT_STORE_KEY, JSON.stringify({ version: 1, drafts: [legacy], published: [] }));
  const loaded = loadExperimentStore(storage);
  assert.equal(loaded.drafts[0].schemaVersion, 2);
  assert.equal(loaded.drafts[0].educationLevel, "high-school");
  assert.equal(Number.isFinite(Date.parse(loaded.drafts[0].metadata.createdAt)), true);
});

test("duplicates to a new draft and searches/filter published cards", () => {
  const copy = duplicateExperimentManifest(validManifest(), "2026-11-16T00:00:00Z", "author-copy");
  assert.equal(copy.status, "draft");
  assert.equal(copy.id, "author-copy");
  const items = [validManifest(), { ...validManifest(), id: "other", title: "Gas model", topic: "Gas chemistry", educationLevel: "high-school", difficulty: "advanced" }];
  assert.deepEqual(searchExperimentLibrary(items, { query: "neutralization", educationLevel: "general" }).map((item) => item.id), ["author-neutralization-demo"]);
  assert.equal(searchExperimentLibrary(items, { difficulty: "advanced" }).length, 1);
});
