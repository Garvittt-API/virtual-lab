import React, { lazy, Suspense, useState } from "react";
import { manifests } from "./simulation/runner";

const SessionWorkbench = lazy(() => import("./SessionWorkbench"));

const experimentIds = ["neutralization", "precipitation", "dilution", "oxygen"];

/** Legacy calculation-library entry, now backed by the canonical saved workbench session. */
export default function ReactionExercises() {
  const [id, setId] = useState("neutralization");
  const experiment = manifests[id];
  return (
    <div className="simple-page reaction-exercises">
      <div className="eyebrow muted">GUIDED EXPERIMENTS / SHARED LABORATORY SESSION</div>
      <h1>Reaction exercises<span>.</span></h1>
      <p>
        Choose an experiment to continue in the same persistent 3D workbench used by Discover. Guided steps, measurements, reactions and notebook entries use the canonical laboratory session.
      </p>
      <div className="notebook">
        <label htmlFor="exercise">Choose an experiment</label>
        <select id="exercise" value={id} onChange={(event) => setId(event.target.value)}>
          {experimentIds.map((experimentId) => (
            <option key={experimentId} value={experimentId}>{manifests[experimentId].title}</option>
          ))}
        </select>
        <h2>{experiment.title}</h2>
        <p>{experiment.subject} · {experiment.topic} · {experiment.difficulty}</p>
        <p><b>Objective:</b> {experiment.objectives.join(" ")}</p>
        <p><b>Materials:</b> {experiment.substances.join(", ")}.</p>
        <div className="safety">{experiment.safety}</div>
      </div>
      <Suspense fallback={<div role="status">Loading experiment session…</div>}>
        <SessionWorkbench key={id} initialMode="guided" experimentId={id} />
      </Suspense>
    </div>
  );
}
