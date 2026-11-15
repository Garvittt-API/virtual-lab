import React, { useState, lazy, Suspense } from "react";
import ExperimentErrorBoundary from "./ExperimentErrorBoundary";
import { exportNotebook } from "./lab/notebook";
import { equipment, stocks } from "./lab/registry";
import { concentration } from "./lab/engine";
const LiquidScene = lazy(() => import("./LiquidScene"));
export default function FreeLab({ session, run }) {
  const [selected, setSelected] = useState(""),
    [kind, setKind] = useState("beaker"),
    [id, setId] = useState("v1"),
    [x, setX] = useState("0"),
    [z, setZ] = useState("0"),
    [stock, setStock] = useState("water"),
    [molarity, setMolarity] = useState(String(stocks.water.molarity)),
    [target, setTarget] = useState(""),
    [via, setVia] = useState(""),
    [amount, setAmount] = useState("10"),
    [unit, setUnit] = useState("mL"),
    [reaction, setReaction] = useState("neutralization"),
    [note, setNote] = useState(""),
    [connectionTarget, setConnectionTarget] = useState("b");
  const workspace = session.core.workspace,
    items = Object.values(workspace.objects),
    item = workspace.objects[selected] || items[0],
    active = item?.id || "",
    canReceive = item ? equipment[item.kind].operations.includes("receive") : false,
    canTransfer = item ? equipment[item.kind].operations.includes("transfer") : false;
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
      new Blob(
        [
          exportNotebook(session.notebook, "text"),
          "\n\nCurrent equipment:\n",
          ...items.map(
            (v) =>
              `- ${v.id}: ${v.kind}, ${v.volumeMl} mL, dissolved ${JSON.stringify(v.solutes)}, solids ${JSON.stringify(v.solids || {})}\n`,
          ),
        ],
        {
          type: "text/plain",
        },
      ),
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
          <div className="transform-controls">
            <b>Apparatus connections</b>
            <label>
              Connect selected ports to
              <select value={connectionTarget} onChange={(e) => setConnectionTarget(e.target.value)}>
                {items.filter((v) => v.id !== active).map((v) => <option key={v.id} value={v.id}>{equipment[v.kind].name} · {v.id}</option>)}
              </select>
            </label>
            {item && workspace.objects[connectionTarget] && Object.entries(equipment[item.kind].ports).flatMap(([ap, a]) =>
              Object.entries(equipment[workspace.objects[connectionTarget].kind].ports)
                .filter(([, b]) => a.accepts.includes(b.kind) && b.accepts.includes(a.kind))
                .map(([bp]) => <button key={`${ap}-${bp}`} onClick={() => run({ type: "connect", a: item.id, ap, b: connectionTarget, bp })}>Connect {ap} ↔ {bp}</button>))}
            {!workspace.connections.length && <small>No apparatus connected.</small>}
            {workspace.connections.map((c, i) => <div className="result-row" key={`${c.a}-${c.ap}-${i}`}>
              <span>{c.a}:{c.ap} ↔ {c.b}:{c.bp}</span>
              <button onClick={() => run({ type: "disconnect", id: c.a, port: c.ap })}>Disconnect</button>
            </div>)}
          </div>
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
          <ExperimentErrorBoundary scene>
            <Suspense
              fallback={<div className="scene">Loading workspace…</div>}
            >
              <LiquidScene
                state={workspace}
                selected={active}
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
                  {equipment[item.kind].dimensionsM.join(" × ")} m · {canReceive
                    ? `Volume: ${item.volumeMl.toFixed(2)} / ${equipment[item.kind].capacityMl} mL`
                    : "No liquid inventory"}
                </p>
                <button
                  className="outline"
                  disabled={
                    !equipment[item.kind].operations.includes("receive")
                  }
                  onClick={() => run({ type: "measure-volume", id: active })}
                >
                  Record volume
                </button>
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
                {Object.entries(item.gases || {}).map(([name, n]) => n > 0 && (
                  <div className="result-row" key={name}><span>{name}(g)</span><b>{n.toPrecision(5)} mol</b></div>
                ))}
                {equipment[item.kind].operations.includes("measure-gas") && <button className="outline" onClick={() => run({ type: "measure-gas", id: active })}>Record gas inventory</button>}
                <label>
                  Stock solution
                  <select
                    value={stock}
                    onChange={(e) => {
                      setStock(e.target.value);
                      setMolarity(String(stocks[e.target.value].molarity));
                    }}
                  >
                    {Object.values(stocks).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                {stocks[stock].solute && <>
                  <label>
                    Concentration (mol/L)
                    <input type="number" min="0" max="20" step="any" value={molarity} onChange={(e) => setMolarity(e.target.value)} />
                  </label>
                  <p className="model-note"><b>{stocks[stock].formula}</b> · {stocks[stock].hazard}</p>
                </>}
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
                  disabled={!canReceive}
                  onClick={() =>
                    run({
                      type: "add",
                      id: active,
                      stock,
                      ...(stocks[stock].solute ? { concentration: Number(molarity) } : {}),
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
                      .filter((v) => v.id !== active && equipment[v.kind].operations.includes("receive"))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {equipment[v.kind].name} · {v.id}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Transfer through (optional)
                  <select value={via} onChange={(e) => setVia(e.target.value)}>
                    <option value="">Direct pour</option>
                    {items.filter((v) => equipment[v.kind].model === "funnel").map((v) => <option key={v.id} value={v.id}>{equipment[v.kind].name} · {v.id}</option>)}
                  </select>
                </label>
                <button
                  className="add-button"
                  disabled={!canTransfer || !target || !canReceive}
                  onClick={() =>
                    run({
                      type: "transfer",
                      from: active,
                      to: target,
                      ...(via ? { via } : {}),
                      volume: Number(amount),
                      unit,
                    })
                  }
                >
                  Transfer volume
                </button>
                <button
                  className="outline"
                  disabled={!canReceive || item.volumeMl <= 0}
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
                  disabled={!canReceive || item.volumeMl <= 0}
                  onClick={() =>
                    run({ type: "react", id: active, reactionId: reaction })
                  }
                >
                  Execute reaction
                </button>
              </>
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
              {session.notebook.entries
                .filter((e) => e.kind === "observation")
                .map((e) => (
                  <div key={e.id}>{e.text}</div>
                ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
