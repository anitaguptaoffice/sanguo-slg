/**
 * CLIENT-033 art evidence: military panel + primary button four states.
 * Usage: node scripts/capture-client-033-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/client-033");

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function enterMainCity(page, appPort) {
  await page.goto(`http://127.0.0.1:${appPort}/`);
  await page.waitForSelector("#hud", { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 20000,
  });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 20000 },
  );
  await page.locator('[data-action="toggle-military"]').click();
  await page.waitForSelector(".military-panel:not(.hidden)", { timeout: 5000 });
}

async function captureButtonStates(page) {
  const recruit = page.locator('.military-panel [data-action="recruit"]');
  await recruit.waitFor({ state: "visible" });
  const box = await recruit.boundingBox();
  if (!box) throw new Error("recruit button box missing");
  const pad = 8;
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(200, box.width + pad * 2),
    height: Math.min(80, box.height + pad * 2),
  };
  await page.screenshot({ path: path.join(outDir, "btn-recruit-normal.png"), clip });
  await recruit.hover();
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, "btn-recruit-hover.png"), clip });
  await recruit.dispatchEvent("mousedown");
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(outDir, "btn-recruit-pressed.png"), clip });
  await recruit.dispatchEvent("mouseup");
  await recruit.evaluate((el) => {
    el.disabled = true;
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, "btn-recruit-disabled.png"), clip });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "inherit" });
  const appPort = 16201;
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 1500));
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    const browser = await chromium.launch();
    for (const { name, width, height, dpr } of [
      { name: "military-1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
      { name: "military-1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
      { name: "military-1280x720-dpr1", width: 1280, height: 720, dpr: 1 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await page.waitForTimeout(600);
      if (name.includes("1280")) {
        const hud = await page.locator("#hud").boundingBox();
        if (!hud) throw new Error("hud box missing");
        await page.screenshot({
          path: path.join(outDir, `${name}.png`),
          clip: { x: hud.x, y: hud.y, width: hud.width, height: Math.min(hud.height + 8, 96) },
          type: "jpeg",
          quality: 88,
        });
      } else {
        const panel = await page.locator(".military-panel").boundingBox();
        if (!panel) throw new Error("military panel box missing");
        const pad = 12;
        await page.screenshot({
          path: path.join(outDir, `${name}.jpg`),
          clip: {
            x: Math.max(0, panel.x - pad),
            y: Math.max(0, panel.y - pad),
            width: panel.width + pad * 2,
            height: panel.height + pad * 2,
          },
          type: "jpeg",
          quality: 88,
        });
      }
      if (name === "military-1600x900-dpr1") {
        await captureButtonStates(page);
      }
      await context.close();
    }
    await browser.close();
    console.log(`Evidence written to ${outDir}`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
