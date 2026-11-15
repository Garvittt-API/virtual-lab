/** A versioned appendable notebook separate from undoable simulation snapshots. */
export const NOTEBOOK_KEY = "materia-notebook-v1";
export function emptyNotebook() {
  return { version: 1, entries: [] };
}
/** @param {any} book */
export function validateNotebook(book) {
  if (!book || book.version !== 1 || !Array.isArray(book.entries))
    throw new Error("Invalid notebook");
  const ids = new Set();
  for (const e of book.entries) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !e.id ||
      ids.has(e.id) ||
      typeof e.sessionId !== "string" ||
      !e.sessionId ||
      typeof e.experiment !== "string" ||
      !e.experiment ||
      typeof e.at !== "string" ||
      !Number.isFinite(Date.parse(e.at)) ||
      !["event", "observation"].includes(e.kind) ||
      typeof e.text !== "string" ||
      !e.text.trim() ||
      e.text.length > 5000
    )
      throw new Error("Invalid notebook entry");
    ids.add(e.id);
  }
  return true;
}
/** @param {any} book @param {any} entry */
export function addEntry(book, entry) {
  validateNotebook(book);
  const next = structuredClone(book);
  next.entries.push(structuredClone(entry));
  validateNotebook(next);
  return next;
}
/** @param {any} book @param {string} id @param {string} text */
export function editObservation(book, id, text) {
  validateNotebook(book);
  const next = structuredClone(book),
    entry = next.entries.find((/** @type {any} */ e) => e.id === id);
  if (!entry || entry.kind !== "observation")
    throw new Error("Observation not found");
  entry.text = text;
  validateNotebook(next);
  return next;
}
/** @param {any} book @param {string} id */
export function removeObservation(book, id) {
  validateNotebook(book);
  const next = structuredClone(book),
    i = next.entries.findIndex(
      (/** @type {any} */ e) => e.id === id && e.kind === "observation",
    );
  if (i < 0) throw new Error("Observation not found");
  next.entries.splice(i, 1);
  return next;
}
/** @param {any} book @param {'text'|'markdown'} format */
export function exportNotebook(book, format) {
  validateNotebook(book);
  if (!["text", "markdown"].includes(format))
    throw new Error("Unsupported export");
  return [
    format === "markdown" ? "# Materia notebook" : "Materia notebook",
    ...book.entries.map(
      (/** @type {any} */ e) =>
        `${format === "markdown" ? "- " : ""}${e.at} | ${e.experiment} | session ${e.sessionId} | ${e.kind}: ${e.text}`,
    ),
  ].join("\n");
}
/** Read without overwriting invalid data. @param {{getItem:(key:string)=>string|null}} storage */
export function loadNotebook(storage) {
  const raw = storage.getItem(NOTEBOOK_KEY);
  if (raw === null) return emptyNotebook();
  const book = JSON.parse(raw);
  validateNotebook(book);
  return book;
}
/** @param {{setItem:(key:string,value:string)=>void}} storage @param {any} book */
export function saveNotebook(storage, book) {
  validateNotebook(book);
  storage.setItem(NOTEBOOK_KEY, JSON.stringify(book));
}
/** @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage @param {any} entry */
export function appendNotebook(storage, entry) {
  const next = addEntry(loadNotebook(storage), entry);
  saveNotebook(storage, next);
  return next;
}
