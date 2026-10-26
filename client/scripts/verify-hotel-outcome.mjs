/** Production DOM/CSS, explicit gateway fixtures; not backend transaction acceptance. */
import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
const out = path.resolve(process.argv[2] || "/tmp/hotel-outcome-evidence");
await mkdir(out, { recursive: true });
const mock = spawn("node", ["mock-server/server.mjs"], { env: { ...process.env, MOCK_GATEWAY_PORT: "19197" }, stdio: "ignore" });
const app = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "16297", "--strictPort"], { env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19197/ws" }, stdio: "ignore" });
const result = { head: execSync("git rev-parse HEAD").toString().trim(), sandbox: true, boundary: "Explicit GatewayPort fixtures; actual aborted HTTP reload; simulated timeout; no production transaction claim", cases: [] };
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch("http://127.0.0.1:16297")).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ chromiumSandbox: true });
  for (const width of [1280, 1600]) for (const action of ["recruit", "refresh"]) for (const mode of ["confirmed-network-failure", "timeout"]) {
    const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 900 } });
    const errors = []; const failedRequests = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("requestfailed", req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
    await page.route("**/__hotel_failed_read", route => route.abort("connectionfailed"));
    await page.goto("http://127.0.0.1:16297");
    await page.locator(".server-list li").first().click();
    await page.locator('[data-action="enter-game"]').click();
    await page.locator('[data-action="toggle-hero"]').waitFor();
    await page.evaluate(async ({ mode }) => {
      const { GatewayClient } = await import("/src/net/GatewayClient.ts");
      const p = GatewayClient.prototype;
      window.__hotel = { calls: [], failReads: false, mode, pool: { candidates: [{ candidate_id: 11, display_name: "赵武", gold_cost: 10 }], hero_capacity: 8, hero_owned: 0, hotel_level: 1 } };
      const f = window.__hotel;
      const read = async name => { f.calls.push(name); if (f.failReads) await fetch("/__hotel_failed_read"); };
      p.listHotelRecruitCandidates = async () => { await read("pool"); return f.pool; };
      p.listPlayerHeroes = async () => { await read("heroes"); return { heroes: [] }; };
      p.listPlayerBag = async () => { await read("bag"); return { items: [{ item_cfg_id: 2004, quantity: 1 }] }; };
      p.getCityState = async () => { await read("wallet"); return { wallet: { gold: 90, food: 5000 } }; };
      const purchase = async name => {
        f.calls.push(name); await new Promise(resolve => { f.releasePurchase = resolve; });
        if (f.mode === "timeout") throw new Error("gateway timeout");
        f.failReads = true;
        return name === "recruit" ? { hero_id: 42, display_name: "赵武" } : f.pool;
      };
      p.recruitHotelCandidate = () => purchase("recruit");
      p.refreshHotelRecruitPool = () => purchase("refresh");
    }, { mode });
    await page.locator('[data-action="toggle-hero"]').click();
    await page.locator('[data-role="hero-recruit-host"] > summary').click();
    const purchase = page.locator(`[data-action="${action === "recruit" ? "recruit-hotel-candidate" : "refresh-hotel-pool"}"]`);
    await purchase.click();
    assert.equal(await purchase.isDisabled(), true);
    // Native dismissal/reopen during the delayed request must not create another purchase.
    await page.keyboard.press("Escape");
    await page.locator('[data-action="toggle-hero"]').click();
    await page.evaluate(() => window.__hotel.releasePurchase());
    await page.waitForFunction(() => {
      const outcome = document.querySelector('[data-role="hotel-outcome"]')?.textContent;
      const warning = document.querySelector('[data-role="hotel-recruit-form-error"]')?.textContent;
      return outcome && !document.querySelector('[data-action="reload-hotel-state"]').disabled &&
        (window.__hotel.mode === "timeout" || warning?.includes("加载未完成"));
    });
    const outcome = page.locator('[data-role="hotel-outcome"]');
    const warning = page.locator('[data-role="hotel-recruit-form-error"]');
    const before = await outcome.innerText();
    assert.ok(before.includes(mode === "timeout" ? "结果暂无法确认" : action === "recruit" ? "已招入" : "客栈池已刷新"));
    assert.equal(await purchase.isDisabled(), true);
    if (mode !== "timeout") { assert.ok((await warning.innerText()).includes("加载未完成")); assert.ok(failedRequests.length > 0); }
    await outcome.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${width}-${action}-${mode}.png`) });
    await page.evaluate(() => { window.__hotel.failReads = false; window.__hotel.pool.candidates = []; });
    await page.locator('[data-action="reload-hotel-state"]').click();
    await page.waitForFunction(() => document.querySelector('[data-role="hotel-recruit-form-error"]')?.textContent?.includes("不能据此判定上次操作结果") && !document.querySelector('[data-action="reload-hotel-state"]').disabled);
    assert.equal(await outcome.innerText(), before);
    assert.ok((await warning.innerText()).includes("不能据此判定上次操作结果"));
    const calls = await page.evaluate(() => window.__hotel.calls);
    assert.equal(calls.filter(name => name === action).length, 1);
    for (const name of ["heroes", "wallet", "bag", "pool"]) assert.ok(calls.includes(name));
    assert.equal(await page.locator('[data-action="refresh-hotel-pool"]').isDisabled(), false);
    assert.deepEqual(errors, []);
    result.cases.push({ width, action, mode, before, after: await outcome.innerText(), warning: await warning.innerText(), calls, failedRequests, errors });
    await page.close();
  }
} finally {
  await writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  await browser?.close();
  for (const child of [mock, app]) { if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once("exit", resolve)); } }
}
assert.equal(result.cases.length, 8);
console.log(JSON.stringify(result, null, 2));
