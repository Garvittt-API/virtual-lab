import { test } from "node:test";
import assert from "node:assert/strict";
import {
  neutralizationExperiment as manifest,
  validateExperiment,
  scoreAssessment,
} from "../src/experiment.js";
test("implemented manifest validates and rejects unsupported or invalid data", () => {
  assert.deepEqual(validateExperiment(manifest), []);
  assert.ok(validateExperiment({ ...manifest, model: "unknown" }).length);
  assert.ok(validateExperiment({ ...manifest, baseM: NaN }).length);
  assert.ok(validateExperiment({ ...manifest, questions: [] }).length);
});
test("assessment requires complete valid answers and provides deterministic feedback", () => {
  assert.throws(() => scoreAssessment(manifest.questions, []));
  assert.throws(() => scoreAssessment(manifest.questions, [1, 99]));
  assert.deepEqual(
    scoreAssessment(manifest.questions, [1, 0]).map((x) => x.correct),
    [true, false],
  );
});
