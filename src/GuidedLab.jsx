import React, { useState, lazy, Suspense } from "react";
import {
  createSession,
  validateSession,
  dispatch,
  guidedManifests,
} from "./lab/guided";
import { equipment } from "./lab/registry";
import { concentration } from "./lab/engine";
const LiquidScene = lazy(() => import("./LiquidScene"));
function read() {
  try {
    const data = JSON.parse(localStorage.getItem("materia-guided-v1"));
    validateSession(data);
    return data;
  } catch {
    return createSession("neutralization");
  }
}
export default function GuidedLab() {
  const [session, setSession] = useState(read),
    [selected, setSelected] = useState("a"),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const { workspace, experiment } = session.core,
    manifest = guidedManifests[experiment.id],
    step = manifest.steps[experiment.step],
    item = workspace.objects[selected];
  function put(s) {
    setSession(s);
    localStorage.setItem("materia-guided-v1", JSON.stringify(s));
  }
  function run(action) {
    const result = dispatch(session, action);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    put(result.state);
  }
  function change(e) {
    if (
      window.confirm(
        "Start the selected experiment? The current guided session will be replaced.",
      )
    ) {
      put(createSession(e.target.value));
      setSelected("a");
      setError("");
    }
  }
  function move(id, position) {
    run({ type: "move", id, position });
  }
  function shift(dx, dz, rotation = 0) {
    const p = item.position;
    move(selected, [
      Math.max(-4, Math.min(4, p[0] + dx)),
      Math.max(-2.5, Math.min(2.5, p[1] + dz)),
      p[2] + rotation,
    ]);
  }
  return (
    <div className="lab-page">
      <div className="lab-title">
        <div>
          <div className="eyebrow muted">
            GUIDED LABORATORY / SHARED VESSEL STATE
          </div>
          <h1>{manifest.title}</h1>
          <p>Measured steps update the same vessel state shown on the bench.</p>
        </div>
        <span className="lab-badge">
          <span /> DIGITAL ONLY
        </span>
      </div>
      <div className="lab-layout">
        <aside className="equipment-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">WORKBENCH</span>
              <h3>Apparatus</h3>
            </div>
          </div>
          {Object.values(workspace.objects).map((v) => (
            <button
              key={v.id}
              className={"equipment " + (selected === v.id ? "selected" : "")}
              onClick={() => setSelected(v.id)}
            >
              <span className="equip-icon">◌</span>
              <span>
                <b>{equipment[v.kind].name}</b>
                <small>
                  {v.id} · {v.volumeMl.toFixed(1)} mL
                </small>
              </span>
            </button>
          ))}
          <div className="transform-controls">
            <b>Position & rotation</b>
            <div>
              <button aria-label="Move left" onClick={() => shift(-0.25, 0)}>
                ←
              </button>
              <button aria-label="Move away" onClick={() => shift(0, -0.25)}>
                ↑
              </button>
              <button aria-label="Move closer" onClick={() => shift(0, 0.25)}>
                ↓
              </button>
              <button aria-label="Move right" onClick={() => shift(0.25, 0)}>
                →
              </button>
            </div>
            <div>
              <button onClick={() => shift(0, 0, -Math.PI / 12)}>↶ 15°</button>
              <button onClick={() => shift(0, 0, Math.PI / 12)}>↷ 15°</button>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <span>
              <span className="live-dot" /> 3D WORKSPACE /{" "}
              {equipment[item.kind].name} {selected}
            </span>
            <span>IDEAL MODEL</span>
          </div>
          <Suspense fallback={<div className="scene">Loading workspace…</div>}>
            <LiquidScene
              state={workspace}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
            />
          </Suspense>
          <div className="scene-hint">
            Drag apparatus · drag background to orbit · scroll to zoom
          </div>
          <div className="workspace-controls">
            <div>
              <button
                onClick={() => run({ type: "undo" })}
                disabled={!session.past.length}
              >
                ↶ Undo
              </button>
              <button
                onClick={() => run({ type: "redo" })}
                disabled={!session.future.length}
              >
                ↷ Redo
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Reset this guided session?"))
                    run({ type: "reset" });
                }}
              >
                Reset
              </button>
            </div>
            <span className="control-status">Saved locally</span>
          </div>
        </div>
        <aside className="guide-panel">
          <div className="guide-content liquid-controls">
            <label htmlFor="guided-experiment">
              Experiment
              <select
                id="guided-experiment"
                value={experiment.id}
                onChange={change}
              >
                {Object.values(guidedManifests).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <h3>Procedure</h3>
            <ol>
              {manifest.steps.map((s, i) => (
                <li
                  key={s.id}
                  className={i < experiment.step ? "completed-step" : ""}
                >
                  {s.instruction} {i < experiment.step ? "✓" : ""}
                </li>
              ))}
            </ol>
            {step ? (
              <button
                className="add-button"
                onClick={() => run({ type: "next", stepId: step.id })}
              >
                Perform next step
              </button>
            ) : (
              <p role="status">
                <b>Procedure complete.</b> Add an observation below.
              </p>
            )}
            <div className="safety">
              <b>Safety and model</b>
              <p>
                {manifest.safety} {manifest.model}
              </p>
            </div>
            <h3>Selected vessel {selected}</h3>
            <p>
              {item.volumeMl.toFixed(1)} / {equipment[item.kind].capacityMl} mL
            </p>
            {Object.entries(item.solutes).map(([id, n]) => (
              <div className="result-row" key={id}>
                <span>{id} dissolved / product</span>
                <b>{n.toPrecision(4)} mol</b>
              </div>
            ))}
            {Object.entries(item.solids || {}).map(([id, n]) => (
              <div className="result-row" key={id}>
                <span>{id} solid</span>
                <b>{n.toPrecision(4)} mol</b>
              </div>
            ))}
            {item.volumeMl > 0 && item.solutes.NaCl !== undefined && (
              <p>NaCl: {concentration(item, "NaCl").toFixed(4)} M</p>
            )}
            <label htmlFor="guided-note">Record observation</label>
            <textarea
              id="guided-note"
              className="oxygen-notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="outline"
              onClick={() => {
                const result = dispatch(session, { type: "observe", note });
                if (result.ok) {
                  put(result.state);
                  setNote("");
                  setError("");
                } else setError(result.error);
              }}
            >
              Save observation
            </button>
            {error && (
              <p role="alert" className="answer-incorrect">
                {error}
              </p>
            )}
            <h3>Session history</h3>
            <div className="event-list">
              {workspace.events.slice(-12).map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
            <p className="model-note">
              The white AgCl marker and liquid levels are qualitative. Measured
              steps use fixed values; no pouring, equilibrium or fluid dynamics
              are simulated. No independent scientific review or visual
              verification.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
