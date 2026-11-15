# Laboratory engine: current increment

This is a foundation, **not a universal chemistry engine**. It coexists with the original neutralization and oxygen activities; those activities have not been migrated to it.

## Boundary and units

`src/lab/registry.js` defines four illustrative procedural equipment types (beaker, conical flask, measuring cylinder, funnel) with nominal dimensions and capacities, supported operations and typed connection ports. The interactive workspace currently instantiates a beaker, a flask and a funnel; the measuring cylinder is defined but not exposed in that workspace. Dimensions are approximate model metadata, not validated engineering specifications. Model IDs reference procedural geometry, not real licensed models.

The stock registry contains water and a user-specified educational 0.1 M sodium chloride solution. Water is treated as the tracked liquid volume, not tracked in moles. NaCl is tracked in moles as one nonreactive solute. No chemical safety classification or physical-property database is implied by the short hazard notices.

`src/lab/engine.js` is independent of Three.js and applies immutable commands to a validated state. Add accepts stock solution and mL; transfer removes a proportional share of a homogeneous mixture and adds the same volume and solute amount to the destination. It rejects negative, nonfinite, insufficient and over-capacity transfers atomically. Concentration is moles divided by volume in litres. The model assumes instantaneous homogeneity and additive volumes, and does not calculate reactions, activities, temperature, solubility or uncertainties. Floating point arithmetic may introduce small rounding errors.

The connection model checks mutual port types and single-port occupancy and supports multiple independent connections. Only funnel stem ↔ vessel mouth is currently defined. Connections are logical: they do not move objects, prevent collisions, or permit fluid flow through equipment. Events are descriptive strings, not a replayable event-sourcing log. Scene history is in memory; the latest state is localStorage on one device. No server-side validation or data isolation exists.

`LiquidLab.jsx` uses these commands for a user-accessible exploratory workspace. `LiquidScene.jsx` renders original procedural objects and volumes from state; liquid height and colour are illustrative, not calibrated flask geometry, and no pouring animation is claimed. The existing scenes are still separate and duplicate rendering logic. UI input, WebGL, persistence, dragging and accessibility have **not** been manually inspected or browser-tested in this iteration.

## Remaining architecture

Generalized creation/duplication/deletion, collision and snapping, real connections, broader equipment and chemical catalogs, source/destination inventory, dissolution, precipitation and reaction calculations, mixing/thermal dynamics, and a schema-driven experiment runner are all incomplete. No migration of oxygen or implementation of the requested three complete demonstrations has happened. The model and activities have not undergone independent scientific review.
