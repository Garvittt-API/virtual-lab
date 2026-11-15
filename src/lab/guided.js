import { stocks } from "./registry.js";
import {
  createWorkspace,
  executeCommand,
  validateWorkspace,
} from "./engine.js";
// Steps are intentionally fixed measured commands, not arbitrary executable code.
/** @typedef {{id:string,instruction:string, command:any}} GuidedStep */
/** @typedef {{id:string,title:string,safety:string,model:string,vesselKind:string,steps:GuidedStep[]}} GuidedManifest */
/** @type {Readonly<Record<string,GuidedManifest>>} */
export const guidedManifests = Object.freeze({
  neutralization: {
    id: "neutralization",
    title: "Acid-base neutralization",
    vesselKind: "flask",
    safety:
      "Digital only. Acids and bases can be hazardous; real work requires supervision.",
    model:
      "Ideal complete strong-acid/base stoichiometry; no pH or heat prediction.",
    steps: [
      {
        id: "acid",
        instruction: "Add 25 mL 0.1 M HCl to beaker a.",
        command: { type: "add", id: "a", stock: "acid", volumeMl: 25 },
      },
      {
        id: "base",
        instruction: "Add 25 mL 0.1 M NaOH to flask b.",
        command: { type: "add", id: "b", stock: "base", volumeMl: 25 },
      },
      {
        id: "transfer",
        instruction: "Transfer 25 mL from flask b to beaker a.",
        command: { type: "transfer", from: "b", to: "a", volumeMl: 25 },
      },
      {
        id: "mix",
        instruction: "Mix the combined solution in beaker a.",
        command: { type: "mix", id: "a" },
      },
      {
        id: "reaction",
        instruction: "Execute the ideal neutralization in beaker a.",
        command: { type: "react", id: "a", reactionId: "neutralization" },
      },
    ],
  },
  precipitation: {
    id: "precipitation",
    title: "Silver chloride precipitation",
    vesselKind: "flask",
    safety:
      "Digital only. Silver salts can cause burns and are hazardous to aquatic life.",
    model:
      "Ideal complete AgCl precipitation; no Ksp or equilibrium calculation.",
    steps: [
      {
        id: "silver",
        instruction: "Add 10 mL 0.1 M silver nitrate to beaker a.",
        command: { type: "add", id: "a", stock: "silver", volumeMl: 10 },
      },
      {
        id: "salt",
        instruction: "Add 20 mL 0.1 M NaCl to flask b.",
        command: { type: "add", id: "b", stock: "salt", volumeMl: 20 },
      },
      {
        id: "transfer",
        instruction: "Transfer 20 mL from flask b to beaker a.",
        command: { type: "transfer", from: "b", to: "a", volumeMl: 20 },
      },
      {
        id: "mix",
        instruction: "Mix the solutions in beaker a.",
        command: { type: "mix", id: "a" },
      },
      {
        id: "reaction",
        instruction: "Calculate ideal AgCl formation in beaker a.",
        command: { type: "react", id: "a", reactionId: "precipitation" },
      },
    ],
  },
  dilution: {
    id: "dilution",
    title: "Stock solution dilution",
    vesselKind: "volumetric",
    safety: "Digital only. Do not consume laboratory material.",
    model:
      "Ideal additive volumes, instantaneous mixing, no activity corrections.",
    steps: [
      {
        id: "stock",
        instruction: "Add 10 mL 0.1 M NaCl stock to beaker a.",
        command: { type: "add", id: "a", stock: "salt", volumeMl: 10 },
      },
      {
        id: "transfer",
        instruction: "Transfer 10 mL stock to 100 mL volumetric flask b.",
        command: { type: "transfer", from: "a", to: "b", volumeMl: 10 },
      },
      {
        id: "water",
        instruction: "Add 90 mL water to flask b.",
        command: { type: "add", id: "b", stock: "water", volumeMl: 90 },
      },
      {
        id: "mix",
        instruction: "Mix the diluted solution in flask b.",
        command: { type: "mix", id: "b" },
      },
      {
        id: "measure",
        instruction: "Record the final concentration in flask b.",
        command: { type: "measure", id: "b", solute: "NaCl" },
      },
    ],
  },
});
/** @param {GuidedManifest} m */
export function validateGuidedManifest(m) {
  if (
    !m ||
    !m.id ||
    !m.title ||
    !m.safety ||
    !m.model ||
    !["flask", "volumetric"].includes(m.vesselKind) ||
    !Array.isArray(m.steps) ||
    !m.steps.length
  )
    throw new Error("Invalid guided manifest");
  const ids = new Set();
  for (const s of m.steps) {
    if (
      !s.id ||
      ids.has(s.id) ||
      !s.instruction ||
      !s.command ||
      !["add", "transfer", "mix", "react", "measure"].includes(s.command.type)
    )
      throw new Error("Invalid guided step");
    ids.add(s.id);
    const c = s.command;
    const isVessel = (/** @type {unknown} */ id) => id === "a" || id === "b";
    if (
      c.type === "add" &&
      (!isVessel(c.id) ||
        !Object.hasOwn(stocks, c.stock) ||
        !Number.isFinite(c.volumeMl) ||
        c.volumeMl <= 0)
    )
      throw new Error("Invalid addition step");
    if (
      c.type === "transfer" &&
      (!isVessel(c.from) ||
        !isVessel(c.to) ||
        c.from === c.to ||
        !Number.isFinite(c.volumeMl) ||
        c.volumeMl <= 0)
    )
      throw new Error("Invalid transfer step");
    if (["mix", "react", "measure"].includes(c.type) && !isVessel(c.id))
      throw new Error("Invalid vessel step");
    if (
      c.type === "react" &&
      !["neutralization", "precipitation"].includes(c.reactionId)
    )
      throw new Error("Invalid reaction step");
    if (c.type === "measure" && c.solute !== "NaCl")
      throw new Error("Invalid measurement step");
  }
  return true;
}
/** @param {string} id */
export function createSession(id) {
  if (!Object.hasOwn(guidedManifests, id))
    throw new Error("Unknown experiment");
  const m = guidedManifests[id];
  validateGuidedManifest(m);
  const workspace = createWorkspace();
  workspace.objects.b.kind = m.vesselKind;
  return {
    version: 1,
    core: {
      workspace,
      experiment: { id, step: 0, notes: /** @type {string[]} */ ([]) },
    },
    past: /** @type {any[]} */ ([]),
    future: /** @type {any[]} */ ([]),
  };
}
/** @param {any} core */
function validateCore(core) {
  if (
    !core ||
    !core.experiment ||
    !Object.hasOwn(guidedManifests, core.experiment.id)
  )
    throw new Error("Invalid experiment");
  const m = guidedManifests[core.experiment.id];
  validateGuidedManifest(m);
  if (
    !Number.isInteger(core.experiment.step) ||
    core.experiment.step < 0 ||
    core.experiment.step > m.steps.length ||
    !Array.isArray(core.experiment.notes) ||
    !core.experiment.notes.every(
      (/** @type {unknown} */ n) => typeof n === "string" && n.length <= 2000,
    )
  )
    throw new Error("Invalid progress");
  validateWorkspace(core.workspace);
  if (
    Object.keys(core.workspace.objects).length !== 3 ||
    core.workspace.objects.a?.kind !== "beaker" ||
    core.workspace.objects.b?.kind !== m.vesselKind ||
    core.workspace.objects.f?.kind !== "funnel"
  )
    throw new Error("Invalid equipment setup");
}
/** @param {any} session */
export function validateSession(session) {
  if (
    !session ||
    session.version !== 1 ||
    !Array.isArray(session.past) ||
    !Array.isArray(session.future) ||
    session.past.length > 50 ||
    session.future.length > 50
  )
    throw new Error("Invalid session");
  validateCore(session.core);
  for (const item of [...session.past, ...session.future]) {
    validateCore(item);
    if (item.experiment.id !== session.core.experiment.id)
      throw new Error("Mismatched history");
  }
  return true;
}
/** @param {any} session @param {any} action */
export function dispatch(session, action) {
  try {
    validateSession(session);
    if (!action || typeof action.type !== "string")
      throw new Error("Invalid command");
    const next = structuredClone(session);
    if (action.type === "undo") {
      if (!next.past.length) throw new Error("Nothing to undo");
      next.future.push(next.core);
      next.core = next.past.pop();
    } else if (action.type === "redo") {
      if (!next.future.length) throw new Error("Nothing to redo");
      next.past.push(next.core);
      next.core = next.future.pop();
    } else {
      const before = structuredClone(next.core),
        c = next.core,
        m = guidedManifests[c.experiment.id];
      if (action.type === "next" || action.type === "perform") {
        const step = m.steps[c.experiment.step];
        if (!step || step.id !== action.stepId)
          throw new Error("Unexpected or completed step");
        let command = step.command;
        if (action.type === "perform") {
          const student = action.command;
          if (!student || student.type !== step.command.type)
            throw new Error("Choose the required operation");
          const keyMap = /** @type {Record<string,string[]>} */ ({
            add: ["id", "stock"],
            transfer: ["from", "to"],
            mix: ["id"],
            react: ["id", "reactionId"],
            measure: ["id", "solute"],
          });
          const keys = keyMap[step.command.type];
          if (!keys || keys.some((k) => student[k] !== step.command[k]))
            throw new Error(
              "Operation does not match the current procedure; check vessel and substance",
            );
          command = { ...student };
        }
        c.workspace = executeCommand(c.workspace, command);
        c.experiment.step++;
      } else if (
        action.type === "move" ||
        action.type === "connect" ||
        action.type === "disconnect"
      )
        c.workspace = executeCommand(c.workspace, action);
      else if (action.type === "observe") {
        c.workspace = executeCommand(c.workspace, {
          type: "observe",
          note: action.note,
        });
        c.experiment.notes.push(action.note.trim());
      } else if (action.type === "reset") {
        const fresh = createSession(c.experiment.id);
        next.core = fresh.core;
      } else throw new Error("Unsupported command");
      next.past.push(before);
      if (next.past.length > 50) next.past.shift();
      next.future = [];
    }
    validateSession(next);
    return { ok: true, state: next, error: "" };
  } catch (error) {
    return {
      ok: false,
      state: session,
      error: error instanceof Error ? error.message : "Invalid command",
    };
  }
}
