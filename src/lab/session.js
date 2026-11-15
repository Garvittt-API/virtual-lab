import {
  executeCommand,
  validateWorkspace,
  gasReceiver,
} from "./engine.js";
import { guidedManifests, experimentManifests, loadExperimentWorkspace } from "./guided.js";
import { createWorkspaceFromManifest, validateExperimentManifest } from "./experiment-authoring.js";
import { equipment } from "./registry.js";
import {
  emptyNotebook,
  validateNotebook,
  addEntry,
  editObservation,
  removeObservation,
} from "./notebook.js";
import { initialOxygen, oxygenLedger, oxygenReaction } from "../oxygen.js";
import { neutralizationMoles } from "../chemistry.js";
const oxygenInitial = () => ({
  connected: initialOxygen.connected,
  loaded: initialOxygen.loaded,
  steps: initialOxygen.steps,
  positions: structuredClone(initialOxygen.positions),
});
/** Shared-scene apparatus layout for the oxygen manifest. @returns {any} */
function createOxygenWorkspace(positions = initialOxygen.positions) {
  return loadExperimentWorkspace("oxygen", positions);
}
/** Keep compatibility fields derived from the universal apparatus and material inventory. @param {any} core */
function syncOxygenMetadata(core) {
  if (core.experiment?.id !== "oxygen" || !core.workspace.objects.tube) return;
  const p = core.experiment.protocol;
  p.connected = Boolean(gasReceiver(core.workspace, "tube"));
  p.loaded = Boolean(core.workspace.objects.tube.solids.KClO3 || core.workspace.objects.tube.solids.KCl ||
    core.workspace.objects.tube.gases.O2 || core.workspace.objects.jar.gases.O2);
  p.positions = Object.fromEntries(["tube", "burner", "jar"].map((id) => [id, [...core.workspace.objects[id].position]]));
  core.experiment.inventory = oxygenLedger(p.loaded, p.steps, core.workspace.objects.jar.gases.O2 || 0);
  core.experiment.step = p.steps;
}
/** Upgrade a pre-universal v2 oxygen core while retaining its reaction ledger. @param {any} core @param {boolean} [force] */
export function hydrateOxygenCore(core, force = false) {
  if (core?.experiment?.id !== "oxygen" || (!force && Object.keys(core.workspace?.objects || {}).length)) return core;
  const next = structuredClone(core), p = next.experiment.protocol, oldInventory = next.experiment.inventory;
  let workspace = createOxygenWorkspace(p.positions);
  workspace.objects.tube.solids.KClO3 = oldInventory.remainingKClO3Mol;
  workspace.objects.tube.solids.KCl = oldInventory.KClMol;
  workspace.objects.jar.gases.O2 = oldInventory.collectedO2Mol;
  if (p.connected) {
    workspace = executeCommand(workspace, { type: "connect", a: "tube", ap: "gasOutlet", b: "delivery", bp: "inlet" });
    workspace = executeCommand(workspace, { type: "connect", a: "delivery", ap: "outlet", b: "jar", bp: "gasInlet" });
  }
  workspace.events = [...(core.workspace.events || [])];
  next.workspace = workspace;
  next.experiment.inventory = oxygenLedger(p.loaded, p.steps, oldInventory.collectedO2Mol);
  return next;
}
/** @param {string} id */
/** @param {string} id @param {any} [definition] */
const experimentName = (id, definition = null) =>
  definition?.title || (id === "oxygen" ? "Oxygen from decomposition" : guidedManifests[id]?.title || "Free exploration");
/** @param {string} id @param {string} mode @param {string|null} experimentId @param {string} at @param {string} [name] @returns {any} */
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
  if (mode === "guided" && (!experimentId ||
    !Object.hasOwn(experimentManifests, experimentId)))
    throw new Error("Guided experiment required");
  if (experimentId && !Object.hasOwn(experimentManifests, experimentId))
    throw new Error("Unknown experiment");
  const workspace =
    experimentId === "oxygen"
      ? createOxygenWorkspace()
      : experimentId
        ? loadExperimentWorkspace(experimentId)
        : { objects: {}, connections: [], events: [] };
  const session = {
    version: 2,
    id,
    name,
    mode,
    createdAt: at,
    updatedAt: at,
    core: {
      workspace,
      experiment: experimentId
        ? experimentId === "oxygen"
          ? { id: experimentId, step: 0, protocol: oxygenInitial(), inventory: oxygenLedger(false, 0) }
          : { id: experimentId, step: 0, result: null }
        : null,
    },
    past: /** @type {any[]} */ ([]),
    future: /** @type {any[]} */ ([]),
    notebook: emptyNotebook(),
  };
  validateLabSession(session);
  return session;
}
/** @param {string} id @param {any} manifest @param {string} at @param {string} [name] */
export function newAuthoredExperimentSession(id, manifest, at, name = manifest?.title || "Authored experiment") {
  const validation = validateExperimentManifest(manifest);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  if (Object.hasOwn(experimentManifests, manifest.id)) throw new Error("Authored experiment ID collides with the built-in library.");
  if (!id || !Number.isFinite(Date.parse(at))) throw new Error("Invalid session metadata");
  const session = {
    version: 2, id, name, mode: "guided", createdAt: at, updatedAt: at,
    core: { workspace: createWorkspaceFromManifest(manifest), experiment: { id: manifest.id, step: 0, definition: structuredClone(manifest), result: null } },
    past: [], future: [], notebook: emptyNotebook(),
  };
  validateLabSession(session);
  return session;
}
/** @param {any} experiment @returns {any} */
function guidedDefinition(experiment) {
  return experiment.definition || guidedManifests[experiment.id] || null;
}
/** @param {any} experiment @returns {any} */
function stepList(experiment) {
  const definition = guidedDefinition(experiment);
  return experiment.definition ? definition?.instructions : definition?.steps;
}
/** @param {any} workspace @param {any} command @returns {{workspace:any,text:string}} */
function runManifestCommand(workspace, command) {
  if (command.type === "measure-volume") {
    const target = workspace.objects[command.id];
    if (!target || !equipment[target.kind].operations.includes("receive")) throw new Error("A supported vessel is required for volume measurement");
    const text = `Measured volume: ${target.volumeMl} mL in ${target.id}.`;
    return { workspace: { ...workspace, events: [...workspace.events, text] }, text };
  }
  if (command.type === "measure-gas") {
    const target = workspace.objects[command.id];
    if (!target || !equipment[target.kind].operations.includes("measure-gas")) throw new Error("Gas measurement requires a gas collection vessel");
    const text = `Measured ${Object.entries(target.gases || {}).map(([name, moles]) => `${name}: ${moles} mol, ${(moles * oxygenReaction.molarGasVolume * 1000).toFixed(2)} mL at 0 °C and 1 atm`).join(", ") || "no collected gas"} in ${target.id}.`;
    return { workspace: { ...workspace, events: [...workspace.events, text] }, text };
  }
  const next = executeCommand(workspace, command);
  return { workspace: next, text: next.events.at(-1) || "" };
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
    if (!e || !Number.isInteger(e.step) || e.step < 0)
      throw new Error("Invalid experiment progress");
    if (e.id === "oxygen") {
      const p = e.protocol;
      const legacyShape = Object.keys(core.workspace.objects).length === 0;
      const jarGas = core.workspace.objects.jar?.gases?.O2 || 0;
      const expectedInventory = /** @type {Record<string,number>} */ (oxygenLedger(p?.loaded ?? false, p?.steps ?? 0, legacyShape ? (e.inventory?.collectedO2Mol || 0) : jarGas));
      const inventoryKeys = Object.keys(expectedInventory).filter((key) => !legacyShape || key !== "uncollectedO2Mol");
      if (!p || typeof p.connected !== "boolean" || typeof p.loaded !== "boolean" ||
        !Number.isInteger(p.steps) || p.steps < 0 || p.steps > 5 || (!p.loaded && p.steps > 0) ||
        !p.positions || Object.keys(p.positions).length !== 3 ||
        Object.keys(p.positions).some((id) => !["tube", "burner", "jar"].includes(id)) ||
        ["tube", "burner", "jar"].some(/** @param {string} id */ (id) => {
          const position = p.positions[id];
          return !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) ||
            Math.abs(position[0]) > 4 || Math.abs(position[1]) > 2.5;
        }) || !e.inventory || inventoryKeys.some((key) => e.inventory[key] !== expectedInventory[key]) ||
        Object.keys(e.inventory).some((key) => !Object.hasOwn(expectedInventory, key)) || e.step !== p.steps)
        throw new Error("Invalid oxygen session state");
      if (!legacyShape) {
        const tube = core.workspace.objects.tube, jar = core.workspace.objects.jar;
        const generated = (tube.gases?.O2 || 0) + (jar.gases?.O2 || 0);
        if (tube.kind !== "reactionVessel" || core.workspace.objects.burner?.kind !== "burner" ||
          jar.kind !== "collectionJar" || core.workspace.objects.delivery?.kind !== "deliveryTube" ||
          p.connected !== Boolean(gasReceiver(core.workspace, "tube")) ||
          ["tube", "burner", "jar"].some((/** @type {string} */ id) => p.positions[id].some((/** @type {number} */ x, /** @type {number} */ i) => x !== core.workspace.objects[id].position[i])) ||
          p.loaded !== (Boolean(tube.solids?.KClO3 || tube.solids?.KCl || generated)) ||
          Math.abs((tube.solids?.KClO3 || 0) - expectedInventory.remainingKClO3Mol) > 1e-12 ||
          Math.abs((tube.solids?.KCl || 0) - expectedInventory.KClMol) > 1e-12 ||
          Math.abs(generated - expectedInventory.generatedO2Mol) > 1e-12)
          throw new Error("Oxygen workspace inventory or topology is inconsistent");
      }
    } else {
      const definition = guidedDefinition(e), steps = stepList(e);
      if (e.definition) {
        const result = validateExperimentManifest(e.definition);
        if (!result.valid || e.definition.id !== e.id || Object.hasOwn(experimentManifests, e.id)) throw new Error("Invalid authored experiment snapshot");
        const apparatus = new Map(e.definition.apparatus.map((/** @type {any} */ item) => [item.id, item.kind]));
        if (Object.keys(core.workspace.objects).length !== apparatus.size || Object.entries(core.workspace.objects).some(([id, item]) => apparatus.get(id) !== item.kind)) throw new Error("Authored experiment workspace does not match its apparatus definition");
      }
      if (!definition || !steps || e.step > steps.length)
        throw new Error("Invalid experiment progress");
      if (e.result !== null && e.result !== undefined &&
        (e.id !== "neutralization" || !Number.isFinite(e.result.pH) || !Number.isFinite(e.result.acidMoles) ||
          !Number.isFinite(e.result.baseMoles) || !Number.isFinite(e.result.reactedMoles) || !["acid", "base", "none"].includes(e.result.excess)))
        throw new Error("Invalid experiment result");
    }
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
  if (s.migration !== undefined && (!s.migration || s.migration.version !== 1 ||
    !["materia-guided-v1", "materia-free-v1", "materia-oxygen", "materia-session", "materia-liquid"].includes(s.migration.sourceKey) ||
    !Number.isInteger(s.migration.sourceVersion) || s.migration.sourceVersion < 1 ||
    !Number.isFinite(Date.parse(s.migration.importedAt))))
    throw new Error("Invalid session migration provenance");
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
        if (next.core.experiment?.id === "oxygen") {
          const fresh = newLabSession(next.id, "guided", "oxygen", at, next.name);
          fresh.mode = next.mode;
          next.core = fresh.core;
        } else if (next.core.experiment?.definition) {
          const fresh = newAuthoredExperimentSession(next.id, next.core.experiment.definition, at, next.name);
          fresh.mode = next.mode;
          next.core = fresh.core;
        } else if (next.mode === "guided" && next.core.experiment) {
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
      } else if (action.type === "oxygen-connect" || action.type === "oxygen-disconnect" || action.type === "oxygen-load" || action.type === "oxygen-heat") {
        if (next.core.experiment?.id !== "oxygen") throw new Error("Oxygen experiment required");
        const p = next.core.experiment.protocol, ws = next.core.workspace;
        if (action.type === "oxygen-connect") {
          if (p.connected) throw new Error("The oxygen apparatus is already connected");
          next.core.workspace = executeCommand(ws, { type: "connect", a: "tube", ap: "gasOutlet", b: "delivery", bp: "inlet" });
          next.core.workspace = executeCommand(next.core.workspace, { type: "connect", a: "delivery", ap: "outlet", b: "jar", bp: "gasInlet" });
        } else if (action.type === "oxygen-disconnect") {
          if (!p.connected) throw new Error("The oxygen apparatus is already disconnected");
          next.core.workspace = executeCommand(ws, { type: "disconnect", id: "tube", port: "gasOutlet" });
          next.core.workspace = executeCommand(next.core.workspace, { type: "disconnect", id: "delivery", port: "outlet" });
        } else if (action.type === "oxygen-load") {
          if (p.loaded) throw new Error("The simulated reactant is already loaded");
          next.core.workspace = executeCommand(ws, { type: "add-solid", id: "tube", stock: "chlorate", massG: oxygenReaction.initialMassG });
        } else {
          if (!p.loaded || p.steps >= 5) throw new Error("Load potassium chlorate before heating; conversion is limited to five increments");
          const remaining = ws.objects.tube.solids.KClO3 || 0;
          const increment = oxygenReaction.initialMassG / oxygenReaction.potassiumChlorateMolarMass * oxygenReaction.fractionPerStep;
          next.core.workspace = executeCommand(ws, { type: "heat", id: "tube", burnerId: "burner", fraction: Math.min(1, increment / remaining) });
          p.steps++;
        }
        syncOxygenMetadata(next.core);
        text = next.core.workspace.events.at(-1) || "";
      } else if (action.type === "perform" || action.type === "next") {
        if (next.mode !== "guided" || !next.core.experiment)
          throw new Error("Guided policy required");
        const e = next.core.experiment,
          step = stepList(e)?.[e.step];
        if (!step || step.id !== action.stepId)
          throw new Error("Unexpected or completed step");
        let command = step.command;
        if (action.type === "perform") {
          const student = action.command;
          const keyMap = /** @type {Record<string,string[]>} */ ({
            add: ["id", "stock"],
            transfer: ["from", "to", "via"],
            mix: ["id"],
            react: ["id", "reactionId"],
            measure: ["id", "solute"],
            "measure-volume": ["id"],
            "measure-gas": ["id"],
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
        const reactionInput = e.id === "neutralization" && command.type === "react"
          ? structuredClone(next.core.workspace.objects[command.id])
          : null;
        const execution = runManifestCommand(next.core.workspace, command);
        next.core.workspace = execution.workspace;
        e.step++;
        if (e.id === "neutralization" && command.type === "react") {
          const vessel = next.core.workspace.objects[command.id];
          const chargeBalance = neutralizationMoles(
            vessel.solutes.HCl || 0,
            vessel.solutes.NaOH || 0,
            vessel.volumeMl,
          );
          e.result = {
            ...chargeBalance,
            acidMoles: reactionInput.solutes.HCl || 0,
            baseMoles: reactionInput.solutes.NaOH || 0,
            reactedMoles: Math.min(
              reactionInput.solutes.HCl || 0,
              reactionInput.solutes.NaOH || 0,
            ),
            excess: (vessel.solutes.HCl || 0) > 0
              ? "acid"
              : (vessel.solutes.NaOH || 0) > 0
                ? "base"
                : "none",
          };
          const measurement = `Calculated pH ${e.result.pH.toFixed(2)} at 25 °C; excess ${e.result.excess}.`;
          next.core.workspace.events.push(measurement);
          text = `${text} ${measurement}`;
        }
        text = execution.text || next.core.workspace.events.at(-1);
      } else {
        if (
          next.mode === "guided" &&
          !["move", "rotate", "connect", "disconnect"].includes(action.type)
        )
          throw new Error("Operation is not allowed by guided policy");
        if (
          ![
            "place",
            "remove",
            "move",
            "rotate",
            "add",
            "transfer",
            "mix",
            "measure",
            "measure-volume",
            "react",
            "connect",
            "disconnect",
            "add-solid",
            "heat",
            "measure-gas",
          ].includes(action.type)
        )
          throw new Error("Unsupported operation");
        if (action.type === "measure-volume") {
          const v = next.core.workspace.objects[action.id];
          if (!v || !equipment[v.kind].operations.includes("receive"))
            throw new Error("A vessel is required");
          text = `Measured volume: ${v.volumeMl} mL in ${v.id}.`;
          next.core.workspace.events.push(text);
        } else if (action.type === "measure-gas") {
          const v = next.core.workspace.objects[action.id];
          if (!v || !equipment[v.kind].operations.includes("measure-gas")) throw new Error("Gas measurement requires a gas collection vessel");
          text = `Measured ${Object.entries(v.gases || {}).map(([name, moles]) => `${name}: ${moles} mol, ${(moles * oxygenReaction.molarGasVolume * 1000).toFixed(2)} mL at 0 °C and 1 atm`).join(", ") || "no collected gas"} in ${v.id}.`;
          next.core.workspace.events.push(text);
        } else {
          next.core.workspace = executeCommand(next.core.workspace, action);
          text = next.core.workspace.events.at(-1);
          if (next.core.experiment?.id === "oxygen") syncOxygenMetadata(next.core);
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
          ? experimentName(next.core.experiment.id, next.core.experiment.definition)
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
