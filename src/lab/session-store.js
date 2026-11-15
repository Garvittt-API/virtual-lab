import { newLabSession, validateLabSession } from "./session.js";
import {
  validateSession as validateGuided,
  guidedManifests,
} from "./guided.js";
import { validateFreeSession } from "./free.js";
import { addEntry } from "./notebook.js";
export const SESSION_STORE_KEY = "materia-lab-sessions-v2";
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
      !["materia-guided-v1", "materia-free-v1"].includes(key) ||
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
/** @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage @param {string} at */
export function loadStore(storage, at) {
  const raw = storage.getItem(SESSION_STORE_KEY);
  let store =
    raw === null
      ? { version: 1, activeId: "", sessions: [], imported: {} }
      : JSON.parse(raw);
  validateStore(store);
  let changed = false;
  for (const [key, mode] of /** @type {Array<[string,'guided'|'free']>} */ ([
    ["materia-guided-v1", "guided"],
    ["materia-free-v1", "free"],
  ])) {
    if (Object.hasOwn(store.imported, key)) continue;
    const source = storage.getItem(key);
    if (source === null) continue;
    const id = mode === "guided" ? "legacy-guided-v1" : "legacy-free-v1";
    if (store.sessions.some((/** @type {any} */ s) => s.id === id))
      throw new Error("Migration ID already in use");
    let migrated;
    try {
      migrated = migrateSession(JSON.parse(source), mode, id, at);
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
