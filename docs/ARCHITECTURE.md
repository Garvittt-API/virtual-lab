# Architecture and scientific state ownership

## Current execution path

All interactive experiment routes now open `SessionWorkbench`. It loads a validated version-2 `LabSession`, dispatches user actions through `dispatchLab`, and persists the resulting session collection under `materia-lab-sessions-v2`. Guided steps and free exploration share `lab/engine.js` workspace state and the same session notebook. Oxygen uses the same controller, renderer, typed apparatus topology, and phase-aware workspace inventory. Its checked protocol step count is progress metadata; it does not own chemical results.

The React entries for Discover, the legacy Virtual lab sidebar item, Liquid workspace, Guided laboratory, Free exploration, Reaction exercises and saved experiment routes lead into the canonical session UI. The four current built-in definitions are neutralization, silver chloride precipitation, dilution and oxygen. Discover adapts those existing definitions into a searchable library and includes locally published authored definitions; every launch uses the same canonical session UI. Reaction exercises can launch all four built-ins.

## State ownership map

| Activity/data | Previous owner | Current owner | Status |
|---|---|---|---|
| Guided neutralization, precipitation and dilution | `guided.js` v1 session | `LabSession.core.workspace` plus guided manifest step | v1 copies are retained and imported once |
| Free exploration | `free.js` v1 session | `LabSession.core.workspace` | v1 copies are retained and imported once |
| Oxygen protocol and equipment transforms | `materia-oxygen` / `oxygenTransition` in `OxygenLab` | `LabSession.core.experiment.protocol` via `dispatchLab` | Migrated; original key is read-only |
| Oxygen quantities and yield | Recomputed from five-step conversion in the oxygen screen | `LabSession.core.experiment.inventory` | Deterministic ledger for solid KClO₃ consumed/remaining, KCl and O₂ produced/collected |
| Legacy neutralization amounts and pH | `materia-session`, `main.jsx`, `chemistry.js` | Canonical vessel solutes/reaction plus `experiment.result` | Migrated and reaction applied once |
| Liquid workspace | `materia-liquid` and `LiquidLab` | Canonical free session/workspace | Migrated; the old page is now an adapter |
| Reaction exercise UI | In-memory `simulation/runner.js` state | Canonical `SessionWorkbench` and `dispatchLab` | UI migrated; old calculation API remains for compatibility/unit tests |
| Session observations and events | Screen-specific fields and global notebook | `LabSession.notebook` | New routed activities use session-linked entries outside undo snapshots |
| Historical global notebook | `materia-notebook-v1` | Existing version-1 notebook | Preserved for old/manual entries; not yet merged into session records |
| Bookmark | `materia-bookmark` | Same local preference | Not scientific state |

`SessionWorkbench` is the persistence boundary for active scientific sessions. `dispatchLab` creates an immutable next session, validates it, records action text in its session notebook and the caller writes the complete collection. Undo/redo snapshots only `core`; notebook entries remain after simulation undo. Failed commands return the unchanged session.

## Oxygen ledger

The original oxygen workflow remains explicit: initial mass 1.00 g KClO₃, five manually selected 20% increments, 2 KClO₃ → 2 KCl + 3 O₂, and ideal-gas capacity conversion at 22.414 L/mol (0 °C, 1 atm). The workspace stores remaining KClO₃, produced KCl, generated O₂, and collected O₂. A connected gas-port path is required for collection; receiver capacity is enforced, and excess remains in the reaction vessel. A heating action requires loaded reactant, a valid conversion fraction, and burner proximity. This deterministic stage is not a heating-rate or kinetic calculation.

The stored gas volume is calculated from the inherited fixed ideal-gas model. It is not a pressure, temperature, kinetics, heat-transfer, or fluid-displacement simulation. Protocol connectivity metadata is derived from and validated against the actual typed gas-port path in the workspace graph.

## Neutralization ledger

Legacy sessions contain base volume, a fixed 25.0 mL 0.1 M HCl starting amount, apparatus transforms, events and a free-text note. Migration adds the corresponding acid/base stocks to the canonical workspace, transfers and mixes once, then applies the shared balanced reaction once (when base is present). The workspace stores consumed reactants, residual HCl/NaOH and products; `experiment.result` stores the pre-existing charge-balance pH/excess result at 25 °C. The source base volume and original apparatus transforms remain in the `compatibility` field; source events/notes are copied into the session notebook.

The new guided neutralization also calculates pH from residual strong acid/base moles and the simulated solution volume after its reaction step. This retains the existing complete-dissociation, monoprotic strong electrolyte, additive-volume and 25 °C assumptions. It does not model activity coefficients, indicators, uncertainty, or reaction heat.

## Rendering boundary

`LiquidScene` receives session-derived state. Its geometry and transfer/gas movement cues display already-committed inventory; they do not calculate chemistry. Chromium tests exercise actual WebGL canvas creation with SwiftShader; this is not a physical-GPU profile. Context-loss notification and renderer lifecycle cleanup exist, but physical-device restoration and memory behavior have not been verified.

## Remaining boundaries

- `simulation/runner.js` still exports its previous pure calculation API for compatibility and unit tests. Product experiment execution no longer calls its in-memory `startExperiment`/`advanceExperiment` state machine.
- Session storage is localStorage only. It has no cross-tab revision locking, server synchronization, account isolation, or backup service.
- The global version-1 notebook is kept for historical/manual entries. The session notebook is authoritative for current laboratory events.
- Condenser joints and some support connections are structural topology only. No condensation, heat-transfer, pressure, flow-rate, heating-kinetics, or temperature-dependent measurement model is enabled.
# Experiment authoring and reusable library

The experiment authoring studio persists versioned definitions in the browser's `materia-experiment-library-v1` local storage record. It adapts existing experiment metadata from `src/lab/guided.js`, validates authored starting states and instruction sequences against `src/lab/registry.js`, `src/lab/engine.js`, and `src/simulation/reactions.js`, and stores published definitions as snapshots in guided canonical sessions. Preview and launch use `SessionWorkbench` and the same `LiquidScene` used by built-in experiments; no experiment-specific renderer is introduced.

Imported definitions are plain JSON with a fixed export envelope and allowlisted command types. A schema v1 to v2 migration fills explicit defaults before strict validation. This is a client-side authoring system: browser storage is not a trust boundary, there is no server identity/role system, and local publication is not server authorization. See [EXPERIMENT_AUTHORING.md](EXPERIMENT_AUTHORING.md) and [EXPERIMENT_MANIFEST_SCHEMA.md](EXPERIMENT_MANIFEST_SCHEMA.md).
