# Reaction and experiment calculation foundation

This is an educational deterministic stoichiometric model, not a general chemistry solver or a scientifically reviewed product.

## Substances and quantities

`src/simulation/substances.js` stores a small catalog of neutral molecular bookkeeping species and their nominal physical state, hazard notes and limitations. Molar mass is computed using rounded IUPAC abridged atomic weights (see source link in module); densities, temperature, solubility values and confidence intervals are **not specified**. Utilities convert mass and moles, mL and L, calculate molarity, and perform ideal dilution. Only plain, uncharged, non-parenthesized formulas made from the supported element set are accepted. Ions, isotopes, hydrates, complexes, charges and arbitrary periodic-table elements are not supported. Aqueous formula units represent mole bookkeeping, not undissociated physical species.

## Stoichiometry

`src/simulation/reactions.js` declares balanced neutralization, silver chloride precipitation, and chlorate decomposition reactions. It checks that equation text exactly matches the listed terms and that atom counts balance before execution. `react` calculates the maximum extent from reactant availability, optionally scales it by an explicitly supplied conversion fraction, then returns limiting reactants, produced quantities and remaining inventory. It does not balance unknown equations, model reaction rates, or determine whether an arbitrary real mixture will react.

Neutralization assumes complete reaction of strong acid/base; pH remains separately calculated by the original ideal 25 °C charge-balance model. Precipitation assumes complete AgCl formation when the predefined reaction is explicitly selected; Ksp, complexation and saturation are ignored, so it is not a general prediction that every concentration produces a precipitate. Oxygen uses a manually selected conversion and preserves the existing 122.55 g/mol and 22.414 L/mol rounding. It is not a kinetics or thermal model. Reference equation for oxygen: [Chemistry LibreTexts](https://chem.libretexts.org/Courses/Modesto_Junior_College/Chemistry_150_-_Bunag/Textbook_for_Chemistry_150/11:_Introduction_to_Chemical_Reactions/11.05:_Some_Types_of_Chemical_Reactions).

All calculations use IEEE 754 double precision; no intermediate rounding is intentional, except fixed educational input constants. Tiny subnormal values can underflow, and near-equal ratios can differ by floating-point rounding. Tests use tolerances. Mole numbers generally change during reactions; tests verify atom conservation and mass conservation with a consistent set of rounded atomic weights rather than incorrectly asserting total moles are conserved. Liquid volume conservation is a separate operation in `src/lab/engine.js`.

The existing `neutralization()` and `oxygenYield()` functions now delegate their reaction stoichiometry to `react`, preserving their original public outputs. Their existing UIs, scenes, local notebooks, and state machines remain separate and **have not migrated to the new runner**.

## Manifest runner

`src/simulation/runner.js` contains four fixed-quantity calculation manifests and an immutable runner. It validates recognized equipment/substance/reaction references, required inputs, step order, and supported addition/reaction/dilution operations; it records textual history, results and optional notes. The runner is not a general-purpose manifest schema or safe authoring format: it has no configurable completion criteria, assessment, persisted session, adjustable measured amounts, physical equipment placement or real laboratory commands. In the UI, required items are a simulated preset, not evidence that equipment was placed in the 3D scene. The reaction exercises panel is a calculation-only view; it does **not** control or read the liquid or oxygen 3D workspaces. Its session is in memory and is lost when leaving the panel.

No independent scientific review or browser/visual verification has been performed. Silver halides and oxidizers can be hazardous; activities are digital only and are not instructions for real-world experimentation.
