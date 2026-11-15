import { react, reactions } from "./simulation/reactions.js";
/** Ideal strong monoprotic acid/base model at 25 °C. Volumes are mL, concentration mol/L.
 * @param {number} acidMl
 * @param {number} baseMl
 * @param {number} acidM
 * @param {number} baseM
 */
export function neutralization(acidMl, baseMl, acidM = 0.1, baseM = 0.1) {
  for (const n of [acidMl, baseMl, acidM, baseM])
    if (!Number.isFinite(n) || n < 0)
      throw new RangeError("Inputs must be finite and non-negative");
  const volume = (acidMl + baseMl) / 1000;
  if (!volume)
    return {
      pH: 7,
      acidMoles: 0,
      baseMoles: 0,
      reactedMoles: 0,
      excess: "none",
    };
  const acidMoles = (acidMl / 1000) * acidM,
    baseMoles = (baseMl / 1000) * baseM;
  const difference = (acidMoles - baseMoles) / volume;
  // Solve charge balance with water autoionization; numerically stable for excess base.
  const h =
    difference >= 0
      ? (difference + Math.sqrt(difference ** 2 + 4e-14)) / 2
      : 2e-14 / (Math.sqrt(difference ** 2 + 4e-14) - difference);
  const stoichiometry = react(reactions.neutralization, {
    HCl: acidMoles,
    NaOH: baseMoles,
  });
  return {
    pH: -Math.log10(h),
    acidMoles,
    baseMoles,
    reactedMoles: stoichiometry.extent,
    excess:
      Math.abs(difference) < 1e-12 ? "none" : difference > 0 ? "acid" : "base",
  };
}
