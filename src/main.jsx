import React, { useState, useEffect, lazy, Suspense } from "react";
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
const LiquidLab = lazy(() => import("./LiquidLab"));
const SessionWorkbench = lazy(() => import("./SessionWorkbench"));

const SharedNotebook = lazy(() => import("./SharedNotebook"));
const ReactionExercises = lazy(() => import("./ReactionExercises"));
import { parseExperimentRoute, experimentHash } from "./lab/launch";
import ExperimentErrorBoundary from "./ExperimentErrorBoundary";
import "./style.css";
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
      <button
        className={"nav-item " + (page === "guided" ? "active" : "")}
        onClick={() => setPage("guided")}
      >
        <TestTube2 size={18} /> Guided laboratory
      </button>
      <button
        className={"nav-item " + (page === "free" ? "active" : "")}
        onClick={() => setPage("free")}
      >
        <Box size={18} /> Free exploration
      </button>
      <button
        className={"nav-item " + (page === "shared-notebook" ? "active" : "")}
        onClick={() => setPage("shared-notebook")}
      >
        <BookOpen size={18} /> Activity notebook
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
export function App() {
  const readRoute = () => parseExperimentRoute(window.location.hash);
  const [route, setRoute] = useState(readRoute),
    [basePage, setBasePage] = useState("library"),
    page = route ? "experiment" : basePage,
    setPage = (next) => {
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      setRoute(null);
      setBasePage(next);
    },
    launch = (id) => {
      const hash = experimentHash(id);
      window.history.pushState(null, "", hash);
      setRoute(parseExperimentRoute(hash));
    },
    [saved, setSavedState] = useState(
      () => localStorage.getItem("materia-bookmark") === "true",
    );
  useEffect(() => {
    const onNavigation = () => {
      setRoute(readRoute());
      setBasePage("library");
    };
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("hashchange", onNavigation);
    return () => {
      window.removeEventListener("popstate", onNavigation);
      window.removeEventListener("hashchange", onNavigation);
    };
  }, []);
  function setSaved(v) {
    setSavedState(v);
    localStorage.setItem("materia-bookmark", v);
  }
  const title = {
    library: "Discover",
    experiment: route?.experiment?.title || "Experiment",
    lab: "Virtual lab",
    oxygen: "Oxygen simulation",
    liquid: "Liquid workspace",
    guided: "Guided laboratory",
    free: "Free exploration",
    reactions: "Reaction exercises",
    notebook: "Lab notebook",
    "shared-notebook": "Activity notebook",
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
            ([
              "lab",
              "oxygen",
              "liquid",
              "guided",
              "free",
              "experiment",
            ].includes(page)
              ? "lab-content"
              : "")
          }
        >
          {page === "library" ? (
            <Library
              open={() => launch("neutralization")}
              openOxygen={() => launch("oxygen")}
              saved={saved}
              setSaved={setSaved}
            />
          ) : page === "experiment" ? (
            route.experiment ? (
              <ExperimentErrorBoundary
                key={route.id}
                onReturn={() => setPage("library")}
              >
                <Suspense
                  fallback={<div role="status">Loading experiment…</div>}
                >
                  <SessionWorkbench
                    initialMode="guided"
                    experimentId={route.id}
                    onReturn={() => setPage("library")}
                  />
                </Suspense>
              </ExperimentErrorBoundary>
            ) : (
              <div className="simple-page" role="alert">
                <h1>Experiment not found</h1>
                <p>This experiment ID is not available.</p>
                <button onClick={() => setPage("library")}>
                  Return to Discover
                </button>
              </div>
            )
          ) : page === "lab" ? (
            <SessionWorkbench
              key="neutralization-workbench"
              initialMode="guided"
              experimentId="neutralization"
            />
          ) : page === "oxygen" ? (
            <SessionWorkbench
              key="oxygen-workbench"
              initialMode="guided"
              experimentId="oxygen"
            />
          ) : page === "liquid" ? (
            <Suspense fallback={<div>Loading workspace…</div>}>
              <LiquidLab />
            </Suspense>
          ) : page === "reactions" ? (
            <Suspense fallback={<div>Loading exercises…</div>}>
              <ReactionExercises />
            </Suspense>
          ) : page === "guided" ? (
            <Suspense fallback={<div>Loading laboratory…</div>}>
              <SessionWorkbench key="guided" initialMode="guided" />
            </Suspense>
          ) : page === "free" ? (
            <Suspense fallback={<div>Loading workspace…</div>}>
              <SessionWorkbench key="free" initialMode="free" />
            </Suspense>
          ) : page === "shared-notebook" ? (
            <Suspense fallback={<div>Loading notebook…</div>}>
              <SharedNotebook />
            </Suspense>
          ) : page === "notebook" ? (
            <Suspense fallback={<div>Loading notebook…</div>}>
              <SharedNotebook />
            </Suspense>
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

if (typeof document !== "undefined")
  createRoot(document.getElementById("root")).render(<App />);
