import { executeCommand, validateWorkspace } from "./engine.js";
/** @param {string} createdAt */
export function createFreeSession(createdAt) {
  if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)))
    throw new Error("Invalid session date");
  return {
    version: 1,
    createdAt,
    workspace: { objects: {}, connections: [], events: [] },
    past: /** @type {any[]} */ ([]),
    future: /** @type {any[]} */ ([]),
    notes: /** @type {string[]} */ ([]),
  };
}
/** @param {any} s */
export function validateFreeSession(s) {
  if (
    !s ||
    s.version !== 1 ||
    typeof s.createdAt !== "string" ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    !Array.isArray(s.notes) ||
    !s.notes.every(
      (/** @type {unknown} */ n) => typeof n === "string" && n.length <= 2000,
    ) ||
    !Array.isArray(s.past) ||
    !Array.isArray(s.future) ||
    s.past.length > 50 ||
    s.future.length > 50
  )
    throw new Error("Invalid free session");
  for (const w of [s.workspace, ...s.past, ...s.future]) {
    validateWorkspace(w);
    if (
      Object.keys(w.objects).length > 12 ||
      Object.keys(w.objects).some(
        (id) => !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id),
      )
    )
      throw new Error("Invalid workspace equipment");
  }
  return true;
}
/** @param {any} s @param {any} action */
export function dispatchFree(s, action) {
  try {
    validateFreeSession(s);
    if (!action || typeof action.type !== "string")
      throw new Error("Invalid command");
    const next = structuredClone(s);
    if (action.type === "note") {
      if (
        typeof action.text !== "string" ||
        !action.text.trim() ||
        action.text.length > 2000
      )
        throw new Error("Observation must be 1–2000 characters");
      next.notes.push(action.text.trim());
    } else if (action.type === "undo") {
      if (!next.past.length) throw new Error("Nothing to undo");
      next.future.push(next.workspace);
      next.workspace = next.past.pop();
    } else if (action.type === "redo") {
      if (!next.future.length) throw new Error("Nothing to redo");
      next.past.push(next.workspace);
      next.workspace = next.future.pop();
    } else {
      const before = structuredClone(next.workspace);
      if (action.type === "reset")
        next.workspace = { objects: {}, connections: [], events: [] };
      else {
        if (
          ![
            "place",
            "remove",
            "move",
            "add",
            "transfer",
            "mix",
            "measure",
            "react",
            "connect",
            "disconnect",
          ].includes(action.type)
        )
          throw new Error("Unsupported operation");
        next.workspace = executeCommand(next.workspace, action);
      }
      next.past.push(before);
      if (next.past.length > 50) next.past.shift();
      next.future = [];
    }
    validateFreeSession(next);
    return { ok: true, state: next, error: "" };
  } catch (e) {
    return {
      ok: false,
      state: s,
      error: e instanceof Error ? e.message : "Invalid command",
    };
  }
}
/** @param {any} s */
export function exportFreeNotebook(s) {
  validateFreeSession(s);
  return [
    "Materia — free exploration",
    `Created: ${s.createdAt}`,
    "",
    "Current equipment:",
    ...Object.values(s.workspace.objects).map(
      (/** @type {any} */ v) =>
        `- ${v.id}: ${v.kind}, ${v.volumeMl} mL, dissolved ${JSON.stringify(v.solutes)}, solids ${JSON.stringify(v.solids || {})}`,
    ),
    "",
    "Operation history:",
    ...s.workspace.events,
    "",
    "Observations:",
    ...s.notes,
    "",
    "Educational idealizations only; not a laboratory record.",
  ].join("\n");
}
