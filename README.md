# Materia — virtual chemistry lab

An early, open-source educational chemistry workspace. The current vertical slice is a guided ideal strong-acid/strong-base neutralization experiment, with an interactive Three.js scene. This is not a complete laboratory platform or a scientifically reviewed teaching resource.

## Run locally

Requirements: Node.js 22.17+ and npm (the browser-test dependencies require Node 22). This checkout originally contained only a README; there was no existing pnpm workspace to preserve.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
# open http://localhost:5173/
```

Run `npm test` for calculation and manifest tests, `npm run lint` for ESLint, `npm run typecheck` for JavaScript type checking of the chemistry and experiment modules, and `npm run build` for a production static build. `npm run test:browser` runs a headless Chromium workflow on Linux; it requires Chromium system libraries including NSS and NSPR. Screenshots are written to the ignored `artifacts/` directory. Serve `dist/` using any static web server (with HTTPS for production). No server, database, authentication, or deployment configuration is provided. Session and bookmark data are stored in the browser's localStorage, not synced or protected across users. Do not store sensitive data there.

## Current workflow

Discover the experiment, enter the lab, drag apparatus or orbit the scene, add base using the procedure button, and review calculated results. Use the apparatus controls to move or rotate the selected object, or drag it on the bench. A short ungraded knowledge check is available in the lab. Undo/redo and reset affect the session; the notebook records additions, accepts notes, and exports a text file. A bookmark is local to the browser. Mobile layout and touch pointer interaction are implemented but have not been device-tested.

## Model and safety

The model calculates the pH of fully dissociated monoprotic strong acid and base solutions at 25 °C, including water autoionization and assuming additive volumes. It does not predict activity, temperature, indicator response, or experimental uncertainty. The liquid color is a qualitative visual cue, not a quantitative indicator model. Numerical reference tests are software checks, not independent scientific review. This is a digital simulation; real chemistry requires appropriate supervision and safety procedures.

See [implementation progress](docs/implementation/AUTONOMOUS_PROGRESS.md) for the audit, scope, verification and next steps. Original procedural equipment geometry and AI-generated hero illustration were created for this project; no NOBOOK assets or source were copied.

## Oxygen simulation (early implementation)

The discovery page also offers an idealized decomposition exercise: arrange the three original procedural apparatus models, connect the pre-defined vessels, load a fixed virtual amount of KClO₃, then advance conversion in fixed increments. The simulated collection volume assumes complete capture and an ideal gas at 0 °C and 1 atm. The flame, bubbles and displacement are illustrations, not a thermal, kinetic or fluid simulation. The exercise has its own locally stored notes and text export. Its controls and scene are not yet browser-verified or independently scientifically reviewed.

The assumed equation and 3:2 molar ratio are described in [Chemistry LibreTexts, decomposition reactions](https://chem.libretexts.org/Courses/Modesto_Junior_College/Chemistry_150_-_Bunag/Textbook_for_Chemistry_150/11:_Introduction_to_Chemical_Reactions/11.05:_Some_Types_of_Chemical_Reactions); the 100 g reference calculation used in a unit test is also shown by [Infinity Learn](https://infinitylearn.com/surge/potassium-chlorate-formula/). These references do not constitute independent review of this implementation. This exercise is digital only; potassium chlorate is a strong oxidizer and the scene is not a safe real-world procedure.

## Liquid workspace

Select **Liquid workspace** in the sidebar to explore a small reusable liquid-state foundation: add water or 0.1 M NaCl, transfer a measured volume between two vessels, inspect concentration, connect a funnel logically, and undo/redo. Data is stored locally. It assumes ideal additive volumes and instantaneous mixing, and it does not simulate reactions or real fluid flow. The scene has not been visually verified; please manually inspect it. See [engine architecture](docs/implementation/LAB_ENGINE.md) and the progress tracker for limitations.
