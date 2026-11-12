// #2516: native inputs, production submit/handoff, controlled FIFO protobuf replies.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..'), out = process.env.QA_OUT;
assert.ok(out, 'QA_OUT required'); mkdirSync(out, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: client }).toString().trim();
const baseline = process.env.QA_BASELINE === '1';
const target = baseline ? 'b98b24b6833e06f1b3f965a4a77dedb2d876ae3f' : 'e3c848e4acdb10baef113c3df36b62f44cc86567';
const tree = git('rev-parse', 'HEAD^{tree}');
assert.equal(git('rev-parse', 'HEAD'), target);
assert.equal(tree, baseline ? '6de1bb51739046120841d8af1ba824739320c754' : '0c41aa9a2e444e3af2f22fb540858291bdb68f76');
const report = { target, tree, baseline, harness: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
  boundary: 'Sandboxed native component integration, controlled scene shell and FIFO protobuf transport; no live backend or natural lifecycle.', cases: [], errors: [], geometry: [] };
const port = 16528, url = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const entry = `import {MainCityScene} from '/src/scenes/MainCityScene.ts';
import {MarchListPanel} from '/src/ui/MarchListPanel.ts';
import {GatewayClient} from '/src/net/GatewayClient.ts';
import {getProtoRoot} from '/src/net/loadProto.ts';
import {openCenterPanel,toggleCenterPanel} from '/src/ui/centerPanelForeground.ts';
import {computeLayoutViewport,applyLayoutFrameStyles,syncLayoutViewportRootClass} from '/src/engine/layoutViewport.ts';
sessionStorage.clear();
const mount=document.getElementById('layout-frame');mount.replaceChildren();
const vp=computeLayoutViewport(innerWidth,innerHeight);applyLayoutFrameStyles(mount,vp);syncLayoutViewportRootClass(mount,vp);
const root=getProtoRoot(), cp=root.lookupType('sanguo.common.v1.ClientPacket'), sp=root.lookupType('sanguo.common.v1.ServerPacket');
const queue=[],sent=[],delivered=[],requests=[];
const ws=Object.assign(new EventTarget(),{readyState:WebSocket.OPEN,send(bytes){const p=cp.decode(bytes);queue.push(p);sent.push(p.route);
 const t=root.lookupType('sanguo.military.v1.'+(p.route.endsWith('StartMarch')?'StartMarchRequest':'ListMarchesRequest'));
 requests.push(t.toObject(t.decode(p.payload),{longs:Number}));},close(){}});
const gateway=new GatewayClient();Object.assign(gateway,{ws,sessionId:'fixture',boundServerId:1,sessionGeneration:1});
const session={serverId:1,cityId:1,cityX:60,cityY:60,player:{player_id:1},garrisonStatus:'ready',cityTroops:[{unit_cfg_id:1,count:40}]};
const panel=new MarchListPanel(mount,gateway,()=>session.cityId,()=>{},{pollIntervalMs:3600000,getWorldSelectedGrid:()=>({x:90,y:91})});panel.attach();
const military=document.createElement('div');military.className='military-panel hidden';military.dataset.centerPanel='military';
military.innerHTML='<h3>出征表单（受控场景）</h3><input aria-label="目标 x" data-field="to-x"><input aria-label="目标 y" data-field="to-y"><input aria-label="兵力" data-field="march-count"><select data-field="march-hero"><option value="7">将领 7</option></select><button data-action="march">出征攻击</button><p data-role="march-form-error"></p>';
mount.append(military);
const scene=new MainCityScene();Object.assign(scene,{session,gateway,militaryPanel:military,marchList:panel,
 marchFormHeroes:[{hero_id:7,status:1}],marchLocalBusyHeroIds:new Set(),cityStateFetch:{clear(){}},renderHud(){},
 marchArrivalPoll:{trackMarch(){}},refreshMinimapMarches:async()=>{},refreshState:async()=>{}});
military.addEventListener('click',e=>scene.onMilitaryClick(e));
const peer=document.createElement('div');peer.className='content-panel hidden';peer.textContent='Other panel';mount.append(peer);
for(const [id,label,fn] of [['military','军事',()=>openCenterPanel(military)],['intel','军情',()=>openCenterPanel(panel.getRoot())],
 ['close','关闭',()=>toggleCenterPanel(panel.getRoot())],['peer','其他面板',()=>openCenterPanel(peer)]]){
 const b=document.createElement('button');b.id='qa-'+id;b.textContent=label;b.onclick=fn;
 b.style.cssText='position:fixed;top:2px;left:'+({military:4,intel:90,close:176,peer:262}[id])+'px;z-index:9999';document.body.append(b);}
const now=Date.now(), old={march_id:8,to_x:90,to_y:91,phase:4,return_finish_at_ms:now+120000},
 fresh={march_id:9,to_x:10,to_y:20,phase:2,depart_at_ms:now,arrive_at_ms:now+60000};
async function reply(route,value,code=0){const req=queue.shift();if(req?.route!==route)throw Error('FIFO mismatch '+req?.route+' expected '+route);
 delivered.push(route);const type=root.lookupType('sanguo.military.v1.'+(route.endsWith('StartMarch')?'StartMarchResponse':'ListMarchesResponse'));
 const data=type.encode(type.fromObject(value)).finish(),bytes=sp.encode(sp.fromObject({trace_id:req.trace_id,code,data,msg:'fixture read failure'})).finish();
 ws.dispatchEvent(new MessageEvent('message',{data:Uint8Array.from(bytes).buffer}));for(let i=0;i<80;i++)await Promise.resolve();}
const list=(rows=[old,fresh],total=rows.length,code=0)=>reply('military.v1.ListMarches',{marches:rows,total},code);
const start=()=>reply('military.v1.StartMarch',{march:fresh,city_troops:[{unit_cfg_id:1,count:10}]});
window.qa={panel,scene,gateway,session,queue,sent,delivered,requests,old,fresh,list,start,openCenterPanel};
panel.toggle();await list([old]);`;
// Read-only geometry: Playwright isVisible() does not detect overflow clipping.
const revealGeometry = row => {
  const rect = r => ({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
  const bounds = rect(row.getBoundingClientRect()), viewport = {left:0,top:0,right:innerWidth,bottom:innerHeight};
  const visible = {left:Math.max(bounds.left,0),top:Math.max(bounds.top,0),
    right:Math.min(bounds.right,innerWidth),bottom:Math.min(bounds.bottom,innerHeight)};
  const ancestors = [];
  for(let el=row.parentElement;el;el=el.parentElement) {
    const style=getComputedStyle(el), box=rect(el.getBoundingClientRect());
    // client* is unscaled; bounding rectangles include layout-frame transforms.
    const sx=el.offsetWidth ? box.width/el.offsetWidth : 1, sy=el.offsetHeight ? box.height/el.offsetHeight : 1;
    const clip={left:box.left+el.clientLeft*sx,top:box.top+el.clientTop*sy,
      right:box.left+(el.clientLeft+el.clientWidth)*sx,bottom:box.top+(el.clientTop+el.clientHeight)*sy};
    const paint=/(paint|strict|content)/.test(style.contain);
    const clipX=paint||/^(hidden|clip|auto|scroll|overlay)$/.test(style.overflowX);
    const clipY=paint||/^(hidden|clip|auto|scroll|overlay)$/.test(style.overflowY);
    if(clipX){visible.left=Math.max(visible.left,clip.left);visible.right=Math.min(visible.right,clip.right);}
    if(clipY){visible.top=Math.max(visible.top,clip.top);visible.bottom=Math.min(visible.bottom,clip.bottom);}
    ancestors.push({tag:el.tagName,id:el.id,role:el.getAttribute('data-role'),className:el.className,box,clip,
      clipX,clipY,overflowX:style.overflowX,overflowY:style.overflowY,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft,
      scrollHeight:el.scrollHeight,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,clientWidth:el.clientWidth});
  }
  const width=Math.max(0,visible.right-visible.left),height=Math.max(0,visible.bottom-visible.top);
  const areaRatio=bounds.width*bounds.height>0 ? width*height/(bounds.width*bounds.height) : 0;
  // Require readable row content, not a 1px sliver or only its separate info card.
  const meaningful=bounds.width>0&&bounds.height>0&&width>=bounds.width*0.9&&
    height>=Math.min(bounds.height,32)&&areaRatio>=0.5;
  return {bounds,viewport,visible:{...visible,width,height},areaRatio,meaningful,ancestors};
};
const staleModes = ['return', 'manual', 'world'];
const modes = baseline ? staleModes : [...staleModes, 'compatible', 'missing', 'failure', 'filter', 'selection', 'close', 'back', 'peer', 'city', 'session', 'mount', 'no-presentation'];
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(url)).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Vite startup'); browser = await chromium.launch({ chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) for (const mode of modes) {
    const page = await browser.newPage({ viewport: { width, height } });page.setDefaultTimeout(10000);
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.route('**/src/main.ts', r => r.fulfill({contentType:'application/javascript',body:entry}));
    await page.goto(url);await page.waitForFunction(()=>window.qa?.delivered.length===1);await page.locator('[data-action="refresh-marches"]').waitFor();
    const phase = p => page.locator('[data-action="march-phase-filter-chip"][data-phase="'+p+'"]');
    const row = id => page.locator('li[data-march-id="'+id+'"]');
    const state = () => page.evaluate(() => ({filter:JSON.parse(sessionStorage.getItem('military-list-filter-v1')),
      dest:qa.panel.getDestFilter(),mode:qa.panel.getDestFilterMode()}));
    await page.locator('[data-action="march-eta-sort"]').selectOption('eta_desc');
    await phase(mode === 'compatible' ? 'outbound' : ['manual','world'].includes(mode) ? 'all' : 'return').click();
    if (mode === 'manual' || mode === 'compatible') {
      await page.locator('input[name="march-dest-filter"][value="manual"]').check();
      await page.locator('[data-field="filter-to-x"]').fill(mode === 'compatible' ? '10' : '90');
      await page.locator('[data-field="filter-to-y"]').fill(mode === 'compatible' ? '20' : '91');
      await page.locator('[data-action="apply-march-dest-filter"]').click();
    }
    if (mode === 'world') await page.locator('input[name="march-dest-filter"][value="world"]').check();
    const before = await state();
    await page.locator('#qa-military').click();
    await page.locator('[data-field="to-x"]').fill('10');await page.locator('[data-field="to-y"]').fill('20');
    await page.locator('[data-field="march-count"]').fill('30');await page.locator('[data-field="march-hero"]').selectOption('7');
    await page.locator('[data-action="march"]').click();
    assert.deepEqual(await page.evaluate(() => qa.queue.map(r=>r.route)), ['military.v1.StartMarch']);
    assert.deepEqual(await page.evaluate(() => qa.requests[1]), {city_id:1,to_x:10,to_y:20,purpose:1,troops:[{unit_cfg_id:1,count:30}],hero_id:7});
    if (mode === 'no-presentation') await page.locator('#qa-peer').click();
    await page.evaluate(() => qa.start());
    assert.deepEqual(await page.evaluate(() => qa.queue.map(r=>r.route)), ['military.v1.ListMarches']);
    assert.equal(await row(9).count(), 0, 'StartMarch result must not fabricate a list row');
    await page.screenshot({path:`${out}/${width}-${mode}-pending.png`});
    if (mode === 'filter') await phase('stationed').click();
    if (mode === 'close' || mode === 'back') await page.locator('#qa-close').click();
    if (mode === 'back') await page.locator('#qa-intel').click();
    if (mode === 'peer') await page.locator('#qa-peer').click();
    if (mode === 'city') await page.evaluate(() => {qa.session.cityId=2;});
    if (mode === 'session') await page.evaluate(() => {qa.gateway.sessionGeneration++;});
    if (mode === 'mount') await page.evaluate(() => {qa.panel.detach();qa.panel.attach();});
    const owned = await state();
    if (mode === 'missing' || mode === 'selection') {
      await page.evaluate(() => qa.list([qa.old]));
      assert.equal(await row(9).count(),0);assert.deepEqual(await state(),before);
      if (mode === 'selection') await row(8).click();
      await page.locator('[data-action="refresh-marches"]').click();
    }
    if (mode === 'failure') {
      await page.evaluate(() => qa.list([],0,10002));
      assert.equal(await row(9).count(),0);assert.deepEqual(await state(),before);
      assert.match(await page.locator('[data-role="march-list-status"]').innerText(),/失败/);
      await page.locator('[data-action="refresh-marches"]').click();
    }
    // Partial first page must not authorize reveal; target appears only on complete page two.
    const invalidated = ['city','session','mount'].includes(mode);
    await page.evaluate(() => qa.list([qa.old],21));
    assert.equal(await row(9).count(),0);
    if (!invalidated) {
      assert.deepEqual(await page.evaluate(() => qa.queue.map(r=>r.route)),['military.v1.ListMarches']);
      assert.deepEqual(await page.evaluate(() => qa.requests.at(-1)),{city_id:1,limit:100,offset:20});
      assert.deepEqual(await state(),owned);
      await page.evaluate(() => qa.list([qa.fresh,{...qa.fresh,march_id:10,arrive_at_ms:qa.fresh.arrive_at_ms+60000}],21));
    }
    if(invalidated) assert.equal(await page.evaluate(()=>qa.panel.getMarches().some(m=>m.march_id===9)),false);
    const cancelled=['filter','selection','close','back','peer','city','session','mount','no-presentation'].includes(mode);
    if (baseline) {
      assert.equal(await row(9).count(),0,'baseline witness must reproduce hidden new row');assert.deepEqual(await state(),before);
      assert.ok(await page.evaluate(() => qa.panel.getMarches().some(m=>m.march_id===9)));
    } else if (cancelled) {
      assert.deepEqual(await state(),owned,'newer ownership must retain filters');assert.equal(await row(9).count(),0);
      if (mode==='selection') assert.equal(await page.evaluate(()=>qa.panel.getSelectedMarchId()),8);
      if (['close','peer','mount','no-presentation'].includes(mode)) assert.equal(await page.evaluate(()=>qa.panel.isOpen()),false);
    } else {
      assert.equal(await row(9).isVisible(),true);assert.equal(await page.evaluate(()=>qa.panel.getSelectedMarchId()),9);
      const geometry=await row(9).evaluate(revealGeometry);
      report.geometry.push({width,height,mode,...geometry});
      await page.screenshot({path:`${out}/${width}-${mode}-settled.png`});
      assert.equal(geometry.meaningful,true,'selected row must meaningfully intersect viewport and every clipping ancestor');
      assert.match(await row(9).getAttribute('class'),/march-row-selected/);assert.match(await row(9).getAttribute('class'),/march-row-recent/);
      const after=await state();assert.equal(after.filter.etaSort,'eta_desc');
      if(mode==='compatible') assert.deepEqual(after,before);else assert.equal(after.filter.phase,'all');
      const ids=await page.locator('li[data-march-id]').evaluateAll(rows=>rows.map(r=>Number(r.dataset.marchId)));
      assert.ok(ids.indexOf(10)<ids.indexOf(9),'ETA descending must order the authoritative rows');
      if(mode==='manual'||mode==='world') assert.deepEqual(after.dest,{x:10,y:20});
    }
    const routes=await page.evaluate(()=>({sent:qa.sent,delivered:qa.delivered,requests:qa.requests}));
    assert.equal(routes.sent.filter(r=>r==='military.v1.StartMarch').length,1);assert.deepEqual(routes.sent,routes.delivered);
    assert.equal(await page.evaluate(()=>qa.queue.length),0);assert.deepEqual(report.errors,[]);
    await page.screenshot({path:`${out}/${width}-${mode}-settled.png`});
    await page.evaluate(()=>{qa.panel.detach();qa.gateway.close();});await page.close();
    report.cases.push({width,height,mode,passed:true,...routes,cleanup:true});
  }
  assert.equal(report.cases.length,modes.length*2);assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e) {report.failure=String(e.stack||e);process.exitCode=1;}
finally {
  await browser?.close();
  if(vite.exitCode===null){const exit=new Promise(r=>vite.once('exit',r));vite.kill('SIGTERM');await exit;}
  report.cleanup={browserClosed:!browser?.isConnected(),viteExit:vite.exitCode,viteSignal:vite.signalCode};
  writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
