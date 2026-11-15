// The module parses untrusted, versioned JSON; runtime validation is authoritative.
// @ts-nocheck
import { createObject, executeCommand, validateWorkspace } from "./engine.js";
import { equipment, stocks } from "./registry.js";
import { reactions, validateReaction } from "../simulation/reactions.js";
import { guidedManifests, experimentManifests } from "./guided.js";

export const EXPERIMENT_SCHEMA_VERSION = 2;
export const EXPERIMENT_STORE_KEY = "materia-experiment-library-v1";
export const EXPERIMENT_EXPORT_FORMAT = "materia-experiment";
export const EXPERIMENT_EXPORT_VERSION = 1;
export const supportedInstructionTypes = Object.freeze([
  "add", "transfer", "mix", "react", "measure", "measure-volume", "measure-gas",
]);
const levels = ["middle-school", "high-school", "undergraduate", "general"];
const difficulties = ["introductory", "intermediate", "advanced"];
const measurements = ["volume", "concentration", "gas-inventory"];
const criteria = ["complete-all-steps"];
const registryOperations = new Set(Object.values(equipment).flatMap((item) => item.operations));
const declaredOperations = new Set([...registryOperations, ...supportedInstructionTypes, "connect"]);
const maxImportBytes = 1_000_000;
const manifestKeys = [
  "schemaVersion", "id", "title", "description", "subject", "topic", "educationLevel", "difficulty",
  "learningObjectives", "requiredKnowledge", "apparatus", "initialChemicals", "initialConnections",
  "supportedOperations", "reactionIds", "instructions", "expectedObservations", "measurements",
  "scientificAssumptions", "safetyWarnings", "completionCriteria", "assessmentQuestions",
  "estimatedDurationMinutes", "metadata", "status",
];

const own = (object, key) => Object.hasOwn(object, key);
const plainObject = (value) => value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
// eslint-disable-next-line no-control-regex
const textValue = (value, max = 1000) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const safeId = (value) => typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value);
const lines = (value, max = 30) => Array.isArray(value) && value.length <= max && value.every((entry) => textValue(entry, 500));

/** Convert the former schema v1 envelope to current v2 without executing imported content. */
export function migrateExperimentManifest(input) {
  if (!plainObject(input)) throw new Error("Experiment definition must be a JSON object");
  if (input.schemaVersion === EXPERIMENT_SCHEMA_VERSION) return structuredClone(input);
  if (input.schemaVersion !== 1) throw new Error("Unsupported experiment schema version");
  const migrated = {};
  for (const key of manifestKeys) if (own(input, key)) migrated[key] = structuredClone(input[key]);
  migrated.schemaVersion = EXPERIMENT_SCHEMA_VERSION;
  migrated.educationLevel ||= input.level || "general";
  migrated.description ||= input.summary || "A guided chemistry experiment.";
  migrated.subject ||= "Chemistry";
  migrated.topic ||= "General chemistry";
  migrated.difficulty ||= "introductory";
  migrated.requiredKnowledge ||= [];
  migrated.initialChemicals ||= input.initialInventory || [];
  migrated.initialConnections ||= [];
  migrated.expectedObservations ||= [];
  migrated.measurements ||= [];
  migrated.scientificAssumptions ||= input.assumptions || [];
  migrated.safetyWarnings ||= input.safety ? [input.safety] : [];
  migrated.completionCriteria ||= ["complete-all-steps"];
  migrated.assessmentQuestions ||= [];
  migrated.estimatedDurationMinutes ||= 15;
  const oldMetadata = plainObject(input.metadata) ? input.metadata : {};
  const importedAt = "1970-01-01T00:00:00.000Z";
  migrated.metadata = {
    author: textValue(oldMetadata.author, 100) ? oldMetadata.author : "Imported",
    createdAt: textValue(oldMetadata.createdAt, 40) ? oldMetadata.createdAt : importedAt,
    updatedAt: textValue(oldMetadata.updatedAt, 40) ? oldMetadata.updatedAt : importedAt,
  };
  migrated.status ||= "draft";
  return migrated;
}

function checkKeys(value, allowed, label, errors) {
  if (!plainObject(value)) { errors.push(`${label} must be an object.`); return false; }
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${label} contains unsupported field “${key}”.`);
  return true;
}

function createInitialWorkspace(manifest, errors) {
  let workspace = { objects: {}, connections: [], events: [] };
  for (const item of (Array.isArray(manifest.apparatus) ? manifest.apparatus : [])) {
    if (!checkKeys(item, ["id", "kind", "position"], "Apparatus item", errors)) continue;
    if (!safeId(item.id)) errors.push(`Equipment ID “${String(item.id)}” is invalid.`);
    if (!own(equipment, item.kind)) errors.push(`Equipment type “${String(item.kind)}” is not in the equipment registry.`);
    if (workspace.objects[item.id]) errors.push(`Equipment ID “${item.id}” is duplicated.`);
    if (!Array.isArray(item.position) || item.position.length !== 3 || !item.position.every(Number.isFinite)) errors.push(`Position for “${item.id}” must contain three finite numbers.`);
    if (!safeId(item.id) || !own(equipment, item.kind) || workspace.objects[item.id] || !Array.isArray(item.position) || item.position.length !== 3 || !item.position.every(Number.isFinite)) continue;
    try { workspace.objects[item.id] = createObject(item.id, item.kind, item.position); }
    catch (error) { errors.push(`Cannot create “${item.id}”: ${error.message}`); }
  }
  if (Object.keys(workspace.objects).length > 12) errors.push("An experiment can use at most 12 apparatus items.");
  for (const chemical of (Array.isArray(manifest.initialChemicals) ? manifest.initialChemicals : [])) {
    if (!checkKeys(chemical, ["equipmentId", "stockId", "volumeMl", "concentrationM"], "Initial chemical", errors)) continue;
    const target = workspace.objects[chemical.equipmentId];
    if (!target) { errors.push(`Initial chemical refers to missing equipment “${String(chemical.equipmentId)}”.`); continue; }
    if (!own(stocks, chemical.stockId)) { errors.push(`Chemical stock “${String(chemical.stockId)}” is unavailable.`); continue; }
    if (!Number.isFinite(chemical.volumeMl) || chemical.volumeMl <= 0) { errors.push(`Initial quantity for “${chemical.stockId}” must be a positive finite volume in mL.`); continue; }
    try {
      workspace = executeCommand(workspace, { type: "add", id: chemical.equipmentId, stock: chemical.stockId, volumeMl: chemical.volumeMl, ...(chemical.concentrationM === undefined ? {} : { concentration: chemical.concentrationM }) });
    } catch (error) { errors.push(`Initial chemical on “${chemical.equipmentId}”: ${error.message}`); }
  }
  for (const connection of (Array.isArray(manifest.initialConnections) ? manifest.initialConnections : [])) {
    if (!checkKeys(connection, ["a", "ap", "b", "bp"], "Connection", errors)) continue;
    try { workspace = executeCommand(workspace, { type: "connect", ...connection }); }
    catch (error) { errors.push(`Invalid connection ${String(connection.a)}:${String(connection.ap)} ↔ ${String(connection.b)}:${String(connection.bp)}: ${error.message}`); }
  }
  try { validateWorkspace(workspace); }
  catch (error) { errors.push(`Initial workspace is invalid: ${error.message}`); }
  return workspace;
}

/** Strict, non-executable manifest validation. Returns publish-blocking errors separately from authoring warnings. */
export function validateExperimentManifest(input) {
  const errors = [], warnings = [];
  let manifest;
  try { manifest = migrateExperimentManifest(input); }
  catch (error) { return { valid: false, errors: [error.message], warnings: [], manifest: null }; }
  checkKeys(manifest, manifestKeys, "Manifest", errors);
  const declared = Array.isArray(manifest.supportedOperations) ? manifest.supportedOperations : [];
  const reactionList = Array.isArray(manifest.reactionIds) ? manifest.reactionIds : [];
  const measurementList = Array.isArray(manifest.measurements) ? manifest.measurements : [];
  if (manifest.schemaVersion !== EXPERIMENT_SCHEMA_VERSION) errors.push("Manifest schema version is unsupported.");
  if (!safeId(manifest.id)) errors.push("Experiment ID must be 2–64 lowercase letters, numbers, or hyphens and start with a letter.");
  if (Object.hasOwn(experimentManifests, manifest.id)) errors.push("Experiment ID is reserved by the built-in library.");
  for (const [key, max] of [["title", 120], ["description", 1600], ["subject", 80], ["topic", 120]]) if (!textValue(manifest[key], max)) errors.push(`${key} is required and must be at most ${max} characters.`);
  if (!levels.includes(manifest.educationLevel)) errors.push("Choose a supported education level.");
  if (!difficulties.includes(manifest.difficulty)) errors.push("Choose a supported difficulty.");
  if (!lines(manifest.learningObjectives, 12) || manifest.learningObjectives.length === 0) errors.push("Add at least one learning objective (maximum 12).");
  if (!lines(manifest.requiredKnowledge, 12)) errors.push("Required knowledge must be a list of at most 12 items.");
  if (!Array.isArray(manifest.apparatus) || manifest.apparatus.length === 0) errors.push("Add at least one apparatus item.");
  if (!Array.isArray(manifest.initialChemicals) || manifest.initialChemicals.length > 30) errors.push("Initial chemicals must be a list of at most 30 items.");
  if (!Array.isArray(manifest.initialConnections) || manifest.initialConnections.length > 30) errors.push("Initial connections must be a list of at most 30 items.");
  if (!Array.isArray(manifest.instructions) || manifest.instructions.length === 0 || manifest.instructions.length > 40) errors.push("Add 1–40 step instructions.");
  if (!Array.isArray(manifest.supportedOperations) || manifest.supportedOperations.some((op) => !declaredOperations.has(op)) || new Set(manifest.supportedOperations).size !== manifest.supportedOperations.length) errors.push("One or more declared equipment operations are unsupported or duplicated.");
  if (!Array.isArray(manifest.reactionIds) || manifest.reactionIds.some((id) => !["neutralization", "precipitation"].includes(id))) errors.push("Only engine-supported neutralization and precipitation reactions can be authored.");
  for (const reactionId of (Array.isArray(manifest.reactionIds) ? manifest.reactionIds : [])) {
    try { validateReaction(reactions[reactionId]); }
    catch (error) { errors.push(`Reaction “${reactionId}” is invalid: ${error.message}`); }
  }
  if (!lines(manifest.expectedObservations, 30)) errors.push("Expected observations must be a list of at most 30 items.");
  if (!Array.isArray(manifest.measurements) || manifest.measurements.some((m) => !measurements.includes(m))) errors.push("Measurements must use implemented volume, concentration, or gas-inventory models.");
  if (!lines(manifest.scientificAssumptions, 20) || manifest.scientificAssumptions.length === 0) errors.push("Document at least one scientific assumption.");
  if (!lines(manifest.safetyWarnings, 20) || manifest.safetyWarnings.length === 0) errors.push("Add a safety statement; digital-only notice is required.");
  if (!Array.isArray(manifest.completionCriteria) || manifest.completionCriteria.length === 0 || manifest.completionCriteria.some((c) => !criteria.includes(c))) errors.push("Choose achievable completion criteria from the supported set.");
  if (!Array.isArray(manifest.assessmentQuestions) || manifest.assessmentQuestions.length > 20 || manifest.assessmentQuestions.some((q) => !plainObject(q) || !textValue(q.prompt, 500) || Object.keys(q).some((key) => !["prompt", "expectedAnswer"].includes(key)) || (q.expectedAnswer !== undefined && !textValue(q.expectedAnswer, 1000)))) errors.push("Assessment questions must contain a prompt and optional plain-text expected answer.");
  if (!Number.isInteger(manifest.estimatedDurationMinutes) || manifest.estimatedDurationMinutes < 1 || manifest.estimatedDurationMinutes > 240) errors.push("Estimated duration must be 1–240 minutes.");
  if (!plainObject(manifest.metadata) || Object.keys(manifest.metadata).some((key) => !["author", "createdAt", "updatedAt"].includes(key)) || !textValue(manifest.metadata.author, 100) || !textValue(manifest.metadata.createdAt, 40) || !Number.isFinite(Date.parse(manifest.metadata.createdAt)) || !textValue(manifest.metadata.updatedAt, 40) || !Number.isFinite(Date.parse(manifest.metadata.updatedAt))) errors.push("Experiment metadata must include a plain-text author and valid created/updated timestamps.");
  if (!["draft", "published"].includes(manifest.status)) errors.push("Status must be draft or published.");

  let workspace = createInitialWorkspace(manifest, errors);
  const stepIds = new Set();
  const instructionList = Array.isArray(manifest.instructions) ? manifest.instructions : [];
  for (const [index, step] of instructionList.entries()) {
    if (!checkKeys(step, ["id", "instruction", "command"], `Instruction ${index + 1}`, errors)) continue;
    if (!safeId(step.id) || stepIds.has(step.id)) errors.push(`Instruction ${index + 1} needs a unique valid ID.`);
    stepIds.add(step.id);
    if (!textValue(step.instruction, 1000)) errors.push(`Instruction ${index + 1} needs plain-text directions.`);
    const command = step.command;
    if (!plainObject(command) || !supportedInstructionTypes.includes(command.type)) { errors.push(`Instruction ${index + 1} uses an unsupported command.`); continue; }
    const commandKeys = { add: ["type", "id", "stock", "volumeMl", "volume", "unit", "concentration"], transfer: ["type", "from", "to", "volumeMl", "volume", "unit", "via"], mix: ["type", "id"], react: ["type", "id", "reactionId"], measure: ["type", "id", "solute"], "measure-volume": ["type", "id"], "measure-gas": ["type", "id"] }[command.type];
    if (Object.keys(command).some((key) => !commandKeys.includes(key))) errors.push(`Instruction ${index + 1} contains unsupported command fields.`);
    if (!declared.includes(command.type)) errors.push(`Instruction ${index + 1} uses undeclared operation “${command.type}”.`);
    if (command.type === "react" && (!reactionList.includes(command.reactionId) || !["neutralization", "precipitation"].includes(command.reactionId))) errors.push(`Instruction ${index + 1} references an unsupported or undeclared reaction.`);
    if (command.type === "measure-volume" && !measurementList.includes("volume")) errors.push(`Instruction ${index + 1} uses undeclared volume measurement.`);
    if (command.type === "measure-gas" && !measurementList.includes("gas-inventory")) errors.push(`Instruction ${index + 1} uses undeclared gas measurement.`);
    if (command.type === "measure" && !measurementList.includes("concentration")) errors.push(`Instruction ${index + 1} uses undeclared concentration measurement.`);
    if (["measure-volume", "measure-gas"].includes(command.type)) {
      const target = workspace.objects[command.id];
      const operation = command.type === "measure-volume" ? "receive" : "measure-gas";
      if (!target || !equipment[target.kind].operations.includes(operation)) errors.push(`Instruction ${index + 1} measurement target does not support ${command.type}.`);
    } else {
      try { workspace = executeCommand(workspace, command); }
      catch (error) { errors.push(`Instruction ${index + 1} cannot execute from the declared starting inventory: ${error.message}`); }
    }
  }
  const usedReactions = instructionList.filter((s) => s?.command?.type === "react").map((s) => s.command.reactionId);
  if (usedReactions.some((id) => !reactionList.includes(id))) errors.push("Every reaction step must reference a declared validated reaction.");
  if (!(manifest.expectedObservations || []).length) warnings.push("No expected observations are provided.");
  if (!(manifest.assessmentQuestions || []).length) warnings.push("No assessment questions are provided.");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings, manifest };
}

export function createDraftManifest(at, id = `author-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`) {
  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION, id, title: "Untitled experiment", description: "Describe the learning activity.",
    subject: "Chemistry", topic: "General chemistry", educationLevel: "general", difficulty: "introductory",
    learningObjectives: ["Describe the modeled observation."], requiredKnowledge: [], apparatus: [], initialChemicals: [], initialConnections: [],
    supportedOperations: ["add"], reactionIds: [], instructions: [], expectedObservations: [], measurements: [],
    scientificAssumptions: ["Digital educational model; results follow only the documented supported operations."],
    safetyWarnings: ["Digital simulation only; not a real-world laboratory procedure."],
    completionCriteria: ["complete-all-steps"], assessmentQuestions: [], estimatedDurationMinutes: 15,
    metadata: { author: "Local author", createdAt: at, updatedAt: at }, status: "draft",
  };
}

export function duplicateExperimentManifest(manifest, at, newId) {
  const result = structuredClone(manifest);
  result.id = newId;
  result.title = `${result.title} (copy)`.slice(0, 120);
  result.status = "draft";
  result.metadata = { ...result.metadata, createdAt: at, updatedAt: at };
  return result;
}

export function exportExperimentManifest(manifest) {
  const validation = validateExperimentManifest(manifest);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return JSON.stringify({ format: EXPERIMENT_EXPORT_FORMAT, exportVersion: EXPERIMENT_EXPORT_VERSION, manifest: validation.manifest }, null, 2);
}

export function importExperimentManifest(text) {
  if (typeof text !== "string" || !text.length || new TextEncoder().encode(text).length > maxImportBytes) throw new Error("Experiment file is empty or exceeds the 1 MB limit.");
  const payload = JSON.parse(text);
  if (!plainObject(payload) || payload.format !== EXPERIMENT_EXPORT_FORMAT || payload.exportVersion !== EXPERIMENT_EXPORT_VERSION) throw new Error("Unsupported experiment export format or version.");
  const manifest = migrateExperimentManifest(payload.manifest);
  manifest.status = "draft";
  const validation = validateExperimentManifest(manifest);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return validation.manifest;
}

export function createWorkspaceFromManifest(input) {
  const validation = validateExperimentManifest(input);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return createInitialWorkspace(validation.manifest, []);
}

export function emptyExperimentStore() { return { version: 1, drafts: [], published: [] }; }

export function loadExperimentStore(storage) {
  const raw = storage.getItem(EXPERIMENT_STORE_KEY);
  if (raw === null) return emptyExperimentStore();
  if (raw.length > 5_000_000) throw new Error("Experiment library exceeds the 5 MB storage limit.");
  const parsed = JSON.parse(raw);
  if (!plainObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.drafts) || !Array.isArray(parsed.published) || parsed.drafts.length > 100 || parsed.published.length > 100) throw new Error("Experiment library storage is invalid.");
  const ids = new Set();
  const migratedStore = { ...parsed, drafts: [], published: [] };
  for (const [status, list] of [["draft", parsed.drafts], ["published", parsed.published]]) for (const rawManifest of list) {
    const m = migrateExperimentManifest(rawManifest);
    if (m.status !== status || ids.has(m.id)) throw new Error("Experiment library contains a duplicate ID or mismatched status.");
    if (Object.hasOwn(experimentManifests, m.id)) throw new Error("Experiment library ID collides with a built-in definition.");
    ids.add(m.id);
    if (status === "published" && !validateExperimentManifest(m).valid) throw new Error(`Published experiment “${m.id}” no longer validates.`);
    migratedStore[status === "draft" ? "drafts" : "published"].push(m);
  }
  return migratedStore;
}

export function saveExperimentStore(storage, store) {
  if (!plainObject(store) || store.version !== 1 || !Array.isArray(store.drafts) || !Array.isArray(store.published) || store.drafts.length > 100 || store.published.length > 100) throw new Error("Experiment library must contain at most 100 drafts and 100 publications.");
  const ids = new Set();
  for (const [status, list] of [["draft", store.drafts], ["published", store.published]]) for (const m of list) {
    if (ids.has(m.id) || m.status !== status) throw new Error("Experiment ID is duplicated or has an invalid publication state.");
    if (Object.hasOwn(experimentManifests, m.id)) throw new Error("Experiment ID is reserved by the built-in library.");
    ids.add(m.id);
    if (status === "published" && !validateExperimentManifest(m).valid) throw new Error("Publishing requires a valid experiment manifest.");
  }
  const serialized = JSON.stringify(store);
  if (serialized.length > 5_000_000) throw new Error("Experiment library exceeds the 5 MB storage limit.");
  storage.setItem(EXPERIMENT_STORE_KEY, serialized);
}

/** Existing published experiments adapt the trusted canonical manifests; no second registry is maintained. */
export function builtInExperimentLibrary() {
  return Object.values(experimentManifests).map((source) => {
    const guided = guidedManifests[source.id];
    return {
      schemaVersion: EXPERIMENT_SCHEMA_VERSION, id: source.id, title: source.title,
      description: source.description || guided?.model || "Explore a deterministic chemistry model in the shared 3D workbench.",
      subject: source.subject || "Chemistry", topic: source.topic || source.title,
      educationLevel: "general", difficulty: "introductory",
      learningObjectives: [`Explore ${source.title.toLowerCase()} using the supported model.`], requiredKnowledge: [],
      apparatus: source.apparatus, initialChemicals: [], initialConnections: source.initialConnections || [],
      supportedOperations: source.supportedOperations, reactionIds: source.reactionReferences.filter((id) => ["neutralization", "precipitation"].includes(id)),
      instructions: guided?.steps || [], expectedObservations: source.expectedObservations,
      measurements: source.id === "oxygen" ? ["gas-inventory"] : ["volume", "concentration"],
      scientificAssumptions: source.assumptions, safetyWarnings: [source.safety],
      completionCriteria: ["complete-all-steps"], assessmentQuestions: [], estimatedDurationMinutes: 15,
      metadata: { author: "Materia library", createdAt: "2026-11-15", updatedAt: "2026-11-15" }, status: "published",
      builtIn: true,
    };
  });
}

export function searchExperimentLibrary(items, { query = "", educationLevel = "all", difficulty = "all", subject = "all" } = {}) {
  const q = query.trim().toLocaleLowerCase();
  return items.filter((item) => (!q || [item.title, item.description, item.subject, item.topic, ...item.learningObjectives].join(" ").toLocaleLowerCase().includes(q)) &&
    (educationLevel === "all" || item.educationLevel === educationLevel) &&
    (difficulty === "all" || item.difficulty === difficulty) &&
    (subject === "all" || item.subject === subject));
}

export function getPublishedExperiment(storage, id) {
  const builtin = builtInExperimentLibrary().find((item) => item.id === id);
  if (builtin) return builtin;
  return loadExperimentStore(storage).published.find((item) => item.id === id) || null;
}
