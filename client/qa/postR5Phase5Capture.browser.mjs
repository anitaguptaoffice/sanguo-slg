#!/usr/bin/env node
/** Phase-5 spot screenshots: guild panel chrome + battle replay stage. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const OUT = resolve(process.argv[2] || "/opt/cursor/artifacts/post-r5-phase5");
const BASE = process.env.VITE_BASE_URL || "http://127.0.0.1:5273";
const CHROMIUM = process.env.CHROMIUM_PATH || "/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

const SAMPLE_ROUNDS = [
  { round: 1, distance: 8, attacker_units: { "1": 120 }, defender_units: { "1": 100 } },
  {
    round: 2,
    distance: 4,
    attacker_units: { "1": 105 },
    defender_units: { "1": 72 },
    attacker_to_def_hp: 28,
    actions: [{ side: "attacker", kind: "attack" }],
  },
  {
    round: 3,
    distance: 0,
    attacker_units: { "1": 88 },
    defender_units: { "1": 40 },
    attacker_to_def_hp: 32,
    defender_to_att_hp: 12,
  },
];

async function shot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(400);
  const file = resolve(OUT, `${name}-${viewport.width}x${viewport.height}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function ensureToolbarAction(page, action) {
  const btn = page.locator(`[data-action="${action}"]`);
  if (!(await btn.isVisible().catch(() => false))) {
    await page.locator('[data-action="toggle-toolbar-more"]').click();
  }
  await btn.click({ timeout: 15000 });
}

const manifest = { base: BASE, shots: [], notes: [] };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROMIUM, chromiumSandbox: true });
const page = await browser.newPage();
await page.goto(BASE);
await page.waitForSelector("#hud", { timeout: 120000 });
await page.locator('li[data-server-id="1"]').waitFor({ timeout: 120000 });
await page.locator('[data-action="enter-game"]:not([disabled])').click();
await page.locator(".main-city-toolbar").waitFor({ timeout: 180000 });

await ensureToolbarAction(page, "toggle-guild");
await page.locator('[data-center-panel="guild"]:not(.hidden)').waitFor({ timeout: 15000 });
manifest.shots.push(await shot(page, "guild-panel", { width: 1280, height: 720 }));

await ensureToolbarAction(page, "toggle-reports");
await page.locator('[data-center-panel="battle-report"]:not(.hidden)').waitFor({ timeout: 15000 });
const firstReport = page.locator(".battle-report-list li button, .battle-report-list li[data-report-id]").first();
if (await firstReport.count()) await firstReport.click({ timeout: 8000 }).catch(() => {});
const hasStage = await page.locator(".battle-report-replay-stage").count();
if (!hasStage) {
  const ok = await page.evaluate(async (rounds) => {
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
    ok ? "replay: QA mountBattleReportReplayStage (sample rounds)" : "replay: mount failed",
  );
} else {
  manifest.notes.push("replay: from real report detail");
}
await page.waitForTimeout(500);
manifest.shots.push(await shot(page, "battle-report-replay", { width: 1280, height: 720 }));

writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(JSON.stringify({ out: OUT, manifest }));