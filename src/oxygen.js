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
