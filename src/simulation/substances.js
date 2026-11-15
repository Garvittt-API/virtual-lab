// Rounded atomic weights (g/mol); intended for classroom stoichiometry, not analytical measurements.
// Values from IUPAC abridged standard atomic weights (https://ciaaw.org/atomic-weights.htm).
export const atomicWeights = Object.freeze({
  H: 1.008,
  O: 15.999,
  Na: 22.99,
  Cl: 35.45,
  Ag: 107.87,
  N: 14.007,
  K: 39.1,
});
/** Parse plain neutral formulae using supported elements; parentheses, charges and hydrates are not supported.
 * @param {string} formula @returns {Record<string,number>} */
export function parseFormula(formula) {
  if (typeof formula !== "string" || !formula)
    throw new Error("Invalid formula");
  const tokens = formula.match(/[A-Z][a-z]?(?:[1-9][0-9]*)?/g);
  if (!tokens || tokens.join("") !== formula)
    throw new Error("Unsupported formula");
  const atoms = /** @type {Record<string,number>} */ ({});
  for (const token of tokens) {
    const parts = token.match(/^([A-Z][a-z]?)([1-9][0-9]*)?$/);
    if (!parts || !Object.hasOwn(atomicWeights, parts[1]))
      throw new Error("Unsupported element");
    const n = parts[2] ? Number(parts[2]) : 1;
    if (!Number.isSafeInteger(n) || n > 1000000)
      throw new Error("Invalid atom count");
    atoms[parts[1]] = (atoms[parts[1]] || 0) + n;
    if (!Number.isSafeInteger(atoms[parts[1]]))
      throw new Error("Invalid atom count");
  }
  return atoms;
}
/** @param {string} formula */
export function molarMass(formula) {
  const atoms = parseFormula(formula);
  return Object.entries(atoms).reduce(
    (sum, [e, n]) =>
      sum + atomicWeights[/** @type {keyof typeof atomicWeights} */ (e)] * n,
    0,
  );
}
/** @typedef {{id:string,name:string,formula:string,state:'aqueous'|'solid'|'gas'|'liquid',hazard:string,limitations:string}} Substance */
/** @type {Readonly<Record<string,Substance>>} */
export const substances = Object.freeze({
  HCl: {
    id: "HCl",
    name: "Hydrochloric acid",
    formula: "HCl",
    state: "aqueous",
    hazard: "Corrosive in concentrated form; hazards vary by concentration.",
    limitations: "Ideal fully dissociated solute.",
  },
  NaOH: {
    id: "NaOH",
    name: "Sodium hydroxide",
    formula: "NaOH",
    state: "aqueous",
    hazard: "Corrosive; hazards vary by concentration.",
    limitations: "Ideal fully dissociated solute.",
  },
  NaCl: {
    id: "NaCl",
    name: "Sodium chloride",
    formula: "NaCl",
    state: "aqueous",
    hazard: "Avoid ingestion and eye contact.",
    limitations: "Ideal dissolved molecular bookkeeping.",
  },
  H2O: {
    id: "H2O",
    name: "Water",
    formula: "H2O",
    state: "liquid",
    hazard: "Laboratory water is not drinking water.",
    limitations: "Solvent inventory is only included if explicitly supplied.",
  },
  AgNO3: {
    id: "AgNO3",
    name: "Silver nitrate",
    formula: "AgNO3",
    state: "aqueous",
    hazard: "Can cause burns and is hazardous to aquatic life.",
    limitations: "Ideal aqueous solution.",
  },
  AgCl: {
    id: "AgCl",
    name: "Silver chloride",
    formula: "AgCl",
    state: "solid",
    hazard: "Avoid release into the environment.",
    limitations: "Ideal insoluble precipitate; equilibrium ignored.",
  },
  NaNO3: {
    id: "NaNO3",
    name: "Sodium nitrate",
    formula: "NaNO3",
    state: "aqueous",
    hazard: "Oxidizer when concentrated; hazards vary by concentration.",
    limitations: "Ideal dissolved molecular bookkeeping.",
  },
  KClO3: {
    id: "KClO3",
    name: "Potassium chlorate",
    formula: "KClO3",
    state: "solid",
    hazard: "Strong oxidizer; hazardous on heating.",
    limitations: "Decomposition is educational only.",
  },
  KCl: {
    id: "KCl",
    name: "Potassium chloride",
    formula: "KCl",
    state: "solid",
    hazard: "Avoid ingestion and eye contact.",
    limitations: "Solid residue in the oxygen model.",
  },
  O2: {
    id: "O2",
    name: "Oxygen",
    formula: "O2",
    state: "gas",
    hazard: "Oxidizing gas; can intensify fire.",
    limitations: "Ideal gas assumed only where stated.",
  },
});
/** @param {number} n @param {string} label */
function nonnegative(n, label) {
  if (!Number.isFinite(n) || n < 0)
    throw new RangeError(`${label} must be finite and non-negative`);
}
/** @param {number} massG @param {string} formula */
export function massToMoles(massG, formula) {
  nonnegative(massG, "Mass");
  return massG / molarMass(formula);
}
/** @param {number} moles @param {string} formula */
export function molesToMass(moles, formula) {
  nonnegative(moles, "Amount");
  const value = moles * molarMass(formula);
  if (!Number.isFinite(value)) throw new RangeError("Mass overflow");
  return value;
}
/** @param {number} moles @param {number} volumeL */
export function molarity(moles, volumeL) {
  nonnegative(moles, "Amount");
  if (!Number.isFinite(volumeL) || volumeL <= 0)
    throw new RangeError("Volume must be positive and finite");
  const value = moles / volumeL;
  if (!Number.isFinite(value)) throw new RangeError("Concentration overflow");
  return value;
}
/** Ideal dilution; volumes in the same units. @param {number} concentration @param {number} initialVolume @param {number} finalVolume */
export function dilute(concentration, initialVolume, finalVolume) {
  nonnegative(concentration, "Concentration");
  nonnegative(initialVolume, "Initial volume");
  if (
    !Number.isFinite(finalVolume) ||
    finalVolume <= 0 ||
    finalVolume < initialVolume
  )
    throw new RangeError(
      "Final volume must be positive and not smaller than initial volume",
    );
  return concentration * (initialVolume / finalVolume);
}
/** @param {number} volume @param {'mL'|'L'} from @param {'mL'|'L'} to */
export function convertVolume(volume, from, to) {
  nonnegative(volume, "Volume");
  if (!["mL", "L"].includes(from) || !["mL", "L"].includes(to))
    throw new Error("Unsupported unit");
  const result =
    from === to ? volume : from === "mL" ? volume / 1000 : volume * 1000;
  if (!Number.isFinite(result)) throw new RangeError("Volume overflow");
  return result;
}
