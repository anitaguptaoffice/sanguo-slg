/** CLIENT-REPAIR-001: real client DOM/CSS with explicit GatewayPort fixtures, not backend RPC acceptance.
 * cd client && PLAYWRIGHT_BROWSERS_PATH=... node scripts/verify-hero-capture-access.mjs [output-dir]
 */
import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { installHeroHostCaptureProbes, scrollHeroDetailHeadInPage, probeHeroPortraitFramesInPage, probeBustNameSameFrameInPage } from "./lib/hero-host-capture-probes.mjs";
const out = path.resolve(process.argv[2] || "/tmp/hero-capture-access");
await mkdir(out, { recursive: true });
const mock = spawn("node", ["mock-server/server.mjs"], { env: { ...process.env, MOCK_GATEWAY_PORT: "19180", MOCK_EVIDENCE_PRESET: "hero-panel-roster" }, stdio: "ignore" });
const app = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16280", "--strictPort"], { env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19180/ws" }, stdio: "ignore" });
let browser;
const results = { head: execSync("git rev-parse HEAD").toString().trim(), boundary: "Mock gateway plus explicit GatewayClient method fixtures; no production CSS/DOM rewriting", viewports: [] };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:16280")).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await installHeroHostCaptureProbes(page);
    await page.goto("http://127.0.0.1:16280");
    await page.locator(".server-list li").first().click();
    await page.locator('[data-action="enter-game"]').click();
    await page.locator('[data-action="toggle-hero"]').waitFor();
    await page.evaluate(async () => {
      const { GatewayClient } = await import("/src/net/GatewayClient.ts");
      const p = GatewayClient.prototype;
      window.__captureCalls = [];
      p.listCaptiveHeroes = async () => ({ captives: [{ hero_id: 55, city_id: 0, display_name: "俘虏甲", level: 8 }, { hero_id: 56, city_id: 0, display_name: "俘虏乙", level: 9 }] });
      p.listComingHeroes = async () => ({ coming: [{ hero_id: 65, city_id: 0, display_name: "来投甲", level: 8 }, { hero_id: 66, city_id: 0, display_name: "来投乙", level: 9 }] });
      p.listPersuadeTargets = async () => ({ targets: [{ npc_cfg_id: 1001, display_name: "结交甲", level: 40, friend: 30, state: 1, hire_friend_min: 30 }, { npc_cfg_id: 1002, display_name: "结交乙", level: 40, friend: 30, state: 1, hire_friend_min: 30 }] });
      p.trySummonCaptive = async (_s, _c, id) => ({ hero_id: id, gold_cost: 0, items: [], summary: `俘虏目标 ${id} · 费用 0` });
      p.tryAcceptComing = async (_s, _c, id) => ({ hero_id: id, summary: `来投目标 ${id} · 费用 0` });
      for (const name of ["sureSummonCaptive", "releaseCaptive", "sureAcceptComing", "rejectComing", "lionizeHero", "persuadeHero"]) {
        p[name] = async (...args) => { window.__captureCalls.push({ name, target: args[2] }); throw new Error("fixture action acknowledged; no backend write"); };
      }
    });
    await page.locator('[data-action="toggle-hero"]').click();
    await page.locator('[data-role="hero-recruit-host"] > summary').click();
    await page.waitForTimeout(200);
    const selected = [];
    for (const [section, row, preview, action, target] of [
      ["captive-hero-section", '[data-captive-id="56"]', "captive-hero-preview", "captive-summon-confirm", 56],
      ["persuade-section", '[data-npc-cfg-id="1002"]', "persuade-preview", "persuade-primary", 1002],
      ["coming-hero-section", '[data-coming-id="66"]', "coming-hero-preview", "coming-accept-confirm", 66],
    ]) {
      const host = page.locator(`[data-role="${section}"]`);
      if (await host.locator("details").getAttribute("open") !== null) await host.locator("summary").click();
      const before = await page.evaluate(() => window.__captureCalls.length);
      await host.locator(`[data-action="${action}"]`).click();
      assert.equal(await page.evaluate(() => window.__captureCalls.length), before, "closed details must reveal before action");
      await host.locator(row).focus(); await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      assert.equal(await host.locator(row).getAttribute("aria-pressed"), "true");
      const text = await host.locator(`[data-role="${preview}"]`).innerText();
      assert.ok(text.includes(String(target)) || text.includes("结交乙"));
      await page.screenshot({ path: path.join(out, `${width}-${section}.png`) });
      await host.locator(`[data-action="${action}"]`).click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.__captureCalls.at(-1).target), target);
      assert.ok((await host.locator('[role="alert"]').innerText()).includes("fixture action acknowledged"));
      await host.locator("summary").focus(); await page.keyboard.press("Enter");
      assert.equal(await host.locator("details").getAttribute("open"), null);
      selected.push({ section, target, preview: text });
    }
    // Reopen and reload uses native controls; no style/content hiding for evidence.
    await page.locator('[data-action="toggle-hero"]').click();
    await page.locator('[data-action="toggle-hero"]').click();
    await page.waitForTimeout(100);
    const recruit = page.locator('[data-role="hero-recruit-host"]');
    if (await recruit.getAttribute("open") !== null) await recruit.locator(":scope > summary").click();
    await page.locator('.hero-list li[data-template-cfg-id="1001"]').first().click();
    await page.locator(".hero-detail-name").waitFor();
    await scrollHeroDetailHeadInPage(page);
    await page.waitForTimeout(100);
    const portrait = await probeBustNameSameFrameInPage(page);
    const probes = await probeHeroPortraitFramesInPage(page, 1001);
    await page.screenshot({ path: path.join(out, `${width}-bust-buttons.png`) });
    assert.equal(probes.captureSectionButtonsInClip.ok, true, "all eight existing actions remain in clip");
    assert.equal(portrait.ok, true, "bust and right-side name remain complete");
    assert.deepEqual(errors, []);
    results.viewports.push({ width, height, selected, portrait, buttons: probes.captureSectionButtonsInClip, calls: await page.evaluate(() => window.__captureCalls), errors });
    await page.close();
  }
} finally {
  await writeFile(path.join(out, "result.json"), JSON.stringify(results, null, 2));
  await browser?.close(); mock.kill(); app.kill();
}
console.log(JSON.stringify(results, null, 2));
