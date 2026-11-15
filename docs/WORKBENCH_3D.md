# Interactive 3D workbench

## Session and scene ownership

`SessionWorkbench` initializes or restores a canonical `LabSession` and routes guided chemistry and free exploration through `dispatchLab`. `GuidedLab` and `FreeLab` both render `LiquidScene`; the scene reads the current `core.workspace`, and user actions return through canonical session commands. Guided experiment manifests still define their own starting vessels and permitted procedure.

The scene creates one Three.js renderer, controls instance, resize observer, event handlers, and animation loop per mount. Canonical workspace updates reconcile the equipment and connection meshes without replacing the renderer; selection changes update only the selection marker. Session events trigger short liquid-transfer and gas-collection cues after the command has committed. Cleanup removes handlers, observer, animation loop, controls, geometry, materials and renderer. Resize updates the camera aspect and drawing size. WebGL context loss is reported in the scene host; browser-level recovery across physical GPU/device combinations remains unverified.

Equipment is procedurally modeled from registry definitions. The 15 prioritized items are beaker, conical flask, test tube, measuring cylinder, volumetric flask, funnel, dropper, pipette, burette, retort stand, clamp, glass rod, watch glass, reagent bottle, and round-bottom flask. Additional gas delivery tube, collection jar, and condenser definitions support connection examples. Their dimensions are illustrative metres and capacity values are nominal teaching limits.

## Manipulation and topology

- Selecting equipment highlights it on the bench and populates the vessel inspector.
- Pointer/touch dragging moves the selected Three.js group and dispatches `move` on pointer release. The engine snaps horizontal coordinates to 0.25 m, enforces bench bounds, and rejects overlaps. Saved coordinates are authoritative.
- Focusable directional and rotation buttons offer a non-drag alternative. The engine also supports an incremental `rotate` command snapped to 15 degrees.
- The free workspace exposes compatible typed port pairs. The engine rejects incompatible, occupied, missing, and self-connections atomically. Supported behaviors include funnel routing, connected dropper/pipette/burette dispensing, gas delivery from the oxygen reaction vessel to the collection jar, and clamp support connection. A condenser can be connected structurally, but has no thermal or transfer behavior; the UI labels this unavailable.
- Undo and redo operate on canonical workspace snapshots. Browser reload restores the saved session from local storage.

## Inventory and supported operations

The current catalog provides water, HCl, NaOH, AgNO₃ and NaCl solutions (catalog defaults are 0.1 M). Users select stock, concentration (0–20 M for dissolved stocks) and volume, add to compatible vessels, route measured liquid transfers directly or through a funnel, dispense from connected dropper/pipette/burette equipment, mix, react for neutralization/AgCl precipitation, and record supported volume, concentration, or collected-gas measurements. The inventory engine stores volume in mL and solute/solid/gas amounts in mol; dissolved inventory transfers proportionally under the homogeneous-mixture assumption. Failed commands leave both vessels unchanged. The concentration range is a software limit, not safety guidance.

Scene liquid height and tint reflect saved volume and dissolved composition. AgCl inventory appears as a settled solid. Transfer cues animate a marker between equipment only after canonical inventory commits; oxygen cues likewise follow generated/collected amounts. These are illustrative movement cues, not fluid or gas dynamics. Heating lights a burner indicator as a representation of the accepted reaction stage; it does not calculate heat. Precipitation and neutralization approximations are described in [SCIENTIFIC_MODELS.md](SCIENTIFIC_MODELS.md).

## New workbench and experiment coverage

“New Workbench” creates a named free session with no equipment. Existing session controls provide local save/reopen, rename, duplicate, JSON import/export, notebook observations, and undo/redo. A reusable experiment-template file format and template library are not implemented.

Guided neutralization, precipitation, dilution, oxygen, and free exploration use the shared `LiquidScene`. New Workbench starts as an empty free session. Oxygen uses typed gas connections and phase-aware workspace inventory; its protocol step count is compatibility/progress metadata that is validated against the workspace inventory.

## Verification environment and limits

`npm run test:browser` exercises canvas pointer dragging, keyboard movement/rotation controls, typed connections, inventory addition/transfer, canonical state, undo/redo, session reload and all four experiment routes. It uses headless Chromium with SwiftShader WebGL. This verifies a software WebGL path, not real GPU performance. The production build still reports a 513.76 kB minified Three.js/OrbitControls chunk (128.57 kB gzip), which is loaded behind the lazy scene boundary.
