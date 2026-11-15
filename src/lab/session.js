import {
  createWorkspace,
  executeCommand,
  validateWorkspace,
} from "./engine.js";
import { guidedManifests } from "./guided.js";
import { equipment } from "./registry.js";
import {
  emptyNotebook,
  validateNotebook,
  addEntry,
  editObservation,
  removeObservation,
} from "./notebook.js";
/** @param {string} id @param {string} mode @param {string|null} experimentId @param {string} at @param {string} [name] */
export function newLabSession(
  id,
  mode,
  experimentId,
  at,
  name = "Laboratory session",
) {
  if (
    typeof id !== "string" ||
    !id ||
    !["guided", "free"].includes(mode) ||
    typeof at !== "string" ||
    !Number.isFinite(Date.parse(at))
  )
    throw new Error("Invalid session metadata");
  if (
    mode === "guided" &&
    (!experimentId || !Object.hasOwn(guidedManifests, experimentId))
  )
    throw new Error("Guided experiment required");
  if (experimentId && !Object.hasOwn(guidedManifests, experimentId))
    throw new Error("Unknown experiment");
  const workspace = experimentId
    ? createWorkspace()
    : { objects: {}, connections: [], events: [] };
  if (experimentId)
    workspace.objects.b.kind = guidedManifests[experimentId].vesselKind;
  const session = {
    version: 2,
    id,
    name,
    mode,
    createdAt: at,
    updatedAt: at,
    core: {
      workspace,
      experiment: experimentId ? { id: experimentId, step: 0 } : null,
    },
    past: /** @type {any[]} */ ([]),
    future: /** @type {any[]} */ ([]),
    notebook: emptyNotebook(),
  };
  validateLabSession(session);
  return session;
}
/** @param {any} core */
function validateCore(core) {
  if (!core || typeof core !== "object")
    throw new Error("Invalid session core");
  validateWorkspace(core.workspace);
  if (
    Object.keys(core.workspace.objects).length > 12 ||
    Object.keys(core.workspace.objects).some(
      (id) => !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id),
    )
  )
    throw new Error("Invalid equipment ID");
  if (core.experiment !== null) {
    const e = core.experiment;
    if (
      !e ||
      !Object.hasOwn(guidedManifests, e.id) ||
      !Number.isInteger(e.step) ||
      e.step < 0 ||
      e.step > guidedManifests[e.id].steps.length
    )
      throw new Error("Invalid experiment progress");
  }
}
/** @param {any} s */
export function validateLabSession(s) {
  if (
    !s ||
    s.version !== 2 ||
    typeof s.id !== "string" ||
    !s.id ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 200 ||
    !["guided", "free"].includes(s.mode) ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    !Number.isFinite(Date.parse(s.updatedAt)) ||
    !Array.isArray(s.past) ||
    !Array.isArray(s.future) ||
    s.past.length > 50 ||
    s.future.length > 50
  )
    throw new Error("Invalid session");
  validateCore(s.core);
  if (s.mode === "guided" && !s.core.experiment)
    throw new Error("Guided mode requires experiment");
  for (const core of [...s.past, ...s.future]) validateCore(core);
  validateNotebook(s.notebook);
  if (s.notebook.entries.some((/** @type {any} */ e) => e.sessionId !== s.id))
    throw new Error("Notebook session mismatch");
  return true;
}
/** @param {any} s @param {any} action @param {string} at @param {string} entryId */
export function dispatchLab(s, action, at, entryId) {
  try {
    validateLabSession(s);
    if (
      !action ||
      typeof action.type !== "string" ||
      typeof at !== "string" ||
      !Number.isFinite(Date.parse(at)) ||
      typeof entryId !== "string" ||
      !entryId
    )
      throw new Error("Invalid command metadata");
    const next = structuredClone(s);
    let text = "",
      kind = "event";
    const before = structuredClone(next.core);
    if (action.type === "policy") {
      if (
        !["guided", "free"].includes(action.mode) ||
        (action.mode === "guided" && !next.core.experiment)
      )
        throw new Error("Guided mode requires an experiment");
      next.mode = action.mode;
      text = `Changed policy to ${action.mode}.`;
    } else if (action.type === "undo") {
      if (!next.past.length) throw new Error("Nothing to undo");
      next.future.push(next.core);
      next.core = next.past.pop();
      text = "Simulation undo.";
    } else if (action.type === "redo") {
      if (!next.future.length) throw new Error("Nothing to redo");
      next.past.push(next.core);
      next.core = next.future.pop();
      text = "Simulation redo.";
    } else if (action.type === "note" || action.type === "observe") {
      const note = action.text ?? action.note;
      if (typeof note !== "string" || !note.trim() || note.length > 2000)
        throw new Error("Observation must be 1–2000 characters");
      text = note.trim();
      kind = "observation";
    } else if (action.type === "edit-note") {
      next.notebook = editObservation(next.notebook, action.id, action.text);
      text = "";
    } else if (action.type === "remove-note") {
      next.notebook = removeObservation(next.notebook, action.id);
      text = "";
    } else {
      if (action.type === "reset") {
        if (next.mode === "guided" && next.core.experiment) {
          const fresh = newLabSession(
            next.id,
            "guided",
            next.core.experiment.id,
            at,
            next.name,
          );
          next.core = fresh.core;
        } else
          next.core = {
            workspace: { objects: {}, connections: [], events: [] },
            experiment: next.core.experiment
              ? { id: next.core.experiment.id, step: 0 }
              : null,
          };
        text = "Reset workspace.";
      } else if (action.type === "perform" || action.type === "next") {
        if (next.mode !== "guided" || !next.core.experiment)
          throw new Error("Guided policy required");
        const e = next.core.experiment,
          step = guidedManifests[e.id].steps[e.step];
        if (!step || step.id !== action.stepId)
          throw new Error("Unexpected or completed step");
        let command = step.command;
        if (action.type === "perform") {
          const student = action.command;
          const keyMap = /** @type {Record<string,string[]>} */ ({
            add: ["id", "stock"],
            transfer: ["from", "to"],
            mix: ["id"],
            react: ["id", "reactionId"],
            measure: ["id", "solute"],
          });
          const keys = keyMap[step.command.type];
          if (
            !student ||
            student.type !== step.command.type ||
            !keys ||
            keys.some((k) => student[k] !== step.command[k])
          )
            throw new Error("Operation does not match current procedure");
          command = student;
        }
        next.core.workspace = executeCommand(next.core.workspace, command);
        e.step++;
        text = next.core.workspace.events.at(-1);
      } else {
        if (
          next.mode === "guided" &&
          !["move", "connect", "disconnect"].includes(action.type)
        )
          throw new Error("Operation is not allowed by guided policy");
        if (
          ![
            "place",
            "remove",
            "move",
            "add",
            "transfer",
            "mix",
            "measure",
            "measure-volume",
            "react",
            "connect",
            "disconnect",
          ].includes(action.type)
        )
          throw new Error("Unsupported operation");
        if (action.type === "measure-volume") {
          const v = next.core.workspace.objects[action.id];
          if (!v || !equipment[v.kind].operations.includes("receive"))
            throw new Error("A vessel is required");
          text = `Measured volume: ${v.volumeMl} mL in ${v.id}.`;
          next.core.workspace.events.push(text);
        } else {
          next.core.workspace = executeCommand(next.core.workspace, action);
          text = next.core.workspace.events.at(-1);
        }
      }
      next.past.push(before);
      if (next.past.length > 50) next.past.shift();
      next.future = [];
    }
    if (text)
      next.notebook = addEntry(next.notebook, {
        id: entryId,
        sessionId: next.id,
        experiment: next.core.experiment
          ? guidedManifests[next.core.experiment.id].title
          : "Free exploration",
        at,
        kind,
        text,
      });
    next.updatedAt = at;
    validateLabSession(next);
    return { ok: true, state: next, error: "" };
  } catch (e) {
    return {
      ok: false,
      state: s,
      error: e instanceof Error ? e.message : "Invalid command",
    };
  }
}
