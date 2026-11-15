import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
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
  await (
    await import("node:fs/promises")
  ).mkdir("artifacts", { recursive: true });
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5181/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/discover.png" });
  await page.getByRole("button", { name: "Enter the virtual lab" }).click();
  await page.locator("canvas").waitFor();
  await page.screenshot({ path: "artifacts/laboratory.png" });
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Add 5 mL NaOH" }).click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  assert.equal(await page.locator(".reading strong").textContent(), "7.00");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByLabel("25.0 mL", { exact: true }).check();
  await page.getByLabel("7", { exact: true }).check();
  await page.getByRole("button", { name: "Check answers" }).click();
  assert.match(await page.getByRole("status").textContent(), /2 of 2 correct/);
  await page.getByRole("button", { name: "Move right" }).click();
  await page.getByRole("button", { name: "Rotate right" }).click();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-session")),
  );
  assert.equal(state.baseMl, 25);
  assert.equal(state.positions.flask[0], 0.25);
  assert.ok(state.positions.flask[2] > 0);
  await page.getByRole("button", { name: "Lab notebook" }).click();
  await page.getByLabel("Your observations").fill("Endpoint reached");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export notes" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "materia-notebook.txt");
  const fs = await import("node:fs/promises");
  assert.match(
    await fs.readFile(await download.path(), "utf8"),
    /Endpoint reached/,
  );
  await page.getByRole("button", { name: "Virtual lab" }).click();
  await page.getByTitle("Undo").click();
  await page.reload();
  await page.getByRole("button", { name: "Virtual lab" }).click();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-session")),
  );
  assert.equal(state.notes, "Endpoint reached");
  assert.equal(state.baseMl, 25);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/laboratory-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await page.reload();
  state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("materia-oxygen")),
  );
  assert.equal(state.steps, 5);
  assert.equal(state.notes, "Collected simulated oxygen");
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflow passed: WebGL scene, titration, transforms, notebook/export, undo, persistence and mobile layout.",
  );
} finally {
  await browser?.close();
  server.kill();
}
