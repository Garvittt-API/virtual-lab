import React, { useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  Beaker,
  BookOpen,
  Bookmark,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  GraduationCap,
  Grid2X2,
  HelpCircle,
  Home,
  Layers3,
  Menu,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  X,
  Plus,
  Minus,
  Undo2,
  Redo2,
  Download,
  Check,
  Info,
} from "lucide-react";
const Scene = lazy(() => import("./Scene"));
const OxygenLab = lazy(() => import("./OxygenLab"));
const LiquidLab = lazy(() => import("./LiquidLab"));
const ReactionExercises = lazy(() => import("./ReactionExercises"));
import { neutralization } from "./chemistry";
import {
  neutralizationExperiment as experiment,
  scoreAssessment,
} from "./experiment";
import "./style.css";
const initialPositions = {
  flask: [0, 0],
  stand: [1.8, -0.4],
  beaker: [-2, 0.3],
};
const initial = {
  baseMl: 0,
  positions: initialPositions,
  notes: "",
  events: ["Session started with 25.0 mL of 0.1 M hydrochloric acid."],
};
const read = () => {
  try {
    const x = JSON.parse(localStorage.getItem("materia-session"));
    const validPositions =
      x?.positions &&
      Object.keys(initialPositions).every(
        (id) =>
          Array.isArray(x.positions[id]) &&
          x.positions[id].length >= 2 &&
          x.positions[id].length <= 3 &&
          x.positions[id].every(Number.isFinite) &&
          Math.abs(x.positions[id][0]) <= 4 &&
          Math.abs(x.positions[id][1]) <= 2.5,
      );
    return x &&
      Number.isFinite(x.baseMl) &&
      x.baseMl >= 0 &&
      x.baseMl <= 50 &&
      validPositions &&
      typeof x.notes === "string" &&
      Array.isArray(x.events) &&
      x.events.every((e) => typeof e === "string")
      ? x
      : initial;
  } catch {
    return initial;
  }
};
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <FlaskConical size={21} />
      </span>
      <span>
        materia<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Sidebar({ page, setPage }) {
  return (
    <aside className="sidebar">
      <Logo />
      <div className="nav-label">WORKSPACE</div>
      <button
        className={"nav-item " + (page === "library" ? "active" : "")}
        onClick={() => setPage("library")}
      >
        <Grid2X2 size={18} /> Discover <span className="nav-arrow">›</span>
      </button>
      <button
        className={"nav-item " + (page === "lab" ? "active" : "")}
        onClick={() => setPage("lab")}
      >
        <Box size={18} /> Virtual lab
      </button>
      <button
        className={"nav-item " + (page === "notebook" ? "active" : "")}
        onClick={() => setPage("notebook")}
      >
        <BookOpen size={18} /> Lab notebook
      </button>
      <button
        className={"nav-item " + (page === "liquid" ? "active" : "")}
        onClick={() => setPage("liquid")}
      >
        <Beaker size={18} /> Liquid workspace
      </button>
      <button
        className={"nav-item " + (page === "reactions" ? "active" : "")}
        onClick={() => setPage("reactions")}
      >
        <FlaskConical size={18} /> Reaction exercises
      </button>
      <div className="side-divider" />
      <div className="nav-label">YOUR LEARNING</div>
      <button className="nav-item" onClick={() => setPage("saved")}>
        <Bookmark size={18} /> Saved experiments
      </button>
      <div className="sidebar-bottom">
        <div className="side-help">
          <span className="help-icon">
            <Sparkles size={16} />
          </span>
          <b>Curious by nature?</b>
          <p>Every great discovery starts with a question.</p>
          <button onClick={() => setPage("lab")}>
            Explore the lab <ArrowRight size={14} />
          </button>
        </div>
        <div className="side-footer">
          <span className="avatar">S</span>
          <div>
            <b>Student workspace</b>
            <small>Local session</small>
          </div>
          <MoreHorizontal size={19} />
        </div>
      </div>
    </aside>
  );
}
function Topbar({ title, setPage }) {
  return (
    <header className="topbar">
      <div className="crumb">
        Workspace <ChevronRight size={14} /> <strong>{title}</strong>
      </div>
      <div className="top-actions">
        <span className="availability">
          <i /> Your lab is ready
        </span>
        <button
          className="icon-btn"
          title="About this lab"
          onClick={() => setPage("about")}
        >
          <HelpCircle size={19} />
        </button>
        <span className="avatar small">S</span>
      </div>
    </header>
  );
}
function Library({ open, openOxygen, saved, setSaved }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All experiments");
  const matches =
    "acid base neutralization titration strong acid chemistry".includes(
      query.toLowerCase(),
    ) &&
    (filter === "All experiments" || filter === "Acid & base");
  const matchesOxygen =
    "oxygen decomposition potassium chlorate inorganic chemistry".includes(
      query.toLowerCase(),
    ) &&
    (filter === "All experiments" || filter === "Inorganic chemistry");
  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> THE VIRTUAL CHEMISTRY LAB
          </div>
          <h1>
            Curiosity looks good on you<span>.</span>
          </h1>
          <p>
            A little curiosity goes a long way. Explore, experiment, and
            <br className="desktop" /> discover chemistry in a whole new
            dimension.
          </p>
          <button className="primary" onClick={open}>
            Enter the virtual lab <ArrowRight size={16} />
          </button>
        </div>
        <div className="hero-art">
          <img src="/lab-hero.png" alt="Illustration of laboratory glassware" />
          <div className="hero-tag">
            <span>
              <Sparkles size={16} />
            </span>
            <div>
              <b>Made for discovery</b>
              <small>Your lab, wherever you are.</small>
            </div>
          </div>
        </div>
      </div>
      <div className="section-head">
        <div>
          <div className="eyebrow muted">FIND SOMETHING FASCINATING</div>
          <h2>
            Explore experiments <span>✳</span>
          </h2>
          <p>Big discoveries begin with a single experiment.</p>
        </div>
        <div className="count-pill">
          <span>02</span> interactive experiments
        </div>
      </div>
      <div className="filter-row">
        <div className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experiments, topics..."
            aria-label="Search experiments"
          />
          <span>⌘ K</span>
        </div>
        <div className="select-wrap">
          <SlidersHorizontal size={16} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter experiments"
          >
            <option>All experiments</option>
            <option>Acid &amp; base</option>
            <option>Physical chemistry</option>
            <option>Inorganic chemistry</option>
          </select>
          <ChevronDown size={14} />
        </div>
      </div>
      <div className="results-line">
        <div>
          <b>All experiments</b>
          <span>{Number(matches) + Number(matchesOxygen)} results</span>
        </div>
        <div>
          Sort by <b>Featured</b> <ChevronDown size={14} />
        </div>
      </div>
      {matches || matchesOxygen ? (
        <div className="cards">
          {matches && (
            <article className="experiment-card">
              <button
                className="card-image"
                onClick={open}
                aria-label="Open acid-base neutralization"
              >
                <img src="/lab-hero.png" alt="Flask and burette illustration" />
                <span className="card-type">
                  <span /> INTERACTIVE 3D
                </span>
                <span className="image-open">
                  <ArrowUpRight size={19} />
                </span>
              </button>
              <div className="card-body">
                <div className="card-top">
                  <span>ACID & BASE</span>
                  <button
                    className={"bookmark " + (saved ? "is-saved" : "")}
                    onClick={() => setSaved(!saved)}
                    aria-label={
                      saved ? "Remove bookmark" : "Bookmark experiment"
                    }
                  >
                    <Bookmark
                      size={18}
                      fill={saved ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <h3>Acid-base neutralization</h3>
                <p>Explore how an acid and a base react, one drop at a time.</p>
                <div className="card-meta">
                  <span>
                    <GraduationCap size={15} /> Beginner
                  </span>
                  <span>
                    <Clock size={15} /> ~15 min
                  </span>
                  <span>
                    <Layers3 size={15} /> Guided
                  </span>
                </div>
                <button className="card-link" onClick={open}>
                  Explore experiment <ArrowRight size={16} />
                </button>
              </div>
            </article>
          )}
          {matchesOxygen && (
            <article className="experiment-card">
              <button
                className="card-image"
                onClick={openOxygen}
                aria-label="Open oxygen decomposition"
              >
                <img
                  src="/lab-hero.png"
                  alt="Laboratory glassware illustration"
                />
                <span className="card-type">
                  <span /> INTERACTIVE 3D
                </span>
              </button>
              <div className="card-body">
                <div className="card-top">
                  <span>INORGANIC CHEMISTRY</span>
                </div>
                <h3>Oxygen from decomposition</h3>
                <p>Explore idealized oxygen production and collection.</p>
                <div className="card-meta">
                  <span>Beginner</span>
                  <span>Guided</span>
                </div>
                <button className="card-link" onClick={openOxygen}>
                  Explore experiment <ArrowRight size={16} />
                </button>
              </div>
            </article>
          )}
        </div>
      ) : (
        <div className="empty">
          <Search size={24} />
          <h3>No experiments found</h3>
          <p>Try another search or category.</p>
        </div>
      )}
      <div className="library-footer">
        <span>BUILT FOR THE INFINITELY CURIOUS</span>
        <span>Learn by doing. Discover by exploring. ✳</span>
      </div>
    </>
  );
}
function Lab({ data, update, undo, redo, canUndo, canRedo, reset }) {
  const [selected, setSelected] = useState("flask"),
    [tab, setTab] = useState("guide");
  const r = neutralization(
    experiment.acidMl,
    data.baseMl,
    experiment.acidM,
    experiment.baseM,
  );
  const add = () => {
    if (data.baseMl >= 50) return;
    let v = Math.min(
      experiment.maxBaseMl,
      data.baseMl + experiment.incrementMl,
    );
    update({
      ...data,
      baseMl: v,
      events: [
        ...data.events,
        `Added ${(v - data.baseMl).toFixed(1)} mL of 0.1 M NaOH. Total: ${v.toFixed(1)} mL; calculated pH ${neutralization(experiment.acidMl, v, experiment.acidM, experiment.baseM).pH.toFixed(2)}.`,
      ],
    });
  };
  const move = (id, p) =>
    update({ ...data, positions: { ...data.positions, [id]: p } });
  const transform = (dx, dz, dr = 0) => {
    const p = data.positions[selected];
    move(selected, [
      Math.max(-4, Math.min(4, p[0] + dx)),
      Math.max(-2.5, Math.min(2.5, p[1] + dz)),
      (p[2] || 0) + dr,
    ]);
  };
  return (
    <div className="lab-page">
      <div className="lab-title">
        <div>
          <div className="eyebrow muted">
            INTERACTIVE EXPERIMENT / ACID & BASE
          </div>
          <h1>Acid-base neutralization</h1>
          <p>Discover what happens when an acid meets a base.</p>
        </div>
        <span className="lab-badge">
          <span /> GUIDED EXPERIMENT
        </span>
      </div>
      <div className="lab-layout">
        <aside className="equipment-panel">
          <div className="panel-heading">
            <div>
              <span className="mini-label">YOUR WORKSPACE</span>
              <h3>Apparatus</h3>
            </div>
            <Box size={18} />
          </div>
          <p className="panel-intro">
            Select an item, then drag it around the bench.
          </p>
          {[
            ["flask", "Conical flask", "25 mL HCl"],
            ["stand", "Burette & stand", "0.1 M NaOH"],
            ["beaker", "Beaker", "For observation"],
          ].map(([id, name, sub]) => (
            <button
              key={id}
              className={"equipment " + (selected === id ? "selected" : "")}
              onClick={() => setSelected(id)}
            >
              <span className="equip-icon">
                {id === "stand" ? (
                  <TestTube2 size={21} />
                ) : (
                  <Beaker size={21} />
                )}
              </span>
              <span>
                <b>{name}</b>
                <small>{sub}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
          <div
            className="transform-controls"
            aria-label="Selected apparatus controls"
          >
            <b>Position & rotation</b>
            <div>
              <button
                onClick={() => transform(-0.25, 0)}
                aria-label="Move left"
              >
                ←
              </button>
              <button
                onClick={() => transform(0, -0.25)}
                aria-label="Move away"
              >
                ↑
              </button>
              <button
                onClick={() => transform(0, 0.25)}
                aria-label="Move closer"
              >
                ↓
              </button>
              <button
                onClick={() => transform(0.25, 0)}
                aria-label="Move right"
              >
                →
              </button>
            </div>
            <div>
              <button
                onClick={() => transform(0, 0, -Math.PI / 12)}
                aria-label="Rotate left"
              >
                ↶ 15°
              </button>
              <button
                onClick={() => transform(0, 0, Math.PI / 12)}
                aria-label="Rotate right"
              >
                ↷ 15°
              </button>
            </div>
          </div>
          <div className="equipment-note">
            <Info size={16} />
            <span>
              Drag objects to arrange them. Drag empty space to orbit the
              camera; scroll to zoom.
            </span>
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <div>
              <span className="live-dot" /> 3D WORKSPACE{" "}
              <span className="workspace-divider">/</span>{" "}
              <span className="workspace-sub">
                {selected === "flask"
                  ? "Conical flask"
                  : selected === "stand"
                    ? "Burette & stand"
                    : "Beaker"}{" "}
                selected
              </span>
            </div>
            <span>IDEAL MODEL</span>
          </div>
          <Suspense
            fallback={
              <div className="scene" role="status">
                Loading 3D workspace…
              </div>
            }
          >
            <Scene
              baseMl={data.baseMl}
              positions={data.positions}
              selected={selected}
              onSelect={setSelected}
              onMove={move}
            />
          </Suspense>
          <div className="scene-hint">
            <span>✥</span> Drag to move apparatus <i /> Orbit by dragging the
            background
          </div>
          <div className="workspace-controls">
            <div>
              <button onClick={undo} disabled={!canUndo} title="Undo">
                <Undo2 size={17} />
              </button>
              <button onClick={redo} disabled={!canRedo} title="Redo">
                <Redo2 size={17} />
              </button>
              <span className="control-sep" />
              <button onClick={reset} title="Reset experiment">
                <RotateCcw size={16} /> Reset
              </button>
            </div>
            <div className="control-status">
              <span /> Changes saved locally
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
              className={tab === "assessment" ? "on" : ""}
              onClick={() => setTab("assessment")}
            >
              Check
            </button>
          </div>
          {tab === "assessment" ? (
            <Assessment />
          ) : tab === "guide" ? (
            <div className="guide-content">
              <div className="guide-heading">
                <span className="mini-label">LET'S GET STARTED</span>
                <h3>Make a little reaction.</h3>
                <p>Follow along and see the chemistry unfold.</p>
              </div>
              <div className="step">
                <span className="step-num done">
                  <Check size={14} />
                </span>
                <div>
                  <b>Meet your materials</b>
                  <p>
                    The flask contains 25.0 mL of 0.1 M hydrochloric acid. The
                    burette contains 0.1 M sodium hydroxide.
                  </p>
                </div>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <div>
                  <b>Add the base</b>
                  <p>
                    Add NaOH in 5 mL increments and watch the calculated pH
                    change.
                  </p>
                  <button
                    className="add-button"
                    onClick={add}
                    disabled={data.baseMl >= 50}
                  >
                    <Plus size={16} /> Add 5 mL NaOH
                  </button>
                </div>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <div>
                  <b>Find the equivalence point</b>
                  <p>
                    At 25.0 mL added, equal amounts have reacted. Compare your
                    result in the Results tab.
                  </p>
                </div>
              </div>
              <div className="safety">
                <b>✳ &nbsp;A note on safety</b>
                <p>
                  Digital simulation only. Acids and bases can be hazardous;
                  real experiments require supervision and appropriate
                  protection.
                </p>
              </div>
            </div>
          ) : (
            <div className="guide-content">
              <div className="guide-heading">
                <span className="mini-label">LIVE OBSERVATIONS</span>
                <h3>The science, in numbers.</h3>
                <p>Calculated from the amounts in your flask.</p>
              </div>
              <div className="reading">
                <span>CALCULATED pH</span>
                <strong>{r.pH.toFixed(2)}</strong>
                <small>
                  {r.excess === "none"
                    ? "Equivalence point"
                    : `Excess ${r.excess}`}
                </small>
              </div>
              <div className="result-row">
                <span>HCl volume</span>
                <b>25.0 mL</b>
              </div>
              <div className="result-row">
                <span>NaOH added</span>
                <b>{data.baseMl.toFixed(1)} mL</b>
              </div>
              <div className="result-row">
                <span>Amount reacted</span>
                <b>{(r.reactedMoles * 1000).toFixed(2)} mmol</b>
              </div>
              <div className="equation">HCl + NaOH → NaCl + H₂O</div>
              <p className="model-note">
                Ideal strong acid / strong base model at 25 °C. Assumes complete
                dissociation, additive volumes and no activity corrections. The
                color is a qualitative indicator cue, not a predicted
                measurement.
              </p>
              <button
                className="add-button"
                onClick={add}
                disabled={data.baseMl >= 50}
              >
                <Plus size={16} /> Add 5 mL NaOH
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
function Assessment() {
  const [answers, setAnswers] = useState(
      Array(experiment.questions.length).fill(null),
    ),
    [feedback, setFeedback] = useState(null);
  return (
    <div className="guide-content">
      <div className="guide-heading">
        <span className="mini-label">KNOWLEDGE CHECK</span>
        <h3>What did you discover?</h3>
        <p>
          Choose an answer for each question to see your feedback. Answers are
          not saved or graded by a teacher.
        </p>
      </div>
      {experiment.questions.map((q, i) => (
        <fieldset className="question" key={q.id}>
          <legend>
            {i + 1}. {q.prompt}
          </legend>
          {q.options.map((option, j) => (
            <label key={option}>
              <input
                type="radio"
                name={q.id}
                checked={answers[i] === j}
                onChange={() => {
                  setAnswers((a) => a.map((v, k) => (k === i ? j : v)));
                  setFeedback(null);
                }}
              />{" "}
              {option}
            </label>
          ))}
          {feedback && (
            <p
              className={
                feedback[i].correct ? "answer-correct" : "answer-incorrect"
              }
            >
              {feedback[i].correct ? "Correct." : "Not quite."}{" "}
              {feedback[i].explanation}
            </p>
          )}
        </fieldset>
      ))}
      <button
        className="add-button"
        disabled={answers.some((a) => a === null)}
        onClick={() =>
          setFeedback(scoreAssessment(experiment.questions, answers))
        }
      >
        Check answers
      </button>
      {feedback && (
        <p className="model-note" role="status">
          {feedback.filter((x) => x.correct).length} of {feedback.length}{" "}
          correct
        </p>
      )}
    </div>
  );
}
function Notebook({ data, update }) {
  function download() {
    const text = `Materia lab notebook\nAcid-base neutralization\n\n${data.events.join("\n")}\n\nNotes:\n${data.notes}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "materia-notebook.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="simple-page">
      <div className="eyebrow muted">YOUR LEARNING</div>
      <h1>
        Lab notebook<span>.</span>
      </h1>
      <p>
        Your observations, all in one place. This notebook is saved on this
        device.
      </p>
      <div className="notebook">
        <div className="notebook-head">
          <div>
            <span className="mini-label">EXPERIMENT 01</span>
            <h2>Acid-base neutralization</h2>
          </div>
          <button className="outline" onClick={download}>
            <Download size={16} /> Export notes
          </button>
        </div>
        <h3>Activity log</h3>
        <div className="event-list">
          {data.events.map((e, i) => (
            <div key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {e}
            </div>
          ))}
        </div>
        <label htmlFor="notes">Your observations</label>
        <textarea
          id="notes"
          placeholder="What did you notice? Add your notes here..."
          value={data.notes}
          onChange={(e) => update({ ...data, notes: e.target.value }, false)}
        />
      </div>
    </div>
  );
}
function App() {
  const [page, setPage] = useState("library"),
    [saved, setSavedState] = useState(
      () => localStorage.getItem("materia-bookmark") === "true",
    ),
    [data, setData] = useState(read),
    [past, setPast] = useState([]),
    [future, setFuture] = useState([]);
  function setSaved(v) {
    setSavedState(v);
    localStorage.setItem("materia-bookmark", v);
  }
  function put(d) {
    setData(d);
    localStorage.setItem("materia-session", JSON.stringify(d));
  }
  function update(d, history = true) {
    if (history) {
      setPast((p) => [...p.slice(-49), data]);
      setFuture([]);
    }
    put(d);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [...f, data]);
    put({ ...past[past.length - 1], notes: data.notes });
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, data]);
    put({ ...future[future.length - 1], notes: data.notes });
    setFuture((f) => f.slice(0, -1));
  }
  function reset() {
    if (
      window.confirm(
        "Reset the experiment? Your notes and activity log will also be cleared.",
      )
    )
      update(initial);
  }
  const title = {
    library: "Discover",
    lab: "Virtual lab",
    oxygen: "Oxygen simulation",
    liquid: "Liquid workspace",
    reactions: "Reaction exercises",
    notebook: "Lab notebook",
    saved: "Saved experiments",
    about: "About",
  }[page];
  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} />
      <main>
        <Topbar title={title} setPage={setPage} />
        <div
          className={
            "content " +
            (["lab", "oxygen", "liquid"].includes(page) ? "lab-content" : "")
          }
        >
          {page === "library" ? (
            <Library
              open={() => setPage("lab")}
              openOxygen={() => setPage("oxygen")}
              saved={saved}
              setSaved={setSaved}
            />
          ) : page === "lab" ? (
            <Lab
              data={data}
              update={update}
              undo={undo}
              redo={redo}
              canUndo={!!past.length}
              canRedo={!!future.length}
              reset={reset}
            />
          ) : page === "oxygen" ? (
            <Suspense fallback={<div>Loading experiment…</div>}>
              <OxygenLab />
            </Suspense>
          ) : page === "liquid" ? (
            <Suspense fallback={<div>Loading workspace…</div>}>
              <LiquidLab />
            </Suspense>
          ) : page === "reactions" ? (
            <Suspense fallback={<div>Loading exercises…</div>}>
              <ReactionExercises />
            </Suspense>
          ) : page === "notebook" ? (
            <Notebook data={data} update={update} />
          ) : page === "saved" ? (
            <div className="simple-page">
              <div className="eyebrow muted">YOUR LEARNING</div>
              <h1>
                Saved experiments<span>.</span>
              </h1>
              <p>Keep your favorite discoveries close by.</p>
              {saved ? (
                <button className="saved-row" onClick={() => setPage("lab")}>
                  <FlaskConical /> Acid-base neutralization{" "}
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div className="empty">
                  <Bookmark />
                  <h3>Nothing saved yet</h3>
                  <p>Bookmark an experiment in Discover to find it here.</p>
                  <button
                    className="outline"
                    onClick={() => setPage("library")}
                  >
                    Explore experiments
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="simple-page">
              <div className="eyebrow muted">ABOUT MATERIA</div>
              <h1>
                A lab for curious minds<span>.</span>
              </h1>
              <p>
                Materia is an early open-source virtual chemistry workspace. The
                current experiment uses an idealized educational model and is
                not a substitute for laboratory training or scientific review.
              </p>
              <button className="primary" onClick={() => setPage("library")}>
                Explore experiments <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
