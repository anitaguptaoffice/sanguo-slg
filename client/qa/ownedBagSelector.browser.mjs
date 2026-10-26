// Isolated production ContentPanels/CSS fixture: no native backend, PG, or network mutations.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/owned-bag-selector-browser';
const url = 'http://127.0.0.1:16493';
mkdirSync(out, { recursive: true });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '16493', '--strictPort'], { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: client }).toString().trim(), boundary: 'Sandboxed Chromium, real production component/CSS, isolated gateway fixtures only. Not native progression or backend proof.', cases: [], errors: [] };
const entry = `import {ContentPanels} from '/src/ui/ContentPanels.ts';
import {computeLayoutViewport,applyLayoutFrameStyles,syncLayoutViewportRootClass} from '/src/engine/layoutViewport.ts';
const mount=document.getElementById('layout-frame');mount.replaceChildren();const vp=computeLayoutViewport(innerWidth,innerHeight);applyLayoutFrameStyles(mount,vp);syncLayoutViewportRootClass(mount,vp);
let s={serverId:1,cityId:11,player:{player_id:4},wallet:{food:100},bag:[{item_cfg_id:2001,quantity:1},{item_cfg_id:2002,quantity:2},{item_cfg_id:2004,quantity:1},{item_cfg_id:2005,quantity:1},{item_cfg_id:2007,quantity:1},{item_cfg_id:9999,quantity:1}],buildings:[],cityTroops:[]};
let returned=0;const calls=[],pending=[];const gateway={getBoundServerId:()=>1,listPlayerBag:async()=>({items:s.bag}),useConsumable:(...args)=>{calls.push(args);return new Promise(resolve=>pending.push(resolve))}};
const p=new ContentPanels(mount,gateway,()=>s,x=>s={...s,...x},()=>{});p.attach();p.setBagReturnHeroDetailHandler(id=>returned=id);p.openBagWithDeepLink({highlightItemId:2001,returnHeroId:7},'hero');
window.qa={calls,pending,get s(){return s},get returned(){return returned},changeActor:()=>s={...s,player:{player_id:5},wallet:{food:9000},bag:[{item_cfg_id:2002,quantity:9}]}};`;
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: '/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.route('**/src/main.ts', r => r.fulfill({ contentType: 'application/javascript', body: entry }));
    await page.goto(url);
    const select = page.locator('[data-field="item-id"]'), use = page.locator('[data-action="use-item"]');
    await page.locator('[data-item-cfg-id="2007"] .bag-stack-name').waitFor();
    const options = await select.locator('option').allTextContents();
    assert.ok(options.includes('2007 常备粮垛 · 持有 1')); assert.ok(options.includes('2002 木料捆·初备 · 持有 2'));
    await select.selectOption('2007'); assert.equal(await select.inputValue(), '2007');
    const bounds = await select.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `${out}/${width}-owned-2007.png` });
    await use.click(); await select.selectOption('2002'); assert.equal(await use.isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => qa.calls), [[1, 2007, 1]]);
    await page.evaluate(() => qa.pending[0]({ remaining: 0, wallet_after: { food: 1100 } }));
    await page.waitForFunction(() => !document.querySelector('[data-action="use-item"]').disabled);
    assert.equal(await select.inputValue(), '2002'); assert.equal(await select.locator('[value="2007"]').count(), 0);
    await page.locator('[data-field="use-count"]').fill('3'); await use.click();
    assert.ok((await page.locator('[data-role="bag-form-error"]').innerText()).includes('超过持有数量'));
    assert.equal(await page.evaluate(() => qa.calls.length), 1);
    await page.locator('[data-field="use-count"]').fill('2'); await use.click();
    assert.deepEqual(await page.evaluate(() => qa.calls), [[1, 2007, 1], [1, 2002, 2]]);
    await page.evaluate(() => qa.pending[1]({ remaining: 0, wallet_after: { food: 1100, wood: 2000 } }));
    await page.waitForFunction(() => document.querySelector('[data-field="item-id"]').selectedOptions[0].textContent.includes('持有 0'));
    assert.equal(await select.inputValue(), '2002'); await use.click(); assert.equal(await page.evaluate(() => qa.calls.length), 2);
    await page.locator('[data-action="refresh-bag"]').click();
    assert.equal(await select.inputValue(), '2002'); assert.equal(await page.locator('[data-item-cfg-id="2002"]').count(), 0);
    for (const id of ['2004', '2005', '9999']) {
      await select.selectOption(id); assert.equal(await use.isDisabled(), true);
      assert.equal(await page.locator('[data-action="use-item-batch"]').isDisabled(), true);
      assert.ok((await page.locator('[data-role="bag-use-capability"]').innerText()).includes('未提交，不会扣除'));
    }
    await page.screenshot({ path: `${out}/${width}-unsupported.png` });
    await select.selectOption('2001'); await page.locator('[data-field="use-count"]').fill('1'); await use.click();
    await page.evaluate(() => qa.changeActor()); await page.locator('[data-action="refresh-bag"]').click();
    await select.selectOption('2002');
    await page.evaluate(() => qa.pending[2]({ remaining: 0, wallet_after: { food: 2100 } }));
    assert.equal(await select.inputValue(), '2002'); assert.ok((await select.locator('option:checked').textContent()).includes('持有 9'));
    assert.equal(await page.evaluate(() => qa.s.wallet.food), 9000);
    await page.locator('[data-action="bag-return-hero"]').click(); assert.equal(await page.evaluate(() => qa.returned), 7);
    report.cases.push({ width, height, options, checks: ['native 2007/2002 selection', 'exact RPC IDs/counts', 'in-flight selection does not double submit', 'stock/count guards', 'refresh/removal', 'unsupported/unknown disabled', 'stale actor ignored', 'hero return'], bounds });
    await page.close();
  }
  assert.equal(report.errors.length, 0); report.passed = true;
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally {
  await browser?.close();
  if (vite.exitCode === null) { const exit = new Promise(r => vite.once('exit', r)); vite.kill('SIGTERM'); await exit; }
  report.cleanup = { browserClosed: !browser?.isConnected(), viteExit: vite.exitCode, viteSignal: vite.signalCode };
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
