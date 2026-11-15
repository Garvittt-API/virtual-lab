# Product research: universal chemistry workbench

**Basis and evidence.** Product goals below are the project owner's supplied description of the [reference URL](https://chemistry-en.nobook.com/console/templates/resource), not independently observed NOBOOK behavior. No browser was opened; no reference interaction, screenshot, assets, scale, or feature parity was verified. Current product claims are sourced to the checkout audited in [CURRENT_ARCHITECTURE_AUDIT.md](CURRENT_ARCHITECTURE_AUDIT.md), commit `94c7181`. Recommendations are proposals, not shipped features. No proprietary content or assets are needed.

## Product concept

One resource discovery experience launches **one workbench application** using a versioned experiment template. New Workbench launches that same application with an empty template and an open interaction policy. Each launch creates or reopens an independently identifiable session; “one state” means one authoritative state *per session*, not all learners sharing one inventory. Mode changes may alter guidance/allowed operations but never swap scientific engines or duplicate inventory. Existing sessions must remain accessible while migrating.

### Resource library and detail

- Search and combine category, education level, difficulty, duration, required apparatus, available operations, safety and reviewed status; sort relevance/title/duration and provide clear empty/offline/error states. Cards display title, licensed/original preview, category, level, difficulty, duration, concise summary, apparatus/substance counts and status. No promise of hundreds until authored and reviewed.
- Detail presents objectives, prerequisites, digital safety, equipment and substances, scientific model/assumptions, model support and known limitations, estimated time, instructions/assessment preview and launch. Distinguish **ready**, **model-limited**, **not yet supported** and **draft**. Accessibility and educational-level metadata are part of authoring and review, not inferred.
- “Start” creates a new session; “Resume” chooses an existing one. Do not silently overwrite a previous attempt. “New Workbench” is prominent alongside catalog entries and launches the same session/scene with no prescribed apparatus.

### Universal workbench interactions

| Intent | Product behavior | Scientific boundary |
|---|---|---|
| Place, select, inspect | Drag palette item or choose + place by click/tap/keyboard; select stable instance ID; inspect real contents and operations. | Preview is ephemeral; commit validates capacity, position and support. |
| Arrange and connect | Move/rotate; show candidate ports and compatible/incompatible feedback; snap only after validation. Provide direct numeric and non-drag controls. | Visual proximity alone is not a valid fluid or electrical connection; ports/types/direction/occupancy are domain constraints. |
| Load and transfer | Choose substance/stock, source, destination, quantity and units; pouring animation may express a confirmed operation. | State and conservation come from the command result, never particle color/geometry; reject unsupported transfers. |
| Mix, measure, react | Explicit operation, instrument and quantity; show determined value, units, conditions, uncertainty/model label; user observation is separate. | Only implemented, approved models execute. Unsupported operations remain visible but disabled with reason. |
| Heat/cool and observe | Enable only explicitly modeled bounded scenarios; temperature only when supported. | A glowing burner, bubbles, or vapor animation does not predict heat, kinetics, pressure or real yield. |
| Recover and record | Undo/redo with clear semantics, reset confirmation, local save/resume, notebook with observations/export. | Notebook audit is independent of reversible scientific state; restoring snapshots must not erase user notes. |

**Accessibility requirement:** W3C WCAG 2.2 calls for a single-pointer alternative to dragging in applicable cases; keyboard accessibility is separately required [1](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Preserve native zoom outside the viewport, offer numeric positioning, readable apparatus lists, focus order/status and a non-WebGL equivalent; validate on real devices rather than infer from source.

## Representative journeys and success states

1. **Discover → guided:** search “dilution,” filter level, inspect model and safety, launch a new attempt, acknowledge safety, measure/transfer actual amounts, inspect calculated concentration, record observations, complete assessment, close/reopen same session and export a notebook. Invalid actions give a reason without changing inventory.
2. **New Workbench:** start empty, place a beaker and flask, select stock, input volume, transfer and mix, inspect state, add observation, save a named session, leave and resume. A template can later be saved deliberately, with validated initial setup rather than silently copying private observations/history.
3. **Recovery:** if migration fails or storage quota is exhausted, present actionable error/export and keep legacy originals. Never replace invalid source with blank content and silently save over it.
4. **Teacher/author (future):** filter reviewed resources, assign a version-pinned activity and review submitted results; author edits a draft manifest, validates supported model, documents safety/data provenance, requests scientific/educational review, then publishes. Requires identity, authorization and privacy architecture not currently present.

## Product decisions to validate with users

The desired education levels, classroom workflow, content licensing, offline/sync expectations, device/performance floor, supported languages, precision/assessment grading, and distinction between physical simulation and animation are not yet established. Research with teachers/students and a domain reviewer before making safety or efficacy claims. Digital-only simulations do not replace supervision or a real laboratory safety procedure.
