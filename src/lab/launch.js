import { guidedManifests, validateGuidedManifest } from "./guided.js";
import { newLabSession, dispatchLab } from "./session.js";
import { loadStore, saveStore } from "./session-store.js";
export const EXPERIMENTS = Object.freeze({
  neutralization: {
    id: "neutralization",
    title: "Acid-base neutralization",
    kind: "guided",
  },
  oxygen: { id: "oxygen", title: "Oxygen from decomposition", kind: "oxygen" },
});
/** @param {string} hash */
export function parseExperimentRoute(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#/experiments/"))
    return null;
  const id = hash.slice("#/experiments/".length);
  return {
    id,
    experiment: Object.hasOwn(EXPERIMENTS, id)
      ? EXPERIMENTS[/** @type {'neutralization'|'oxygen'} */ (id)]
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
    EXPERIMENTS[/** @type {'neutralization'|'oxygen'} */ (experimentId)]
      .kind !== "guided" ||
    !Object.hasOwn(guidedManifests, experimentId)
  )
    throw new Error("Unknown guided experiment");
  validateGuidedManifest(guidedManifests[experimentId]);
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
      guidedManifests[experimentId].title,
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
