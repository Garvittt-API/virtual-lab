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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5181/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/discover.png" });
  await page.getByRole("button", { name: "Open acid-base neutralization" }).click();
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
  await page.getByRole("button", { name: "Open oxygen decomposition" }).click();
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Connect vessels" }).click();
  await page.getByRole("button", { name: "Add KClO₃" }).click();
  for (let i = 0; i < 5; i++)
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
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem("materia-lab-sessions-v2")));
    assert.ok(current.sessions.some((entry) => entry.core.experiment?.id === experiment));
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
  const equipmentPicker = page.locator(".equipment-panel select").first();
  await equipmentPicker.selectOption("stand");
  await page.getByLabel("Equipment ID").fill("s1");
  await page.getByLabel("Bench X").fill("-2");
  await page.getByRole("button", { name: "Place equipment" }).click();
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
  await page.getByRole("button", { name: "Transfer volume" }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/new-workbench-mobile.png", fullPage: true });
  assert.equal(await page.getByRole("button", { name: "Place equipment" }).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Place equipment" }).evaluate((button) => button.getBoundingClientRect().right <= window.innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflow passed: Chromium SwiftShader rendering; neutralization, oxygen, precipitation and dilution sessions; custom empty workbench placement, movement, rotation, chemical transfer, typed connections, undo/redo, persistence, export/import and mobile viewport.",
  );
} finally {
  await browser?.close();
  server.kill();
}
