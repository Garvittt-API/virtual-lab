import React, { useState } from "react";
import {
  manifests,
  startExperiment,
  advanceExperiment,
  recordNote,
  sessionMolarity,
} from "./simulation/runner";
import { reactions } from "./simulation/reactions";
import { substances } from "./simulation/substances";
export default function ReactionExercises() {
  const [id, setId] = useState("neutralization"),
    [state, setState] = useState(null),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  const manifest = manifests[id];
  function select(e) {
    setId(e.target.value);
    setState(null);
    setNote("");
    setError("");
  }
  function start() {
    try {
      setState(
        startExperiment(manifest, manifest.equipment, manifest.substances),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function advance() {
    try {
      setState(
        advanceExperiment(manifest, state, manifest.steps[state.step].id),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function addNote() {
    try {
      setState(recordNote(state, note));
      setNote("");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="simple-page reaction-exercises">
      <div className="eyebrow muted">
        GUIDED CALCULATIONS / EDUCATIONAL MODELS
      </div>
      <h1>
        Reaction exercises<span>.</span>
      </h1>
      <p>
        Follow a manifest-driven calculation. This panel does not control the 3D
        workspace or model physical transfer.
      </p>
      <div className="notebook">
        <label htmlFor="exercise">Choose an exercise</label>
        <select id="exercise" value={id} onChange={select}>
          {Object.values(manifests).map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <h2>{manifest.title}</h2>
        <p>
          {manifest.subject} · {manifest.topic} · {manifest.difficulty}
        </p>
        <p>
          <b>Objective:</b> {manifest.objectives.join(" ")}
        </p>
        <p>
          <b>Required apparatus:</b>{" "}
          {manifest.equipment.length
            ? manifest.equipment.join(", ")
            : "none in calculation-only mode"}
          . <b>Materials:</b>{" "}
          {manifest.substances.map((x) => substances[x].name).join(", ")}.
        </p>
        <div className="safety">{manifest.safety}</div>
        {!state ? (
          <button className="add-button" onClick={start}>
            Start calculation
          </button>
        ) : (
          <>
            <h3>Procedure</h3>
            <ol>
              {manifest.steps.map((step, i) => (
                <li
                  key={step.id}
                  className={i < state.step ? "completed-step" : ""}
                >
                  {step.instruction} {i < state.step ? "✓" : ""}
                </li>
              ))}
            </ol>
            {state.completed ? (
              <p role="status">
                <b>Calculation complete.</b> This does not certify laboratory
                competence.
              </p>
            ) : (
              <button className="add-button" onClick={advance}>
                Run next step: {manifest.steps[state.step].id}
              </button>
            )}
            <h3>Calculated inventory</h3>
            <div className="event-list">
              {Object.entries(state.inventory).map(([species, moles]) => (
                <div key={species}>
                  {substances[species].name} ({substances[species].state}):{" "}
                  {moles.toPrecision(4)} mol
                </div>
              ))}
            </div>
            {state.volumeMl > 0 && (
              <p>
                Total modeled liquid volume: {state.volumeMl.toFixed(1)} mL
                {state.inventory.NaCl !== undefined
                  ? ` · NaCl: ${sessionMolarity(state, "NaCl").toFixed(4)} M`
                  : ""}
              </p>
            )}
            {state.results.map((r, i) => (
              <div key={i} className="safety">
                <b>{reactions[r.reactionId].equation}</b>
                <p>
                  Extent: {r.extent.toPrecision(4)} mol; limiting:{" "}
                  {r.limiting.join(", ")}.
                </p>
                <p>
                  {reactions[r.reactionId].observation}{" "}
                  {reactions[r.reactionId].limitations}
                </p>
              </div>
            ))}
            <label htmlFor="exercise-note">Observation</label>
            <textarea
              id="exercise-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an observation"
            />
            <button className="outline" onClick={addNote}>
              Record observation
            </button>
            <div className="event-list">
              {state.notes.map((entry, i) => (
                <div key={i}>{entry}</div>
              ))}
            </div>
            <p className="model-note">
              This session is in memory only and is cleared when you leave the
              panel. These results are idealized, not independently
              scientifically reviewed.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="answer-incorrect">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
