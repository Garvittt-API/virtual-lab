// Declarative data for the implemented strong-acid/strong-base activity.
export const neutralizationExperiment = Object.freeze({
  id: "strong-acid-base",
  title: "Acid-base neutralization",
  version: 1,
  model: "strong-monoprotic-neutralization-25C",
  acidMl: 25,
  acidM: 0.1,
  baseM: 0.1,
  maxBaseMl: 50,
  incrementMl: 5,
  apparatus: ["conical flask", "burette and stand", "beaker"],
  chemicals: ["hydrochloric acid solution", "sodium hydroxide solution"],
  equation: "HCl + NaOH → NaCl + H₂O",
  assumptions:
    "Complete dissociation, additive volumes, ideal activities, and 25 °C.",
  safety:
    "Digital simulation only. Real acids and bases can be hazardous and require suitable protection and supervision.",
  questions: [
    {
      id: "equivalence",
      prompt:
        "How much 0.1 M NaOH is required to react with 25.0 mL of 0.1 M HCl?",
      options: ["12.5 mL", "25.0 mL", "50.0 mL"],
      answer: 1,
      explanation:
        "Both solutions have the same concentration and react 1:1, so equal volumes contain equal amounts.",
    },
    {
      id: "ph",
      prompt:
        "In this ideal model, what is the pH at the equivalence point at 25 °C?",
      options: ["1", "7", "13"],
      answer: 1,
      explanation:
        "No strong acid or base is in excess; water autoionization gives pH 7 at 25 °C.",
    },
  ],
});
/** Validate untrusted manifest fields before use.
 * @param {any} m
 * @returns {string[]}
 */
export function validateExperiment(m) {
  const errors = [];
  if (!m || typeof m !== "object") return ["Manifest must be an object"];
  if (typeof m.id !== "string" || !m.id.trim()) errors.push("Missing id");
  if (m.model !== "strong-monoprotic-neutralization-25C")
    errors.push("Unsupported model");
  for (const key of ["acidMl", "acidM", "baseM", "maxBaseMl", "incrementMl"])
    if (!Number.isFinite(m[key]) || m[key] <= 0)
      errors.push(`${key} must be positive and finite`);
  if (
    !Array.isArray(m.questions) ||
    !m.questions.length ||
    m.questions.some(
      (/** @type {any} */ q) =>
        !q.prompt ||
        !Array.isArray(q.options) ||
        !Number.isInteger(q.answer) ||
        q.answer < 0 ||
        q.answer >= q.options.length ||
        !q.explanation,
    )
  )
    errors.push("Invalid questions");
  return errors;
}
/** @param {Array<{options: string[], answer: number, explanation: string}>} questions
 * @param {number[]} answers
 */
export function scoreAssessment(questions, answers) {
  if (
    !Array.isArray(questions) ||
    !Array.isArray(answers) ||
    questions.length !== answers.length ||
    answers.some(
      (a, i) =>
        !Number.isInteger(a) || a < 0 || a >= questions[i].options.length,
    )
  )
    throw new RangeError("Answer every question with a valid option");
  return questions.map((question, i) => ({
    correct: answers[i] === question.answer,
    explanation: question.explanation,
  }));
}
