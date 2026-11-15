import { react, reactions } from "./simulation/reactions.js";
/** A digital, idealized stoichiometric model; it is not a heating-rate prediction. */
export const oxygenReaction = Object.freeze({
  equation: "2 KClO₃(s) → 2 KCl(s) + 3 O₂(g)",
  potassiumChlorateMolarMass: 122.55, // g/mol, rounded from standard atomic weights
  molarGasVolume: 22.414, // L/mol, ideal gas at 0 °C and 1 atm
  initialMassG: 1,
  fractionPerStep: 0.2,
});
export const initialOxygen = Object.freeze({
  connected: false,
  loaded: false,
  steps: 0,
  notes: "",
  positions: { tube: [-1.4, 0, 0], burner: [-1.4, 1, 0], jar: [1.5, 0, 0] },
  events: [],
});
/** @param {number} massG @param {number} fraction */
export function oxygenYield(massG, fraction) {
  if (
    !Number.isFinite(massG) ||
    massG < 0 ||
    !Number.isFinite(fraction) ||
    fraction < 0 ||
    fraction > 1
  )
    throw new RangeError("Invalid amount or conversion fraction");
  // Retain the original 122.55 g/mol rounding and conversion assumption.
  const result = react(
    reactions.oxygen,
    { KClO3: massG / oxygenReaction.potassiumChlorateMolarMass },
    fraction,
  );
  const reacted = result.extent * 2;
  return {
    reactantMoles: reacted,
    oxygenMoles: result.produced.O2,
    potassiumChlorideMoles: result.produced.KCl,
    oxygenMl: result.produced.O2 * oxygenReaction.molarGasVolume * 1000,
  };
}

/** Build the persisted reaction ledger for the existing five 20% conversion actions. */
/** @param {boolean} loaded @param {number} steps @param {number} [collectedO2Mol] */
export function oxygenLedger(loaded, steps, collectedO2Mol) {
  if (typeof loaded !== "boolean" || !Number.isInteger(steps) || steps < 0 || steps > 5 || (!loaded && steps > 0))
    throw new RangeError("Invalid oxygen experiment progress");
  if (!loaded) {
    if (collectedO2Mol !== undefined && collectedO2Mol !== 0) throw new RangeError("Cannot collect oxygen before loading reactant");
    return { initialKClO3Mol: 0, remainingKClO3Mol: 0, consumedKClO3Mol: 0, KClMol: 0, generatedO2Mol: 0, collectedO2Mol: 0, uncollectedO2Mol: 0, collectedO2Ml: 0 };
  }
  const initialKClO3Mol = oxygenReaction.initialMassG / oxygenReaction.potassiumChlorateMolarMass;
  const yieldAtProgress = oxygenYield(oxygenReaction.initialMassG, steps * oxygenReaction.fractionPerStep);
  const consumedKClO3Mol = yieldAtProgress.reactantMoles;
  const generatedO2Mol = yieldAtProgress.oxygenMoles;
  const collected = collectedO2Mol === undefined ? generatedO2Mol : collectedO2Mol;
  if (!Number.isFinite(collected) || collected < 0 || collected > generatedO2Mol + 1e-12)
    throw new RangeError("Invalid collected oxygen amount");
  const uncollectedO2Mol = generatedO2Mol - collected;
  return {
    initialKClO3Mol,
    remainingKClO3Mol: Math.max(0, initialKClO3Mol - consumedKClO3Mol),
    consumedKClO3Mol,
    KClMol: yieldAtProgress.potassiumChlorideMoles,
    generatedO2Mol,
    collectedO2Mol: collected,
    uncollectedO2Mol: Math.abs(uncollectedO2Mol) < 1e-12 ? 0 : Math.max(0, uncollectedO2Mol),
    collectedO2Ml: collected * oxygenReaction.molarGasVolume * 1000,
  };
}

/** Validate the persisted pre-canonical oxygen format without changing it. @param {any} state */
export function validateLegacyOxygen(state) {
  if (!state || typeof state !== "object" || Array.isArray(state) ||
    Object.keys(state).some((key) => !["connected", "loaded", "steps", "notes", "positions", "events"].includes(key)) ||
    typeof state.connected !== "boolean" || typeof state.loaded !== "boolean" ||
    typeof state.notes !== "string" || !Array.isArray(state.events) || !state.events.every(/** @param {unknown} event */ (event) => typeof event === "string") ||
    !Number.isInteger(state.steps) || state.steps < 0 || state.steps > 5 || (!state.loaded && state.steps > 0))
    throw new Error("Invalid legacy oxygen session");
  if (!state.positions || typeof state.positions !== "object" || Array.isArray(state.positions) ||
    Object.keys(state.positions).length !== 3 || ["tube", "burner", "jar"].some((id) => {
      const position = state.positions[id];
      return !Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || Math.abs(position[0]) > 4 || Math.abs(position[1]) > 2.5;
    })) throw new Error("Invalid legacy oxygen apparatus positions");
  return true;
}
/** Immutable state transitions shared by controls and tests. No kinetic or thermal model is implied.
 * @param {{connected: boolean, loaded: boolean, steps: number, notes: string, positions: Record<string, number[]>, events: string[]}} state
 * @param {{type: string, id?: string, position?: number[], value?: string}} action
 */
export function oxygenTransition(state, action) {
  switch (action.type) {
    case "connect":
      if (state.connected) return state;
      return {
        ...state,
        connected: true,
        events: [
          ...state.events,
          "Connected the reaction vessel to the collection vessel.",
        ],
      };
    case "disconnect":
      if (!state.connected) return state;
      return {
        ...state,
        connected: false,
        events: [...state.events, "Disconnected the delivery tube."],
      };
    case "load":
      if (state.loaded) return state;
      return {
        ...state,
        loaded: true,
        events: [
          ...state.events,
          "Loaded 1.00 g of potassium chlorate (simulated).",
        ],
      };
    case "heat": {
      const [tx, tz] = state.positions.tube;
      const [bx, bz] = state.positions.burner;
      if (
        !state.connected ||
        !state.loaded ||
        state.steps >= 5 ||
        Math.hypot(tx - bx, tz - bz) > 1.2
      )
        return state;
      const steps = state.steps + 1;
      const yieldMl = oxygenYield(
        oxygenReaction.initialMassG,
        steps * oxygenReaction.fractionPerStep,
      ).oxygenMl;
      return {
        ...state,
        steps,
        events: [
          ...state.events,
          `Simulated conversion ${steps * 20}%; theoretical collected oxygen ${yieldMl.toFixed(1)} mL at 0 °C and 1 atm.`,
        ],
      };
    }
    case "move": {
      const p = action.position;
      if (
        typeof action.id !== "string" ||
        !Object.hasOwn(state.positions, action.id) ||
        !Array.isArray(p) ||
        p.length !== 3 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 4 ||
        Math.abs(p[1]) > 2.5
      )
        return state;
      return { ...state, positions: { ...state.positions, [action.id]: p } };
    }
    case "note":
      return typeof action.value === "string"
        ? { ...state, notes: action.value }
        : state;
    default:
      return state;
  }
}
