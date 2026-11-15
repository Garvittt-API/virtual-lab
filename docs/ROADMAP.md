# Roadmap

## Completed in this milestone

- Oxygen and neutralization routes use the canonical `SessionWorkbench` and `dispatchLab` session controller.
- One-time deterministic imports copy the old oxygen, neutralization, and liquid workspace keys into the canonical store without modifying source keys.
- Oxygen progression stores a validated stoichiometric inventory ledger alongside its apparatus protocol.
- Legacy neutralization quantities become vessel inventory and one shared reaction result; legacy pH/excess calculation is retained.
- Reaction exercise and liquid workspace entry points now route through canonical sessions.
- Current session notebook, undo/redo, export/import, duplicate/rename, and local persistence are exercised in browser automation.

## Next engineering work

1. Resolve Git author identity and commit the staged baseline plus this coherent migration increment.
2. Replace the oxygen boolean connection flag with general typed apparatus topology and represent its gas output through the common workspace equipment/inventory model.
3. Merge legacy global notebook records into canonical sessions without duplicating their current compatibility view.
4. Replace the calculation-only runner compatibility module with a manifest adapter over canonical commands; add migration for any external consumers before changing its public API.
5. Add schema-version migration for future canonical session revisions and improve malformed-save export/recovery UI.
6. Add cross-tab conflict detection, durable browser storage, and optional server persistence before introducing accounts.
7. Expand supported equipment and instruments, then add scientifically reviewed experiments one workflow at a time.
8. Complete keyboard/touch accessibility review, renderer context-loss recovery, profiling, security review, and production deployment configuration.

This project is not production-ready. It has no backend, authentication, classroom roles, deployment pipeline, or independent scientific review.
