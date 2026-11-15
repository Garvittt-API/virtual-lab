import React, { useState, lazy, Suspense } from "react";
import {
  createWorkspace,
  execute,
  validateWorkspace,
  concentration,
} from "./lab/engine";
import { equipment, stocks } from "./lab/registry";
const LiquidScene = lazy(() => import("./LiquidScene"));
function load() {
  try {
    const s = JSON.parse(localStorage.getItem("materia-liquid"));
    validateWorkspace(s);
    if (
      Object.keys(s.objects).length !== 3 ||
      s.objects.a?.kind !== "beaker" ||
      s.objects.b?.kind !== "flask" ||
      s.objects.f?.kind !== "funnel"
    )
      throw new Error("Unexpected workspace objects");
    return s;
  } catch {
    return createWorkspace();
  }
}
export default function LiquidLab() {
  const [state, setState] = useState(load),
    [selected, setSelected] = useState("a"),
    [past, setPast] = useState([]),
    [future, setFuture] = useState([]),
    [error, setError] = useState(""),
    [stock, setStock] = useState("water"),
    [amount, setAmount] = useState("10"),
    [target, setTarget] = useState("b");
  const v = state.objects[selected];
  function put(s) {
    setState(s);
    localStorage.setItem("materia-liquid", JSON.stringify(s));
  }
  function run(c) {
    try {
      const s = execute(state, c);
      setPast([...past.slice(-49), state]);
      setFuture([]);
      setError("");
      put(s);
    } catch (e) {
      setError(e.message);
    }
  }
  function undo() {
    if (past.length) {
      setFuture([...future, state]);
      put(past[past.length - 1]);
      setPast(past.slice(0, -1));
      setError("");
    }
  }
  function redo() {
    if (future.length) {
      setPast([...past, state]);
      put(future[future.length - 1]);
      setFuture(future.slice(0, -1));
      setError("");
    }
  }
  function select(id) {
    setSelected(id);
    setTarget(id === "b" ? "a" : "b");
  }
  function move(id, p) {
    run({ type: "move", id, position: p });
  }
  function moveBy(dx, dz, dr = 0) {
    const p = v.position;
    move(selected, [
      Math.max(-4, Math.min(4, p[0] + dx)),
      Math.max(-2.5, Math.min(2.5, p[1] + dz)),
      p[2] + dr,
    ]);
  }
  const connection = state.connections[0];
  return (
    <div className="lab-page">
      <div className="lab-title">
        <div>
          <div className="eyebrow muted">EXPLORATION / IDEAL LIQUID MODEL</div>
          <h1>Liquid workspace</h1>
          <p>Measure, transfer and dilute without inventing a reaction.</p>
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
          <p className="panel-intro">
            Select an object or drag it in the scene.
          </p>
          {Object.values(state.objects).map((item) => (
            <button
              className={
                "equipment " + (selected === item.id ? "selected" : "")
              }
              key={item.id}
              onClick={() => select(item.id)}
            >
              <span className="equip-icon">◌</span>
              <span>
                <b>{equipment[item.kind].name}</b>
                <small>
                  {item.id} · {equipment[item.kind].capacityMl} mL capacity
                </small>
              </span>
            </button>
          ))}
          <div className="transform-controls">
            <b>Position & rotation</b>
            <div>
              <button onClick={() => moveBy(-0.25, 0)}>←</button>
              <button onClick={() => moveBy(0, -0.25)}>↑</button>
              <button onClick={() => moveBy(0, 0.25)}>↓</button>
              <button onClick={() => moveBy(0.25, 0)}>→</button>
            </div>
            <div>
              <button onClick={() => moveBy(0, 0, -Math.PI / 12)}>↶ 15°</button>
              <button onClick={() => moveBy(0, 0, Math.PI / 12)}>↷ 15°</button>
            </div>
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <span>
              <span className="live-dot" /> 3D WORKSPACE /{" "}
              {equipment[v.kind].name}
            </span>
            <span>IDEAL MIXING</span>
          </div>
          <Suspense fallback={<div className="scene">Loading workspace…</div>}>
            <LiquidScene
              state={state}
              selected={selected}
              onSelect={select}
              onMove={move}
            />
          </Suspense>
          <div className="scene-hint">
            Drag objects · drag background to orbit · scroll to zoom
          </div>
          <div className="workspace-controls">
            <div>
              <button onClick={undo} disabled={!past.length}>
                ↶ Undo
              </button>
              <button onClick={redo} disabled={!future.length}>
                ↷ Redo
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Reset the liquid workspace?")) {
                    setPast([...past, state]);
                    setFuture([]);
                    put(createWorkspace());
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
            <span className="mini-label">EQUIPMENT INSPECTOR</span>
            <h3>
              {equipment[v.kind].name} · {selected}
            </h3>
            <p>
              Volume: {v.volumeMl.toFixed(2)} / {equipment[v.kind].capacityMl}{" "}
              mL
            </p>
            {v.kind !== "funnel" && (
              <p>
                NaCl: {(v.solutes.NaCl || 0).toFixed(5)} mol ·{" "}
                {concentration(v, "NaCl").toFixed(3)} M
              </p>
            )}
            <label>
              Amount (mL)
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Stock
              <select value={stock} onChange={(e) => setStock(e.target.value)}>
                {Object.values(stocks)
                  .filter((s) => ["water", "salt"].includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="add-button"
              onClick={() =>
                run({
                  type: "add",
                  id: selected,
                  stock,
                  volumeMl: Number(amount),
                })
              }
            >
              Add to selected
            </button>
            <label>
              Transfer to
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {Object.values(state.objects)
                  .filter((x) => x.id !== selected)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {equipment[x.kind].name} · {x.id}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="add-button"
              onClick={() =>
                run({
                  type: "transfer",
                  from: selected,
                  to: target,
                  volumeMl: Number(amount),
                })
              }
            >
              Transfer measured volume
            </button>
            <div className="equation">Connections</div>
            <p className="model-note">
              The funnel stem connects to either vessel mouth. The green line
              shows the logical connection; it does not snap the geometry or
              model fluid flow.
            </p>
            {connection ? (
              <button
                className="outline"
                onClick={() =>
                  run({
                    type: "disconnect",
                    id: connection.a,
                    port: connection.ap,
                  })
                }
              >
                Disconnect funnel
              </button>
            ) : (
              <div>
                <button
                  className="outline"
                  onClick={() =>
                    run({
                      type: "connect",
                      a: "f",
                      ap: "stem",
                      b: "a",
                      bp: "mouth",
                    })
                  }
                >
                  Funnel → beaker
                </button>
                <button
                  className="outline"
                  onClick={() =>
                    run({
                      type: "connect",
                      a: "f",
                      ap: "stem",
                      b: "b",
                      bp: "mouth",
                    })
                  }
                >
                  Funnel → flask
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="answer-incorrect">
                {error}
              </p>
            )}
            <div className="safety">
              <b>Educational approximation</b>
              <p>
                Volumes are additive and liquids mix instantly. Only water and
                nonreactive salt solution are modeled. No reactions, fluid
                dynamics, temperature, or real-world safety guarantees are
                simulated.
              </p>
            </div>
            <h3>Activity log</h3>
            <div className="event-list">
              {state.events.slice(-10).map((event, i) => (
                <div key={i}>{event}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
