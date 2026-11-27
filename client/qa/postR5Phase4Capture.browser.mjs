#!/usr/bin/env node
/**
 * Post-R5 phase-4 polish screenshots (QA only; not wired into CI product code).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const OUT = resolve(process.argv[2] || "/opt/cursor/artifacts/post-r5-phase4");
const BASE = process.env.VITE_BASE_URL || "http://127.0.0.1:5273";
const CHROMIUM = process.env.CHROMIUM_PATH || "/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

const manifest = { base: BASE, shots: [], notes: [] };

async function shots(page, label, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);
  const file = resolve(OUT, `${label}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  manifest.shots.push(file);
  return file;
}

const SAMPLE_ROUNDS = [
  {
    round: 1,
    distance: 8,
    attacker_units: { "1": 120 },
    defender_units: { "1": 100 },
    actions: [{ side: "attacker", kind: "move" }],
  },
  {
    round: 2,
    distance: 4,
    attacker_units: { "1": 105 },
    defender_units: { "1": 72 },
    attacker_to_def_hp: 28,
    actions: [
      { side: "attacker", kind: "attack" },
      { side: "defender", kind: "attack" },
    ],
  },
  {
    round: 3,
    distance: 0,
    attacker_units: { "1": 88 },
    defender_units: { "1": 40 },
    attacker_to_def_hp: 32,
    defender_to_att_hp: 12,
    actions: [{ side: "attacker", kind: "attack" }],
  },
];

async function tryRealMarch(page) {
  await page.locator('[data-action="toggle-military"]').click();
  await page.locator(".military-panel:visible").first().waitFor({ timeout: 15000 }).catch(() => {});
  const recruit = page.locator('[data-action="recruit"]:visible').first();
  if (await recruit.count()) {
    await recruit.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  const marchBtn = page.locator('[data-action="march"]:visible').first();
  if (await marchBtn.isEnabled().catch(() => false)) {
    await page.locator('[data-field="march-count"]').fill("15").catch(() => {});
    await marchBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    manifest.notes.push("march: submitted via military panel");
    return true;
  }
  manifest.notes.push("march: skipped (march button disabled)");
  return false;
}

async function mountReplayIfNeeded(page) {
  const hasStage = await page.locator(".battle-report-replay-stage").count();
  if (hasStage > 0) {
    manifest.notes.push("battle-replay: real report detail");
    return;
  }
  const injected = await page.evaluate(async (rounds) => {
    const detail = document.querySelector('[data-role="report-detail"]');
    if (!detail) return false;
    try {
      const mod = await import("/src/ui/battleReportReplayStage.ts");
      mod.mountBattleReportReplayStage(detail, rounds);
      detail.classList.remove("hidden");
      return true;
    } catch {
      return false;
    }
  }, SAMPLE_ROUNDS);
  manifest.notes.push(
    injected
      ? "battle-replay: QA import mountBattleReportReplayStage with sample rounds"
      : "battle-replay: no detail mount (list may be empty)",
  );
}

const browser = await chromium.launch({ executablePath: CHROMIUM, chromiumSandbox: true });
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });

await page.goto(BASE);
await page.waitForSelector("#hud", { timeout: 120000 });
await shots(page, "server-select", { width: 1280, height: 720 });

await page.locator('li[data-server-id="1"]').waitFor({ timeout: 120000 });
await page.locator('[data-action="enter-game"]:not([disabled])').waitFor({ timeout: 120000 });
await page.locator('[data-action="enter-game"]').click();
await page.locator(".main-city-toolbar").waitFor({ timeout: 180000 });

await page.locator('[data-action="toggle-hero"]').click();
await page.locator('[data-center-panel="hero"]:visible').first().waitFor({ timeout: 15000 }).catch(() => {});
await shots(page, "hero-panel", { width: 1280, height: 720 });

await tryRealMarch(page);
await page.locator('[data-action="open-world-map"]').click();
await page.locator('[data-role="world-map-layer"]:not(.hidden)').waitFor({ timeout: 15000 });
await page.waitForTimeout(2000);
await shots(page, "world-map-march", { width: 1600, height: 900 });
await page.locator('[data-action="world-map-close"]').click();

async function ensureToolbarAction(page, action) {
  const btn = page.locator(`[data-action="${action}"]`);
  if (!(await btn.isVisible().catch(() => false))) {
    await page.locator('[data-action="toggle-toolbar-more"]').click();
  }
  await btn.click({ timeout: 15000 });
}

await ensureToolbarAction(page, "toggle-guild");
await page.locator('[data-center-panel="guild"]:not(.hidden)').first()
  .waitFor({ timeout: 10000 }).catch(() => {});
let guildVisible = await page.locator('[data-center-panel="guild"]:not(.hidden)').count();
if (!guildVisible) {
  await ensureToolbarAction(page, "toggle-queue");
  await page.locator('[data-center-panel="queue"]:not(.hidden)').waitFor({ timeout: 10000 }).catch(() => {});
  manifest.notes.push("guild-or-queue: queue panel (guild hidden)");
} else {
  manifest.notes.push("guild-or-queue: guild panel");
}
await shots(page, "guild-or-queue", { width: 1280, height: 720 });

await page.locator('[data-action="toggle-reports"]').click();
await page.locator('[data-center-panel="battle-report"]:visible').first().waitFor({ timeout: 10000 }).catch(() => {});
const firstReport = page.locator(".battle-report-list li button, .battle-report-list li[data-report-id]").first();
if (await firstReport.count()) await firstReport.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800);
await mountReplayIfNeeded(page);
await page.waitForTimeout(600);
await shots(page, "battle-report-replay", { width: 1280, height: 720 });

writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(JSON.stringify({ out: OUT, count: manifest.shots.length, notes: manifest.notes }));