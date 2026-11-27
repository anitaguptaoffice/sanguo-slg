#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const OUT = resolve(process.argv[2] || "/opt/cursor/artifacts/post-r5-phase1-r2");
const BASE = process.env.VITE_BASE_URL || "http://127.0.0.1:5273";
const CHROMIUM = process.env.CHROMIUM_PATH || "/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

async function shots(page, label, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);
  const file = resolve(OUT, `${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

const browser = await chromium.launch({ executablePath: CHROMIUM, chromiumSandbox: true });
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
await page.goto(BASE);
await page.locator('li[data-server-id="1"]').waitFor({ timeout: 120000 });
await page.locator('[data-action="enter-game"]:not([disabled])').waitFor({ timeout: 120000 });
await page.locator('[data-action="enter-game"]').click();
await page.locator(".main-city-toolbar").waitFor({ timeout: 180000 });
const manifest = [];
manifest.push(await shots(page, "main-city", { width: 1280, height: 720 }));
manifest.push(await shots(page, "main-city", { width: 1600, height: 900 }));
await page.locator('[data-action="toggle-city-scene"]').click();
await page.waitForTimeout(600);
manifest.push(await shots(page, "outer-city", { width: 1600, height: 900 }));
await page.locator('[data-action="toggle-city-scene"]').click();
const more = page.locator('[data-action="toggle-toolbar-more"]');
if (await more.count()) await more.click();
const farm = page.locator('[data-action="upgrade-farm"]').first();
if (await farm.count()) await farm.click({ force: true });
await page.locator(".building-panel:visible").first().waitFor({ timeout: 10000 }).catch(() => {});
manifest.push(await shots(page, "building-panel", { width: 1280, height: 720 }));
await page.locator('[data-action="open-world-map"]').click();
await page.locator('[data-role="world-map-layer"]:not(.hidden)').waitFor({ timeout: 15000 });
await page.locator('[data-role="world-map-canvas"]').click({ position: { x: 420, y: 280 } });
await page.locator('[data-role="world-map-detail"]:not(.hidden)').waitFor({ timeout: 15000 }).catch(() => {});
manifest.push(await shots(page, "world-map-tile-detail", { width: 1600, height: 900 }));
await page.locator('[data-action="world-map-close"]').click();
await page.locator('[data-action="toggle-military"]').click();
await page.locator('.military-panel:visible').first().waitFor({ timeout: 10000 }).catch(() => {});
manifest.push(await shots(page, "military-dispatch", { width: 1280, height: 720 }));
await page.locator('[data-action="close-military-panel"]').click().catch(() => {});
await page.locator('[data-action="toggle-reports"]').click();
await page.locator('[data-center-panel="battle-report"]:visible').first().waitFor({ timeout: 10000 }).catch(() => {});
manifest.push(await shots(page, "battle-report-panel", { width: 1280, height: 720 }));
writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify({ base: BASE, shots: manifest }, null, 2));
await browser.close();
console.log(JSON.stringify({ out: OUT, count: manifest.length }));