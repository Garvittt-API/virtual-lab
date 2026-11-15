# Persistence and migration

## Current store

The `materia-lab-sessions-v2` localStorage value contains a version-1 collection envelope with `activeId`, canonical version-2 sessions, and migration markers. Each session stores its mode, experiment identity/progress, workspace, undo/redo core snapshots, timestamps, and session-linked notebook. Notebook observations live outside the undo snapshots.

Current session JSON export/import validates the envelope and session before adding it. Import assigns a fresh session ID and remaps notebook entry IDs and session IDs. Duplication also creates a fresh identity while retaining workspace and history.

## One-time legacy sources

| Source key | Mapping | Provenance marker |
|---|---|---|
| `materia-guided-v1` | Canonical guided workspace, progress, history and notes | source version 1 |
| `materia-free-v1` | Canonical free workspace, history and notes | source version 1 |
| `materia-oxygen` | Oxygen protocol, transforms, step progress, reconstructed stoichiometric ledger, events and observation | source version 1 |
| `materia-session` | Canonical acid/base inventory, one reaction execution, pH result, transforms compatibility payload, events and observation | source version 1 |
| `materia-liquid` | Canonical free workspace and event history | source version 1 |

All mappings add a `session.migration` record with migration version, source key/version, and import timestamp. The source keys are never removed or rewritten. A marker prevents repeat import; deterministic IDs make retries after a failed store write stable. All present sources are validated and copied in memory before the new session store is written. A failure to parse, validate, save, or recognize a format leaves the source data intact and does not save a partial store.

Legacy formats did not record per-event timestamps or durable session IDs. Their events and notes therefore receive the migration timestamp and new canonical session ID. Legacy neutralization's original apparatus transforms and base volume are also kept in a compatibility field. The old global notebook remains a separate historical store.

## Recovery and limits

Malformed JSON, invalid state, unsupported fields, duplicate migration IDs, and storage quota/write errors stop migration with an error. No automatic recovery/export UI is provided for malformed localStorage yet; the old keys remain available for manual recovery. localStorage is device/browser scoped, may be cleared by the user/browser, has quota limits, and is not an account sync or backup system. There is no cross-tab conflict control.
