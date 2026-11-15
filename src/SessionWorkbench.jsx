import React, { useState, lazy, Suspense } from "react";
import { initializeGuidedExperiment } from "./lab/launch";
import { newLabSession, dispatchLab } from "./lab/session";
import { loadStore, saveStore } from "./lab/session-store";
import { exportNotebook } from "./lab/notebook";
const GuidedLab = lazy(() => import("./GuidedLab"));
const FreeLab = lazy(() => import("./FreeLab"));
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID();
function initial(mode, experimentId) {
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
  onReturn,
}) {
  const [data, setData] = useState(() => initial(initialMode, experimentId)),
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
  if (!store)
    return (
      <div className="simple-page">
        <h1>Session recovery required</h1>
        <p role="alert">{data.error}</p>
        <button onClick={() => setData(initial(initialMode, experimentId))}>
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
        <button onClick={() => start("free")}>New empty session</button>
        <button onClick={() => start("guided", "neutralization")}>
          New guided session
        </button>
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
        {session.mode === "guided" ? (
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
