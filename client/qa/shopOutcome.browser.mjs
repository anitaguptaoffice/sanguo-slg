// Production ContentPanels/CSS, isolated gateway fixtures. No live service/DB mutations.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/shop-outcome-browser';
const port = process.env.QA_PORT ?? '16513', url = `http://127.0.0.1:${port}`;
mkdirSync(out, { recursive: true });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: client }).toString().trim(), boundary: 'Sandboxed Chromium, production component/CSS, controlled gateway fixtures. Not backend atomicity, live gateway or native progression proof.', cases: [], errors: [] };
const entry = `import {ContentPanels} from '/src/ui/ContentPanels.ts';
import {beginAssetRead} from '/src/net/questClaimAssets.ts';
import {AssetLoader} from '/src/engine/AssetLoader.ts';
import {skinShopPanel} from '/src/engine/artPanelSkin.ts';
import {computeLayoutViewport,applyLayoutFrameStyles,syncLayoutViewportRootClass} from '/src/engine/layoutViewport.ts';
const mount=document.getElementById('layout-frame');mount.replaceChildren();const vp=computeLayoutViewport(innerWidth,innerHeight);applyLayoutFrameStyles(mount,vp);syncLayoutViewportRootClass(mount,vp);
let s={serverId:1,cityId:11,player:{player_id:4},wallet:{gold:100},bag:[{item_cfg_id:2004,quantity:4}],buildings:[],cityTroops:[]};
let generation=1, failCity=false, holdBag=false;const pending=[],reads=[],calls=[],patches=[],statuses=[],held=[];
const snapshot={bag:[{item_cfg_id:2001,quantity:3},{item_cfg_id:2004,quantity:1}],wallet:{gold:90}};
const gateway={getBoundServerId:()=>1,getSessionId:()=>'fixture',getSessionGeneration:()=>generation,
 listShopShelf:async(...args)=>{reads.push(['shelf',...args]);return{offers:[{offer_id:1001,item_cfg_id:2001,quantity_per_purchase:3,price_resources:{gold:10},purchase_limit:10,purchased_count:0}]}},
 listPlayerBag:async(...args)=>{reads.push(['bag',...args]);if(holdBag){holdBag=false;return new Promise(resolve=>held.push(resolve))}return{items:snapshot.bag}},
 getCityState:async(...args)=>{reads.push(['city',...args]);if(failCity)throw Error('city read failed');return{wallet:snapshot.wallet}},
 purchaseShopOffer:(...args)=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}))}};
const p=new ContentPanels(mount,gateway,()=>s,x=>{patches.push(x);s={...s,...x}},x=>statuses.push(x));p.attach();const assets=new AssetLoader();await assets.loadAll();skinShopPanel(p.getShopRoot(),assets,520,320);p.toggleShop();
const toggle=document.createElement('button');toggle.id='qa-toggle';toggle.textContent='开关商城';toggle.style.cssText='position:fixed;left:4px;top:4px;z-index:9999';toggle.onclick=()=>p.toggleShop();document.body.append(toggle);
window.qa={p,calls,reads,patches,statuses,pending,held,get s(){return s},failCity:v=>failCity=v,holdBag:()=>holdBag=true,
 done:i=>pending[i].resolve({granted_items:{items:[{item_cfg_id:2001,quantity:3}]},wallet_after:{gold:90}}),fail:i=>pending[i].reject(Error('gateway timeout')),
 overtake:()=>{s={...s,bag:[{item_cfg_id:2004,quantity:9}],wallet:{gold:900}};beginAssetRead(gateway)},
 changeActor:()=>{s={...s,player:{player_id:5}};generation++}};`;
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: '/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.route('**/src/main.ts', r => r.fulfill({ contentType: 'application/javascript', body: entry }));
    await page.route('**/assets/art/v1/manifest.json', async r => {
      const response = await r.fetch(), manifest = await response.json();
      manifest.assets = manifest.assets.filter(a => a.id === 'ui.panel.shop.v1');
      await r.fulfill({ response, json: manifest });
    });
    await page.goto(url); await page.locator('[data-offer-id="1001"]').waitFor();
    assert.ok((await page.locator('[data-center-panel="shop"]').evaluate(el => el.style.borderImageSource)).includes('panel_default.png'));
    const buy = page.locator('[data-action="buy-offer"]'), reload = page.locator('[data-action="reload-shop-state"]');
    const feedback = page.locator('[data-role="shop-feedback"]'), warning = page.locator('[data-role="shop-form-error"]');
    await page.evaluate(() => qa.failCity(true)); await buy.click({ clickCount: 2 });
    assert.equal(await page.evaluate(() => qa.calls.length), 1); assert.equal(await buy.isDisabled(), true);
    await page.evaluate(() => qa.done(0)); await page.waitForFunction(() => document.querySelector('[data-role="shop-form-error"]').textContent.includes('待同步'));
    assert.ok((await feedback.innerText()).includes('购买成功')); assert.equal(await page.evaluate(() => qa.patches.length), 0);
    await page.evaluate(() => getSelection()?.removeAllRanges());
    await page.screenshot({ path: `${out}/${width}-confirmed-refresh-failure.png` });
    await page.evaluate(() => qa.failCity(false)); await reload.click(); await page.waitForFunction(() => qa.patches.length === 1);
    assert.deepEqual(await page.evaluate(() => qa.s.bag), [{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }]);
    assert.equal(await page.evaluate(() => qa.s.wallet.gold), 90); assert.equal(await page.evaluate(() => qa.calls.length), 1);
    await page.evaluate(() => qa.holdBag()); await buy.click(); await page.evaluate(() => qa.p.toggleBag());
    await page.waitForFunction(() => qa.held.length === 1);
    const hiddenPatches = await page.evaluate(() => qa.patches.length);
    const readsBeforeClose = await page.evaluate(() => qa.reads.length);
    await page.evaluate(() => qa.done(1)); await page.waitForFunction(() => !document.querySelector('[data-action="reload-shop-state"]').disabled);
    await page.evaluate(() => qa.held.shift()({ items: [{ item_cfg_id: 2004, quantity: 4 }] }));
    assert.equal(await page.evaluate(() => qa.patches.length), hiddenPatches);
    assert.equal(await page.evaluate(() => qa.reads.length), readsBeforeClose);
    await page.locator('#qa-toggle').click(); await page.waitForFunction(() => !document.querySelector('[data-action="buy-offer"]').disabled);
    assert.equal(await page.evaluate(() => qa.calls.length), 2);
    await buy.click(); await page.evaluate(() => qa.fail(2)); await page.waitForFunction(() => document.querySelector('[data-role="shop-feedback"]').textContent.includes('结果未知'));
    assert.equal(await buy.isDisabled(), true); await reload.click();
    await page.waitForFunction(() => !document.querySelector('[data-action="buy-offer"]').disabled);
    assert.ok((await feedback.innerText()).includes('结果未知')); assert.ok((await warning.innerText()).includes('不能据此判定'));
    assert.ok((await buy.innerText()).includes('非重试')); assert.equal(await page.evaluate(() => qa.calls.length), 3);
    const bounds = await reload.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    await page.evaluate(() => getSelection()?.removeAllRanges());
    await page.screenshot({ path: `${out}/${width}-unknown-after-read.png` });
    await page.evaluate(() => qa.holdBag()); await buy.click(); await page.evaluate(() => qa.done(3));
    await page.waitForFunction(() => qa.held.length === 1); const patches = await page.evaluate(() => qa.patches.length);
    await page.evaluate(() => { qa.overtake(); qa.held[0]({ items: [{ item_cfg_id: 2001, quantity: 999 }] }); });
    await page.waitForFunction(() => !document.querySelector('[data-action="reload-shop-state"]').disabled);
    assert.equal(await page.evaluate(() => qa.s.wallet.gold), 900); assert.equal(await page.evaluate(() => qa.patches.length), patches);
    assert.ok((await feedback.innerText()).includes('购买成功')); assert.ok((await warning.innerText()).includes('待同步'));
    await reload.click(); await page.waitForFunction(() => !document.querySelector('[data-action="buy-offer"]').disabled);
    await buy.click(); await page.evaluate(() => qa.changeActor()); await page.locator('#qa-toggle').click(); await page.locator('#qa-toggle').click();
    await page.waitForFunction(() => !document.querySelector('[data-action="buy-offer"]').disabled); await buy.click();
    const actorPatches = await page.evaluate(() => qa.patches.length); await page.evaluate(() => qa.done(4));
    assert.equal(await buy.isDisabled(), true); assert.equal(await page.evaluate(() => qa.patches.length), actorPatches);
    await page.evaluate(() => qa.done(5)); await page.waitForFunction(() => !document.querySelector('[data-action="buy-offer"]').disabled);
    await buy.click(); const beforeDetach = await page.evaluate(() => qa.patches.length);
    await page.evaluate(() => { qa.p.detach(); qa.done(6); });
    assert.equal(await page.evaluate(() => qa.patches.length), beforeDetach);
    assert.deepEqual(await page.evaluate(() => qa.calls), Array.from({ length: 7 }, () => [1, 1001, 1]));
    report.cases.push({ width, height, reloadBounds: bounds, checks: ['double click one RPC', 'success survives read failure', 'read-only retry', 'authoritative item currency', 'close/reopen no replay', 'intervening hidden bag read discarded', 'unknown survives reads', 'new purchase explicit', 'stale assets rejected', 'old actor cannot unlock new action', 'unmount ignored'] });
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
