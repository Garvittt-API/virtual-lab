import React, { useState, lazy, Suspense } from "react";
import { initializeGuidedExperiment } from "./lab/launch";
import { newLabSession, dispatchLab } from "./lab/session";
import {
  duplicateSession,
  exportSession,
  importSession,
  loadStore,
  saveStore,
} from "./lab/session-store";
import { exportNotebook } from "./lab/notebook";
const GuidedLab = lazy(() => import("./GuidedLab"));
const FreeLab = lazy(() => import("./FreeLab"));
const OxygenLab = lazy(() => import("./OxygenLab"));
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID();
function initial(mode, experimentId, legacyKey) {
  try {
    if (experimentId)
      return {
        store: initializeGuidedExperiment(
          localStorage,
          experimentId,
          now(),
          id,
        ),
        error: "",
      };
    let store = loadStore(localStorage, now());
    if (legacyKey && store.imported[legacyKey]) {
      store = { ...store, activeId: store.imported[legacyKey] };
      saveStore(localStorage, store);
    }
    if (!store.sessions.length) {
      const s = newLabSession(
        id(),
        mode,
        mode === "guided" ? "neutralization" : null,
        now(),
        mode === "guided" ? "Neutralization" : "Free exploration",
      );
      store = { ...store, activeId: s.id, sessions: [s] };
      saveStore(localStorage, store);
    } else {
      const s = store.sessions.find((x) => x.id === store.activeId);
      if (s.mode !== mode && (mode === "free" || s.core.experiment)) {
        const result = dispatchLab(s, { type: "policy", mode }, now(), id());
        if (!result.ok) throw new Error(result.error);
        store = {
          ...store,
          sessions: store.sessions.map((x) =>
            x.id === s.id ? result.state : x,
          ),
        };
        saveStore(localStorage, store);
      }
    }
    return { store, error: "" };
  } catch (e) {
    console.error("Laboratory session initialization failed:", e);
    return {
      store: null,
      error: `Cannot open laboratory sessions: ${e instanceof Error ? e.message : "storage failure"}. Original data has not been removed. Correct or export the stored data before retrying.`,
    };
  }
}
export default function SessionWorkbench({
  initialMode,
  experimentId,
  legacyKey,
  onReturn,
}) {
  const [data, setData] = useState(() => initial(initialMode, experimentId, legacyKey)),
    [edit, setEdit] = useState(""),
    [draft, setDraft] = useState("");
  const store = data.store,
    session = store?.sessions.find((s) => s.id === store.activeId);
  function persist(next) {
    try {
      saveStore(localStorage, next);
      setData({ store: next, error: "" });
      return true;
    } catch (e) {
      setData({
        ...data,
        error: `Session was not saved: ${e instanceof Error ? e.message : "storage failure"}. Previous data remains available.`,
      });
      return false;
    }
  }
  function run(action) {
    if (!session) return false;
    const result = dispatchLab(session, action, now(), id());
    if (!result.ok) {
      setData({ ...data, error: result.error });
      return false;
    }
    return persist({
      ...store,
      sessions: store.sessions.map((s) =>
        s.id === session.id ? result.state : s,
      ),
    });
  }
  function start(mode, experiment = null) {
    try {
      const name = window.prompt(
        "Session name",
        mode === "guided" ? "Guided experiment" : "Free exploration",
      );
      if (name === null) return;
      const s = newLabSession(id(), mode, experiment, now(), name);
      persist({ ...store, activeId: s.id, sessions: [...store.sessions, s] });
    } catch (e) {
      setData({
        ...data,
        error: e instanceof Error ? e.message : "Cannot start session",
      });
    }
  }
  function download(format) {
    const url = URL.createObjectURL(
      new Blob([exportNotebook(session.notebook, format)], {
        type: "text/plain",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `materia-session-notebook.${format === "markdown" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function downloadSession() {
    const url = URL.createObjectURL(
      new Blob([exportSession(session)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "lab-session"}.materia.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function readSessionFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const copy = importSession(await file.text(), id(), now());
      if (store.sessions.some((s) => s.id === copy.id))
        throw new Error("A session with this ID already exists");
      persist({ ...store, activeId: copy.id, sessions: [...store.sessions, copy] });
    } catch (e) {
      setData({
        ...data,
        error: `Import failed: ${e instanceof Error ? e.message : "invalid session file"}. Existing sessions were not changed.`,
      });
    }
  }
  if (!store)
    return (
      <div className="simple-page">
        <h1>Session recovery required</h1>
        <p role="alert">{data.error}</p>
          <button onClick={() => setData(initial(initialMode, experimentId, legacyKey))}>
          Retry
        </button>
        {onReturn && <button onClick={onReturn}>Return to Discover</button>}
      </div>
    );
  return (
    <>
      <div className="liquid-controls">
        <label>
          Saved laboratory session{" "}
          <select
            value={session.id}
            onChange={(e) => persist({ ...store, activeId: e.target.value })}
          >
            {store.sessions.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name} · {s.mode} · {s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <button className="add-button" onClick={() => start("free")}>New Workbench</button>
        <button onClick={() => start("guided", "neutralization")}>
          New guided session
        </button>
        <button
          onClick={() => {
            const name = window.prompt("Session name", session.name);
            if (name === null) return;
            const trimmed = name.trim();
            if (!trimmed || trimmed.length > 200) {
              setData({ ...data, error: "Name must contain 1–200 characters." });
              return;
            }
            persist({
              ...store,
              sessions: store.sessions.map((s) =>
                s.id === session.id ? { ...s, name: trimmed, updatedAt: now() } : s,
              ),
            });
          }}
        >
          Rename session
        </button>
        <button
          onClick={() => {
            try {
              const copy = duplicateSession(session, id(), now());
              persist({ ...store, activeId: copy.id, sessions: [...store.sessions, copy] });
            } catch (e) {
              setData({ ...data, error: e instanceof Error ? e.message : "Cannot duplicate session" });
            }
          }}
        >
          Duplicate session
        </button>
        <button onClick={downloadSession}>Export workspace</button>
        <label className="outline">
          Import workspace
          <input type="file" accept="application/json,.json" onChange={readSessionFile} />
        </label>
        <button
          disabled={session.mode === "free"}
          onClick={() => run({ type: "policy", mode: "free" })}
        >
          Free policy
        </button>
        <button
          disabled={session.mode === "guided" || !session.core.experiment}
          onClick={() => run({ type: "policy", mode: "guided" })}
        >
          Guided policy
        </button>
        <p>
          Session {session.id} · {session.mode}. Switching policy preserves the
          workspace and notes. Guided mode requires an experiment.
        </p>
        {data.error && (
          <p role="alert" className="answer-incorrect">
            {data.error}
          </p>
        )}
      </div>
      <Suspense fallback={<div>Loading laboratory…</div>}>
        {session.core.experiment?.id === "oxygen" ? (
          <OxygenLab session={session} run={run} />
        ) : session.mode === "guided" ? (
          <GuidedLab
            session={session}
            run={run}
            startExperiment={(exp) => start("guided", exp)}
          />
        ) : (
          <FreeLab session={session} run={run} />
        )}
      </Suspense>
      <section className="notebook">
        <h2>Session notebook</h2>
        <p>Notebook history is independent of simulation undo and redo.</p>
        <button onClick={() => download("text")}>Export text</button>
        <button onClick={() => download("markdown")}>Export Markdown</button>
        {session.notebook.entries.map((e) => (
          <div className="result-row" key={e.id}>
            <div>
              <small>
                {e.at} · {e.kind}
              </small>
              {edit === e.id ? (
                <textarea
                  value={draft}
                  onChange={(x) => setDraft(x.target.value)}
                />
              ) : (
                <p>{e.text}</p>
              )}
            </div>
            {e.kind === "observation" && (
              <div>
                {edit === e.id ? (
                  <button
                    onClick={() => {
                      if (run({ type: "edit-note", id: e.id, text: draft }))
                        setEdit("");
                    }}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEdit(e.id);
                      setDraft(e.text);
                    }}
                  >
                    Edit
                  </button>
                )}
                <button onClick={() => run({ type: "remove-note", id: e.id })}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
