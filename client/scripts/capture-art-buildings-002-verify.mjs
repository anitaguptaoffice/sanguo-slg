/**
 * ART-BUILDINGS-002 engineering verification screenshots.
 * Usage: node scripts/capture-art-buildings-002-verify.mjs
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-buildings-002/screenshots");

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
  const server = page.locator(".server-list li").first();
  await server.waitFor({ timeout: 10000 });
  await server.click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 20000 },
  );
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
    await new Promise((r) => setTimeout(r, 2000));
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    const browser = await chromium.launch();
    for (const { name, width, height, dpr } of [
      { name: "maincity-four-slots-1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
      { name: "maincity-four-slots-1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
      { name: "maincity-four-slots-1280x720-dpr1", width: 1280, height: 720, dpr: 1 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await page.waitForTimeout(800);
      const hud = await page.locator("#hud").textContent();
      const scaleTag = dpr >= 2 ? "2×" : "1×";
      if (!hud?.includes(`${scaleTag} @${dpr.toFixed(1)}dpr`)) {
        console.warn(`HUD DPR tag mismatch for ${name}: ${hud}`);
      }
      await page.locator("#game-viewport").screenshot({ path: path.join(outDir, `${name}.png`) });
      await context.close();
    }

    // Click lumber slot (layout coords from mainCitySlots hit box center)
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await enterMainCity(page, appPort);
    const canvas = page.locator("#game");
    const box = await canvas.boundingBox();
    if (box) {
      const layoutX = 480;
      const layoutY = 400;
      const cssX = (layoutX / 1600) * box.width;
      const cssY = (layoutY / 900) * box.height;
      await page.mouse.click(box.x + cssX, box.y + cssY);
      await page.waitForTimeout(400);
      await page.locator("#game-viewport").screenshot({
        path: path.join(outDir, "hit-test-lumber-selected.png"),
      });
    }
    await context.close();
    await browser.close();
    console.log(`Screenshots written to ${outDir}`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
