/**
 * Runtime VERIFY screenshots for ART-MILITARY-005 (mock gateway + dev server).
 * Usage: node scripts/capture-art-military-005-verify.mjs
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-military-005/screenshots");

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

async function openMilitary(page) {
  await page.locator('[data-action="toggle-military"]').click();
  await page.waitForSelector(".military-panel:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(400);
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
      { name: "military-open-1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
      { name: "military-open-1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
      { name: "military-open-1280x720-dpr1", width: 1280, height: 720, dpr: 1 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await openMilitary(page);
      await page.locator("#game-viewport").screenshot({ path: path.join(outDir, `${name}.png`) });
      await page.locator(".military-panel").screenshot({
        path: path.join(outDir, `${name}-right-panel-crop.png`),
      });
      await context.close();
    }

    const ctxBtn = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const pageBtn = await ctxBtn.newPage();
    await enterMainCity(pageBtn, appPort);
    await openMilitary(pageBtn);
    const recruitBtn = pageBtn.locator('.military-panel button[data-action="recruit"]');
    await recruitBtn.screenshot({ path: path.join(outDir, "btn-primary-normal.png") });
    await recruitBtn.hover();
    await pageBtn.waitForTimeout(120);
    await recruitBtn.screenshot({ path: path.join(outDir, "btn-primary-hover.png") });
    await pageBtn.mouse.down();
    await pageBtn.waitForTimeout(80);
    await recruitBtn.screenshot({ path: path.join(outDir, "btn-primary-pressed.png") });
    await pageBtn.mouse.up();
    await pageBtn.evaluate(() => {
      const b = document.querySelector('.military-panel button[data-action="recruit"]');
      if (b) b.disabled = true;
    });
    await pageBtn.waitForTimeout(80);
    await recruitBtn.screenshot({ path: path.join(outDir, "btn-primary-disabled.png") });
    await ctxBtn.close();

    const ctxClose = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const pageClose = await ctxClose.newPage();
    await enterMainCity(pageClose, appPort);
    await openMilitary(pageClose);
    await pageClose.locator('[data-action="toggle-military"]').click();
    await pageClose.waitForFunction(
      () => document.querySelector(".military-panel")?.classList.contains("hidden"),
      { timeout: 5000 },
    );
    await pageClose.waitForTimeout(300);
    const canvas = pageClose.locator("#game");
    await canvas.click({ position: { x: 400, y: 300 } });
    await pageClose.waitForTimeout(200);
    await pageClose.locator("#game-viewport").screenshot({ path: path.join(outDir, "maincity-after-military-close-click.png") });
    await ctxClose.close();

    const centerPanels = [
      { action: "toggle-queue", name: "queue" },
      { action: "toggle-mail", name: "mail" },
      { action: "toggle-daily", name: "daily" },
      { action: "toggle-bag", name: "bag" },
    ];
    const ctxCenter = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const pageCenter = await ctxCenter.newPage();
    await enterMainCity(pageCenter, appPort);
    for (const { action, name } of centerPanels) {
      await pageCenter.locator(`[data-action="${action}"]`).click();
      await pageCenter.waitForTimeout(500);
      const panel = pageCenter.locator(".content-panel:not(.hidden)").first();
      if (await panel.count()) {
        await pageCenter.locator("#game-viewport").screenshot({
          path: path.join(outDir, `center-panel-${name}-open.png`),
        });
      }
      await pageCenter.locator(`[data-action="${action}"]`).click();
      await pageCenter.waitForTimeout(200);
    }
    await ctxCenter.close();

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
