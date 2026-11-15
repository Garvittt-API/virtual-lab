# Universal workbench: proposed architecture

**Status:** design proposal, not implemented. Basis: repository evidence in [audit](CURRENT_ARCHITECTURE_AUDIT.md) and user-supplied product direction. No browser observation or scientific peer review. Preserve existing application, store formats and model behavior while replacing duplication incrementally. One authoritative state **per session**, not a single shared state across all experiments or users.

## Boundaries and data flow

`Resource catalog → manifest validation/version resolution → session factory → session controller (policy + commands) → immutable lab state → scene projection + panels`. Notebook, persistence and assessment receive typed domain events from the same session transaction. A guided policy validates manifest step and safety acknowledgement before invoking the *same* command handler used by an open/free policy. New Workbench is an empty initial manifest/session, not a separate engine. React stores selection, form draft and ephemeral drag preview only; Three objects/animations are projections, never inventories.

### Canonical envelope (illustrative JSON, no implementation claim)

```json
{
  "schemaVersion": 2,
  "sessionId": "session-stable-id",
  "revision": 12,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z",
  "origin": {"mode": "guided", "manifestId": "dilution", "manifestVersion": 1},
  "workspace": {
    "equipment": {"vessel-1": {"definitionId": "beaker", "definitionVersion": 1, "transform": {"positionM": [0,0,0], "rotationRad": [0,0,0]}, "compartments": {"body": {"phases": {"aqueous": {"volumeMl": 20, "amountMol": {"NaCl": 0.002}}}}}}},
    "connections": []
  },
  "progress": {"stepId": "measure", "safetyAcknowledged": true, "answers": {}, "status": "in-progress"},
  "notebook": {"entries": []},
  "history": {"undo": [], "redo": [], "audit": []},
  "modelVersions": {"reaction": "ideal-v1", "units": "v1"}
}
```

This is a **contract sketch**, not a final serialized schema; decide exact units and phase representation with a chemistry reviewer before coding. Stable IDs are distinct for sessions, instances, compartments, connections, species, stock mixtures, experiments, manifest versions, commands and notebook entries. Physical material has one authoritative location/phase (e.g., `solid`, `aqueous`, `liquid`, `gas`) per compartment, amounts in mol; concentration is derived from amount and *mixture* volume; track solvent explicitly only when data allow it, otherwise mark unknown rather than invent water moles. A gas collector and reaction tube are separate compartments with an explicit transfer/capture assumption; do not double-count gas as both produced and collected. Do not infer temperature from a burner animation. Temperature, pressure and phase properties are `unknown/not-modeled` unless supported, never arbitrary defaults. Separate derived projections and explicit model state from inventories; validate finite nonnegative values, capacity, IDs, known species, phase and connection consistency; use bounded tolerances only where scientifically justified.

### Commands and history

Proposed `applyCommand(session, {id, type, expectedRevision, inputs}, context)` → `{ok, nextSession, events, measurements, warnings}` or `{ok:false, code, message, fieldErrors}`. Normalize units; validate schema, capability, port and policy, species, capacities, model conditions and safety; calculate on a copy and atomically commit state/progress/notebook events once. Never mutate on failure, including partial transfer or persistence abort. Dispatch action ID and clock from boundary, not random/time inside pure simulation. Commands include place/remove/move/rotate, add stock/solid, measure, transfer, mix, dilution as composed conserved transfer/add operations, connect/disconnect, reaction, approved model-specific heat/cool, observation, progression and reset. Reject unsupported heat/cool and models explicitly. Pure domain events carry before/after quantities and model/version; notebook can include independently edited observations and audit events. Undo restores scientific state/progress without deleting notebook records; record undo/redo separately and use checkpointed snapshots or inverse operations only where proven reversible. Branching after undo clears redo, not audit; reset is an explicit reversible operation. Decide whether safety acknowledgements and assessment submissions should be reversible independently, document and test.

### Runner and manifest

Declarative, versioned, bounded manifest, not arbitrary JS or evaluable strings:

```json
{
  "schemaVersion": 1, "id": "salt-dilution", "version": 1,
  "metadata": {"title": "Stock dilution", "level": "school", "category": "solutions", "difficulty": "introductory", "durationMinutes": 20, "previewAsset": "original-asset-id", "description": "Ideal dilution"},
  "objectives": ["Calculate amount concentration"],
  "safety": {"warning": "Digital only", "requiresAcknowledgement": true},
  "requirements": {"equipmentDefinitions": ["beaker", "volumetric"], "species": ["NaCl", "H2O"], "modelIds": ["ideal-dilution-v1"]},
  "setup": {"instances": [], "initialInventories": [], "connections": []},
  "policy": {"allowedCommands": ["add", "transfer", "mix", "measure"], "mode": "guided"},
  "steps": [{"id": "measure", "instruction": "Record concentration", "accept": {"type": "measure", "targetRole": "final-vessel"}}],
  "expectedObservations": [{"text": "Concentration decreases on dilution", "modelId": "ideal-dilution-v1"}],
  "calculations": [{"kind": "amount-concentration", "sourceRole": "final-vessel", "species": "NaCl"}],
  "completion": {"allRequiredSteps": true},
  "assessment": [{"id": "q1", "kind": "single-choice", "prompt": "How does concentration change?", "options": ["decreases", "increases"], "answerIndex": 0}]
}
```

Empty `setup` in this *illustration* would not be launchable with a missing `final-vessel`; validator must resolve instance IDs, roles, references, quantities, required model/instrument capabilities and initial bounds before any commit. Step acceptance can reference typed predicates, prior events and thresholds through an allowlisted expression AST, not `eval`; distinguish guidance, required action, calculations, expected observations and assessment. Compare actual student quantities, not preset outcomes. Store manifest/model version in each session, validate finite size/depth/IDs and migrations; immutable published versions enable resume and reproducibility. Free mode uses the same manifest loader, explicit empty setup, no procedure and same safety/capability rules. A template export excludes user data unless explicitly chosen and validates availability, licensing and model support.

## Equipment and chemical registries

**Equipment definition**: stable ID/version, licensed geometry asset or procedural model, render scale/origin, dimensions, nominal capacity and calibration, materials, mount/footprint/clearance, typed compartments and port poses/orientation, capability contracts (accepted phase, receive/transfer/mix/heat/measure; range/precision/uncertainty), attachment compatibility and occupancy, hazard constraints, supported-model version and accessibility label. Instance state owns transform, contents, open/closed settings, attachments and measured result; definition owns reusable static properties. Never infer support from an available model geometry. A connection graph uses typed endpoints (liquid/gas/electric/mechanical), direction, attachment state, capacity/occupancy and orientation/alignment tolerances; optional tubes are physical connector instances. Validate cycles where relevant, dangling references, crossing or mechanical stability only when modeled. Snap candidate is UI preview; a valid command commits the graph.

| Family | Current evidence | Proposed support gate |
|---|---|---|
| Beaker, conical flask, cylinder, volumetric flask | definitions and generic receiving/transferring in `registry.js`; no instrument precision | retain as ideal liquid containers; calibrated measurements/mark-fill require explicit model and tests |
| Funnel | visual + logical connection; no flow/filter | no flow claim until path/filter mechanics implemented |
| Test tube, round-bottom, gas collection, burner | isolated procedural oxygen scene, not common registry/engine | migrate geometry; implement solid/gas, connector and bounded conversion behavior before functional label |
| Pipette, dropper, burette, separatory funnel, condenser, stand/clamp, hot plate | no universal operational models | keep unavailable until capacity, mounting, delivery/flow and corresponding commands exist |
| Balance, thermometer, pH meter, electrodes and advanced instruments | no common instrument model | unavailable until units, calibration, range, measurement conditions, uncertainty and scientific validation exist |

**Substance definition:** stable chemical identity (external identifiers optional and versioned), formula and charge/isotopic specification, molar mass source/rounding, allowed phases, color/optics separate from chemistry, density/solubility/thermal data with units, conditions, range, source and uncertainty, hazards and concentration/region applicability, incompatible combinations and approved model references. **Stock definition:** mixture recipe + concentration, solvent, volumes, provenance/hazards; do not conflate stock ID with pure species. Existing `substances.js` and `registry.js` stocks overlap but have different purposes: consolidate identity/links without deleting validated catalog data. PubChem compound summaries aggregate data and safety annotations from multiple organizations [4](https://pubchem.ncbi.nlm.nih.gov/docs/compound-page); import should preserve source, date, conditions, licensing and editorial review, not silently treat every value as valid for all mixtures. NIST WebBook examples list property conditions, methods, references and uncertainties [2](https://webbook.nist.gov/cgi/cbook.cgi?ID=C7727379&Mask=4). Domain data ingestion is future work, not automatic reaction discovery.

## Simulation and visual models

| Operation | Proposed deterministic scientific contract | Visual layer / gate |
|---|---|---|
| Pour/transfer | Explicit quantity, origin/destination/phase, capacity, conservation; homogeneous composition only if model says so; reject incompatible phases; optional flow-rate model | Animate a validated transfer; stop/cancel semantics reconciled to committed amount, not mesh collisions |
| Mix/dilute/dissolve | Inventory balance; additive volume/homogeneity clearly tagged ideal; dissolution only with approved solubility/temperature model | Swirl/bubbles purely illustrative; do not assert dissolution from animation |
| React/precipitate | Balanced stoichiometry + limiting extent; phase/product routing and declared conversion/equilibrium model; reaction activation explicit | AgCl marker derived from solid quantity; ideal complete precipitation clearly not Ksp prediction |
| Gas/heat/cool | Begin with legacy oxygen's explicit conversion and complete capture model; later approved energy, phase, loss and pressure models with constraints | Flame/gas are illustrative; no predicted temperature/kinetics unless actual model implemented |
| Evaporation, filtration, distillation, titration, electrolysis | Need model-specific mass/energy/charge balances, apparatus/conditions, separation/flow, reviewed data and test vectors; disabled by default | No fabricated downstream products, temperature, color or instrument outputs |
| Measurements | Measured quantity is derived from actual contents and instrument capability; quantity, units, range, resolution and uncertainty recorded | Controls disabled or unavailable when physical instrument/underlying model is missing |

IUPAC defines reaction extent via stoichiometric change [1](https://goldbook.iupac.org/terms/view/E02283); this supports extent bookkeeping, not a rate or equilibrium model. Reviewed external references are needed for each implemented process. Existing stoichiometric engine is a reusable calculation kernel; extending it is not a claim of broad predictive chemistry.

## 3D interaction and performance design

Reuse Three.js, `OrbitControls`, raycasting, procedural meshes, resize/disposal and UI movement buttons from `LiquidScene`; factor a persistent renderer/scene controller, stable `instanceId → Object3D` mapping and incremental projections, with reference-counted geometry/material disposal. OrbitControls supports orbit, pan and zoom [3](https://threejs.org/docs/pages/OrbitControls.html); actual current gestures must be device-tested. Split interaction state machine: idle → pick/preview → validate → commit or cancel; use canvas-relative coordinates, capture pointer, handle `pointercancel`/lost capture, multi-touch camera gestures and selection conflicts. Pointer capture and `touch-action` control dispatch/default gesture behavior [1](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events). Provide keyboard and tap alternatives, focus/status text, numeric placement and touch targets; never rely on drag alone [1](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Renderer failure has an accessible 2D/list fallback, preserving identical commands.

Use footprint/bounds and port local transforms for broad-phase snapping and static collision checks first; exclude connected/stacked allowed pairs deliberately. No physics engine until measured necessity; physics geometry is not scientific chemistry. Profile draw calls, memory, frame time, startup and low-end hardware before optimization; reuse geometry/materials, lazy load, limit DPR, dispose on removal. InstancedMesh can reduce draw calls for repeated geometry/material but requires instance-aware selection and lifecycle handling [3](https://threejs.org/docs/pages/InstancedMesh.html). Establish measurable budgets in product testing; do not invent verified frame rates.

## Storage, migration and recovery

Propose IndexedDB session records and notebook entries in a single transactional database, with `sessions`, `entries`, `templates`, `migrationReports` and explicit schema versions, indexed by session and updated time. IndexedDB reads/writes are transaction scoped, and request success alone is not transaction completion [1](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction); atomic DB writes do **not** make localStorage reads or deletions part of the same transaction. Import localStorage as immutable snapshots: read → validate source → deterministic map with original key/hash, missing-data flags and model versions → validate target → commit target + provenance + import marker together → await transaction completion → reread/compare invariants → only then mark ready; keep original source indefinitely unless user explicitly exports/clears it. Failure leaves original untouched and gives export/recovery, no blank overwrite. Re-import is idempotent and detects changed source by content hash, not index alone. Handle quota, private mode, eviction, aborted transaction, multi-tab optimistic revisions/conflict and unsupported versions. IndexedDB durability guarantees vary; explicit export/backups remain necessary. Restore rejects malformed/untrusted input, enforces size/depth/schema limits and never executes imported code. JSON session export/import includes manifest/model versions, canonical state, notebook and history subject to privacy choices, checksums, compatibility and conflict policy. Store timestamps as UTC when known; legacy timestamps remain unknown.

Notebook entries structured `{id,sessionId,at?,kind,commandId?,payload,modelVersion?,source?,revision}` for measurement, transfer, mix, reaction, calculation, observation, assessment, completion and undo notices. Untrusted manual text rendered as text, not HTML. User notes are not in scientific undo snapshots; automatic audit events and edited/deleted observations have explicit history semantics. Existing `materia-notebook-v1` and legacy text are imported as text with provenance, not treated as new quantitative observations. Future account sync/teacher access needs consent, authorization, retention and conflict resolution; local-only comes first.

## Module inventory and boundaries

Status: **P** partial; **R** needs refactoring; **M** missing; **S** requires scientific validation. No module is called complete for target scope.

| # | Module | Status | Evidence / intended boundary |
|---|---|---|---|
| 1 | Resource library | P/R | `main.jsx:205` two hardcoded cards and filters; catalog index + search |
| 2 | Detail/launch | P/R | legacy details/entry, no manifest-generic launch/resume |
| 3 | Universal 3D workbench | P/R | `LiquidScene`, separate legacy scenes; persistent view adapter |
| 4 | Equipment registry | P/R/S | `lab/registry.js` five basic definitions, ports |
| 5 | Chemical registry | P/R/S | `substances.js` and separate `stocks` |
| 6 | Connection system | P/R/S | validated logical ports, no spatial/functional flow |
| 7 | Chemical simulation commands | P/R/S | `lab/engine.js`; common per-workspace immutable command |
| 8 | Reaction/stoichiometry | P/S | `reactions.js` three ideal balanced reactions |
| 9 | Physical processes | P/R/S | instantaneous liquid transfer/mix; heat/gas isolated and ideal, most missing |
| 10 | Measurement/instruments | P/R/S | volume input and computed concentration; no real instrument model |
| 11 | Manifest loader | P/R | two narrow incompatible manifest types; versioned declarative loader needed |
| 12 | Guided runner | P/R | `guided.js` fixed IDs/actions; no general safety/assessment |
| 13 | Free exploration | P/R | `free.js` independent local workspace; same engine, separate session |
| 14 | Custom experiment builder | M | create/validate/version/template/share controls |
| 15 | Laboratory notebook | P/R | `notebook.js`, `import-notes.js`; incomplete activity integration and transactions |
| 16 | Persistence/migration | P/R | separate localStorage keys, note-only import; no canonical scientific migration |
| 17 | Assessment/validation | P/R | `experiment.js` simple in-memory questions; generalized persisted assessment missing |
| 18 | Student experience | P/R/S | existing guidance/notes, uneven status and no efficacy validation |
| 19 | Teacher/classroom | M | no identities, assignments, submissions or authorization |
| 20 | Resource authoring | M | no editor, review workflow, publish/version, licensing |

### Data safety and governance

Digital-only warnings, hazardous-substance flags, age/curriculum gates, safety acknowledgement, model limitations and teacher oversight must accompany each reviewed resource. Hazardous chlorate decomposition, corrosives and silver salts must never be presented as instructions to perform an unsafe real procedure. Validate science with qualified reviewers, reference data/units/provenance and model-domain tests. Nothing in this document establishes independent scientific validation.
