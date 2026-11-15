import { validateSession, guidedManifests } from "./guided.js";
import { validateFreeSession } from "./free.js";
import { loadNotebook, saveNotebook, addEntry } from "./notebook.js";
/** Import only existing notes and event text, never scientific state. Original keys are read-only. @param {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} storage @param {string} at */
export function importLegacyNotebook(storage, at) {
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at)))
    throw new Error("Invalid import date");
  let book = loadNotebook(storage);
  const sources = [
    ["materia-guided-v1", "guided"],
    ["materia-free-v1", "free"],
    ["materia-oxygen", "oxygen"],
    ["materia-session", "neutralization"],
  ];
  for (const [key, type] of sources) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const old = JSON.parse(raw);
    let events, notes, title;
    if (type === "guided") {
      validateSession(old);
      events = old.core.workspace.events;
      notes = old.core.experiment.notes;
      title = guidedManifests[old.core.experiment.id].title;
    } else if (type === "free") {
      validateFreeSession(old);
      events = old.workspace.events;
      notes = old.notes;
      title = "Free exploration";
    } else {
      if (
        !old ||
        !Array.isArray(old.events) ||
        !old.events.every(
          (/** @type {unknown} */ x) => typeof x === "string",
        ) ||
        typeof old.notes !== "string"
      )
        throw new Error(`Invalid legacy notebook in ${key}`);
      events = old.events;
      notes = old.notes ? [old.notes] : [];
      title = type === "oxygen" ? "Oxygen (legacy)" : "Neutralization (legacy)";
    }
    for (const [kind, values] of /** @type {Array<[string,string[]]>} */ ([
      ["event", events],
      ["observation", notes],
    ])) {
      for (const [i, text] of values.entries()) {
        if (!text.trim()) continue;
        const id = `import:${key}:${kind}:${i}`;
        if (book.entries.some((/** @type {any} */ e) => e.id === id)) continue;
        book = addEntry(book, {
          id,
          sessionId: `import:${key}`,
          experiment: title,
          at,
          kind,
          text,
        });
      }
    }
  }
  saveNotebook(storage, book);
  return book;
}
