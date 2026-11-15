# Implementation roadmap: dependency-first, no fabricated capabilities

This is a proposal, not completion status. Numbers are dependency stages, not an estimate. Multiple incremental commits can coexist; protect current screens/saves until their replacements pass equivalence and migration gates. For the target architecture, see [UNIVERSAL_WORKBENCH_ARCHITECTURE.md](UNIVERSAL_WORKBENCH_ARCHITECTURE.md).

## Stage 1 — canonical laboratory architecture

- **Dependencies:** current audit/baseline and agreed state/units/legacy mapping. Start with existing liquid workflows, not oxygen gas physics guessed in advance.
- **Deliverables:** one validated versioned session envelope per attempt, stable IDs, a single atomic command/session controller and notebook transaction, pure state/model boundary, version-pinned manifest policy, explicit backward-compatible read-only legacy import/recovery. Adapt guided and free UIs to the same session schema/controller and renderer; preserve old behavior. Then extend phase model with solid/gas and migrate legacy oxygen and neutralization, all three guided flows and calculation exercises to one runner, in separate reviewed increments.
- **Likely files:** `src/lab/engine.js`, `guided.js`, `free.js`, `notebook.js`, `import-notes.js`, `src/simulation/runner.js`, `reactions.js`, `src/{GuidedLab,FreeLab,LiquidLab,OxygenLab,ReactionExercises,main}.jsx`, `src/oxygen.js`, `src/chemistry.js`; add domain session/persistence/migration modules and tests.
- **Technical risk:** cross-key partial writes, React state bypasses, invalid legacy data overwrite, double execution, session changes on navigation, history loss, version skew. **Scientific risk:** phase/concentration mismatch, double-counting reacted inventory or gas, loss of 25 °C pH / legacy oxygen conversion semantics.
- **Tests:** schema invariants, mode-independent identical command sequences, invalid atomicity, deterministic undo/redo, notebook survival, multiple saved sessions, migration fixtures for guided/free/liquid/oxygen/neutralization at valid boundaries, corrupted/unknown versions and write-fault injection. Verify 0–5 oxygen conversions against `oxygenYield`, neutralization across 0–50 mL against `neutralization`, guided precipitation/dilution amounts, source byte preservation and reload. Include automated UI/scene checks in a capable environment, never claim they ran in Arena.
- **Acceptance (full stage):** all named activities operate through one runner/controller and one inventory per session; saved sessions reopen with same state/notebook and no data loss; legacy source keys remain recoverable; reproducible calculations match baselines; all tests/checks pass and scientific model limitations are visible. This is larger than the next implementation slice below.
- **Do not yet:** delete legacy data/screens, force migration of uncertain data, invent gas/heat physics, replace stoichiometric kernel or build hundreds of manifests.

### Recommended first implementation milestone: canonical *liquid* session slice

1. Introduce one versioned session object with stable `sessionId`, revision, one workspace inventory, progress/policy, notebook and undo/redo, using the existing `lab/engine.js` and reaction functions. Define storage transaction boundary and keep older keys unchanged.
2. Switch **both** existing Guided and Free screens to the same session controller, session format, workspace operations, notebook service and `LiquidScene`. Opening a saved guided session in free policy or back must keep the same explicit session ID and actual inventory; support new/independent attempts, not a global shared bench. Preserve three guided workflows and current free-mode actions, including guidance, notes, export and undo.
3. Provide deterministic, idempotent **copy migrations** from valid `materia-guided-v1` and `materia-free-v1` including valid histories and notes; validate both source/target, retain old source bytes; failures and unavailable storage show recoverable error and never overwrite originals. Preserve existing shared notebook entries and link when evidence is sufficient; do not infer unknown session identities/timestamps. Legacy oxygen/neutralization remain accessible and clearly unconverted for this slice.
4. Test guided/free round-trip of the **same** session ID and object inventory, no duplicate inventory fields, rendering adapter purity, actual non-default amounts, policy rejection, capacity/negative/bad units atomicity, all three experiments, free use, state/history/notebook persistence, note-independent undo/redo, branching, corrupted/future version, quota/transaction abort/retry and exact legacy byte preservation. Validate reload/reopen from saved state and all existing 53 tests without weakening.
5. Run `npm test`, lint, limited typecheck (expand coverage for new domain), build, audit and `git diff --check`. Document assumptions and migration failures. Do not claim browser verification; have a developer manually test launch/switch/resume, drag, notes, reset, export and narrow-screen interactions outside this environment.

**First-slice exit criterion:** all five points above work in the actual UI and tests, not only adapter fixtures. This is partial Stage 1; oxygen, legacy neutralization, calculation runner and universal persistence are explicitly not accepted as migrated until subsequent increments. A shared helper alone does not pass.

## Stage 2 — universal 3D workbench

- **Dependencies:** Stage 1 state/controller contracts; preserve `LiquidScene` while extracting renderer.
- **Deliverables/files:** shared scene manager/view adapter and stable object map from `src/LiquidScene.jsx`, `Scene.jsx`, `OxygenScene.jsx`; selection, placement, move/rotate, accessible non-drag control, port snap preview + validated connect; reuse existing procedural assets.
- **Risks:** camera/drag capture conflicts, resource leaks, collision false positives, inaccessible gestures; **science:** rendering may imply a transfer or stability never simulated.
- **Tests:** pure transform/projection/connection rules, renderer does not mutate scientific state, setup/teardown; external manual desktop/touch/WebGL failure/accessibility and mobile verification.
- **Acceptance:** guided and free use same scene/controller and persistent state; compatible/incompatible connection and cancel behavior demonstrable; no visual outcome changes chemistry. **Not yet:** realistic fluid dynamics or claimed support for unimplemented apparatus.

## Stage 3 — equipment and chemical libraries

- **Dependencies:** Stage 1 versioned identities/phase contracts; port policy from Stage 2 can evolve in parallel.
- **Deliverables/files:** `lab/registry.js`, `simulation/substances.js`, curated versioned definitions, compatibility/capabilities and provenance; start with current five equipment/known species, add oxygen tube/burner/collector explicitly before migration; unit conversion helpers.
- **Risks:** invalid definitions, trademark/licensing, incomplete hazardous data; **science:** density, molar mass/phase/concentration and stock identity must be conditional, not fabricated.
- **Tests:** unique IDs, finite ranges, link/version integrity, reciprocal compatibility, missing-property disable, unit round trips and reference vectors. **Acceptance:** every enabled operation has a tested capability contract and labeled limitations. **Not yet:** enable pipettes, pH meters or advanced equipment just because geometry exists.

## Stage 4 — physical and chemical operations

- **Dependencies:** stages 1 and 3; Stage 2 supplies interaction feedback but scientific operations remain headless.
- **Deliverables/files:** extend `lab/engine.js`, `simulation/reactions.js` and reviewed process/instrument modules for conserved transfers, oxygen ideal solid→gas conversion/capture, measurement, bounded phase-aware reactions; add other operations only as explicitly modeled.
- **Risks:** order/atomicity, precision and unsupported combinations; **science:** additive volume, complete AgCl precipitation, equilibrium, kinetics, heating and gas capture have limited validity.
- **Tests:** mass/atom/charge where model permits, exact extent, source/destination capacities, fractional conversion, missing model, reversibility/replay and independently sourced numerical reference cases. **Acceptance:** no output outside declared model and independently reviewed model/data before scientific validation claim. **Not yet:** general-purpose reaction prediction, distillation, electrolysis or thermal/fluid simulation without data/model review.

## Stage 5 — experiment manifest system

- **Dependencies:** Stage 1 controller/runner; Stage 3 registry; Stage 4 required operations.
- **Deliverables/files:** versioned manifest schema, validator, data-only predicates, capabilities, safety, expected observations, calculation/assessment and completion; migrate `guided.js`, `simulation/runner.js`, `experiment.js`, oxygen and legacy neutralization declaratively, preserving legacy semantics.
- **Risks:** untrusted scripts, invalid references, hardcoded experiment branches, changing existing sessions; **science:** incorrect expected observations/answers for variable student quantities.
- **Tests:** validate malformed/unknown/version/size data, execute all 4 supported scientific workflows through same session, varied input, acknowledgements, assessment, completion, reset and migration. **Acceptance:** manifest data + generic policy/commands drive each supported experiment, version-pinned and reproducible; no experiment-specific branch. **Not yet:** public arbitrary user-authored executable logic.

## Stage 6 — resource library

- **Dependencies:** Stage 5 published metadata and launch API; accessibility/performance UX design may begin earlier.
- **Deliverables/files:** replace hardcoded `main.jsx` cards with catalog data/index, search/filter/sort, detail, original/licensed previews, supported/draft labels and session-aware launch/resume.
- **Risks:** stale indexes, content/asset rights, search scale; **science:** unreviewed resources may look production-ready.
- **Tests:** searchable metadata, combined filter/sort, pagination/empty/error, validated launch/version, keyboard/accessibility and content review. **Acceptance:** real reviewed catalog entries launch correct template into universal workbench, large-index test data without shipping fake experiments. **Not yet:** claim hundreds of reviewed experiments or load unsupported manifests as functional.

## Stage 7 — New Workbench and custom templates

- **Dependencies:** stages 1–3 and 5; stage 6 makes discovery prominent.
- **Deliverables/files:** empty manifest/policy, named multi-session creation, save/reopen/list/export/import and validated custom template builder; free mode remains same controller and notebook.
- **Risks:** overwriting sessions, local quota, untrusted import, private data leakage in templates; **science:** a custom combination may not have a model.
- **Tests:** create independent workspaces, reload, session/template round trips, immutable template copy, version mismatch/quota/conflict and malicious input. **Acceptance:** same workbench and scientific engine as predefined runs; saved session continues exactly and unsupported operations explain why. **Not yet:** unrestricted script execution, template publication or cloud claims.

## Stage 8 — complete experiment library (iterative content program)

- **Dependencies:** reviewed Stage 5 manifests and Stage 4 models for each topic, not merely UI availability.
- **Deliverables/files:** curriculum taxonomy, version-pinned curated school/high-school/undergraduate/advanced resources, original/licensed content and reviewed worked examples.
- **Risks:** misleading scale/rights, review capacity; **science:** equilibrium, quantitative thermal, advanced instrumentation and hazards require separate validated models.
- **Tests:** per-manifest schema/reference tests, end-to-end supported actions, scientific/educational signoff, data licensing, accessibility and curriculum checks. **Acceptance:** each published resource has reproducible, reviewed model and explicit limitations; unsupported topics remain drafts. **Not yet:** bulk placeholders, generic reactions, automatic unsafe instructions.

## Stage 9 — learning platform

- **Dependencies:** Stage 1 notebook/session reliability, Stage 5 assessment, identity/privacy design.
- **Deliverables/files:** unified student progress/assessment/feedback and eventually teacher classrooms, assignments/submissions and author review; server/API/authorization only when requirements and deployment are approved.
- **Risks:** minors' privacy, authorization, grading fairness, offline conflicts; **science:** misleading automated grading for open-ended observations.
- **Tests:** roles/consent/isolation, review workflow, assessment correctness, offline conflict/retry, export/deletion, audit trail; usability research. **Acceptance:** documented privacy/security and teacher/student workflows, scientifically appropriate grading. **Not yet:** collecting sensitive learner data or promising classroom/cloud support in local-only app.

## Stage 10 — production readiness

- **Dependencies:** relevant preceding stages and real device/testing environments.
- **Deliverables/files:** CI, deployment configuration, security and dependency policy, monitoring without private-data leakage, accessibility/mobile support, documented backup/recovery, performance budgets and disaster recovery; refine Vite/Three chunk only after profiling.
- **Risks:** infrastructure, WebGL loss, third-party licenses, browser eviction, cross-tab conflicts; **science:** stale models/data without version pinning or reviewer ownership.
- **Tests:** unit/property/integration, supported-browser and real-device interaction, accessibility audit, load/performance profiling, security/threat modeling, migration fault injection, deployment/restore drills, scientific review and release signoff. **Acceptance:** agreed measurable service/device/quality targets met with evidence and documented model limitations. **Not yet:** deployment/validation claims before checks actually run.

## Safe parallelism and gates

After session schema/capability contracts are agreed, scene extraction (2), definition/provenance research (3), schema authoring design (5), resource UX (6), accessibility and threat modeling (10) can proceed in parallel behind interfaces; science implementation (4), production publication (8) and classroom data (9) remain gated by their dependencies. Stage 7 shares Stage 1–3 foundations, not a second engine. Any UI changes to active screens merge only with compatibility/migration tests. A scientific expert and a device/browser-capable reviewer must sign off relevant model and visual claims independently.
