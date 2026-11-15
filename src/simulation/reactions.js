import { substances, parseFormula } from "./substances.js";
/** @typedef {{species:string, coefficient:number}} Term */
/** @typedef {{id:string,equation:string,reactants:Term[],products:Term[],conditions:string,observation:string,limitations:string}} Reaction */
/** @type {Readonly<Record<string,Reaction>>} */
export const reactions = Object.freeze({
  neutralization: {
    id: "neutralization",
    equation: "HCl + NaOH -> NaCl + H2O",
    reactants: [
      { species: "HCl", coefficient: 1 },
      { species: "NaOH", coefficient: 1 },
    ],
    products: [
      { species: "NaCl", coefficient: 1 },
      { species: "H2O", coefficient: 1 },
    ],
    conditions: "Mixed aqueous strong acid and base, ideal complete reaction.",
    observation: "Excess acid or base determines pH; no indicator is modeled.",
    limitations: "No activity, heat, equilibrium or kinetics.",
  },
  precipitation: {
    id: "precipitation",
    equation: "AgNO3 + NaCl -> AgCl + NaNO3",
    reactants: [
      { species: "AgNO3", coefficient: 1 },
      { species: "NaCl", coefficient: 1 },
    ],
    products: [
      { species: "AgCl", coefficient: 1 },
      { species: "NaNO3", coefficient: 1 },
    ],
    conditions:
      "Idealized mixed aqueous solutions with complete precipitation.",
    observation: "AgCl is represented as a solid precipitate.",
    limitations:
      "Ignores Ksp, complexation, ionic strength and side reactions; not a quantitative equilibrium model.",
  },
  oxygen: {
    id: "oxygen",
    equation: "2 KClO3 -> 2 KCl + 3 O2",
    reactants: [{ species: "KClO3", coefficient: 2 }],
    products: [
      { species: "KCl", coefficient: 2 },
      { species: "O2", coefficient: 3 },
    ],
    conditions:
      "Manually specified conversion of solid reactant under simulated heating.",
    observation: "Oxygen is represented as a gas.",
    limitations: "No thermal, rate, pressure or side-reaction model.",
  },
});
/** @param {Term[]} terms */
function side(terms) {
  return terms
    .map(
      (t) =>
        `${t.coefficient === 1 ? "" : `${t.coefficient} `}${substances[t.species].formula}`,
    )
    .join(" + ");
}
/** @param {Reaction} reaction */
export function validateReaction(reaction) {
  if (
    !reaction ||
    typeof reaction.id !== "string" ||
    !reaction.id ||
    !Array.isArray(reaction.reactants) ||
    !reaction.reactants.length ||
    !Array.isArray(reaction.products) ||
    !reaction.products.length ||
    !reaction.conditions ||
    !reaction.limitations ||
    !reaction.observation
  )
    throw new Error("Invalid reaction");
  const sums = [
    /** @type {Record<string,number>} */ ({}),
    /** @type {Record<string,number>} */ ({}),
  ];
  for (const [i, terms] of [reaction.reactants, reaction.products].entries()) {
    const seen = new Set();
    for (const t of terms) {
      if (
        !t ||
        !Object.hasOwn(substances, t.species) ||
        !Number.isSafeInteger(t.coefficient) ||
        t.coefficient <= 0 ||
        seen.has(t.species)
      )
        throw new Error("Invalid reaction term");
      seen.add(t.species);
      for (const [element, count] of Object.entries(
        parseFormula(substances[t.species].formula),
      )) {
        sums[i][element] = (sums[i][element] || 0) + count * t.coefficient;
        if (!Number.isSafeInteger(sums[i][element]))
          throw new Error("Atom count overflow");
      }
    }
  }
  if (
    reaction.equation !==
    `${side(reaction.reactants)} -> ${side(reaction.products)}`
  )
    throw new Error("Equation does not match terms");
  if (
    new Set([...Object.keys(sums[0]), ...Object.keys(sums[1])]).size === 0 ||
    [...new Set([...Object.keys(sums[0]), ...Object.keys(sums[1])])].some(
      (k) => (sums[0][k] || 0) !== (sums[1][k] || 0),
    )
  )
    throw new Error("Unbalanced reaction");
  return true;
}
/** Pure ideal stoichiometric execution. Missing reactants mean zero; all quantities are mol.
 * @param {Reaction} reaction @param {Record<string,number>} inventory @param {number} [fraction] */
export function react(reaction, inventory, fraction = 1) {
  validateReaction(reaction);
  if (
    !inventory ||
    typeof inventory !== "object" ||
    Array.isArray(inventory) ||
    !Number.isFinite(fraction) ||
    fraction < 0 ||
    fraction > 1
  )
    throw new Error("Invalid reaction input");
  for (const [id, n] of Object.entries(inventory)) {
    if (!Object.hasOwn(substances, id) || !Number.isFinite(n) || n < 0)
      throw new Error("Invalid inventory");
  }
  const ratios = reaction.reactants.map(
    (t) => (inventory[t.species] || 0) / t.coefficient,
  );
  const maximum = Math.min(...ratios),
    extent = maximum * fraction;
  if (!Number.isFinite(extent)) throw new RangeError("Extent overflow");
  const remaining = { ...inventory },
    produced = /** @type {Record<string,number>} */ ({});
  for (const t of reaction.reactants) {
    const before = remaining[t.species] || 0;
    const after = before - extent * t.coefficient;
    remaining[t.species] = Math.max(0, after);
  }
  for (const t of reaction.products) {
    const amount = extent * t.coefficient;
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite((remaining[t.species] || 0) + amount)
    )
      throw new RangeError("Product overflow");
    produced[t.species] = amount;
    remaining[t.species] = (remaining[t.species] || 0) + amount;
  }
  const limiting = reaction.reactants
    .filter((_, i) => ratios[i] === maximum)
    .map((t) => t.species);
  return {
    extent,
    maximumExtent: maximum,
    limiting,
    produced,
    inventory: remaining,
    reactionId: reaction.id,
  };
}
