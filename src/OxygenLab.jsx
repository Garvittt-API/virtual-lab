import React, { useState, lazy, Suspense } from "react";
import ExperimentErrorBoundary from "./ExperimentErrorBoundary";
import { oxygenReaction, oxygenYield } from "./oxygen";
const LiquidScene = lazy(() => import("./LiquidScene"));
const names = {
  tube: "Reaction vessel",
  burner: "Burner",
  jar: "Collection vessel",
};
export default function OxygenLab({ session, run }) {
  const protocol = session.core.experiment.protocol;
  const inventory = session.core.experiment.inventory;
  const state = {
    ...protocol,
    events: session.core.workspace.events,
    notes: session.notebook.entries.filter((entry) => entry.kind === "observation").map((entry) => entry.text).join("\n"),
  };
  const [selected, setSelected] = useState("tube"),
    [tab, setTab] = useState("guide"),
    [answer, setAnswer] = useState(""),
    [checked, setChecked] = useState(false),
    [noteDraft, setNoteDraft] = useState("");
  const burnerReady =
    Math.hypot(
      state.positions.tube[0] - state.positions.burner[0],
      state.positions.tube[1] - state.positions.burner[1],
    ) <= 1.2;
  const result = oxygenYield(
    oxygenReaction.initialMassG,
    state.steps * oxygenReaction.fractionPerStep,
  );
  function dispatch(action) {
    const types = { connect: "oxygen-connect", disconnect: "oxygen-disconnect", load: "oxygen-load", heat: "oxygen-heat" };
    if (action.type === "move") return run(action);
    if (action.type === "note") return run({ type: "observe", text: action.value });
    return run({ type: types[action.type] });
  }
  function undo() {
    run({ type: "undo" });
  }
  function redo() {
    run({ type: "redo" });
  }
  function move(id, position) {
    dispatch({ type: "move", id, position });
  }
  function transform(dx, dz, dr = 0) {
    const p = state.positions[selected];
    move(selected, [
      Math.max(-4, Math.min(4, p[0] + dx)),
      Math.max(-2.5, Math.min(2.5, p[1] + dz)),
      p[2] + dr,
    ]);
  }
  function reset() {
    if (window.confirm("Reset the oxygen experiment? Notebook observations will remain.")) run({ type: "reset" });
  }
  function download() {
    const text = `Oxygen preparation — digital simulation\n${oxygenReaction.equation}\n${state.events.join("\n")}\n\nObservations: ${state.notes}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "oxygen-session.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="lab-page oxygen-page">
      <div className="lab-title">
        <div>
          <div className="eyebrow muted">
            GUIDED SIMULATION / INORGANIC CHEMISTRY
          </div>
          <h1>Oxygen from decomposition</h1>
          <p>Explore an idealized stoichiometric model of oxygen production.</p>
        </div>
        <span className="lab-badge">
          <span /> DIGITAL ONLY
        </span>
      </div>
      <div className="lab-layout">
        <aside className="equipment-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">YOUR WORKSPACE</span>
              <h3>Apparatus</h3>
            </div>
          </div>
          <p className="panel-intro">
            Select and position the apparatus. The delivery tube joins the
            reaction and collection vessels.
          </p>
          {Object.entries(names).map(([id, name]) => (
            <button
              key={id}
              className={"equipment " + (selected === id ? "selected" : "")}
              onClick={() => setSelected(id)}
            >
              <span className="equip-icon">{id === "burner" ? "♨" : "◌"}</span>
              <span>
                <b>{name}</b>
                <small>
                  {id === "jar"
                    ? "Gas collection"
                    : id === "tube"
                      ? "Decomposition"
                      : "Heat source"}
                </small>
              </span>
              ›
            </button>
          ))}
          <div className="transform-controls">
            <b>Position & rotation</b>
            <div>
              <button
                aria-label="Move left"
                onClick={() => transform(-0.25, 0)}
              >
                ←
              </button>
              <button
                aria-label="Move away"
                onClick={() => transform(0, -0.25)}
              >
                ↑
              </button>
              <button
                aria-label="Move closer"
                onClick={() => transform(0, 0.25)}
              >
                ↓
              </button>
              <button
                aria-label="Move right"
                onClick={() => transform(0.25, 0)}
              >
                →
              </button>
            </div>
            <div>
              <button onClick={() => transform(0, 0, -Math.PI / 12)}>
                ↶ 15°
              </button>
              <button onClick={() => transform(0, 0, Math.PI / 12)}>
                ↷ 15°
              </button>
            </div>
          </div>
          <p className="equipment-note">
            Drag apparatus or use the controls. The tube connection follows both
            vessels.
          </p>
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <div>
              <span className="live-dot" />
              3D WORKSPACE / {names[selected]} selected
            </div>
            <span>IDEAL MODEL</span>
          </div>
          <ExperimentErrorBoundary scene>
            <Suspense
              fallback={<div className="scene">Loading 3D workspace…</div>}
            >
              <LiquidScene
                state={session.core.workspace}
                selected={selected}
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
              <button onClick={undo} disabled={!session.past.length} title="Undo">
                ↶ Undo
              </button>
              <button onClick={redo} disabled={!session.future.length} title="Redo">
                ↷ Redo
              </button>
              <button onClick={reset}>Reset</button>
            </div>
            <div className="control-status">
              <span /> Saved locally
            </div>
          </div>
        </div>
        <aside className="guide-panel">
          <div className="tabs">
            <button
              className={tab === "guide" ? "on" : ""}
              onClick={() => setTab("guide")}
            >
              Procedure
            </button>
            <button
              className={tab === "results" ? "on" : ""}
              onClick={() => setTab("results")}
            >
              Results
            </button>
            <button
              className={tab === "notes" ? "on" : ""}
              onClick={() => setTab("notes")}
            >
              Notes
            </button>
            <button
              className={tab === "check" ? "on" : ""}
              onClick={() => setTab("check")}
            >
              Check
            </button>
          </div>
          {tab === "guide" ? (
            <div className="guide-content">
              <div className="guide-heading">
                <span className="mini-label">EDUCATIONAL SIMULATION</span>
                <h3>Explore oxygen production</h3>
                <p>
                  Arrange the reaction vessel, burner and gas collection vessel.
                  Connect the vessels and load the virtual material.
                </p>
              </div>
              <div className="equation">{oxygenReaction.equation}</div>
              <p className="model-note" role="status">
                {state.connected
                  ? "Gas path connected: reaction vessel → delivery tube → collection vessel."
                  : "No gas path connected. Generated oxygen will remain in the reaction vessel until you connect the apparatus."}
              </p>
              <div className="step">
                <span className="step-num">1</span>
                <div>
                  <b>Connect the apparatus</b>
                  <p>
                    Only the reaction vessel and gas collection vessel are
                    compatible with this delivery tube.
                  </p>
                  <button
                    className="add-button"
                    onClick={() =>
                      dispatch({
                        type: state.connected ? "disconnect" : "connect",
                      })
                    }
                  >
                    {state.connected ? "Disconnect tube" : "Connect vessels"}
                  </button>
                </div>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <div>
                  <b>Add simulated substance</b>
                  <p>Load a fixed 1.00 g of potassium chlorate.</p>
                  <button
                    className="add-button"
                    onClick={() => dispatch({ type: "load" })}
                    disabled={state.loaded}
                  >
                    {state.loaded ? "Loaded" : "Add KClO₃"}
                  </button>
                </div>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <div>
                  <b>Simulate decomposition</b>
                  <p>
                    Place the burner near the reaction vessel. Each action
                    converts 20% of the starting material; this is not a
                    predicted heating rate. Gas without a complete delivery path
                    remains uncollected in the reaction vessel.
                  </p>
                  <button
                    className="add-button"
                    onClick={() => dispatch({ type: "heat" })}
                    disabled={
                      !state.loaded || state.steps >= 5 || !burnerReady
                    }
                  >
                    Simulate heating step
                  </button>
                  {!burnerReady && (
                    <p>Move the burner closer to the reaction vessel.</p>
                  )}
                </div>
              </div>
              <div className="safety">
                <b>✳ Digital simulation only</b>
                <p>
                  Potassium chlorate is a strong oxidizer. Heating it and
                  collecting oxygen can be hazardous. Do not use this simplified
                  simulation as a real-world procedure; real work requires
                  professional supervision and risk assessment.
                </p>
              </div>
            </div>
          ) : tab === "results" ? (
            <div className="guide-content">
              <div className="guide-heading">
                <span className="mini-label">THEORETICAL RESULTS</span>
                <h3>What changed?</h3>
              </div>
              <div className="reading">
                <span>COLLECTED OXYGEN VOLUME</span>
                <strong>{session.core.experiment.inventory.collectedO2Ml.toFixed(1)} mL</strong>
                <small>at 0 °C and 1 atm</small>
              </div>
              <div className="result-row">
                <span>Conversion</span>
                <b>{state.steps * 20}%</b>
              </div>
              <div className="result-row">
                <span>O₂ generated</span>
                <b>{(session.core.experiment.inventory.generatedO2Mol * 1000).toFixed(3)} mmol</b>
              </div>
              <div className="result-row">
                <span>O₂ uncollected</span>
                <b>{(inventory.uncollectedO2Mol * 1000).toFixed(3)} mmol</b>
              </div>
              <div className="result-row">
                <span>KCl formed</span>
                <b>{(result.potassiumChlorideMoles * 1000).toFixed(3)} mmol</b>
              </div>
              <div className="result-row">
                <span>KClO₃ remaining</span>
                <b>{session.core.experiment.inventory.remainingKClO3Mol.toPrecision(4)} mol</b>
              </div>
              <p className="model-note">
                Assumes the balanced reaction and ideal gas molar volume of 22.414
                L/mol at 0 °C and 1 atm. Gas moves only through connected gas ports;
                the collection vessel is limited to 500 mL. Excess stays uncollected.
                Conversion is manually specified, not predicted. Water
                displacement and bubbles are illustrative, not measured. The
                model has not been independently scientifically reviewed.
              </p>
              {state.steps === 0 && <p className="model-note" role="status">No oxygen has been generated yet. Load the reactant and run a heating stage.</p>}
              {inventory.collectedO2Ml >= 500 - 1e-8 && <p className="answer-incorrect" role="status">The 500 mL receiver is full. Additional generated oxygen remains uncollected.</p>}
              <p className="model-note">
                <b>Conclusion:</b> The idealized reaction produces 1.5 moles of
                oxygen per mole of potassium chlorate consumed.
              </p>
            </div>
          ) : tab === "notes" ? (
            <div className="guide-content">
              <h3>Experiment notebook</h3>
              <p className="model-note">Stored on this device only.</p>
              <div className="event-list">
                {state.events.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
              <label htmlFor="oxygen-notes">Your observations</label>
              <textarea
                id="oxygen-notes"
                className="oxygen-notes"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Record your observations"
              />
              <button
                className="outline"
                disabled={!noteDraft.trim()}
                onClick={() => {
                  if (dispatch({ type: "note", value: noteDraft })) setNoteDraft("");
                }}
              >
                Save observation
              </button>
              <button className="add-button" onClick={download}>
                Export notebook
              </button>
            </div>
          ) : (
            <div className="guide-content">
              <h3>Knowledge check</h3>
              <p className="model-note">
                According to the balanced equation, how many moles of O₂ form
                from 2 moles of KClO₃?
              </p>
              {["1", "2", "3"].map((a) => (
                <label className="oxygen-option" key={a}>
                  <input
                    type="radio"
                    name="oxygen-answer"
                    value={a}
                    checked={answer === a}
                    onChange={() => {
                      setAnswer(a);
                      setChecked(false);
                    }}
                  />{" "}
                  {a} moles
                </label>
              ))}
              <button
                className="add-button"
                disabled={!answer}
                onClick={() => setChecked(true)}
              >
                Check answer
              </button>
              {checked && (
                <p role="status" className="model-note">
                  {answer === "3" ? "Correct." : "Not quite."} The balanced
                  equation shows 2 KClO₃ produce 3 O₂.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
