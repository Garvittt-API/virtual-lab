import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5181",
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);
let browser;
try {
  await (await import("node:fs/promises")).mkdir("artifacts", {
    recursive: true,
  });
  await Promise.race([
    once(server.stdout, "data"),
    once(server, "exit").then(() => {
      throw Error("Vite exited");
    }),
  ]);
  browser = await playwright.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: [
      ...chromium.args,
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5181/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/discover.png" });
  await page.locator(".experiment-card").filter({ hasText: "Acid-base neutralization" }).getByRole("button", { name: "Open experiment" }).click();
  await page.locator("canvas").waitFor();
  await page.screenshot({ path: "artifacts/laboratory.png" });

  for (const operation of ["add", "add", "transfer", "mix", "react"])
    await page.getByRole("button", { name: `Perform ${operation}` }).click();
  await page.getByText("Procedure complete.").waitFor();
  await page.getByLabel("Record observation").fill("Neutral endpoint recorded");
  await page.getByRole("button", { name: "Save observation" }).click();
  await page.getByRole("button", { name: "Move right" }).click();

  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-lab-sessions-v2")),
  );
  assert.equal(saved.sessions.length, 1);
  const session = saved.sessions[0];
  assert.equal(session.core.experiment.step, 5);
  assert.equal(session.core.experiment.result.pH, 7);
  assert.equal(session.core.experiment.result.reactedMoles, 0.0025);
  assert.equal(session.core.workspace.objects.a.solutes.NaCl, 0.0025);
  assert.ok(
    session.notebook.entries.some(
      (entry) => entry.kind === "observation" && entry.text === "Neutral endpoint recorded",
    ),
  );
  assert.equal(session.core.workspace.objects.a.position[0], -1.25);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace" }).click();
  const download = await downloadPromise;
  const exportPath = "/tmp/materia-browser-session.json";
  await download.saveAs(exportPath);
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await page.waitForFunction(() =>
    [...document.querySelectorAll("select option")].some((option) =>
      option.textContent.includes("(imported)"),
    ),
  );
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-lab-sessions-v2")),
  );
  assert.equal(saved.sessions.length, 2);
  assert.notEqual(saved.sessions[0].id, saved.sessions[1].id);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/laboratory-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-lab-sessions-v2")),
  );
  assert.equal(saved.sessions.length, 2);
  assert.ok(saved.sessions.some((entry) => entry.notebook.entries.some((item) => item.text === "Neutral endpoint recorded")));

  await page.getByRole("button", { name: "Discover" }).click();
  await page.locator(".experiment-card").filter({ hasText: "Oxygen from decomposition" }).getByRole("button", { name: "Open experiment" }).click();
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Add KClO₃" }).click();
  await page.getByRole("status").filter({ hasText: "No gas path connected" }).waitFor();
  await page.getByRole("button", { name: "Simulate heating step" }).click();
  let oxygenState = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  let activeOxygen = oxygenState.sessions.find((entry) => entry.id === oxygenState.activeId);
  assert.ok(activeOxygen.core.workspace.objects.tube.gases.O2 > 0);
  assert.equal(activeOxygen.core.workspace.objects.jar.gases.O2 || 0, 0);
  await page.getByRole("button", { name: "Connect vessels" }).click();
  oxygenState = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  activeOxygen = oxygenState.sessions.find((entry) => entry.id === oxygenState.activeId);
  assert.ok(activeOxygen.core.workspace.objects.jar.gases.O2 > 0);
  assert.equal(activeOxygen.core.workspace.objects.tube.gases.O2, 0);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Simulate heating step" }).click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  assert.equal(await page.locator(".reading strong").textContent(), "274.3 mL");
  await page.screenshot({ path: "artifacts/oxygen-laboratory.png" });
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByLabel("Your observations").fill("Collected simulated oxygen");
  await page.getByRole("button", { name: "Save observation" }).click();
  await page.getByRole("button", { name: "Free policy" }).click();
  await page.getByRole("button", { name: "Guided policy" }).click();
  await page.reload();
  const canonicalStore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-lab-sessions-v2")),
  );
  const oxygenSession = canonicalStore.sessions.find((entry) => entry.core.experiment?.id === "oxygen");
  assert.equal(oxygenSession.core.experiment.protocol.steps, 5);
  assert.ok(Math.abs(oxygenSession.core.experiment.inventory.collectedO2Ml - 274.3) < 0.05);
  assert.ok(oxygenSession.notebook.entries.some((entry) => entry.text === "Collected simulated oxygen"));
  assert.equal(await page.evaluate(() => localStorage.getItem("materia-oxygen")), null);

  await page.getByRole("button", { name: "Reaction exercises" }).click();
  for (const experiment of ["precipitation", "dilution"]) {
    await page.locator("#exercise").selectOption(experiment);
    await page.locator("canvas").waitFor();
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Perform / }).click();
    await page.getByText("Procedure complete.").waitFor();
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
    const completed = current.sessions.find((entry) => entry.core.experiment?.id === experiment);
    assert.ok(completed);
    assert.equal(completed.core.experiment.step, 5);
    if (experiment === "precipitation") {
      assert.ok(Math.abs(completed.core.workspace.objects.a.solids.AgCl - 0.001) < 1e-12);
      assert.ok(Math.abs(completed.core.workspace.objects.a.solutes.NaNO3 - 0.001) < 1e-12);
    } else {
      assert.equal(completed.core.workspace.objects.b.volumeMl, 100);
      assert.ok(Math.abs(completed.core.workspace.objects.b.solutes.NaCl - 0.001) < 1e-12);
    }
  }

  await page.getByRole("button", { name: "Free exploration", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept("Browser-built workbench"));
  await page.getByRole("button", { name: "New Workbench" }).click();
  await page.getByLabel("Equipment ID").waitFor({ timeout: 5000 }).catch(async () => {
    await page.screenshot({ path: "artifacts/workbench-debug.png", fullPage: true });
    console.log((await page.locator("body").innerText()).slice(-2500));
    throw Error("New Workbench did not render free equipment controls");
  });
  let custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  let customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.equal(customSession.mode, "free");
  assert.equal(Object.keys(customSession.core.workspace.objects).length, 0);
  await page.getByRole("status").filter({ hasText: "Start by choosing an item" }).waitFor();
  const equipmentPicker = page.locator(".equipment-panel select").first();
  await equipmentPicker.selectOption("stand");
  await page.getByLabel("Equipment ID").fill("s1");
  await page.getByLabel("Bench X").fill("-2");
  await page.getByRole("button", { name: "Place equipment" }).click();
  assert.equal(await page.getByLabel("Equipment ID").inputValue(), "s2");
  await equipmentPicker.selectOption("clamp");
  await page.getByLabel("Equipment ID").fill("c1");
  await page.getByLabel("Bench X").fill("2");
  await page.getByRole("button", { name: "Place equipment" }).click();
  await equipmentPicker.selectOption("beaker");
  await page.getByLabel("Equipment ID").fill("b1");
  await page.getByLabel("Bench X").fill("0");
  await page.getByRole("button", { name: "Place equipment" }).click();
  await equipmentPicker.selectOption("flask");
  await page.getByLabel("Equipment ID").fill("f1");
  await page.getByLabel("Bench X").fill("1");
  await page.getByRole("button", { name: "Place equipment" }).click();
  await page.getByRole("button", { name: /Clamp.*c1/ }).click();
  assert.equal(await page.getByRole("combobox", { name: "Connect selected ports to" }).inputValue(), "s1");
  await page.getByText("Position & rotation").waitFor();
  const dragStart = await page.evaluate(() => {
    const canvas = document.querySelector(".scene canvas"), rect = canvas.getBoundingClientRect();
    const eye = [6, 6, 9], target = [0, 0.8, 0], sub = (a, b) => a.map((v, i) => v - b[i]);
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0), norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
    const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const forward = norm(sub(target, eye)), right = norm(cross(forward, [0,1,0])), up = cross(right, forward), point = [2,1.2,0], rel = sub(point, eye), depth = dot(rel, forward), focal = rect.height / (2 * Math.tan(38 * Math.PI / 360));
    return { x: rect.left + rect.width / 2 + dot(rel, right) * focal / depth, y: rect.top + rect.height / 2 - dot(rel, up) * focal / depth };
  });
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 32, dragStart.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.notEqual(customSession.core.workspace.objects.c1.position[0], 2);
  await page.getByRole("button", { name: "Move right" }).click();
  await page.getByRole("button", { name: "↷ 15°" }).click();
  await page.getByRole("combobox", { name: "Connect selected ports to" }).selectOption({ label: "Retort stand · s1" });
  await page.getByRole("button", { name: /Connect holder/ }).click();
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.equal(customSession.core.workspace.connections.length, 1);
  assert.ok(customSession.past.length >= 4);
  await page.getByRole("button", { name: "Undo", exact: false }).click();
  await page.getByRole("button", { name: "Redo", exact: false }).click();
  await page.getByRole("button", { name: /Beaker.*b1/ }).click();
  await page.locator(".guide-panel select").first().selectOption("acid");
  await page.getByLabel("Volume", { exact: true }).last().fill("10");
  await page.getByRole("button", { name: "Add stock to selected" }).click();
  await page.getByLabel("Transfer to").selectOption("f1");
  await page.getByRole("button", { name: "Transfer measured volume" }).click();
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.equal(customSession.core.workspace.objects.b1.volumeMl, 0);
  assert.equal(customSession.core.workspace.objects.f1.solutes.HCl, 0.001);
  assert.equal(customSession.core.workspace.objects.f1.volumeMl, 10);
  await page.reload();
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.equal(customSession.core.workspace.objects.f1.solutes.HCl, 0.001);
  await page.getByRole("button", { name: "Free exploration", exact: true }).click();
  await page.locator("canvas").waitFor();
  await equipmentPicker.selectOption("dropper");
  await page.getByLabel("Equipment ID").fill("d1");
  await page.getByLabel("Bench X").fill("-3");
  await page.getByLabel("Bench Z").fill("-1");
  await page.getByRole("button", { name: "Place equipment" }).click();
  await page.getByRole("button", { name: /Dropper.*d1/ }).click();
  await page.locator(".guide-panel select").first().selectOption("acid");
  await page.getByLabel("Volume", { exact: true }).last().fill("5");
  await page.getByRole("button", { name: "Add stock to selected" }).click();
  await page.getByRole("combobox", { name: "Connect selected ports to" }).selectOption("f1");
  await page.getByRole("button", { name: /Connect tip/ }).click();
  await page.getByLabel("Transfer to").selectOption("f1");
  await page.getByLabel("Volume", { exact: true }).last().fill("2");
  await page.getByRole("button", { name: "Dispense measured volume" }).click();
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.equal(customSession.core.workspace.objects.d1.volumeMl, 3);
  assert.equal(customSession.core.workspace.objects.f1.volumeMl, 12);
  assert.ok(Math.abs(customSession.core.workspace.objects.d1.solutes.HCl - 0.0003) < 1e-12);
  assert.ok(Math.abs(customSession.core.workspace.objects.f1.solutes.HCl - 0.0012) < 1e-12);
  await page.locator(".equipment-panel .transform-controls").first().locator(".result-row").filter({ hasText: "d1:tip" }).getByRole("button", { name: "Disconnect" }).click();
  for (const [kind, dispenserId, benchZ, expectedVolume] of [["pipette", "p1", 0, 13], ["burette", "u1", 1, 14]]) {
    await page.locator(".equipment-panel select").first().selectOption(kind);
    await page.getByLabel("Equipment ID").fill(dispenserId);
    await page.getByLabel("Bench X").fill("-3");
    await page.getByLabel("Bench Z").fill(String(benchZ));
    await page.getByRole("button", { name: "Place equipment" }).click();
    await page.getByRole("button", { name: new RegExp(`${kind === "burette" ? "Burette" : "Pipette"}.*${dispenserId}`) }).click();
    await page.getByLabel("Volume", { exact: true }).last().fill("5");
    await page.getByRole("button", { name: "Add stock to selected" }).click();
    await page.getByRole("combobox", { name: "Connect selected ports to" }).selectOption("f1");
    await page.getByRole("button", { name: /Connect tip/ }).click();
    await page.getByLabel("Transfer to").selectOption("f1");
    await page.getByLabel("Volume", { exact: true }).last().fill("1");
    await page.getByRole("button", { name: "Dispense measured volume" }).click();
    custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
    customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
    assert.equal(customSession.core.workspace.objects[dispenserId].volumeMl, 4);
    assert.equal(customSession.core.workspace.objects.f1.volumeMl, expectedVolume);
    assert.ok(Math.abs(customSession.core.workspace.objects[dispenserId].solutes.HCl - 0.0004) < 1e-12);
    assert.ok(Math.abs(customSession.core.workspace.objects.f1.solutes.HCl - expectedVolume * 0.0001) < 1e-12);
    await page.locator(".equipment-panel .transform-controls").first().locator(".result-row").filter({ hasText: `${dispenserId}:tip` }).getByRole("button", { name: "Disconnect" }).click();
  }
  page.once("dialog", (dialog) => dialog.accept("Browser-built workbench renamed"));
  await page.getByRole("button", { name: "Rename session" }).click();
  await page.getByRole("button", { name: "Duplicate session" }).click();
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.match(customSession.name, /\(copy\)$/);
  assert.equal(customSession.core.workspace.objects.d1.volumeMl, 3);
  const workbenchExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace" }).click();
  await (await workbenchExport).saveAs("/tmp/materia-free-workbench.json");
  await page.locator('input[type="file"]').setInputFiles("/tmp/materia-free-workbench.json");
  await page.waitForFunction(() => {
    const store = JSON.parse(localStorage.getItem("materia-lab-sessions-v2"));
    return store?.sessions.find((entry) => entry.id === store.activeId)?.name.endsWith("(imported)");
  });
  custom = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  customSession = custom.sessions.find((entry) => entry.id === custom.activeId);
  assert.match(customSession.name, /\(imported\)$/);
  assert.equal(customSession.core.workspace.objects.d1.volumeMl, 3);
  await page.getByRole("button", { name: "Free exploration", exact: true }).click();
  await page.locator("canvas").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/new-workbench-mobile.png", fullPage: true });
  assert.equal(await page.getByRole("button", { name: "Place equipment" }).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Place equipment" }).evaluate((button) => button.getBoundingClientRect().right <= window.innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole("button", { name: "Authoring studio" }).click();
  await page.getByRole("button", { name: "New experiment", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser authored neutralization");
  await page.getByRole("tab", { name: "Setup" }).click();
  await page.getByRole("button", { name: "Add equipment" }).click();
  await page.getByRole("button", { name: "Add equipment" }).click();
  await page.locator(".author-section .author-row").nth(1).locator("select").first().selectOption("funnel");
  await page.getByRole("button", { name: "Add initial solution" }).click();
  await page.getByRole("button", { name: "Add initial solution" }).click();
  await page.locator(".author-section .author-row").nth(3).locator("select").nth(1).selectOption("base");
  await page.getByRole("button", { name: "Add connection" }).click();
  const connectionRow = page.locator(".author-section .author-row").last();
  await connectionRow.getByLabel("Equipment A").selectOption("v2");
  await connectionRow.getByLabel("Port A").selectOption("stem");
  await connectionRow.getByLabel("Equipment B").selectOption("v1");
  await connectionRow.getByLabel("Port B").selectOption("mouth");
  await page.getByRole("button", { name: "Save draft" }).click();
  const setupDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-experiment-library-v1")).drafts.at(-1));
  assert.equal(setupDraft.apparatus[1].kind, "funnel");
  assert.equal(setupDraft.initialChemicals.length, 2);
  assert.deepEqual(setupDraft.initialConnections, [{ a: "v2", ap: "stem", b: "v1", bp: "mouth" }]);
  await page.getByRole("tab", { name: "Procedure" }).click();
  await page.getByRole("button", { name: "Add instruction" }).click();
  await page.getByRole("button", { name: "Add instruction" }).click();
  await page.locator(".author-step").nth(0).locator("select").first().selectOption("mix");
  await page.locator(".author-step").nth(1).locator("select").first().selectOption("react");
  await page.getByRole("button", { name: "Save draft" }).click();
  const procedureDraft = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-experiment-library-v1")).drafts.at(-1));
  assert.deepEqual(procedureDraft.instructions.map((step) => step.command.id), ["v1", "v1"]);
  await page.getByRole("tab", { name: "Review" }).click();
  await page.getByRole("button", { name: "Validate definition" }).click();
  await page.getByRole("status").filter({ hasText: "Validation passed" }).waitFor();
  await page.getByRole("button", { name: "Preview in 3D workbench" }).click();
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Perform mix" }).click();
  await page.getByRole("button", { name: "Perform react" }).click();
  await page.getByText("Procedure complete.").waitFor();
  let authoredSessions = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  let authoredSession = authoredSessions.sessions.find((entry) => entry.id === authoredSessions.activeId);
  assert.equal(authoredSession.core.experiment.definition.title, "Browser authored neutralization");
  assert.ok(authoredSession.core.workspace.events.some((event) => event.includes("Reaction neutralization")));
  await page.getByRole("button", { name: "Return to authoring studio" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByRole("button", { name: "Authoring studio" }).click();
  await page.getByRole("button", { name: /Browser authored neutralization/ }).click();
  await page.getByRole("tab", { name: "Review" }).click();
  await page.getByRole("button", { name: "Validate definition" }).click();
  await page.getByRole("button", { name: "Publish validated experiment" }).click();
  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByLabel("Search published experiments").fill("Browser authored neutralization");
  await page.getByRole("button", { name: "Launch experiment" }).click();
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Perform mix" }).click();
  authoredSessions = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
  authoredSession = authoredSessions.sessions.find((entry) => entry.id === authoredSessions.activeId);
  assert.equal(authoredSession.core.experiment.definition.id.startsWith("author-"), true);
  assert.equal(authoredSession.core.experiment.step, 1);
  await page.getByRole("button", { name: "Discover" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/experiment-library-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Authoring studio" }).click();
  await page.screenshot({ path: "artifacts/authoring-studio-mobile.png", fullPage: true });
  assert.equal(await page.getByRole("button", { name: "New experiment", exact: true }).isVisible(), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflow passed: Chromium SwiftShader rendering; built-in chemistry and oxygen workflows; free-workbench equipment, persistence and import/export; authored draft setup, validation, actual 3D preview, reopen, publish, library search and launch; mobile library and authoring layouts.",
  );
} finally {
  await browser?.close();
  server.kill();
}
