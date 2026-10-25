/** Production client + mock Gateway: native focus/pointer regression, not backend acceptance. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const out = path.resolve(process.argv[2] || "stable-slot-evidence");
await mkdir(out, { recursive: true });
const mock = spawn("node", ["mock-server/server.mjs"], { env: { ...process.env, MOCK_GATEWAY_PORT: "19186", MOCK_EVIDENCE_PRESET: "hero-panel-roster" }, stdio: "ignore" });
const app = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16286", "--strictPort"], { env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19186/ws" }, stdio: "ignore" });
let browser;
const results = { boundary: "Mock Gateway; production DOM/CSS; native focus/mouse/keyboard; no force clicks or DOM replacement", widths: [] };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:16286")).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const width of [1280, 1600]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 900 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:16286");
    await page.locator(".server-list li").first().click();
    await page.locator('[data-action="enter-game"]').click();
    const hall = page.locator('.main-city-slot-overlay-cell[data-slot-key="hall"]');
    await hall.waitFor({ state: "attached" });
    if (width === 1600) {
      assert.equal(await hall.isVisible(), false);
      const hidden = await hall.elementHandle(); await page.waitForTimeout(500);
      assert.equal(await hidden.evaluate(node => node.isConnected), true);
      results.widths.push({ width, height: 900, intentionallyHidden: true, originalNodeRetained: true });
      // Real viewport resize activates the documented narrow letterbox layout, no CSS overrides.
      await page.setViewportSize({ width, height: 720 });
    }
    await hall.waitFor();
    const original = await hall.elementHandle();
    await hall.focus(); await page.waitForTimeout(500);
    assert.equal(await original.evaluate(node => node === document.activeElement && node.isConnected), true);
    await page.screenshot({ path: path.join(out, `${width}-focused-slots.png`) });
    // Read-only observation of actual native events; no application state/style changes.
    await hall.evaluate(node => { window.slotClicks = 0; node.addEventListener("click", () => window.slotClicks++); });
    const box = await hall.boundingBox(); assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(500); // many MainCityScene idle sync frames
    assert.equal(await original.evaluate(node => node.isConnected), true);
    await page.mouse.up(); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.slotClicks), 1);
    assert.equal(await hall.evaluate(node => node.classList.contains("main-city-slot-overlay-cell-selected")), true);
    assert.equal(await original.evaluate(node => node === document.querySelector('.main-city-slot-overlay-cell[data-slot-key="hall"]')), true);
    await hall.focus(); await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.slotClicks), 2);
    await hall.focus(); await page.waitForTimeout(500);
    assert.equal(await original.evaluate(node => node === document.activeElement), true);
    await page.screenshot({ path: path.join(out, `${width}-stable-slots.png`) });
    assert.deepEqual(errors, []);
    results.widths.push({ width, height: 720, focusRetainedMs: 500, pointerDownAcrossSyncMs: 500, pointerActivations: 1, keyboardActivations: 1, originalNodeRetained: true, errors });
    await page.close();
  }
} finally { await writeFile(path.join(out, "result.json"), JSON.stringify(results, null, 2)); await browser?.close(); mock.kill(); app.kill(); }
console.log(JSON.stringify(results, null, 2));
