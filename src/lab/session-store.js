import { newLabSession, validateLabSession, hydrateOxygenCore } from "./session.js";
import {
  validateSession as validateGuided,
  guidedManifests,
} from "./guided.js";
import { validateFreeSession } from "./free.js";
import { addEntry } from "./notebook.js";
import { createWorkspace, executeCommand, validateWorkspace } from "./engine.js";
import { oxygenLedger, validateLegacyOxygen } from "../oxygen.js";
import { neutralization } from "../chemistry.js";
export const SESSION_STORE_KEY = "materia-lab-sessions-v2";
const LEGACY_SESSION_KEYS = [
  "materia-guided-v1",
  "materia-free-v1",
  "materia-oxygen",
  "materia-session",
  "materia-liquid",
];
export const SESSION_EXPORT_FORMAT = "materia-lab-session";
export const SESSION_EXPORT_VERSION = 1;

/** Export only the selected session, with a versioned envelope. @param {any} session */
export function exportSession(session) {
  validateLabSession(session);
  return JSON.stringify(
    { format: SESSION_EXPORT_FORMAT, version: SESSION_EXPORT_VERSION, session },
    null,
    2,
  );
}

/** Validate an imported file completely before adding it to the store. @param {string} text @param {string} id @param {string} at */
export function importSession(text, id, at) {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw new Error("Session file is empty or exceeds the 2 MB limit");
  const data = JSON.parse(text);
  if (
    !data ||
    data.format !== SESSION_EXPORT_FORMAT ||
    data.version !== SESSION_EXPORT_VERSION
  )
    throw new Error("Unsupported session export format or version");
  validateLabSession(data.session);
  if (typeof id !== "string" || !id || !Number.isFinite(Date.parse(at)))
    throw new Error("Invalid import metadata");
  const session = structuredClone(data.session);
  if (session.core.experiment?.id === "oxygen") {
    session.core = hydrateOxygenCore(session.core);
    session.past = session.past.map((/** @type {any} */ core) => hydrateOxygenCore(core));
    session.future = session.future.map((/** @type {any} */ core) => hydrateOxygenCore(core));
  }
  session.id = id;
  session.name = `${session.name} (imported)`.slice(0, 200);
  session.createdAt = at;
  session.updatedAt = at;
  session.notebook.entries = session.notebook.entries.map(
    /** @param {any} entry @param {number} index */ (entry, index) => ({
      ...entry,
      id: `${id}-entry-${index}`,
      sessionId: id,
    }),
  );
  validateLabSession(session);
  return session;
}

/** Make an independent copy while retaining the full workspace and undo history. @param {any} source @param {string} id @param {string} at */
export function duplicateSession(source, id, at) {
  validateLabSession(source);
  const copy = structuredClone(source);
  if (typeof id !== "string" || !id || !Number.isFinite(Date.parse(at)))
    throw new Error("Invalid duplicate metadata");
  copy.id = id;
  copy.name = `${source.name} (copy)`.slice(0, 200);
  copy.createdAt = at;
  copy.updatedAt = at;
  copy.notebook.entries = copy.notebook.entries.map(
    /** @param {any} entry @param {number} index */ (entry, index) => ({
      ...entry,
      id: `${id}-entry-${index}`,
      sessionId: id,
    }),
  );
  validateLabSession(copy);
  return copy;
}
/** @param {any} store */
export function validateStore(store) {
  if (
    !store ||
    store.version !== 1 ||
    !Array.isArray(store.sessions) ||
    !store.imported ||
    typeof store.imported !== "object" ||
    Array.isArray(store.imported) ||
    typeof store.activeId !== "string"
  )
    throw new Error("Invalid session store");
  const ids = new Set();
  for (const s of store.sessions) {
    validateLabSession(s);
    if (ids.has(s.id)) throw new Error("Duplicate session ID");
    ids.add(s.id);
  }
  if (store.activeId && !ids.has(store.activeId))
    throw new Error("Invalid active session");
  for (const [key, id] of Object.entries(store.imported))
    if (
      !LEGACY_SESSION_KEYS.includes(key) ||
      typeof id !== "string" ||
      !ids.has(id)
    )
      throw new Error("Invalid migration marker");
  return true;
}
/** Reject unknown legacy fields rather than silently dropping them. @param {any} value @param {string[]} keys */
function knownFields(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Unsupported legacy fields; original retained");
}
/** @param {any} workspace */
function validateLegacyWorkspaceFields(workspace) {
  knownFields(workspace, ["objects", "connections", "events"]);
  knownFields(workspace.objects, Object.keys(workspace.objects));
  for (const object of Object.values(workspace.objects))
    knownFields(object, [
      "id",
      "kind",
      "position",
      "volumeMl",
      "solutes",
      "solids",
      "gases",
      "heated",
      "mixed",
    ]);
  for (const connection of workspace.connections)
    knownFields(connection, ["a", "ap", "b", "bp"]);
}
/** @param {any} old @param {'guided'|'free'} mode @param {string} id @param {string} at */
export function migrateSession(old, mode, id, at) {
  if (mode === "guided") validateGuided(old);
  else if (mode === "free") validateFreeSession(old);
  else throw new Error("Unknown legacy format");
  knownFields(
    old,
    mode === "guided"
      ? ["version", "core", "past", "future"]
      : ["version", "createdAt", "workspace", "past", "future", "notes"],
  );
  const legacyCores =
    mode === "guided"
      ? [old.core, ...old.past, ...old.future]
      : [old.workspace, ...old.past, ...old.future];
  for (const core of legacyCores) {
    if (mode === "guided") {
      knownFields(core, ["workspace", "experiment"]);
      knownFields(core.experiment, ["id", "step", "notes"]);
    }
    validateLegacyWorkspaceFields(mode === "guided" ? core.workspace : core);
  }
  const exp = mode === "guided" ? old.core.experiment.id : null;
  const next = newLabSession(
    id,
    mode,
    exp,
    mode === "free" ? old.createdAt : at,
    mode === "guided"
      ? guidedManifests[exp].title
      : "Imported free exploration",
  );
  /** @param {any} core */
  const mapCore = (core) =>
    mode === "guided"
      ? {
          workspace: structuredClone(core.workspace),
          experiment: { id: core.experiment.id, step: core.experiment.step },
        }
      : { workspace: structuredClone(core), experiment: null };
  next.core = mapCore(mode === "guided" ? old.core : old.workspace);
  next.past = old.past.map(mapCore);
  next.future = old.future.map(mapCore);
  next.migration = {
    version: 1,
    sourceKey: mode === "guided" ? "materia-guided-v1" : "materia-free-v1",
    sourceVersion: 1,
    importedAt: at,
  };
  const notes =
    mode === "guided" ? [...old.core.experiment.notes] : [...old.notes];
  if (mode === "guided")
    for (const core of legacyCores)
      for (const note of core.experiment.notes)
        if (!notes.includes(note)) notes.push(note);
  const events = next.core.workspace.events;
  for (const [kind, values] of /** @type {Array<[string,string[]]>} */ ([
    ["event", events],
    ["observation", notes],
  ]))
    for (const [i, text] of values.entries()) {
      if (!text.trim()) continue;
      next.notebook = addEntry(next.notebook, {
        id: `legacy-${kind}-${i}`,
        sessionId: id,
        experiment: exp ? guidedManifests[exp].title : "Free exploration",
        at,
        kind,
        text,
      });
    }
  validateLabSession(next);
  return next;
}

/** Convert the legacy oxygen activity into a canonical session without writing to its original key. @param {any} old @param {string} id @param {string} at @returns {any} */
export function migrateOxygenSession(old, id, at) {
  validateLegacyOxygen(old);
  const next = newLabSession(id, "guided", "oxygen", at, "Oxygen from decomposition");
  next.core.experiment.step = old.steps;
  next.core.experiment.protocol = {
    connected: old.connected,
    loaded: old.loaded,
    steps: old.steps,
    positions: structuredClone(old.positions),
  };
  next.core.experiment.inventory = oxygenLedger(old.loaded, old.steps);
  next.core = hydrateOxygenCore(next.core, true);
  next.core.workspace.events = [...old.events];
  next.migration = { version: 1, sourceKey: "materia-oxygen", sourceVersion: 1, importedAt: at };
  appendImportedNotebook(next, old.events, old.notes ? [old.notes] : [], at);
  validateLabSession(next);
  return next;
}

/** Convert the legacy pH screen as one already-completed canonical neutralization. The reaction is executed once from the original volumes. @param {any} old @param {string} id @param {string} at @returns {any} */
export function migrateNeutralizationSession(old, id, at) {
  knownFields(old, ["baseMl", "positions", "notes", "events"]);
  if (!Number.isFinite(old.baseMl) || old.baseMl < 0 || old.baseMl > 50 ||
    typeof old.notes !== "string" || !Array.isArray(old.events) || !old.events.every(/** @param {unknown} event */ (event) => typeof event === "string"))
    throw new Error("Invalid legacy neutralization record");
  knownFields(old.positions, ["flask", "stand", "beaker"]);
  for (const id of ["flask", "stand", "beaker"]) {
    const p = old.positions[id];
    if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every(Number.isFinite) || Math.abs(p[0]) > 4 || Math.abs(p[1]) > 2.5)
      throw new Error("Invalid legacy neutralization apparatus position");
  }
  const next = newLabSession(id, "guided", "neutralization", at, "Acid-base neutralization");
  let workspace = createWorkspace();
  workspace.objects.a.position = [old.positions.beaker[0], old.positions.beaker[1], old.positions.beaker[2] || 0];
  workspace.objects.b.position = [old.positions.flask[0], old.positions.flask[1], old.positions.flask[2] || 0];
  workspace = executeCommand(workspace, { type: "add", id: "a", stock: "acid", volume: 25, unit: "mL" });
  if (old.baseMl > 0) {
    workspace = executeCommand(workspace, { type: "add", id: "b", stock: "base", volume: old.baseMl, unit: "mL" });
    workspace = executeCommand(workspace, { type: "transfer", from: "b", to: "a", volume: old.baseMl, unit: "mL" });
    workspace = executeCommand(workspace, { type: "mix", id: "a" });
    workspace = executeCommand(workspace, { type: "react", id: "a", reactionId: "neutralization" });
  }
  workspace.events = [...old.events, ...workspace.events];
  next.core.workspace = workspace;
  next.core.experiment.step = guidedManifests.neutralization.steps.length;
  next.core.experiment.result = neutralization(25, old.baseMl);
  workspace.events.push(
    `Calculated pH ${next.core.experiment.result.pH.toFixed(2)} at 25 °C; excess ${next.core.experiment.result.excess}.`,
  );
  next.core.experiment.compatibility = {
    source: "materia-session v1",
    legacyPositions: structuredClone(old.positions),
    legacyBaseMl: old.baseMl,
  };
  next.migration = { version: 1, sourceKey: "materia-session", sourceVersion: 1, importedAt: at };
  appendImportedNotebook(next, workspace.events, old.notes ? [old.notes] : [], at);
  validateLabSession(next);
  return next;
}

/** Convert the separate liquid workspace to a free canonical session. @param {any} old @param {string} id @param {string} at @returns {any} */
export function migrateLiquidSession(old, id, at) {
  validateWorkspace(old);
  const next = newLabSession(id, "free", null, at, "Imported liquid workspace");
  next.core.workspace = structuredClone(old);
  next.migration = { version: 1, sourceKey: "materia-liquid", sourceVersion: 1, importedAt: at };
  appendImportedNotebook(next, old.events, [], at);
  validateLabSession(next);
  return next;
}

/** @param {any} session @param {string[]} events @param {string[]} observations @param {string} at */
function appendImportedNotebook(session, events, observations, at) {
  const title = session.core.experiment?.id === "oxygen" ? "Oxygen from decomposition" :
    session.core.experiment?.id === "neutralization" ? guidedManifests.neutralization.title : "Liquid workspace";
  const records = /** @type {Array<{kind:string, values:string[]}>} */ ([
    { kind: "event", values: events },
    { kind: "observation", values: observations },
  ]);
  for (const { kind, values } of records)
    for (const [index, text] of values.entries()) {
      if (!text.trim()) continue;
      session.notebook = addEntry(session.notebook, {
        id: `${session.id}-legacy-${kind}-${index}`,
        sessionId: session.id,
        experiment: title,
        at,
        kind,
        text: text.trim(),
      });
    }
}
/** @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage @param {string} at */
export function loadStore(storage, at) {
  const raw = storage.getItem(SESSION_STORE_KEY);
  let store =
    raw === null
      ? { version: 1, activeId: "", sessions: [], imported: {} }
      : JSON.parse(raw);
  validateStore(store);
  let changed = false;
  for (const session of store.sessions) {
    if (session.core.experiment?.id !== "oxygen") continue;
    if ([session.core, ...session.past, ...session.future].some((core) => core.experiment?.id === "oxygen" && !Object.keys(core.workspace.objects).length)) changed = true;
    session.core = hydrateOxygenCore(session.core);
    session.past = session.past.map((/** @type {any} */ core) => hydrateOxygenCore(core));
    session.future = session.future.map((/** @type {any} */ core) => hydrateOxygenCore(core));
  }
  for (const [key, mode] of /** @type {Array<[string,'guided'|'free'|'oxygen'|'neutralization'|'liquid']>} */ ([
    ["materia-guided-v1", "guided"],
    ["materia-free-v1", "free"],
    ["materia-oxygen", "oxygen"],
    ["materia-session", "neutralization"],
    ["materia-liquid", "liquid"],
  ])) {
    if (Object.hasOwn(store.imported, key)) continue;
    const source = storage.getItem(key);
    if (source === null) continue;
    const id = `legacy-${mode}-v1`;
    if (store.sessions.some((/** @type {any} */ s) => s.id === id))
      throw new Error("Migration ID already in use");
    let migrated;
    try {
      const old = JSON.parse(source);
      migrated = mode === "guided" || mode === "free"
        ? migrateSession(old, mode, id, at)
        : mode === "oxygen"
          ? migrateOxygenSession(old, id, at)
          : mode === "neutralization"
            ? migrateNeutralizationSession(old, id, at)
            : migrateLiquidSession(old, id, at);
    } catch (e) {
      throw new Error(
        `Cannot migrate ${key}: ${e instanceof Error ? e.message : "invalid data"}. Original data is unchanged.`,
        { cause: e },
      );
    }
    store.sessions.push(migrated);
    store.imported[key] = id;
    if (!store.activeId) store.activeId = id;
    changed = true;
  }
  validateStore(store);
  if (changed) storage.setItem(SESSION_STORE_KEY, JSON.stringify(store));
  return store;
}
/** @param {{setItem:(key:string,value:string)=>void}} storage @param {any} store */
export function saveStore(storage, store) {
  validateStore(store);
  storage.setItem(SESSION_STORE_KEY, JSON.stringify(store));
}
