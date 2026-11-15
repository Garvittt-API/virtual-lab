# Scientific models and limitations

These are deterministic classroom calculations, not independently reviewed experimental predictions or real-world procedures.

## Neutralization

- Reaction: HCl + NaOH → NaCl + H₂O, 1:1 stoichiometry.
- A shared reaction calculation determines extent, limiting reactant, remaining HCl/NaOH and products.
- The legacy pH calculation is preserved: strong, monoprotic acid/base, full dissociation, charge balance including water autoionization, 25 °C and additive solution volumes.
- Canonical guided sessions calculate pH from residual acid/base amount and current modeled vessel volume after reaction.
- No activities, buffer equilibria, indicator transition, calorimetry, kinetics, or measurement uncertainty are modeled.

## Oxygen generation

- Reaction: 2 KClO₃(s) → 2 KCl(s) + 3 O₂(g).
- Inherited amount and progression: 1.00 g starting KClO₃, five user-triggered increments of 20% of the starting amount.
- Molar mass remains 122.55 g/mol for compatibility with prior outputs.
- O₂ is collected only through a connected typed gas-port path. The deterministic transfer is limited by the collection jar's declared capacity; excess remains in the reaction vessel. Capacity conversion uses ideal gas molar volume 22.414 L/mol at 0 °C and 1 atm.
- Heating eligibility uses the burner operation and 1.2 scene-unit proximity check. This is a procedural gate, not a thermal or kinetic prediction.
- The canonical workspace records solid reactant/product and gas quantities. Visual bubbles and liquid levels do not determine or feed back into the ledger.
- Reported gas volume is a derived ideal-gas equivalent at the fixed conditions above. No pressure, temperature change, flow rate, leakage, or kinetic state is simulated.

## Precipitation and dilution

- AgCl precipitation uses balanced stoichiometry and a complete-precipitation approximation. It does not solve Ksp, ionic strength, complexation, or equilibrium.
- NaCl dilution assumes additive volumes, immediate homogeneous mixing, and no activity corrections.

## Units and conservation

- Vessel liquid volume is mL; solute inventories and reaction extents are mol; input stock concentration is mol/L.
- The oxygen ledger stores moles and derived gas volume. Its stored initial mass uses the explicitly retained rounded molar mass above.
- Reaction calculations are deterministic and tested in software. The tests are not external scientific validation.

## Liquid transfer and supported measurements

- Transfers convert user input from mL or L to the canonical mL unit, remove the same fraction of every dissolved solute from the source, and add it to the receiver. This assumes each source is homogeneous. Vessel capacity and dispenser connection constraints are checked before the returned state is accepted.
- Dropper, pipette, and burette use the same deterministic measured transfer operation. Their model does not simulate suction, pressure, droplet size, calibration tolerances, or flow dynamics. A compatible dispenser tip connection is required.
- Funnel routing identifies the receiver via a connected funnel stem; there is no gravity/flow calculation. The animation is a short display cue after state commit.
- Volume, concentration, and gas inventory can be recorded from supported vessels. Gas volume is reported only under the fixed ideal-gas assumption. There is no mass model for balance readings, acid/base equilibrium pH meter, or temperature model for thermometer readings; those operations are unavailable.

## Explicitly unavailable models

- A condenser connection is structural only. Enabling condensation needs a defined vapor/liquid phase inventory, energy balance, heat-transfer boundary conditions, and validation data; none are available here.
- Burner display is an indicator of an accepted reaction command. The model does not predict heat transfer, ignition, temperature, or reaction rate.
- Gas transfer is capacity-limited inventory routing, not gas pressure, delivery rate, leakage, or displacement simulation.
