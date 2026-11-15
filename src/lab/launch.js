import { guidedManifests, experimentManifests, validateGuidedManifest } from "./guided.js";
import { newLabSession, newAuthoredExperimentSession, dispatchLab } from "./session.js";
import { loadStore, saveStore } from "./session-store.js";
import { validateExperimentManifest, getPublishedExperiment } from "./experiment-authoring.js";
export const EXPERIMENTS = Object.freeze(Object.fromEntries(Object.values(experimentManifests).map((item) => [item.id, { id: item.id, title: item.title, kind: "guided" }])));
/** @param {string} hash */
export function parseExperimentRoute(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#/experiments/"))
    return null;
  const id = hash.slice("#/experiments/".length);
  return {
    id,
    experiment: Object.hasOwn(EXPERIMENTS, id)
      ? { ...EXPERIMENTS[id], builtIn: true }
      : null,
  };
}
/** @param {string} experimentId */
export function experimentHash(experimentId) {
  if (!Object.hasOwn(EXPERIMENTS, experimentId))
    throw new Error("Unknown experiment");
  return `#/experiments/${experimentId}`;
}
/** @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage @param {string} experimentId @param {string} at @param {() => string} makeId */
export function initializeGuidedExperiment(storage, experimentId, at, makeId) {
  if (
    !Object.hasOwn(EXPERIMENTS, experimentId) ||
    EXPERIMENTS[experimentId]
      .kind !== "guided" ||
    (experimentId !== "oxygen" && !Object.hasOwn(guidedManifests, experimentId))
  )
    throw new Error("Unknown guided experiment");
  if (experimentId !== "oxygen") validateGuidedManifest(guidedManifests[experimentId]);
  let store = loadStore(storage, at);
  let session =
    store.sessions.find(
      (/** @type {any} */ s) =>
        s.id === store.activeId && s.core.experiment?.id === experimentId,
    ) ||
    store.sessions.find(
      (/** @type {any} */ s) => s.core.experiment?.id === experimentId,
    );
  if (!session) {
    session = newLabSession(
      makeId(),
      "guided",
      experimentId,
      at,
      experimentId === "oxygen"
        ? EXPERIMENTS.oxygen.title
        : guidedManifests[experimentId].title,
    );
    store = {
      ...store,
      activeId: session.id,
      sessions: [...store.sessions, session],
    };
  } else {
    if (session.mode !== "guided") {
      const result = dispatchLab(
        session,
        { type: "policy", mode: "guided" },
        at,
        makeId(),
      );
      if (!result.ok) throw new Error(result.error);
      session = result.state;
    }
    store = {
      ...store,
      activeId: session.id,
      sessions: store.sessions.map((/** @type {any} */ s) =>
        s.id === session.id ? session : s,
      ),
    };
  }
  saveStore(storage, store);
  return store;
}

/** Launch an imported or authored manifest through the same persisted scientific session. @param {Storage|any} storage @param {any} manifest @param {string} at @param {()=>string} makeId */
export function initializeAuthoredExperiment(storage, manifest, at, makeId) {
  const validation = validateExperimentManifest(manifest);
  if (!validation.valid || manifest.status !== "published") throw new Error("Only valid published experiments can be launched from the library.");
  let store = loadStore(storage, at);
  const session = newAuthoredExperimentSession(makeId(), manifest, at);
  store = { ...store, activeId: session.id, sessions: [...store.sessions, session] };
  saveStore(storage, store);
  return store;
}

/** Resolve a direct custom experiment URL only when its publication record is available locally. @param {Storage|any} storage @param {string} id */
export function resolvePublishedExperiment(storage, id) {
  return getPublishedExperiment(storage, id);
}
