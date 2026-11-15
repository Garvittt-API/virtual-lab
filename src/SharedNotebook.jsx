import React, { useState } from "react";
import { SESSION_STORE_KEY, validateStore } from "./lab/session-store";
import { importLegacyNotebook } from "./lab/import-notes";
import {
  loadNotebook,
  saveNotebook,
  editObservation,
  removeObservation,
  addEntry,
  exportNotebook,
} from "./lab/notebook";
function read() {
  try {
    return { book: loadNotebook(localStorage), error: "" };
  } catch {
    return {
      book: null,
      error:
        "The shared notebook could not be read. Existing data has not been overwritten.",
    };
  }
}
function readSessionBooks() {
  try {
    const raw = localStorage.getItem(SESSION_STORE_KEY);
    if (raw === null) return { sessions: [], error: "" };
    const store = JSON.parse(raw);
    validateStore(store);
    return { sessions: store.sessions, error: "" };
  } catch {
    return {
      sessions: [],
      error:
        "Laboratory session notebooks could not be read; stored data was not changed.",
    };
  }
}
export default function SharedNotebook() {
  const [sessionBooks] = useState(readSessionBooks),
    [value, setValue] = useState(read),
    [text, setText] = useState(""),
    [editId, setEditId] = useState(""),
    [editing, setEditing] = useState("");
  function apply(change) {
    try {
      const book = change(value.book);
      saveNotebook(localStorage, book);
      setValue({ book, error: "" });
      return true;
    } catch {
      return (
        setValue({
          ...value,
          error:
            "Could not save the shared notebook. Existing data has not been overwritten.",
        }),
        false
      );
    }
  }
  function download(format) {
    const url = URL.createObjectURL(
        new Blob(
          [
            exportNotebook(value.book, format),
            ...sessionBooks.sessions.map(
              (s) =>
                `\n\nSession: ${s.name} (${s.id})\n${exportNotebook(s.notebook, format)}`,
            ),
          ],
          { type: "text/plain" },
        ),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `materia-shared-notebook.${format === "markdown" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="notebook">
      <div className="notebook-head">
        <h2>Shared activity notebook</h2>
      </div>
      <p>
        Shows saved guided and free session entries alongside earlier activity
        notes. Simulation undo does not erase notebook entries.
      </p>
      {value.error && <p role="alert">{value.error}</p>}
      {sessionBooks.error && <p role="alert">{sessionBooks.error}</p>}
      <h3>Laboratory sessions</h3>
      <p>
        Open a laboratory session to edit its observations. Entries below belong
        to their saved session.
      </p>
      {sessionBooks.sessions.map((s) => (
        <div key={s.id}>
          <h4>
            {s.name} · {s.id}
          </h4>
          {s.notebook.entries.map((e) => (
            <div className="result-row" key={e.id}>
              <small>
                {e.at} · {e.kind}
              </small>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      ))}
      {value.book && (
        <>
          <label>
            New observation
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
            />
          </label>
          <button
            onClick={() => {
              if (
                apply((book) =>
                  addEntry(book, {
                    id: crypto.randomUUID(),
                    sessionId: "manual",
                    experiment: "Manual notebook",
                    at: new Date().toISOString(),
                    kind: "observation",
                    text,
                  }),
                )
              )
                setText("");
            }}
          >
            Add observation
          </button>
          <button onClick={() => download("text")}>Export text</button>
          <button onClick={() => download("markdown")}>Export Markdown</button>
          <button
            onClick={() => {
              try {
                const book = importLegacyNotebook(
                  localStorage,
                  new Date().toISOString(),
                );
                setValue({ book, error: "" });
              } catch {
                setValue({
                  ...value,
                  error:
                    "Import failed; the original saves and shared notebook were not changed.",
                });
              }
            }}
          >
            Import existing activity notes and events
          </button>
          <p>
            Copies older records without changing their original saves. Sources
            already migrated into canonical laboratory sessions are skipped.
            Older entries use the import date; repeating an import is
            idempotent.
          </p>
          <h3>Activity history</h3>
          {value.book.entries.map((e) => (
            <div className="result-row" key={e.id}>
              <div>
                <small>
                  {e.at} · {e.experiment} · {e.sessionId} · {e.kind}
                </small>
                {editId === e.id ? (
                  <textarea
                    value={editing}
                    onChange={(x) => setEditing(x.target.value)}
                    maxLength={5000}
                  />
                ) : (
                  <p>{e.text}</p>
                )}
              </div>
              {e.kind === "observation" && (
                <div>
                  {editId === e.id ? (
                    <button
                      onClick={() => {
                        if (
                          apply((book) => editObservation(book, e.id, editing))
                        )
                          setEditId("");
                      }}
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditId(e.id);
                        setEditing(e.text);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() =>
                      apply((book) => removeObservation(book, e.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
