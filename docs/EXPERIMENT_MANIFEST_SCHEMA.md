# Experiment manifest schema v2

Authored experiments are plain JSON data. The `schemaVersion` is `2`; the versioned export envelope has `format: "materia-experiment"` and `exportVersion: 1`. Schema v1 definitions can be migrated to v2. Unknown schema or export versions are rejected. Imports are limited to 1 MB and stored libraries to 5 MB.

## Definition fields

- `id`: stable lowercase identifier matching `[a-z][a-z0-9-]{1,63}`.
- `title`, `description`, `subject`, `topic`: bounded plain text.
- `educationLevel`: `middle-school`, `high-school`, `undergraduate`, or `general`.
- `difficulty`: `introductory`, `intermediate`, or `advanced`.
- `learningObjectives`, `requiredKnowledge`: plain text arrays.
- `apparatus`: registry `kind`, unique stable `id`, and finite `[x,y,z]` bench position (maximum 12 objects).
- `initialChemicals`: equipment ID, registered stock ID, positive volume in mL, and optional concentration in mol/L. The engine checks quantities and vessel capacity.
- `initialConnections`: equipment IDs and registered port names. The existing connection engine checks port compatibility and duplicate use.
- `supportedOperations`: declared operations; instruction commands must be declared and belong to the fixed operation allowlist.
- `reactionIds`: currently `neutralization` or `precipitation`, checked against the engine reaction definitions.
- `instructions`: 1–40 stable-ID, plain-text steps with a fixed command object. JavaScript, HTML, and arbitrary executable code are not supported.
- `expectedObservations`, `measurements`, `scientificAssumptions`, `safetyWarnings`, `completionCriteria`, `assessmentQuestions`, `estimatedDurationMinutes`, `metadata`, and explicit `draft`/`published` `status`.

Validation errors block publication. Warnings provide author feedback but do not silently change the experiment. See [scientific validation](SCIENTIFIC_VALIDATION.md) for scope and limitations.
