// Component fixture QA, NOT a native gateway playthrough; starts this worktree's Vite.
import assert from "node:assert/strict";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.QA_URL ?? "http://127.0.0.1:16391";
const out = process.env.QA_OUT ?? "/tmp/upgrade-prerequisite-browser";
mkdirSync(out, { recursive: true });
const client = resolve(import.meta.dirname, "..");
const server = process.env.QA_URL ? null : spawn(process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "16391", "--strictPort"],
  { cwd: client, stdio: ["ignore", openSync(`${out}/vite.log`, "w"), "inherit"] });
const browser = await chromium.launch({
  executablePath: "/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
  chromiumSandbox: true,
});
const report = { source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: client }).toString().trim(),
  browser: "chromium_headless_shell-1148; chromiumSandbox=true; no custom security flags",
  boundary: "Actual component, production CSS/art/layout; deterministic session fixtures, no gateway or native progression claim.", cases: [], errors: [] };
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* wait for local Vite */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.route("**/src/main.ts", (route) => route.fulfill({ contentType: "text/javascript", body: "// Isolated component fixture" }));
    await page.goto(url);
    await page.evaluate(async () => {
      const { MainCityBuildingPanel } = await import("/src/ui/MainCityBuildingPanel.ts");
      const { AssetLoader } = await import("/src/engine/AssetLoader.ts");
      const { skinDefaultPanel } = await import("/src/engine/artPanelSkin.ts");
      const { skinPrimaryButtons } = await import("/src/engine/artButtonSkin.ts");
      const layout = await import("/src/engine/layoutViewport.ts");
      const frame = document.getElementById("layout-frame");
      frame.replaceChildren();
      const vp = layout.computeLayoutViewport(innerWidth, innerHeight);
      layout.applyLayoutFrameStyles(frame, vp);
      layout.syncLayoutViewportRootClass(frame, vp);
      const assets = new AssetLoader();
      await assets.loadAll();
      const city = (hall) => ({ serverId: 1, cityId: 1, cityName: "Fixture", player: {}, bag: [], cityTroops: [],
        wallet: { food: 10000, wood: 10000, stone: 10000, iron: 10000 },
        buildings: [{ slot_key: "hall", building_cfg_id: 1, level: hall }, { slot_key: "farm", building_cfg_id: 2, level: 2 }] });
      let session = city(2);
      const actions = [];
      const panel = new MainCityBuildingPanel(frame, { farm: "农田", hall: "城主府" }, () => session,
        (...args) => actions.push(args), () => "idle", (root) => skinDefaultPanel(root, assets, 380, 300));
      panel.attach();
      skinPrimaryButtons(panel.getRoot(), assets);
      panel.selectSlot("farm");
      window.fixture = { panel, actions, update(hall, sync = true) { session = city(hall); if (sync) panel.sync(); } };
    });
    const button = page.locator('[data-action="confirm-upgrade"]');
    const hint = page.locator('[data-role="build-prerequisite"]');
    assert.equal(await button.isDisabled(), true);
    assert.match(await hint.innerText(), /需城主府达到 Lv3（当前 Lv2）/);
    const geometry = await page.locator('[data-center-panel="building"]').evaluate((panel) => {
      const p = panel.getBoundingClientRect(), b = panel.querySelector("button").getBoundingClientRect();
      const scroll = panel.querySelector(".panel-scroll-body");
      return { panel: p.toJSON(), button: b.toJSON(), overflow: scroll.scrollWidth > scroll.clientWidth + 1 };
    });
    assert.equal(geometry.overflow, false);
    assert(geometry.panel.x >= 0 && geometry.panel.right <= width);
    assert(geometry.button.top >= geometry.panel.top && geometry.button.bottom <= geometry.panel.bottom);
    await page.screenshot({ path: `${out}/${width}-hall2-farm3-blocked.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('[data-center-panel="building"]').isVisible(), false);
    await page.evaluate(() => { window.fixture.panel.selectSlot("farm"); window.fixture.update(3); });
    assert.equal(await button.isDisabled(), false);
    assert.equal(await hint.isVisible(), false);
    await page.screenshot({ path: `${out}/${width}-hall3-farm3-allowed.png` });
    // Session changes after paint: a real enabled-button click must recheck before callback.
    await page.evaluate(() => window.fixture.update(2, false));
    await button.click();
    assert.equal(await button.isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.fixture.actions), []);
    await page.evaluate(() => window.fixture.panel.selectSlot("hall"));
    assert.equal(await button.isDisabled(), false);
    await page.screenshot({ path: `${out}/${width}-hall-self-upgrade.png` });
    await button.click();
    assert.deepEqual(await page.evaluate(() => window.fixture.actions), [["hall", 1]]);
    report.cases.push({ width, height, geometry, checks: "blocked; refreshed boundary; stale click no action; hall exemption; Escape/reopen" });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  server?.kill();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
