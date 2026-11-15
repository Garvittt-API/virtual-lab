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
import { parseExperimentRoute, experimentHash, resolvePublishedExperiment } from "./lab/launch";
import { getPublishedExperiment } from "./lab/experiment-authoring";
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
        className={"nav-item " + (page === "authoring" ? "active" : "")}
        onClick={() => setPage("authoring")}
      >
        <FlaskConical size={18} /> Authoring studio
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
const ExperimentLibrary = lazy(() => import("./ExperimentLibrary"));
const ExperimentAuthoringStudio = lazy(() => import("./ExperimentAuthoringStudio"));
export function App() {
  const readRoute = () => {
    const route = parseExperimentRoute(window.location.hash);
    if (route && !route.experiment) {
      try { route.experiment = resolvePublishedExperiment(localStorage, route.id); }
      catch { route.experiment = null; }
    }
    return route;
  };
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
    launch = (item) => {
      const id = typeof item === "string" ? item : item.id;
      const hash = experimentHash(id);
      window.history.pushState(null, "", hash);
      setRoute(readRoute());
    },
    launchLibraryItem = (item) => {
      if (item.builtIn) launch(item.id);
      else {
        const hash = `#/experiments/${item.id}`;
        window.history.pushState(null, "", hash);
        setRoute({ id: item.id, experiment: item });
      }
    },
    [savedId, setSavedId] = useState(
      () => localStorage.getItem("materia-bookmark-id") || (localStorage.getItem("materia-bookmark") === "true" ? "neutralization" : ""),
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
  function toggleSaved(id) {
    const next = savedId === id ? "" : id;
    setSavedId(next);
    localStorage.setItem("materia-bookmark-id", next);
    localStorage.setItem("materia-bookmark", String(Boolean(next)));
  }
  const title = {
    library: "Discover",
    experiment: route?.experiment?.title || "Experiment",
    authoring: "Authoring studio",
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
            <Suspense fallback={<div role="status">Loading experiment library…</div>}>
              <ExperimentLibrary onLaunch={launchLibraryItem} onAuthoring={() => setPage("authoring")} savedId={savedId} onToggleSaved={toggleSaved} />
            </Suspense>
          ) : page === "authoring" ? (
            <Suspense fallback={<div role="status">Loading authoring studio…</div>}>
              <ExperimentAuthoringStudio onLibrary={() => setPage("library")} />
            </Suspense>
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
                    experimentId={route.experiment?.builtIn ? route.id : undefined}
                    initialManifest={route.experiment?.schemaVersion ? route.experiment : undefined}
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
              {savedId ? (
                <button className="saved-row" onClick={() => launchLibraryItem(getPublishedExperiment(localStorage, savedId))}>
                  <FlaskConical /> {getPublishedExperiment(localStorage, savedId)?.title || "Saved experiment"}{" "}
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
