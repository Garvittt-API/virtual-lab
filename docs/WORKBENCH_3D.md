# Interactive 3D workbench

## Session and scene ownership

`SessionWorkbench` initializes or restores a canonical `LabSession` and routes guided chemistry and free exploration through `dispatchLab`. `GuidedLab` and `FreeLab` both render `LiquidScene`; the scene reads the current `core.workspace`, and user actions return through canonical session commands. Guided experiment manifests still define their own starting vessels and permitted procedure.

The scene creates one Three.js renderer, controls instance, resize observer, event handlers, and animation loop per mount. Later session updates replace procedural equipment/connection meshes and selection highlighting while keeping the renderer. Scene cleanup removes handlers, observer, animation loop, controls, geometry, materials and renderer. Resize updates the camera aspect and drawing size. WebGL context loss is reported in the scene host; automatic restoration was not verified across physical browser/GPU combinations.

Equipment is procedurally modeled from registry definitions. The 15 prioritized items are beaker, conical flask, test tube, measuring cylinder, volumetric flask, funnel, dropper, pipette, burette, retort stand, clamp, glass rod, watch glass, reagent bottle, and round-bottom flask. Additional gas delivery tube, collection jar, and condenser definitions support connection examples. Their dimensions are illustrative metres and capacity values are nominal teaching limits.

## Manipulation and topology

- Selecting equipment highlights it on the bench and populates the vessel inspector.
- Pointer/touch dragging moves the selected Three.js group and dispatches `move` on pointer release. The engine snaps horizontal coordinates to 0.25 m, enforces bench bounds, and rejects overlaps. Saved coordinates are authoritative.
- Focusable directional and rotation buttons offer a non-drag alternative. The engine also supports an incremental `rotate` command snapped to 15 degrees.
- The free workspace exposes each compatible pair of typed ports from the registry. The engine rejects incompatible, occupied, missing, or self-connections atomically. Supported examples include funnel stem to open vessel, clamp holder to retort stand post, a delivery tube between a flask and collection jar, and condenser joints to compatible flask mouths. Connection lines are illustrative, not functional tubing.
- Undo and redo operate on canonical workspace snapshots. Browser reload restores the saved session from local storage.

## Inventory and supported operations

The current catalog provides water, HCl, NaOH, AgNO₃ and NaCl solutions (catalog defaults are 0.1 M). Users select stock, concentration (0–20 M for dissolved stocks) and volume, add to compatible vessels, transfer a measured volume between supported vessels, mix, react for neutralization/AgCl precipitation, and record volume or concentration measurements. The inventory engine stores volume in mL, solute and solid amounts in mol, and transfers dissolved inventory proportionally. This concentration range is a software limit for the educational model, not safety guidance.

Scene liquid height reflects volume/capacity and a supported-species tint. AgCl inventory appears as a settled solid. These are deterministic visual indicators of saved state. There is no pouring animation, gas flow, thermal animation, particle simulation or fluid dynamics. Precipitation and neutralization are educational idealizations described in [SCIENTIFIC_MODELS.md](SCIENTIFIC_MODELS.md).

## New workbench and experiment coverage

“New Workbench” creates a named free session with no equipment. Existing session controls provide local save/reopen, rename, duplicate, JSON import/export, notebook observations, and undo/redo. A reusable experiment-template file format and template library are not implemented.

Guided neutralization, precipitation and dilution use the shared `LiquidScene`. Oxygen retains its dedicated `OxygenScene` and experiment-specific protocol/ledger representation. It is regression-tested, but does not yet share the universal apparatus graph and common workspace inventory. Bridging that model is required before claiming every route uses one workbench representation.

## Verification environment and limits

`npm run test:browser` exercises canvas pointer dragging, keyboard movement/rotation controls, typed connections, inventory addition/transfer, canonical state, undo/redo, session reload and all four experiment routes. It uses headless Chromium with SwiftShader WebGL. This verifies a software WebGL path, not real GPU performance. The production build still reports a 513.76 kB minified Three.js/OrbitControls chunk (128.57 kB gzip), which is loaded behind the lazy scene boundary.
