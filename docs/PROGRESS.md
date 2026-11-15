# Progress — unified scientific sessions

Date: 2026-11-15 (Asia/Kolkata)

## Initial repository safety

- Initial branch was unborn `master`; `git status` showed the whole application untracked and no commits, no remote, and no configured `user.name` or `user.email`.
- `.gitignore` excludes `node_modules/`, `dist/`, `.env`, and `artifacts/`. No credential/secret/key-named project files were found. Hidden `.agents`, `.aws`, and `.codex` directories contained no files. The baseline add list included README, package lock, docs, source, tests, public artwork and configuration only; it excluded dependencies, build output and browser screenshots.
- The Git directory was read-only in the default sandbox. The staging/commit action was retried with escalation as required. Git successfully staged 59 project files and created branch `codex/unified-scientific-sessions`, but the baseline commit failed with `Author identity unknown` because neither `user.name` nor `user.email` is configured. Git reported its fallback identity as `exfil@Exfil.(none)`. No identity was fabricated or configured. The baseline remains staged; milestone changes are unstaged. No commit hash exists.

## Implemented

- Canonical session launch now handles oxygen in addition to guided neutralization, precipitation and dilution. `OxygenLab` receives the current canonical session and dispatch function; its protocol transitions, apparatus positions, undo/redo, events, observations and results no longer write `materia-oxygen`.
- Oxygen session state stores a checked ledger for initial/remaining/consumed KClO₃, KCl, generated/collected O₂ and ideal-gas volume. The prior 1.00 g, five × 20%, 122.55 g/mol, complete-capture, 0 °C/1 atm model remains in place.
- Legacy `materia-oxygen`, `materia-session`, and `materia-liquid` saves are validated and copied to canonical sessions. Each migration has a versioned provenance record; source bytes are retained. The neutralization copy builds canonical acid/base quantities, applies the balanced reaction once, stores the existing pH/excess result and preserves old apparatus coordinates in a compatibility field. Legacy events and notes are copied into the session notebook.
- Canonical initialization also selects/creates guided sessions for precipitation and dilution. The Reaction exercises entry now launches those manifests in `SessionWorkbench`; the Liquid workspace entry now opens the canonical free session and selects the imported liquid state when present.
- The old neutralization screen and its separate `materia-session` writer were removed from the active app path. The old liquid writer is replaced with a canonical-session adapter. Existing legacy keys remain available for migration/recovery.
- Added tests for oxygen ledger conservation/yield, undo/redo and reset, session restoration, legacy source preservation, multiple-source migration, repeated migration, provenance, malformed migration failure and neutralization pH/product quantities. Browser automation now verifies both canonical sessions and policy switching.
- Added `docs/ARCHITECTURE.md`, `docs/SCIENTIFIC_MODELS.md`, `docs/PERSISTENCE.md`, `docs/ROADMAP.md`, updated README, and this progress report.

## Verification

- `npm test`: all 11 test files pass.
- `node tests/session.test.js`: all 18 session tests pass.
- `npm run lint`: passes.
- `npm run typecheck`: passes for configured JavaScript modules (not React JSX).
- `npm run build`: passes; Vite warns on the 521.16 kB minified shared Three.js scene chunk.
- `npm run test:browser`: passes with headless Chromium + SwiftShader WebGL, covering neutralization, oxygen, precipitation, dilution, New Workbench, apparatus operations, persistence and mobile viewport. SwiftShader is software rendering, not physical GPU verification.
- `npm audit --audit-level=moderate`: found 0 vulnerabilities after the restricted network request was retried with network access.
- `git diff --check`: passes with no whitespace errors.

## Remaining gaps

- Connection behaviors outside implemented gas, funnel, dispenser, and support paths remain topology-only; condenser transfer and thermal behavior is explicitly unsupported.
- The previous calculation runner functions remain exported and tested for compatibility, although the app UI no longer invokes their in-memory execution state.
- Historical `materia-notebook-v1` remains separate; migration records legacy events in canonical session notebooks, while the shared notebook retains old global/manual records.
- localStorage still lacks account sync, cross-tab conflict detection, durable backup, and automatic recovery/export for corrupted data.
- Teacher/classroom/admin workflows, resource authoring, broader apparatus/instruments, full touch/device accessibility, real-device WebGL, independent scientific review, and production deployment are not implemented.

## Exact next task

Continue with independently reviewed apparatus physics, condenser behavior, and real-device WebGL validation. No Git author identity is configured, so do not create a commit until the user configures one.

## Universal interactive workbench increment — 2026-11-15

- Guided neutralization, precipitation, dilution, and free exploration share `LiquidScene`, a single renderer implementation. This increment made the renderer, controls and animation loop stable across session updates; workspace changes now reconcile scene contents without replacing the renderer. Resize, cleanup, and WebGL lost/restored notifications are registered. Context loss is surfaced to the user; recovery across real GPU/device drivers is not independently verified.
- Expanded the procedural 3D equipment library with all 15 prioritized items plus gas delivery tube, collection jar, and condenser. Definitions include dimensions, capacity, operations and typed ports. Shapes are low-detail procedural teaching models, not photorealistic or manufacturer-accurate assets.
- Added session commands for 0.25 m workspace snapping, overlap rejection on movement, and 15° incremental rotation. Existing pointer drag still commits through `dispatchLab`; keyboard-focusable position/rotation controls use the same canonical commands. The free workbench exposes compatible port pairing and disconnect actions. Tested connection example: clamp holder to retort stand post. Existing funnel-to-open-vessel topology also remains valid.
- The free workbench draws liquid levels from saved vessel volume and tint from supported dissolved species; saved AgCl solids display as settled precipitate. The engine remains deterministic: visual updates display its state and do not calculate reaction outcomes. Typed gas-tube/collection connections are available, but oxygen generation/capture is not routed through them. Pour animations and physical fluid simulation are not implemented.
- Free-workbench users can override catalog solution molarity (0–20 M) for supported dissolved stocks. The selected concentration is validated and feeds the canonical mole calculation; water remains a solvent-volume addition.
- “New Workbench” creates a named, empty free canonical session. Existing local persistence, rename/duplicate, JSON export/import, observations, and undo/redo remain available. A reusable experiment-template authoring/export format is not implemented.
- Oxygen now renders through `LiquidScene` and stores reaction solids, product gas, and collection jar gas in the canonical workspace. Typed gas ports route O₂ through the delivery tube, subject to jar capacity. The original five user-triggered 20% conversion steps and 122.55 g/mol assumption remain. Collection volume uses ideal gas at 0 °C and 1 atm (22.414 L/mol).
- Session creation loads neutralization, precipitation, dilution, and oxygen through `experimentManifests` and `loadExperimentWorkspace`. The manifests carry apparatus and positions, initial inventory/connections, supported operations, instructions, reaction references, expected observations, completion criteria, and assumptions.
- Gas transfer is deterministic and capacity-limited; it does not model pressure, flow rate, heating rate, or kinetics. Supported dispensing requires compatible connected ports. A funnel transfer names its connected receiver. Animations follow committed scientific state.
- Browser tests now create a custom workbench, place four equipment items, perform an actual canvas pointer drag, rotate and nudge equipment, connect typed ports, add 10 mL of 0.1 M acid stock, transfer it, undo/redo, reload, and verify stored moles/volume/connections. They also open neutralization, oxygen, precipitation, and dilution routes, and exercise export/import and mobile viewport checks.
- Mobile visual review found the equipment creation row clipped at 390 px. The panel now wraps form controls and equipment cards; browser checks confirm the placement button remains within the viewport and save `artifacts/new-workbench-mobile.png` as the current visual reference.
- Latest verification: all 11 Node test files pass, including new manifest-loader coverage; lint, configured JS typecheck, production build, browser workflow, whitespace check, and npm audit pass. Audit reports 0 vulnerabilities. Build emits a 521.16 kB minified scene chunk warning. Browser WebGL uses headless Chromium SwiftShader, not a physical GPU.
- No Git commits exist. The branch is `codex/unified-scientific-sessions`; the initial 59-file baseline remains staged, milestone changes remain unstaged, and no files were discarded. A commit still requires the user's valid Git author name and email; none is configured, and none was invented.
