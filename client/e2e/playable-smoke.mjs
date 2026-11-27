/**
 * Playable smoke gate: boots the real client against the real Go gateway and
 * walks the first player-visible chain (server select -> demo account ->
 * main city -> world/queue panels).
 *
 * Requires: PostgreSQL + Redis + `cmd/server` on :8080 and the built client
 * served on APP_URL (default `vite preview` on :4173).
 *
 * Usage: APP_URL=http://127.0.0.1:4173 node e2e/playable-smoke.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:4173";
const REPORT_PATH = process.env.REPORT_PATH ?? "playable-smoke-report.json";
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR ?? "playable-smoke-screenshots";

const steps = [];
const consoleErrors = [];

function record(name, detail) {
  steps.push({ name, at: new Date().toISOString(), ...detail });
  console.log(`[smoke] ${name}${detail?.detail ? ` — ${detail.detail}` : ""}`);
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#hud", { timeout: 30000 });
    record("client boot", { detail: "HUD mounted" });

    await page.waitForSelector(".server-list li", { timeout: 30000 });
    const serverCount = await page.locator(".server-list li").count();
    if (serverCount < 1) throw new Error("server list is empty; gateway unreachable");
    record("gateway connected", { detail: `${serverCount} server(s) listed` });

    await page.locator(".server-list li").first().click();
    await page.locator('[data-action="enter-game"]:not([disabled])').click();
    await page.waitForSelector(".main-city-toolbar", { timeout: 45000 });
    await page.waitForSelector('[data-action="open-world-map"]', { timeout: 15000 });
    record("entered main city", { detail: "toolbar mounted" });

    const hudText = (await page.locator("#hud").innerText()).trim();
    for (const bad of ["启动失败", "进服失败", "连接失败"]) {
      if (hudText.includes(bad)) throw new Error(`HUD reports failure: ${bad}`);
    }
    if (!/主城|城主府|城府/.test(hudText)) throw new Error("HUD does not show the city identity");
    await page.waitForSelector('[data-role="hud-resources"]', { timeout: 15000 });
    const resourceAmounts = await page.locator('[data-role="hud-resources"] .hud-resource-amount').count();
    if (resourceAmounts < 4) throw new Error("resource HUD is missing entries");
    record("city state rendered", {
      detail: `${resourceAmounts} resource entries · ${hudText.replace(/\s+/g, " ").slice(0, 100)}`,
    });

    await page.locator('[data-action="open-world-map"]').click();
    await page.waitForSelector('[data-role="world-map-layer"]:not(.hidden)', { timeout: 15000 });
    await page.waitForFunction(
      () => /已载入\s+\d+\s+格/.test(document.querySelector('[data-role="world-map-status"]')?.textContent ?? ""),
      { timeout: 30000 },
    );
    const mapStatus = (await page.locator('[data-role="world-map-status"]').innerText()).trim();
    const mapPixel = await page.evaluate(() => {
      const canvas = document.querySelector('[data-role="world-map-canvas"]');
      const context = canvas.getContext("2d");
      const data = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      return [data[0], data[1], data[2]];
    });
    if (mapPixel[0] + mapPixel[1] + mapPixel[2] < 30) {
      throw new Error(`world map canvas is blank: ${mapPixel.join(",")}`);
    }
    record("world map rendered", { detail: `${mapStatus} · centre pixel ${mapPixel.join(",")}` });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "world-map.png") });
    await page.locator('[data-action="world-map-close"]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-role="world-map-layer"]')?.classList.contains("hidden"),
      { timeout: 10000 },
    );

    const worldBtn = page.locator('[data-action="toggle-world"]');
    if (!(await worldBtn.isVisible())) {
      await page.locator('[data-action="toggle-toolbar-more"]').click();
    }
    await worldBtn.click();
    await page.waitForSelector(".world-panel:not(.hidden)", { timeout: 15000 });
    const worldText = (await page.locator(".world-panel").innerText()).trim();
    if (!worldText) throw new Error("world panel rendered empty");
    record("world panel opened", { detail: worldText.replace(/\s+/g, " ").slice(0, 120) });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "world.png") });

    await page.locator('[data-action="toggle-queue"]').click();
    await page.waitForSelector('[data-center-panel="queue"]:not(.hidden)', { timeout: 15000 });
    record("queue panel opened");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "main-city.png") });

    // The gateway must still be healthy after the player chain.
    const healthUrl = process.env.HEALTH_URL ?? "http://127.0.0.1:8080/healthz";
    const health = await fetch(healthUrl);
    const healthBody = await health.text();
    if (!health.ok) throw new Error(`healthz failed: ${healthBody}`);
    record("gateway healthy after chain", { detail: healthBody.trim() });

    const fatal = consoleErrors.filter((line) => !/favicon|Failed to load resource/i.test(line));
    if (fatal.length > 0) throw new Error(`console errors: ${fatal.slice(0, 3).join(" | ")}`);

    await writeFile(
      REPORT_PATH,
      JSON.stringify({ appUrl: APP_URL, startedAt: steps[0]?.at, steps, consoleErrors }, null, 2),
    );
    console.log(`[smoke] PASS — report at ${REPORT_PATH}`);
  } catch (error) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "failure.png") }).catch(() => {});
    await writeFile(
      REPORT_PATH,
      JSON.stringify({ appUrl: APP_URL, steps, consoleErrors, error: String(error) }, null, 2),
    );
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[smoke] FAIL —", error.message);
  process.exit(1);
});
