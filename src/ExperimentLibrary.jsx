import React, { useState } from "react";
import { ArrowRight, BookOpen, Bookmark, Clock, FlaskConical, Search } from "lucide-react";
import {
  builtInExperimentLibrary,
  loadExperimentStore,
  searchExperimentLibrary,
} from "./lab/experiment-authoring";

export default function ExperimentLibrary({ onLaunch, onAuthoring, savedId, onToggleSaved }) {
  const [query, setQuery] = useState("");
  const [educationLevel, setEducationLevel] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [subject, setSubject] = useState("all");
  const [loaded] = useState(() => {
    try {
      const store = loadExperimentStore(localStorage);
      return { items: [...builtInExperimentLibrary(), ...store.published], error: "" };
    } catch (caught) {
      return { items: builtInExperimentLibrary(), error: caught instanceof Error ? caught.message : "Experiment library could not be loaded." };
    }
  });
  const { items, error } = loaded;
  const subjects = [...new Set(items.map((item) => item.subject))].sort();
  const results = searchExperimentLibrary(items, { query, educationLevel, difficulty, subject });
  return (
    <div className="simple-page experiment-library">
      <div className="section-head">
        <div>
          <div className="eyebrow muted">CHEMISTRY LEARNING LIBRARY</div>
          <h1>Explore experiments<span>.</span></h1>
          <p>Choose a validated activity and work in the shared 3D laboratory.</p>
        </div>
        <button className="primary" onClick={onAuthoring}><BookOpen size={16} /> Author an experiment</button>
      </div>
      {error && <p role="alert" className="answer-incorrect">{error} Built-in experiments remain available.</p>}
      <div className="experiment-library-filters">
        <label className="search"><Search size={18} /><input aria-label="Search published experiments" placeholder="Search title, topic, objectives…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Education level<select aria-label="Filter by education level" value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)}>
          <option value="all">All levels</option><option value="middle-school">Middle school</option><option value="high-school">High school</option><option value="undergraduate">Undergraduate</option><option value="general">General</option>
        </select></label>
        <label>Difficulty<select aria-label="Filter by difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="all">All difficulties</option><option value="introductory">Introductory</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select></label>
        <label>Subject<select aria-label="Filter by subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="all">All subjects</option>{subjects.map((name) => <option key={name}>{name}</option>)}
        </select></label>
      </div>
      <div className="results-line"><div><b>Published experiments</b><span>{results.length} results</span></div></div>
      {results.length ? <div className="cards">
        {results.map((item) => <article className="experiment-card authored-experiment-card" key={item.id}>
          <div className="card-body">
            <div className="card-top"><span>{item.subject.toLocaleUpperCase()} · {item.topic}</span><button className={`bookmark ${savedId === item.id ? "is-saved" : ""}`} aria-label={savedId === item.id ? "Remove bookmark" : `Bookmark ${item.title}`} onClick={() => onToggleSaved(item.id)}><Bookmark size={17} fill={savedId === item.id ? "currentColor" : "none"} /></button><span className="published-badge">PUBLISHED</span></div>
            <h3>{item.title}</h3><p>{item.description}</p>
            <details><summary>Learning objectives and setup</summary>
              <ul>{item.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
              <p><b>Equipment:</b> {item.apparatus.map((item) => item.kind).join(", ")}</p>
              <p><b>Safety:</b> {item.safetyWarnings.join(" ")}</p>
            </details>
            <div className="card-meta"><span>{item.educationLevel.replaceAll("-", " ")}</span><span>{item.difficulty}</span><span><Clock size={14} /> ~{item.estimatedDurationMinutes} min</span></div>
            <button className="card-link" onClick={() => onLaunch(item)}>{item.builtIn ? "Open experiment" : "Launch experiment"} <ArrowRight size={16} /></button>
          </div>
        </article>)}
      </div> : <div className="empty"><FlaskConical size={25} /><h3>No experiments found</h3><p>Adjust the search or filters to see more activities.</p></div>}
    </div>
  );
}
