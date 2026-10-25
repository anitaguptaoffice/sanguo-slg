/** Real production DOM/CSS + mock Gateway transport; not backend acceptance. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const out = path.resolve(process.argv[2] || "center-panel-evidence");
await mkdir(out, { recursive: true });
const mock = spawn("node", ["mock-server/server.mjs"], { env: { ...process.env, MOCK_GATEWAY_PORT: "19185", MOCK_EVIDENCE_PRESET: "hero-panel-roster" }, stdio: "ignore" });
const app = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16285", "--strictPort"], { env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19185/ws" }, stdio: "ignore" });
let browser;
const results = { boundary: "Mock gateway; native toolbar/HUD; no DOM/style hiding", widths: [] };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:16285")).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const width of [1280, 1600]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 900 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://127.0.0.1:16285");
    await page.locator(".server-list li").first().click();
    await page.locator('[data-action="enter-game"]').click();
    await page.locator('[data-action="toggle-mail"]').waitFor();
    const visible = () => page.evaluate(() => [...document.querySelectorAll(".content-panel, .military-panel, .building-panel")].filter(e => !e.classList.contains("hidden")).map(e => e.dataset.centerPanel || "quest"));
    const trace = [];
    await page.evaluate(async () => {
      const { GatewayClient } = await import("/src/net/GatewayClient.ts");
      const original = GatewayClient.prototype.listPlayerHeroes;
      GatewayClient.prototype.listPlayerHeroes = async function (...args) {
        const result = await original.apply(this, args);
        await new Promise(resolve => setTimeout(resolve, 400)); return result;
      };
    });
    await page.locator('[data-action="toggle-hero"]').click();
    await page.locator('[data-action="toggle-mail"]').click();
    await page.waitForTimeout(600); assert.deepEqual(await visible(), ["mail"]);
    await page.locator('[data-action="toggle-mail"]').click();
    for (const [action, expected] of [["mail","mail"],["hero","hero"],["queue","queue"],["marches","march"],["world","world"],["bag","bag"],["shop","shop"],["bag","bag"]]) {
      await page.locator(`[data-action="toggle-${action}"]`).click();
      await page.waitForTimeout(100);
      assert.deepEqual(await visible(), [expected]); trace.push({ action, visible: await visible() });
    }
    await page.locator('[data-action="toggle-bag"]').click(); assert.deepEqual(await visible(), []);
    await page.locator('[data-action="toggle-queue"]').click();
    await page.locator('[data-action="toggle-mail"]').focus(); await page.keyboard.press("Enter");
    assert.deepEqual(await visible(), ["mail"]);
    await page.waitForTimeout(50);
    const focused = await page.evaluate(() => document.activeElement?.closest("[data-center-panel]")?.getAttribute("data-center-panel"));
    assert.equal(focused, "mail");
    await page.keyboard.press("Escape"); assert.deepEqual(await visible(), []);
    const hud = page.locator('[aria-label^="HUD 深链："]');
    const hudTrace = [];
    for (let i = 0; i < await hud.count(); i++) {
      const label = await hud.nth(i).getAttribute("aria-label");
      await page.locator('[data-action="toggle-hero"]').click();
      await hud.nth(i).click(); await page.waitForTimeout(100);
      assert.equal((await visible()).length, 1); hudTrace.push({ label, visible: await visible() });
    }
    await page.locator('[data-action="toggle-queue"]').click();
    await page.locator('[data-action="toggle-marches"]').click();
    assert.deepEqual(await visible(), ["march"]);
    await page.locator('[data-action="refresh-marches"]').click();
    await page.screenshot({ path: path.join(out, `${width}-march-foreground.png`) });
    // Observe separate known defect; never rewrite the DOM to make this test pass.
    const strip = page.locator(".main-city-slot-overlay-cell").first();
    let slotFocus = null;
    if (await strip.isVisible()) {
      await strip.focus(); await page.waitForTimeout(100);
      slotFocus = await page.evaluate(() => document.activeElement?.className);
    }
    assert.deepEqual(errors, []); results.widths.push({ width, trace, hudTrace, focused, slotVisible: await strip.isVisible(), slotFocus, errors });
    await page.close();
  }
} finally { await writeFile(path.join(out, "result.json"), JSON.stringify(results, null, 2)); await browser?.close(); mock.kill(); app.kill(); }
console.log(JSON.stringify(results, null, 2));
