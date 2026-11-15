import { reactions, react } from "./reactions.js";
import { substances, molarity } from "./substances.js";
import { equipment } from "../lab/registry.js";
/** @typedef {{id:string,action:'add'|'react'|'dilute',species?:string,moles?:number,volumeMl?:number,reactionId?:string,instruction:string}} Step */
/** @typedef {{id:string,title:string,subject:string,topic:string,difficulty:string,objectives:string[],equipment:string[],substances:string[],safety:string,steps:Step[]}} Manifest */
/** @type {Readonly<Record<string,Manifest>>} */
export const manifests = Object.freeze({
  neutralization: {
    id: "neutralization",
    title: "Acid-base stoichiometry",
    subject: "Chemistry",
    topic: "Acid and base",
    difficulty: "Beginner",
    objectives: ["Determine a limiting reagent."],
    equipment: ["beaker", "flask"],
    substances: ["HCl", "NaOH"],
    safety:
      "Digital only; real acids and bases require supervision and appropriate protection.",
    steps: [
      {
        id: "acid",
        action: "add",
        species: "HCl",
        moles: 0.0025,
        volumeMl: 25,
        instruction: "Add 25 mL of 0.1 M HCl.",
      },
      {
        id: "base",
        action: "add",
        species: "NaOH",
        moles: 0.0025,
        volumeMl: 25,
        instruction: "Add 25 mL of 0.1 M NaOH.",
      },
      {
        id: "react",
        action: "react",
        reactionId: "neutralization",
        instruction: "Calculate the ideal neutralization.",
      },
    ],
  },
  precipitation: {
    id: "precipitation",
    title: "Silver chloride precipitation",
    subject: "Chemistry",
    topic: "Precipitation",
    difficulty: "Intermediate",
    objectives: ["Identify the limiting reagent and predicted solid."],
    equipment: ["beaker", "flask"],
    substances: ["AgNO3", "NaCl"],
    safety:
      "Digital only; silver salts can cause burns and must not be released into the environment.",
    steps: [
      {
        id: "silver",
        action: "add",
        species: "AgNO3",
        moles: 0.001,
        volumeMl: 10,
        instruction: "Add 10 mL of 0.1 M silver nitrate.",
      },
      {
        id: "salt",
        action: "add",
        species: "NaCl",
        moles: 0.002,
        volumeMl: 20,
        instruction: "Add 20 mL of 0.1 M sodium chloride.",
      },
      {
        id: "react",
        action: "react",
        reactionId: "precipitation",
        instruction: "Calculate the ideal precipitate and remaining solute.",
      },
    ],
  },
  dilution: {
    id: "dilution",
    title: "Solution dilution",
    subject: "Chemistry",
    topic: "Solutions",
    difficulty: "Beginner",
    objectives: ["Calculate concentration after dilution."],
    equipment: ["cylinder", "flask"],
    substances: ["NaCl", "H2O"],
    safety: "Digital only; do not consume laboratory materials.",
    steps: [
      {
        id: "stock",
        action: "add",
        species: "NaCl",
        moles: 0.001,
        volumeMl: 10,
        instruction: "Measure 10 mL of 0.1 M sodium chloride stock.",
      },
      {
        id: "dilute",
        action: "dilute",
        volumeMl: 100,
        instruction: "Add solvent to a total volume of 100 mL.",
      },
    ],
  },
  oxygen: {
    id: "oxygen",
    title: "Oxygen stoichiometry",
    subject: "Chemistry",
    topic: "Decomposition",
    difficulty: "Intermediate",
    objectives: ["Calculate theoretical oxygen yield."],
    equipment: [],
    substances: ["KClO3"],
    safety: "Digital only; potassium chlorate is a strong oxidizer.",
    steps: [
      {
        id: "load",
        action: "add",
        species: "KClO3",
        moles: 1 / 122.55,
        volumeMl: 0,
        instruction: "Load a theoretical 1 g of KClO3.",
      },
      {
        id: "react",
        action: "react",
        reactionId: "oxygen",
        instruction: "Calculate full decomposition.",
      },
    ],
  },
});
/** @param {Manifest} m */
export function validateManifest(m) {
  if (
    !m ||
    !m.id ||
    !m.title ||
    !m.subject ||
    !m.topic ||
    !m.difficulty ||
    !m.safety ||
    !Array.isArray(m.objectives) ||
    !m.objectives.length ||
    !Array.isArray(m.equipment) ||
    !Array.isArray(m.substances) ||
    !Array.isArray(m.steps) ||
    !m.steps.length
  )
    throw new Error("Invalid manifest");
  if (
    m.equipment.some((x) => !Object.hasOwn(equipment, x)) ||
    m.substances.some((x) => !Object.hasOwn(substances, x))
  )
    throw new Error("Unknown requirement");
  const ids = new Set();
  for (const s of m.steps) {
    if (!s.id || ids.has(s.id) || !s.instruction)
      throw new Error("Invalid step");
    ids.add(s.id);
    if (s.action === "add") {
      if (
        !s.species ||
        !m.substances.includes(s.species) ||
        typeof s.moles !== "number" ||
        !Number.isFinite(s.moles) ||
        s.moles < 0 ||
        typeof s.volumeMl !== "number" ||
        !Number.isFinite(s.volumeMl) ||
        s.volumeMl < 0
      )
        throw new Error("Invalid addition");
    } else if (s.action === "react") {
      if (
        !s.reactionId ||
        !Object.hasOwn(reactions, s.reactionId) ||
        reactions[s.reactionId].reactants.some(
          (t) => !m.substances.includes(t.species),
        )
      )
        throw new Error("Invalid reaction reference");
    } else if (s.action === "dilute") {
      if (
        typeof s.volumeMl !== "number" ||
        !Number.isFinite(s.volumeMl) ||
        s.volumeMl <= 0
      )
        throw new Error("Invalid dilution");
    } else throw new Error("Unsupported step");
  }
  return true;
}
/** @param {Manifest} manifest @param {string[]} availableEquipment @param {string[]} availableSubstances */
export function startExperiment(
  manifest,
  availableEquipment,
  availableSubstances,
) {
  validateManifest(manifest);
  if (
    !Array.isArray(availableEquipment) ||
    !Array.isArray(availableSubstances) ||
    manifest.equipment.some((x) => !availableEquipment.includes(x)) ||
    manifest.substances.some((x) => !availableSubstances.includes(x))
  )
    throw new Error("Missing experiment requirements");
  return {
    manifestId: manifest.id,
    step: 0,
    inventory: /** @type {Record<string,number>} */ ({}),
    volumeMl: 0,
    history: /** @type {string[]} */ ([]),
    results: /** @type {ReturnType<typeof react>[]} */ ([]),
    notes: /** @type {string[]} */ ([]),
    completed: false,
  };
}
/** @typedef {ReturnType<typeof startExperiment>} Session */
/** @param {Manifest} manifest @param {Session} state @param {string} stepId */
export function advanceExperiment(manifest, state, stepId) {
  validateManifest(manifest);
  if (
    !state ||
    state.manifestId !== manifest.id ||
    !Number.isInteger(state.step) ||
    state.step < 0 ||
    state.step >= manifest.steps.length ||
    state.completed ||
    !Array.isArray(state.history) ||
    state.history.length !== state.step ||
    !Array.isArray(state.results) ||
    !Array.isArray(state.notes) ||
    !state.inventory ||
    typeof state.inventory !== "object" ||
    Array.isArray(state.inventory) ||
    Object.entries(state.inventory).some(
      ([id, n]) =>
        !Object.hasOwn(substances, id) || !Number.isFinite(n) || n < 0,
    ) ||
    !Number.isFinite(state.volumeMl) ||
    state.volumeMl < 0 ||
    manifest.steps[state.step].id !== stepId
  )
    throw new Error("Invalid step or completed experiment");
  const next = structuredClone(state),
    step = manifest.steps[state.step];
  if (step.action === "add") {
    const id = /** @type {string} */ (step.species),
      moles = /** @type {number} */ (step.moles),
      volume = /** @type {number} */ (step.volumeMl);
    next.inventory[id] = (next.inventory[id] || 0) + moles;
    next.volumeMl += volume;
    if (!Number.isFinite(next.inventory[id]) || !Number.isFinite(next.volumeMl))
      throw new Error("Amount overflow");
  } else if (step.action === "react") {
    const definition = reactions[/** @type {string} */ (step.reactionId)];
    if (
      definition.reactants.some(
        (t) => !Object.hasOwn(next.inventory, t.species),
      )
    )
      throw new Error("Missing reactants");
    const reaction = react(definition, next.inventory);
    next.inventory = reaction.inventory;
    next.results.push(reaction);
  } else if (step.action === "dilute") {
    const total = /** @type {number} */ (step.volumeMl);
    if (total < next.volumeMl)
      throw new Error("Final volume is smaller than initial volume");
    next.volumeMl = total;
  }
  next.history.push(step.instruction);
  next.step++;
  next.completed = next.step === manifest.steps.length;
  return next;
}
/** @param {Session} state @param {string} note */
export function recordNote(state, note) {
  if (typeof note !== "string" || !note.trim())
    throw new Error("Note is empty");
  return { ...state, notes: [...state.notes, note.trim()] };
}
/** @param {Session} state @param {string} species */
export function sessionMolarity(state, species) {
  return molarity(state.inventory[species] || 0, state.volumeMl / 1000);
}
