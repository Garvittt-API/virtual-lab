import React, { useState } from "react";
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
export default function SharedNotebook() {
  const [value, setValue] = useState(read),
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
        new Blob([exportNotebook(value.book, format)], { type: "text/plain" }),
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
        Records new guided and free-mode actions on this device. Earlier
        activity notes remain in their original screens. Simulation undo does
        not erase these entries.
      </p>
      {value.error && <p role="alert">{value.error}</p>}
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
            Imports copies only; scientific sessions stay separate. Imported
            entries use the import date. Repeating an import skips entries at
            the same source index.
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
