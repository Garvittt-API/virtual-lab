# Materia — virtual chemistry lab

Materia is an early, open-source educational chemistry workspace. Current experiment routes use a shared canonical local session, a Three.js workbench, guided/free policies, and a session-aware notebook. It is not a complete laboratory platform, independently scientifically reviewed, or production-ready.

## Run locally

Requirements: Node.js 22.17+ and npm.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
# open http://localhost:5173/
```

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` for project checks. `npm run test:browser` launches headless Chromium on Linux and requires the system libraries needed by Chromium. It exercises the two current Discover workflows using SwiftShader WebGL and writes screenshots to ignored `artifacts/`.

The web app has no backend, database, authentication, deployment configuration, or cloud synchronization. Scientific sessions, legacy migration copies, and bookmarks live in localStorage on this browser. They are not account-isolated or backed up; do not store sensitive data there.

## Current experiments and sessions

Discover launches acid-base neutralization and oxygen from decomposition. Reaction exercises can launch those plus ideal AgCl precipitation and NaCl dilution. Guided and free entry points, the old Liquid workspace route, and the oxygen activity use `SessionWorkbench`, `dispatchLab`, and a session-linked notebook. Legacy `materia-oxygen`, `materia-session`, and `materia-liquid` data is validated and copied once to the canonical session store; original keys remain unchanged.

The oxygen experiment retains its five manually triggered 20% conversion steps, 1.00 g KClO₃ model, 3:2 O₂ stoichiometry, complete capture assumption, and ideal gas volume at 0 °C and 1 atm. It now stores a derived material ledger inside the canonical session; the apparatus connection is still an activity-specific compatibility flag, and bubbles/displacement remain illustrative.

Legacy neutralization retains the 25.0 mL 0.1 M HCl starting volume, entered NaOH volume, charge-balance pH at 25 °C, and excess-reactant result. Migration materializes the aqueous inventory and applies the balanced reaction once. Current guided neutralization also calculates pH from remaining inventory after reaction.

## Model and safety

The models assume ideal educational chemistry. Neutralization assumes full dissociation, monoprotic strong acid/base, charge balance and additive volume. Precipitation assumes complete AgCl formation without Ksp/equilibrium. Dilution assumes additive volumes and immediate mixing. Oxygen assumes no side reactions, manually set conversion and ideal gas capture. No independent scientific validation is claimed. This is a digital simulation, not real-world lab instruction; hazardous materials and procedures require qualified supervision.

## Architecture and limits

See [architecture](docs/ARCHITECTURE.md), [scientific models](docs/SCIENTIFIC_MODELS.md), [persistence and migration](docs/PERSISTENCE.md), [roadmap](docs/ROADMAP.md), and [implementation progress](docs/PROGRESS.md). The calculation-runner module remains as a compatibility API for software tests; the product UI no longer invokes that in-memory workflow. The global legacy notebook is still separate from session notebooks. There are no accounts, teacher/classroom workflows, authoring system, deployment pipeline, or independent science review.
