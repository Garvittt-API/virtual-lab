import React, { useState, lazy, Suspense } from "react";
import ExperimentErrorBoundary from "./ExperimentErrorBoundary";
import { guidedManifests } from "./lab/guided";
import { equipment, stocks } from "./lab/registry";
import { concentration } from "./lab/engine";
const LiquidScene = lazy(() => import("./LiquidScene"));
function GuidedStepControl({ step, workspace, run }) {
  const [command, setCommand] = useState(() => ({
    ...step.command,
    volume: step.command.volumeMl || 10,
    unit: "mL",
  }));
  const update = (key, value) =>
    setCommand((current) => ({ ...current, [key]: value }));
  const vessels = Object.values(workspace.objects);
  const vesselSelect = (key, label, operation = "receive") => (
    <label>
      {label}
      <select
        value={command[key] || ""}
        onChange={(e) => update(key, e.target.value)}
      >
        {vessels.filter((v) => equipment[v.kind].operations.includes(operation)).map((v) => (
          <option key={v.id} value={v.id}>
            {equipment[v.kind].name} · {v.id}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="liquid-controls">
      <p className="model-note">
        Choose the requested operation and quantity. Volumes in the procedure
        are suggestions, not required values.
      </p>
      {step.command.type === "add" && (
        <>
          {vesselSelect("id", "Destination vessel")}
          <label>
            Stock solution
            <select
              value={command.stock}
              onChange={(e) => update("stock", e.target.value)}
            >
              {Object.values(stocks).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {step.command.type === "transfer" && (
        <>
          {vesselSelect("from", "Source vessel")}
          {vesselSelect("to", "Destination vessel")}
          {step.command.via && (
            <label>Funnel
              <select value={command.via || step.command.via} onChange={(e) => update("via", e.target.value)}>
                <option value={step.command.via}>{step.command.via}</option>
              </select>
            </label>
          )}
        </>
      )}
      {["mix", "react", "measure", "measure-volume"].includes(step.command.type) && vesselSelect("id", "Vessel")}
      {step.command.type === "measure-gas" && vesselSelect("id", "Gas measurement vessel", "measure-gas")}
      {step.command.type === "react" && (
        <label>
          Reaction
          <select
            value={command.reactionId}
            onChange={(e) => update("reactionId", e.target.value)}
          >
            <option value="neutralization">Neutralization</option>
            <option value="precipitation">AgCl precipitation</option>
          </select>
        </label>
      )}
      {["add", "transfer"].includes(step.command.type) && (
        <>
          <label>
            Volume
            <input
              type="number"
              min="0"
              step="any"
              value={command.volume}
              onChange={(e) => update("volume", Number(e.target.value))}
            />
          </label>
          <label>
            Unit
            <select
              value={command.unit}
              onChange={(e) => update("unit", e.target.value)}
            >
              <option>mL</option>
              <option>L</option>
            </select>
          </label>
        </>
      )}
      <button
        className="add-button"
        onClick={() => run({ type: "perform", stepId: step.id, command })}
      >
        Perform {step.command.type}
      </button>
    </div>
  );
}
export default function GuidedLab({ session, run, startExperiment }) {
  const [selected, setSelected] = useState("a"),
    [note, setNote] = useState("");
  const { workspace, experiment } = session.core,
    manifest = experiment.definition || guidedManifests[experiment.id],
    steps = experiment.definition ? manifest.instructions : manifest.steps,
    step = steps[experiment.step],
    item = workspace.objects[selected] || Object.values(workspace.objects)[0];
  function change(e) {
    if (window.confirm("Start a new independent guided session?")) {
      startExperiment(e.target.value);
      setSelected("a");
    }
  }
  function move(id, position) {
    run({ type: "move", id, position });
  }
  function shift(dx, dz, rotation = 0) {
    if (!item) return;
    const p = item.position;
    move(item.id, [
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
              {item ? equipment[item.kind].name : "Empty bench"}{" "}
              {item?.id || ""}
            </span>
            <span>IDEAL MODEL</span>
          </div>
          <ExperimentErrorBoundary scene>
            <Suspense
              fallback={<div className="scene">Loading workspace…</div>}
            >
              <LiquidScene
                state={workspace}
                selected={item?.id || ""}
                onSelect={setSelected}
                onMove={move}
              />
            </Suspense>
          </ExperimentErrorBoundary>
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
                disabled={Boolean(experiment.definition)}
              >
                {experiment.definition && <option value={experiment.id}>{experiment.definition.title}</option>}
                {Object.values(guidedManifests).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <h3>Procedure</h3>
            <ol>
              {steps.map((s, i) => (
                <li
                  key={s.id}
                  className={i < experiment.step ? "completed-step" : ""}
                >
                  {s.instruction} {i < experiment.step ? "✓" : ""}
                </li>
              ))}
            </ol>
            {step ? (
              <GuidedStepControl
                key={step.id}
                step={step}
                workspace={workspace}
                run={run}
              />
            ) : (
              <p role="status">
                <b>Procedure complete.</b> Add an observation below.
              </p>
            )}
            <div className="safety">
              <b>Safety and model</b>
              <p>
                {manifest.safety || (manifest.safetyWarnings || []).join(" ")} {manifest.model || (manifest.scientificAssumptions || []).join(" ")}
              </p>
            </div>
            {item && (
              <>
                <h3>Selected vessel {item.id}</h3>
                <p>
                  {item.volumeMl.toFixed(1)} / {equipment[item.kind].capacityMl}{" "}
                  mL
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
              </>
            )}
            {experiment.result && (
              <div className="reading" aria-label="Calculated neutralization result">
                <span>CALCULATED pH · 25 °C</span>
                <strong>{experiment.result.pH.toFixed(2)}</strong>
                <small>
                  {experiment.result.excess === "none"
                    ? "Stoichiometric equivalence"
                    : `Excess ${experiment.result.excess}`}
                </small>
              </div>
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
                if (run({ type: "observe", note })) setNote("");
              }}
            >
              Save observation
            </button>
            <h3>Session history</h3>
            <div className="event-list">
              {workspace.events.slice(-12).map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
            <p className="model-note">
              The white AgCl marker and liquid levels are qualitative. Measured
              steps accept student volumes; no pouring, equilibrium or fluid
              dynamics are simulated. No independent scientific review or visual
              verification.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
