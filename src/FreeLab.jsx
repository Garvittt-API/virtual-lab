import React, { useState, lazy, Suspense } from "react";
import {
  createFreeSession,
  validateFreeSession,
  dispatchFree,
  exportFreeNotebook,
} from "./lab/free";
import { appendNotebook } from "./lab/notebook";
import { equipment, stocks } from "./lab/registry";
import { concentration } from "./lab/engine";
const LiquidScene = lazy(() => import("./LiquidScene"));
function read() {
  try {
    const value = JSON.parse(localStorage.getItem("materia-free-v1"));
    validateFreeSession(value);
    return value;
  } catch {
    return createFreeSession(new Date().toISOString());
  }
}
export default function FreeLab() {
  const [session, setSession] = useState(read),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [kind, setKind] = useState("beaker"),
    [id, setId] = useState("v1"),
    [x, setX] = useState("0"),
    [z, setZ] = useState("0"),
    [stock, setStock] = useState("water"),
    [target, setTarget] = useState(""),
    [amount, setAmount] = useState("10"),
    [unit, setUnit] = useState("mL"),
    [reaction, setReaction] = useState("neutralization"),
    [note, setNote] = useState(""),
    [notebookSession] = useState(() => crypto.randomUUID());
  const workspace = session.workspace,
    items = Object.values(workspace.objects),
    item = workspace.objects[selected] || items[0],
    active = item?.id || "";
  function put(s) {
    setSession(s);
    localStorage.setItem("materia-free-v1", JSON.stringify(s));
  }
  function run(action) {
    const r = dispatchFree(session, action);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    put(r.state);
    setError("");
    try {
      const text =
        action.type === "note"
          ? action.text.trim()
          : ["undo", "redo", "reset"].includes(action.type)
            ? `Simulation ${action.type}`
            : r.state.workspace.events.at(-1);
      if (text)
        appendNotebook(localStorage, {
          id: crypto.randomUUID(),
          sessionId: notebookSession,
          experiment: "Free exploration",
          at: new Date().toISOString(),
          kind: action.type === "note" ? "observation" : "event",
          text,
        });
    } catch {
      setError(
        "Action saved, but shared notebook could not be written. Existing notebook data was preserved.",
      );
    }

    return true;
  }
  function move(objectId, position) {
    run({ type: "move", id: objectId, position });
  }
  function shift(dx, dz, rotation = 0) {
    if (!item) return;
    const p = item.position;
    move(active, [
      Math.max(-4, Math.min(4, p[0] + dx)),
      Math.max(-2.5, Math.min(2.5, p[1] + dz)),
      p[2] + rotation,
    ]);
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportFreeNotebook(session)], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "materia-free-notebook.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="lab-page">
      <div className="lab-title">
        <div>
          <div className="eyebrow muted">
            OPEN WORKBENCH / IDEAL EDUCATIONAL MODEL
          </div>
          <h1>Free exploration</h1>
          <p>
            Place apparatus, choose solutions, and explore supported reactions.
          </p>
        </div>
        <span className="lab-badge">
          <span /> DIGITAL ONLY
        </span>
      </div>
      <div className="lab-layout">
        <aside className="equipment-panel liquid-controls">
          <div className="panel-heading">
            <div>
              <span className="mini-label">EQUIPMENT LIBRARY</span>
              <h3>Workbench</h3>
            </div>
          </div>
          <label>
            Equipment
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.values(equipment).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipment ID
            <input
              value={id}
              maxLength={32}
              onChange={(e) => setId(e.target.value)}
            />
          </label>
          <label>
            Bench X
            <input
              type="number"
              step="0.5"
              min="-4"
              max="4"
              value={x}
              onChange={(e) => setX(e.target.value)}
            />
          </label>
          <label>
            Bench Z
            <input
              type="number"
              step="0.5"
              min="-2.5"
              max="2.5"
              value={z}
              onChange={(e) => setZ(e.target.value)}
            />
          </label>
          <button
            className="add-button"
            onClick={() => {
              if (
                run({
                  type: "place",
                  id,
                  kind,
                  position: [Number(x), Number(z), 0],
                })
              )
                setSelected(id);
            }}
          >
            Place equipment
          </button>
          <p className="panel-intro">
            Placement checks simple bench bounds and separation. Moving does not
            enforce collisions.
          </p>
          {items.map((v) => (
            <button
              key={v.id}
              className={"equipment " + (active === v.id ? "selected" : "")}
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
          {item && (
            <>
              <div className="transform-controls">
                <b>Position & rotation</b>
                <div>
                  <button
                    aria-label="Move left"
                    onClick={() => shift(-0.25, 0)}
                  >
                    ←
                  </button>
                  <button
                    aria-label="Move away"
                    onClick={() => shift(0, -0.25)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move closer"
                    onClick={() => shift(0, 0.25)}
                  >
                    ↓
                  </button>
                  <button
                    aria-label="Move right"
                    onClick={() => shift(0.25, 0)}
                  >
                    →
                  </button>
                </div>
                <div>
                  <button onClick={() => shift(0, 0, -Math.PI / 12)}>
                    ↶ 15°
                  </button>
                  <button onClick={() => shift(0, 0, Math.PI / 12)}>
                    ↷ 15°
                  </button>
                </div>
              </div>
              <button
                className="outline"
                onClick={() => {
                  if (run({ type: "remove", id: active })) setSelected("");
                }}
              >
                Remove selected
              </button>
            </>
          )}
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <span>
              <span className="live-dot" /> 3D WORKSPACE /{" "}
              {item ? `${equipment[item.kind].name} ${active}` : "empty bench"}
            </span>
            <span>IDEAL MODEL</span>
          </div>
          <Suspense fallback={<div className="scene">Loading workspace…</div>}>
            <LiquidScene
              state={workspace}
              selected={active}
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
                  if (window.confirm("Clear the bench? Notes will remain.")) {
                    run({ type: "reset" });
                    setSelected("");
                  }
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
            <span className="mini-label">VESSEL INSPECTOR</span>
            <h3>
              {item
                ? `${equipment[item.kind].name} · ${active}`
                : "Select equipment"}
            </h3>
            {item && (
              <>
                <p>
                  Volume: {item.volumeMl.toFixed(2)} /{" "}
                  {equipment[item.kind].capacityMl} mL
                </p>
                {Object.entries(item.solutes).map(([name, n]) => (
                  <div className="result-row" key={name}>
                    <span>
                      {name} ·{" "}
                      {item.volumeMl > 0
                        ? concentration(item, name).toFixed(4)
                        : "0"}{" "}
                      M
                    </span>
                    <b>{n.toPrecision(4)} mol</b>
                    <button
                      disabled={item.volumeMl <= 0}
                      onClick={() =>
                        run({ type: "measure", id: active, solute: name })
                      }
                    >
                      Record concentration
                    </button>
                  </div>
                ))}
                {Object.entries(item.solids || {}).map(([name, n]) => (
                  <div className="result-row" key={name}>
                    <span>{name} settled solid</span>
                    <b>{n.toPrecision(4)} mol</b>
                  </div>
                ))}
                <label>
                  Stock solution
                  <select
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  >
                    {Object.values(stocks).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Volume
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Unit
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option>mL</option>
                    <option>L</option>
                  </select>
                </label>
                <button
                  className="add-button"
                  onClick={() =>
                    run({
                      type: "add",
                      id: active,
                      stock,
                      volume: Number(amount),
                      unit,
                    })
                  }
                >
                  Add stock to selected
                </button>
                <label>
                  Transfer to
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">Choose destination</option>
                    {items
                      .filter((v) => v.id !== active)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {equipment[v.kind].name} · {v.id}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="add-button"
                  onClick={() =>
                    run({
                      type: "transfer",
                      from: active,
                      to: target,
                      volume: Number(amount),
                      unit,
                    })
                  }
                >
                  Transfer volume
                </button>
                <button
                  className="outline"
                  onClick={() => run({ type: "mix", id: active })}
                >
                  Mix selected
                </button>
                <label>
                  Supported reaction
                  <select
                    value={reaction}
                    onChange={(e) => setReaction(e.target.value)}
                  >
                    <option value="neutralization">Neutralization</option>
                    <option value="precipitation">AgCl precipitation</option>
                  </select>
                </label>
                <button
                  className="outline"
                  onClick={() =>
                    run({ type: "react", id: active, reactionId: reaction })
                  }
                >
                  Execute reaction
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="answer-incorrect">
                {error}
              </p>
            )}
            <div className="safety">
              <b>Digital model only</b>
              <p>
                Instant mixing and additive volumes are idealizations. Complete
                AgCl precipitation ignores equilibrium. No gas, heating,
                temperature or real-world procedure is modeled.
              </p>
            </div>
            <label htmlFor="free-note">Observation</label>
            <textarea
              id="free-note"
              className="oxygen-notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="outline"
              onClick={() => {
                if (run({ type: "note", text: note })) setNote("");
              }}
            >
              Save observation
            </button>
            <button className="outline" onClick={download}>
              Export notebook
            </button>
            <p className="model-note">
              Notes are kept when bench actions are undone or reset. Session is
              stored on this device only.
            </p>
            <h3>Recent operations</h3>
            <div className="event-list">
              {workspace.events.slice(-12).map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
            <h3>Observations</h3>
            <div className="event-list">
              {session.notes.map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
