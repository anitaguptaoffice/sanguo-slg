// Native component acceptance with controlled protobuf transport; no live economy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..'), out = process.env.QA_OUT;
assert.ok(out, 'QA_OUT is required'); mkdirSync(out, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: client }).toString().trim();
const target = '6d21279dbfbc522b67a3a8b1e8d4b978e09b1002', tree = '58f042526a31e79dbf468a145b863165f0188293';
assert.equal(git('rev-parse', 'HEAD'), target); assert.equal(git('rev-parse', 'HEAD^{tree}'), tree);
const report = { target, tree, harness: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
  boundary: 'Sandboxed Chromium, production ContentPanels/GatewayClient/protobuf/CSS; controlled FIFO transport, not live backend or progression.', cases: [], errors: [] };
const port = 16527, url = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const entry = `import {ContentPanels} from '/src/ui/ContentPanels.ts';
import {GatewayClient} from '/src/net/GatewayClient.ts';
import {getProtoRoot} from '/src/net/loadProto.ts';
import {computeLayoutViewport,applyLayoutFrameStyles,syncLayoutViewportRootClass} from '/src/engine/layoutViewport.ts';
const mount=document.getElementById('layout-frame');mount.replaceChildren();
const vp=computeLayoutViewport(innerWidth,innerHeight);applyLayoutFrameStyles(mount,vp);syncLayoutViewportRootClass(mount,vp);
const root=getProtoRoot(), cp=root.lookupType('sanguo.common.v1.ClientPacket'), sp=root.lookupType('sanguo.common.v1.ServerPacket');
const queue=[],sent=[],delivered=[];const ws=Object.assign(new EventTarget(),{readyState:WebSocket.OPEN,send(bytes){const p=cp.decode(bytes);queue.push(p);sent.push(p.route)},close(){}});
const gateway=new GatewayClient();Object.assign(gateway,{ws,sessionId:'fixture-session',boundServerId:1,sessionGeneration:1});
const session={serverId:1,cityId:1,cityName:'城',player:{player_id:1},wallet:{gold:10,food:100},bag:[],buildings:[],cityTroops:[]};
const panels=new ContentPanels(mount,gateway,()=>session,p=>Object.assign(session,p),()=>{});panels.attach();
async function reply(route,type,value,code=0){const req=queue.shift();if(req?.route!==route)throw Error('FIFO route mismatch: '+req?.route+' expected '+route);delivered.push(route);
 const t=root.lookupType(type),data=t.encode(t.fromObject(value)).finish(),bytes=sp.encode(sp.fromObject({trace_id:req.trace_id,code,data,message:'fixture failure'})).finish();
 ws.dispatchEvent(new MessageEvent('message',{data:Uint8Array.from(bytes).buffer}));for(let i=0;i<40;i++)await Promise.resolve();}
const shelf=()=>reply('shop.v1.ListShopShelf','sanguo.shop.v1.ListShopShelfResponse',{offers:[{offer_id:1001,item_cfg_id:2001,quantity_per_purchase:1,price_resources:{gold:10}}]});
const bag=(code=0,empty=false)=>reply('content.v1.ListPlayerBag','sanguo.content.v1.ListPlayerBagResponse',{items:empty?[]:[{item_cfg_id:2001,quantity:1}]},code);
const purchase=(code=0)=>reply('shop.v1.PurchaseShopOffer','sanguo.shop.v1.PurchaseShopOfferResponse',{wallet_after:{gold:0,food:100},granted_items:{items:[{item_cfg_id:2001,quantity:1}]}},code);
const city=()=>reply('domestic.v1.GetCityState','sanguo.domestic.v1.GetCityStateResponse',{wallet:{food:105}});
for(const [id,text,fn] of [['shop','商城',()=>panels.toggleShop()],['bag','背包',()=>panels.toggleBag()]]){const b=document.createElement('button');b.id='qa-'+id;b.textContent=text;b.style.cssText='position:fixed;top:4px;left:'+(id==='shop'?4:80)+'px;z-index:9999';b.onclick=fn;document.body.append(b)}
window.qa={panels,gateway,session,queue,sent,delivered,reply,shelf,bag,purchase,city};panels.toggleShop();await shelf();`;
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(url)).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Vite startup'); browser = await chromium.launch({ chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    for (const mode of ['success', 'repeat', 'close', 'remount', 'actor', 'reject', 'unknown', 'use-recovery']) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', e => report.errors.push(String(e)));
      await page.route('**/src/main.ts', r => r.fulfill({ contentType: 'application/javascript', body: entry }));
      await page.goto(url); const buy = page.locator('[data-action="buy-offer"]'); await buy.waitFor();
      assert.equal(await buy.isDisabled(), false);
      if (mode === 'use-recovery') {
        await page.locator('#qa-bag').click(); await page.evaluate(() => qa.bag());
        await page.locator('[data-action="use-item"]').click();
        await page.evaluate(() => qa.reply('content.v1.UseConsumable','sanguo.content.v1.UseConsumableResponse',{},10002));
        await page.locator('#qa-shop').click(); await page.evaluate(() => qa.shelf());
      }
      await buy.click(); await page.locator('#qa-bag').click();
      assert.equal(await page.locator('[data-center-panel="bag"]').isVisible(), true);
      assert.deepEqual(await page.evaluate(() => qa.queue.map(r => r.route)), ['shop.v1.PurchaseShopOffer']);
      if (mode === 'repeat') { await page.locator('[data-action="refresh-bag"]').click(); await page.locator('[data-action="refresh-bag"]').click(); }
      if (mode === 'close' || mode === 'use-recovery') await page.locator('#qa-bag').click();
      if (mode === 'remount') await page.evaluate(() => { qa.panels.detach(); qa.panels.attach(); });
      if (mode === 'actor') await page.evaluate(() => { qa.session.player = { player_id: 2 }; });
      await page.screenshot({ path: `${out}/${width}-${mode}-pending.png` });
      const code = mode === 'reject' || mode === 'use-recovery' ? 64001 : mode === 'unknown' ? 10002 : 0;
      await page.evaluate(c => qa.purchase(c), code);
      if (['close', 'remount', 'actor', 'use-recovery'].includes(mode)) {
        assert.equal(await page.evaluate(() => qa.queue.length), 0);
        if (mode === 'close') assert.equal(await page.evaluate(() => qa.session.wallet.gold), 0);
        if (mode === 'actor' || mode === 'remount') {
          assert.deepEqual(await page.evaluate(() => qa.session.wallet), { gold: 10, food: 100 });
          assert.deepEqual(await page.evaluate(() => qa.session.bag), []);
        }
        if (mode === 'use-recovery') {
          await page.locator('#qa-bag').click();
          await page.evaluate(() => qa.bag(0, true)); await page.evaluate(() => qa.city());
          assert.ok(!(await page.locator('[data-role="bag-list"]').innerText()).includes('加载'));
          assert.deepEqual(await page.evaluate(() => qa.session.bag), []);
          assert.equal(await page.evaluate(() => qa.session.wallet.food), 105);
          assert.equal(await page.evaluate(() => qa.sent.filter(x => x === 'content.v1.UseConsumable').length), 1);
        }
      } else {
        assert.deepEqual(await page.evaluate(() => qa.queue.map(r => r.route)), ['content.v1.ListPlayerBag']);
        await page.evaluate(() => qa.bag());
        assert.deepEqual(await page.evaluate(() => qa.session.bag), [{ item_cfg_id: 2001, quantity: 1 }]);
        assert.equal(await page.evaluate(() => qa.session.wallet.gold), code ? 10 : 0);
        if (['success', 'repeat'].includes(mode)) {
          await page.locator('#qa-shop').click(); await page.evaluate(() => qa.bag());
          await page.evaluate(() => qa.city()); await page.evaluate(() => qa.shelf());
          assert.equal(await buy.isDisabled(), true);
          assert.equal(await page.evaluate(() => qa.session.wallet.gold), 0);
        }
      }
      assert.equal(await page.evaluate(() => qa.sent.filter(x => x === 'shop.v1.PurchaseShopOffer').length), 1);
      assert.deepEqual(await page.evaluate(() => qa.delivered), await page.evaluate(() => qa.sent));
      await page.screenshot({ path: `${out}/${width}-${mode}-settled.png` });
      report.cases.push({ width, height, mode, passed: true, sent: await page.evaluate(() => qa.sent) });
      await page.evaluate(() => { qa.panels.detach(); qa.gateway.close(); }); await page.close();
    }
  }
  assert.equal(report.cases.length, 16); assert.deepEqual(report.errors, []); report.passed = true;
} catch (e) { report.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  await browser?.close();
  if (vite.exitCode === null) { const exit = new Promise(r => vite.once('exit', r)); vite.kill('SIGTERM'); await exit; }
  report.cleanup = { browserClosed: !browser?.isConnected(), viteExit: vite.exitCode, viteSignal: vite.signalCode };
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
