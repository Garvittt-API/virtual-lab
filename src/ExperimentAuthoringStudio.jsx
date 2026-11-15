import React, { useState } from "react";
import { ArrowLeft, Download, Eye, FileUp, Plus, Save, ShieldCheck, X } from "lucide-react";
import SessionWorkbench from "./SessionWorkbench";
import { equipment, stocks } from "./lab/registry";
import {
  createDraftManifest,
  duplicateExperimentManifest,
  exportExperimentManifest,
  importExperimentManifest,
  loadExperimentStore,
  saveExperimentStore,
  supportedInstructionTypes,
  validateExperimentManifest,
} from "./lab/experiment-authoring";

const now = () => new Date().toISOString();
const newId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
const splitLines = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean);

function defaultCommand(type, manifest) {
  const first = manifest.apparatus[0]?.id || "";
  const second = manifest.apparatus[1]?.id || first;
  const vessels = manifest.apparatus.filter((item) => equipment[item.kind]?.operations.includes("receive"));
  const reactionVessel = vessels[0]?.id || first;
  if (type === "add") return { type, id: reactionVessel, stock: "acid", volumeMl: 10 };
  if (type === "transfer") return { type, from: vessels.find((item) => item.id === first)?.id || reactionVessel, to: vessels.find((item) => item.id !== reactionVessel)?.id || second, volumeMl: 10 };
  if (["mix", "measure", "measure-volume"].includes(type)) return { type, id: reactionVessel, ...(type === "measure" ? { solute: "HCl" } : {}) };
  if (type === "measure-gas") return { type, id: manifest.apparatus.find((item) => equipment[item.kind]?.operations.includes("measure-gas"))?.id || "" };
  if (type === "react") return { type, id: reactionVessel, reactionId: "neutralization" };
  return { type: "mix", id: reactionVessel };
}

export default function ExperimentAuthoringStudio({ onLibrary }) {
  const [loadError] = useState(() => {
    try { loadExperimentStore(localStorage); return ""; }
    catch (caught) { return caught instanceof Error ? caught.message : "Stored experiments could not be loaded."; }
  });
  const [library, setLibrary] = useState(() => {
    try { return loadExperimentStore(localStorage); }
    catch { return { version: 1, drafts: [], published: [] }; }
  });
  const [manifest, setManifest] = useState(null);
  const [tab, setTab] = useState("basics");
  const [preview, setPreview] = useState(false);
  const [validation, setValidation] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importCounter, setImportCounter] = useState(0);

  function persist(nextLibrary, notice = "Draft saved on this device.") {
    if (loadError) { setError(`Existing experiment data could not be read: ${loadError}. Export or repair it before saving to avoid replacing it.`); return false; }
    try {
      saveExperimentStore(localStorage, nextLibrary);
      setLibrary(nextLibrary); setMessage(notice); setError("");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save experiment.");
      return false;
    }
  }
  function patchManifest(update) {
    setManifest((current) => ({ ...current, ...update, metadata: { ...current.metadata, updatedAt: now() } }));
    setValidation(null); setMessage("");
  }
  function openDraft(item) { setManifest(structuredClone(item)); setTab("basics"); setValidation(null); setError(""); setMessage(""); }
  function createDraft() {
    let id = `author-${newId().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48)}`;
    while ([...library.drafts, ...library.published].some((item) => item.id === id)) id = `author-${newId().replace(/[^a-z0-9]/g, "").slice(0, 48)}`;
    const next = createDraftManifest(now(), id);
    setManifest(next); setTab("basics"); setValidation(null); setError(""); setMessage("");
  }
  function saveDraft() {
    if (!manifest) return false;
    if (library.published.some((item) => item.id === manifest.id)) { setError("Published definitions are read-only. Duplicate one to create an editable draft."); return false; }
    const nextManifest = { ...manifest, status: "draft", metadata: { ...manifest.metadata, updatedAt: now() } };
    const drafts = library.drafts.filter((item) => item.id !== manifest.id).concat(nextManifest);
    if (persist({ ...library, drafts })) { setManifest(nextManifest); return true; }
    return false;
  }
  function duplicateDraft(source = manifest) {
    if (!source) return;
    const stem = `${source.id.slice(0, 50)}-copy`;
    let id = stem;
    let suffix = 2;
    while ([...library.drafts, ...library.published].some((item) => item.id === id)) id = `${stem.slice(0, 61)}-${suffix++}`;
    const copy = duplicateExperimentManifest(source, now(), id);
    setManifest(copy); setValidation(null); setMessage("");
  }
  function addApparatus() {
    if (!manifest || manifest.apparatus.length >= 12) return;
    const index = manifest.apparatus.length + 1;
    const item = { id: `v${index}`, kind: "beaker", position: [Math.max(-4, Math.min(4, -1 + index * 0.5)), Math.min(2.5, -0.5 + (index % 2)), 0] };
    const ids = new Set(manifest.apparatus.map((v) => v.id));
    while (ids.has(item.id)) item.id = `v${Number(item.id.slice(1)) + 1}`;
    patchManifest({ apparatus: [...manifest.apparatus, item] });
  }
  function addChemical() {
    if (!manifest || !manifest.apparatus.length) return;
    const vessel = manifest.apparatus.find((item) => equipment[item.kind]?.operations.includes("receive")) || manifest.apparatus[0];
    patchManifest({ initialChemicals: [...manifest.initialChemicals, { equipmentId: vessel.id, stockId: "acid", volumeMl: 10, concentrationM: 0.1 }] });
  }
  function addConnection() {
    if (!manifest || manifest.apparatus.length < 2) return;
    patchManifest({ initialConnections: [...manifest.initialConnections, { a: manifest.apparatus[0].id, ap: "stem", b: manifest.apparatus[1].id, bp: "mouth" }] });
  }
  function addInstruction() {
    if (!manifest || manifest.instructions.length >= 40) return;
    const command = defaultCommand("add", manifest);
    patchManifest({ instructions: [...manifest.instructions, { id: `step-${manifest.instructions.length + 1}`, instruction: "Describe what the learner should do.", command }], supportedOperations: [...new Set([...manifest.supportedOperations, command.type])] });
  }
  function updateInstruction(index, update) {
    const instructions = manifest.instructions.map((step, i) => i === index ? { ...step, ...update } : step);
    patchManifest({ instructions });
  }
  function updateCommand(index, type) {
    const command = defaultCommand(type, manifest);
    const instructions = manifest.instructions.map((step, i) => i === index ? { ...step, command } : step);
    const reactionIds = type === "react" ? [...new Set([...manifest.reactionIds, command.reactionId])] : manifest.reactionIds;
    const measurements = type === "measure" ? [...new Set([...manifest.measurements, "concentration"])] : type === "measure-volume" ? [...new Set([...manifest.measurements, "volume"])] : type === "measure-gas" ? [...new Set([...manifest.measurements, "gas-inventory"])] : manifest.measurements;
    patchManifest({ instructions, reactionIds, measurements, supportedOperations: [...new Set([...manifest.supportedOperations, type])] });
  }
  function validate() {
    if (!manifest) return;
    const result = validateExperimentManifest({ ...manifest, status: "draft" });
    setValidation(result); setTab("review");
    if (result.valid) setMessage(`Validation passed with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}.`);
    else setMessage("");
  }
  function publish() {
    if (!manifest) return;
    const checked = validateExperimentManifest({ ...manifest, status: "draft" });
    setValidation(checked);
    if (!checked.valid) { setError("Resolve validation errors before publishing."); setTab("review"); return; }
    if (library.drafts.some((item) => item.id === manifest.id)) {
      const drafts = library.drafts.filter((item) => item.id !== manifest.id);
      const published = [...library.published, { ...manifest, status: "published", metadata: { ...manifest.metadata, updatedAt: now() } }];
      const result = persist({ ...library, drafts, published }, "Published to this device’s experiment library.");
      if (result) setManifest((current) => ({ ...current, status: "published" }));
    } else if (!library.published.some((item) => item.id === manifest.id)) {
      const published = [...library.published, { ...manifest, status: "published", metadata: { ...manifest.metadata, updatedAt: now() } }];
      const result = persist({ ...library, published }, "Published to this device’s experiment library.");
      if (result) setManifest((current) => ({ ...current, status: "published" }));
    } else setError("This published experiment is read-only. Duplicate it to make changes.");
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const imported = importExperimentManifest(await file.text());
      if ([...library.drafts, ...library.published].some((item) => item.id === imported.id)) throw new Error("That experiment ID already exists. Duplicate or rename the definition before importing.");
      setImportCounter((count) => count + 1); setManifest(imported); setValidation(null); setMessage("Imported as a draft. Save it to keep it in this browser."); setError(""); setTab("basics");
    } catch (caught) { setError(`Import failed: ${caught instanceof Error ? caught.message : "invalid experiment file"}`); }
  }
  function exportFile() {
    try {
      const blob = new Blob([exportExperimentManifest(manifest)], { type: "application/json" });
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${manifest.id}.materia-experiment.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Export failed."); }
  }
  function previewExperiment() {
    const checked = validateExperimentManifest({ ...manifest, status: "draft" });
    setValidation(checked);
    if (!checked.valid) { setError("Resolve validation errors before previewing."); setTab("review"); return; }
    if (saveDraft()) setPreview(true);
  }

  if (preview && manifest) return <div className="author-preview">
    <div className="author-preview-bar"><button onClick={() => setPreview(false)}><ArrowLeft size={16} /> Return to authoring studio</button><span>Live preview · {manifest.title}</span></div>
    <SessionWorkbench key={`preview-${manifest.id}-${manifest.metadata.updatedAt}`} initialMode="guided" initialManifest={{ ...manifest, status: "draft" }} />
  </div>;

  const tabs = ["basics", "setup", "procedure", "review"];
  return <div className="simple-page authoring-studio">
    <div className="section-head"><div><div className="eyebrow muted">LOCAL EXPERIMENT AUTHORING</div><h1>Authoring studio<span>.</span></h1><p>Create a validated activity using the current chemistry and equipment models.</p></div><button onClick={onLibrary}><ArrowLeft size={16} /> Experiment library</button></div>
    <p className="authoring-local-notice"><ShieldCheck size={17} /> Drafts and publications are stored in this browser. This app has no server identity or author roles; local publishing does not create server-side authorization.</p>
    {loadError && <p role="alert" className="answer-incorrect">Stored experiment data is unavailable: {loadError}. Saving is disabled to protect the existing browser data.</p>}
    {error && <p role="alert" className="answer-incorrect">{error}</p>}{message && <p role="status" className="author-status">{message}</p>}
    <div className="authoring-layout">
      <aside className="authoring-drafts">
        <button className="primary" onClick={createDraft}><Plus size={16} /> New experiment</button>
        <h3>Drafts · {library.drafts.length}</h3>
        {library.drafts.map((draft) => <button key={draft.id} className={`author-draft ${manifest?.id === draft.id ? "selected" : ""}`} onClick={() => openDraft(draft)}><b>{draft.title || "Untitled"}</b><small>{draft.id} · Draft</small></button>)}
        <h3>Published · {library.published.length}</h3>
        {library.published.map((item) => <div className="author-draft" key={item.id}><b>{item.title}</b><small>{item.id} · Published · read-only</small><button onClick={() => duplicateDraft(item)}>Duplicate for editing</button></div>)}
        <label className="import-experiment">Import definition<FileUp size={15} /><input key={importCounter} type="file" accept="application/json,.json" onChange={importFile} /></label>
      </aside>
      {!manifest ? <div className="author-empty"><h2>Start with a draft</h2><p>Define the learning goal, apparatus and supported procedure. Validation checks it against the same equipment and chemistry engine used by the workbench.</p><button className="primary" onClick={createDraft}>Create experiment draft</button></div> : <section className="author-editor">
        <div className="author-editor-heading"><div><span className={`published-badge ${manifest.status}`}>{manifest.status.toUpperCase()}</span><h2>{manifest.title}</h2><small>ID: {manifest.id} · schema v{manifest.schemaVersion}</small></div><div className="author-editor-actions"><button onClick={saveDraft}><Save size={15} /> Save draft</button><button onClick={() => duplicateDraft()}><Plus size={15} /> Duplicate</button><button onClick={exportFile}><Download size={15} /> Export</button></div></div>
        <div className="author-tabs" role="tablist">{tabs.map((name) => <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
        {tab === "basics" && <div className="author-section">
          <h3>Experiment brief</h3><label>Title<input maxLength={120} value={manifest.title} onChange={(e) => patchManifest({ title: e.target.value })} /></label>
          <label>Description<textarea maxLength={1600} value={manifest.description} onChange={(e) => patchManifest({ description: e.target.value })} /></label>
          <div className="author-grid"><label>Subject<input maxLength={80} value={manifest.subject} onChange={(e) => patchManifest({ subject: e.target.value })} /></label><label>Topic<input maxLength={120} value={manifest.topic} onChange={(e) => patchManifest({ topic: e.target.value })} /></label>
            <label>Education level<select value={manifest.educationLevel} onChange={(e) => patchManifest({ educationLevel: e.target.value })}><option value="middle-school">Middle school</option><option value="high-school">High school</option><option value="undergraduate">Undergraduate</option><option value="general">General</option></select></label>
            <label>Difficulty<select value={manifest.difficulty} onChange={(e) => patchManifest({ difficulty: e.target.value })}><option value="introductory">Introductory</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label>Estimated minutes<input type="number" min="1" max="240" value={manifest.estimatedDurationMinutes} onChange={(e) => patchManifest({ estimatedDurationMinutes: Number(e.target.value) })} /></label>
            <label>Author label<input maxLength={100} value={manifest.metadata.author} onChange={(e) => patchManifest({ metadata: { ...manifest.metadata, author: e.target.value, updatedAt: now() } })} /></label></div>
          <label>Learning objectives · one per line<textarea value={manifest.learningObjectives.join("\n")} onChange={(e) => patchManifest({ learningObjectives: splitLines(e.target.value) })} /></label>
          <label>Required knowledge · one per line<textarea value={manifest.requiredKnowledge.join("\n")} onChange={(e) => patchManifest({ requiredKnowledge: splitLines(e.target.value) })} /></label>
        </div>}
        {tab === "setup" && <div className="author-section"><h3>Apparatus and starting material</h3>
          {manifest.apparatus.map((item, index) => <div className="author-row" key={item.id}><label>Equipment<select value={item.kind} onChange={(e) => patchManifest({ apparatus: manifest.apparatus.map((row, i) => i === index ? { ...row, kind: e.target.value } : row) })}>{Object.values(equipment).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label><label>Stable ID<input value={item.id} maxLength={32} onChange={(e) => patchManifest({ apparatus: manifest.apparatus.map((row, i) => i === index ? { ...row, id: e.target.value } : row) })} /></label><label>X<input type="number" step="0.25" min="-4" max="4" value={item.position[0]} onChange={(e) => patchManifest({ apparatus: manifest.apparatus.map((row, i) => i === index ? { ...row, position: [Number(e.target.value), row.position[1], row.position[2]] } : row) })} /></label><label>Z<input type="number" step="0.25" min="-2.5" max="2.5" value={item.position[1]} onChange={(e) => patchManifest({ apparatus: manifest.apparatus.map((row, i) => i === index ? { ...row, position: [row.position[0], Number(e.target.value), row.position[2]] } : row) })} /></label><button aria-label={`Remove equipment ${item.id}`} onClick={() => patchManifest({ apparatus: manifest.apparatus.filter((_, i) => i !== index), initialChemicals: manifest.initialChemicals.filter((chemical) => chemical.equipmentId !== item.id), initialConnections: manifest.initialConnections.filter((connection) => connection.a !== item.id && connection.b !== item.id) })}><X size={15} /></button></div>)}
          <button onClick={addApparatus} disabled={manifest.apparatus.length >= 12}><Plus size={15} /> Add equipment</button>
          <h3>Initial solutions</h3>{manifest.initialChemicals.map((chemical, index) => <div className="author-row" key={`${chemical.equipmentId}-${index}`}><label>Vessel<select value={chemical.equipmentId} onChange={(e) => patchManifest({ initialChemicals: manifest.initialChemicals.map((item, i) => i === index ? { ...item, equipmentId: e.target.value } : item) })}>{manifest.apparatus.map((item) => <option key={item.id} value={item.id}>{item.id} · {equipment[item.kind]?.name}</option>)}</select></label><label>Stock<select value={chemical.stockId} onChange={(e) => patchManifest({ initialChemicals: manifest.initialChemicals.map((item, i) => i === index ? { ...item, stockId: e.target.value } : item) })}>{Object.values(stocks).map((stock) => <option key={stock.id} value={stock.id}>{stock.name}</option>)}</select></label><label>mL<input type="number" min="0" step="any" value={chemical.volumeMl} onChange={(e) => patchManifest({ initialChemicals: manifest.initialChemicals.map((item, i) => i === index ? { ...item, volumeMl: Number(e.target.value) } : item) })} /></label><label>mol/L<input type="number" min="0" max="20" step="any" value={chemical.concentrationM} onChange={(e) => patchManifest({ initialChemicals: manifest.initialChemicals.map((item, i) => i === index ? { ...item, concentrationM: Number(e.target.value) } : item) })} /></label><button aria-label="Remove initial solution" onClick={() => patchManifest({ initialChemicals: manifest.initialChemicals.filter((_, i) => i !== index) })}><X size={15} /></button></div>)}
          <button onClick={addChemical} disabled={!manifest.apparatus.length}><Plus size={15} /> Add initial solution</button>
          <h3>Apparatus connections</h3>{manifest.initialConnections.map((connection, index) => { const a = manifest.apparatus.find((item) => item.id === connection.a), b = manifest.apparatus.find((item) => item.id === connection.b); return <div className="author-row" key={`connection-${index}`}><label>Equipment A<select value={connection.a} onChange={(e) => patchManifest({ initialConnections: manifest.initialConnections.map((item, i) => i === index ? { ...item, a: e.target.value } : item) })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>Port A<select value={connection.ap} onChange={(e) => patchManifest({ initialConnections: manifest.initialConnections.map((item, i) => i === index ? { ...item, ap: e.target.value } : item) })}>{Object.keys(equipment[a?.kind]?.ports || {}).map((port) => <option key={port}>{port}</option>)}</select></label><label>Equipment B<select value={connection.b} onChange={(e) => patchManifest({ initialConnections: manifest.initialConnections.map((item, i) => i === index ? { ...item, b: e.target.value } : item) })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>Port B<select value={connection.bp} onChange={(e) => patchManifest({ initialConnections: manifest.initialConnections.map((item, i) => i === index ? { ...item, bp: e.target.value } : item) })}>{Object.keys(equipment[b?.kind]?.ports || {}).map((port) => <option key={port}>{port}</option>)}</select></label><button aria-label="Remove apparatus connection" onClick={() => patchManifest({ initialConnections: manifest.initialConnections.filter((_, i) => i !== index) })}><X size={15} /></button></div>; })}
          <button onClick={addConnection} disabled={manifest.apparatus.length < 2}><Plus size={15} /> Add connection</button>
        </div>}
        {tab === "procedure" && <div className="author-section"><h3>Procedure and scientific observations</h3><p>Each step is a fixed allowlisted command. No scripts or executable code can be imported.</p>
          {manifest.instructions.map((step, index) => <div className="author-step" key={step.id}><div className="author-row"><label>Operation<select value={step.command.type} onChange={(e) => updateCommand(index, e.target.value)}>{supportedInstructionTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Step ID<input value={step.id} onChange={(e) => updateInstruction(index, { id: e.target.value })} /></label><button aria-label={`Remove step ${step.id}`} onClick={() => patchManifest({ instructions: manifest.instructions.filter((_, i) => i !== index) })}><X size={15} /></button></div><label>Instruction<textarea maxLength={1000} value={step.instruction} onChange={(e) => updateInstruction(index, { instruction: e.target.value })} /></label>
            {step.command.type === "add" && <div className="author-row"><label>Destination<select value={step.command.id} onChange={(e) => updateInstruction(index, { command: { ...step.command, id: e.target.value } })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>Stock<select value={step.command.stock} onChange={(e) => updateInstruction(index, { command: { ...step.command, stock: e.target.value } })}>{Object.values(stocks).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>mL<input type="number" min="0" step="any" value={step.command.volumeMl} onChange={(e) => updateInstruction(index, { command: { ...step.command, volumeMl: Number(e.target.value) } })} /></label></div>}
            {step.command.type === "transfer" && <div className="author-row"><label>Source<select value={step.command.from} onChange={(e) => updateInstruction(index, { command: { ...step.command, from: e.target.value } })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>Destination<select value={step.command.to} onChange={(e) => updateInstruction(index, { command: { ...step.command, to: e.target.value } })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>mL<input type="number" min="0" step="any" value={step.command.volumeMl} onChange={(e) => updateInstruction(index, { command: { ...step.command, volumeMl: Number(e.target.value) } })} /></label><label>Funnel (optional)<select value={step.command.via || ""} onChange={(e) => updateInstruction(index, { command: { ...step.command, via: e.target.value || undefined } })}><option value="">Direct</option>{manifest.apparatus.filter((item) => item.kind === "funnel").map((item) => <option key={item.id}>{item.id}</option>)}</select></label></div>}
            {step.command.type === "react" && <div className="author-row"><label>Vessel<select value={step.command.id} onChange={(e) => updateInstruction(index, { command: { ...step.command, id: e.target.value } })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label><label>Supported reaction<select value={step.command.reactionId} onChange={(e) => { const reactionId = e.target.value; updateInstruction(index, { command: { ...step.command, reactionId } }); patchManifest({ reactionIds: [...new Set([...manifest.reactionIds, reactionId])] }); }}><option value="neutralization">HCl + NaOH neutralization</option><option value="precipitation">AgCl precipitation</option></select></label></div>}
            {["mix", "measure", "measure-volume", "measure-gas"].includes(step.command.type) && <div className="author-row"><label>Vessel<select value={step.command.id} onChange={(e) => updateInstruction(index, { command: { ...step.command, id: e.target.value } })}>{manifest.apparatus.map((item) => <option key={item.id}>{item.id}</option>)}</select></label>{step.command.type === "measure" && <label>Solute<select value={step.command.solute} onChange={(e) => updateInstruction(index, { command: { ...step.command, solute: e.target.value } })}>{["HCl", "NaOH", "AgNO3", "NaCl", "NaNO3"].map((solute) => <option key={solute}>{solute}</option>)}</select></label>}</div>}
          </div>)}
          <button onClick={addInstruction} disabled={manifest.instructions.length >= 40}><Plus size={15} /> Add instruction</button>
          <label>Expected observations · one per line<textarea value={manifest.expectedObservations.join("\n")} onChange={(e) => patchManifest({ expectedObservations: splitLines(e.target.value) })} /></label>
          <div className="author-checks"><b>Measurements declared</b>{[["volume", "Volume"], ["concentration", "Concentration"], ["gas-inventory", "Gas inventory"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={manifest.measurements.includes(value)} onChange={(e) => patchManifest({ measurements: e.target.checked ? [...new Set([...manifest.measurements, value])] : manifest.measurements.filter((item) => item !== value) })} /> {label}</label>)}</div>
        </div>}
        {tab === "review" && <div className="author-section"><h3>Scientific review and publication</h3><label>Scientific assumptions · one per line<textarea value={manifest.scientificAssumptions.join("\n")} onChange={(e) => patchManifest({ scientificAssumptions: splitLines(e.target.value) })} /></label><label>Safety warnings · one per line<textarea value={manifest.safetyWarnings.join("\n")} onChange={(e) => patchManifest({ safetyWarnings: splitLines(e.target.value) })} /></label><label>Completion criteria<select value={manifest.completionCriteria[0] || "complete-all-steps"} onChange={(e) => patchManifest({ completionCriteria: [e.target.value] })}><option value="complete-all-steps">Complete all listed steps</option></select></label>
          <h4>Assessment questions</h4>{manifest.assessmentQuestions.map((question, index) => <div className="author-row" key={index}><label>Prompt<input value={question.prompt} onChange={(e) => patchManifest({ assessmentQuestions: manifest.assessmentQuestions.map((item, i) => i === index ? { ...item, prompt: e.target.value } : item) })} /></label><label>Expected answer (optional)<input value={question.expectedAnswer || ""} onChange={(e) => patchManifest({ assessmentQuestions: manifest.assessmentQuestions.map((item, i) => i === index ? { ...item, expectedAnswer: e.target.value } : item) })} /></label><button aria-label="Remove assessment question" onClick={() => patchManifest({ assessmentQuestions: manifest.assessmentQuestions.filter((_, i) => i !== index) })}><X size={15} /></button></div>)}<button onClick={() => patchManifest({ assessmentQuestions: [...manifest.assessmentQuestions, { prompt: "", expectedAnswer: "" }] })}><Plus size={15} /> Add assessment question</button>
          <div className="validation-panel"><div><h4>Validation report</h4><p>{validation ? validation.valid ? "No validation errors" : `${validation.errors.length} error(s)` : "Run validation before preview or publishing."}</p></div><button onClick={validate}><ShieldCheck size={15} /> Validate definition</button>
            {validation?.errors.length > 0 && <ul className="validation-errors" role="alert">{validation.errors.map((item, index) => <li key={index}>{item}</li>)}</ul>}{validation?.warnings.length > 0 && <ul className="validation-warnings" aria-label="Validation warnings">{validation.warnings.map((item, index) => <li key={index}>{item}</li>)}</ul>}
          </div><div className="author-publish-actions"><button onClick={previewExperiment} disabled={!validation?.valid}><Eye size={15} /> Preview in 3D workbench</button><button className="primary" onClick={publish}><ShieldCheck size={15} /> Publish validated experiment</button><p>Publishing is local to this browser. There is no server-side role or permission system.</p></div>
        </div>}
      </section>}
    </div>
  </div>;
}
