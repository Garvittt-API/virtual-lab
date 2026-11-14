# Materia — virtual chemistry lab

An early, open-source educational chemistry workspace. The current vertical slice is a guided ideal strong-acid/strong-base neutralization experiment, with an interactive Three.js scene. This is not a complete laboratory platform or a scientifically reviewed teaching resource.

## Run locally

Requirements: Node.js 22.17+ and npm (the browser-test dependencies require Node 22). This checkout originally contained only a README; there was no existing pnpm workspace to preserve.

```sh
npm ci
npm run dev
# open the address printed by Vite
```

Run `npm test` for calculation and manifest tests, `npm run lint` for ESLint, `npm run typecheck` for JavaScript type checking of the chemistry and experiment modules, and `npm run build` for a production static build. `npm run test:browser` runs a headless Chromium workflow on Linux; it requires Chromium system libraries including NSS and NSPR. Screenshots are written to the ignored `artifacts/` directory. Serve `dist/` using any static web server (with HTTPS for production). No server, database, authentication, or deployment configuration is provided. Session and bookmark data are stored in the browser's localStorage, not synced or protected across users. Do not store sensitive data there.

## Current workflow

Discover the experiment, enter the lab, drag apparatus or orbit the scene, add base using the procedure button, and review calculated results. Use the apparatus controls to move or rotate the selected object, or drag it on the bench. A short ungraded knowledge check is available in the lab. Undo/redo and reset affect the session; the notebook records additions, accepts notes, and exports a text file. A bookmark is local to the browser. Mobile layout and touch pointer interaction are implemented but have not been device-tested.

## Model and safety

The model calculates the pH of fully dissociated monoprotic strong acid and base solutions at 25 °C, including water autoionization and assuming additive volumes. It does not predict activity, temperature, indicator response, or experimental uncertainty. The liquid color is a qualitative visual cue, not a quantitative indicator model. Numerical reference tests are software checks, not independent scientific review. This is a digital simulation; real chemistry requires appropriate supervision and safety procedures.

See [implementation progress](docs/implementation/AUTONOMOUS_PROGRESS.md) for the audit, scope, verification and next steps. Original procedural equipment geometry and AI-generated hero illustration were created for this project; no NOBOOK assets or source were copied.
