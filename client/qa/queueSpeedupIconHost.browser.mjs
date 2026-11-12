import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, openSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/queue-speedup-host';
const target = '93618e18902ca2e54375069808281044b51b0889';
const tree = '7a1555da00470a54ec5f6c5dda9e4818e9a715eb';
const url = 'http://127.0.0.1:16497', gateway = 'http://127.0.0.1:19097';
const button = 'button[data-action="speedup-build"][data-queue-speedup-item="2003"]';
const icon = `${button} > img.queue-speedup-item-icon`;
const modeFile = resolve(client, 'mock-server/queue-art-mode.json');
const fixture = resolve(client, 'mock-server/queue-art.fixture.mjs');
mkdirSync(out, { recursive: true });
const git = arg => execFileSync('git', ['rev-parse', arg], { cwd: client }).toString().trim();
const report = { head: git('HEAD'), tree: git('HEAD^{tree}'), harnessSHA256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'), boundary: 'Actual main.ts/MainCityScene/QueuePanels/AssetLoader, localhost fixture only, no native economy or deployment acceptance', cases: [], captures: [], errors: [] };
assert.equal(report.head, target);assert.equal(report.tree, tree);
let source = readFileSync(resolve(client, 'mock-server/server.mjs'), 'utf8');
function replaceOnce(before, after) { assert.equal(source.split(before).length, 2, before);source = source.replace(before, after); }
replaceOnce('const route = cp.route;', 'const route = cp.route; console.log("QA_ROUTE", route);');
replaceOnce('const state = sessionState();', `const state = sessionState(); if (JSON.parse(fs.readFileSync(${JSON.stringify(modeFile)}, 'utf8')).disabled) delete state.bag[2003];`);
replaceOnce('server.listen(PORT, () => {', "server.listen(PORT, '127.0.0.1', () => {");
writeFileSync(modeFile, JSON.stringify({ disabled: false }));writeFileSync(fixture, source);
const launch = (file,args,name,env={}) => spawn(process.execPath,[file,...args],{cwd:client,env:{...process.env,...env},stdio:['ignore',openSync(`${out}/${name}.log`,'w'),openSync(`${out}/${name}-error.log`,'w')]});
const mock = launch(fixture, [], 'mock', { MOCK_GATEWAY_PORT:'19097', MOCK_EVIDENCE_PRESET:'queue-build' });
const vite = launch('node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port','16497','--strictPort'],'vite',{VITE_GATEWAY_WS_URL:'ws://127.0.0.1:19097/ws'});
let browser, lastPage;
const pause = ms => new Promise(r=>setTimeout(r,ms));
const routes = () => readFileSync(`${out}/mock.log`,'utf8').split('\n').filter(x=>x.startsWith('QA_ROUTE ')).map(x=>x.slice(9));
// Fail closed: every route after completed ordinary bootstrap must be an identified read.
const reads = new Set(['domestic.v1.GetCityState','world.v1.ListPlayerCities','world.v1.GetWorldMap','world.v1.GetMapChunk','military.v1.ListMarches','military.v1.ListBattleReports','quest.v1.ListPlayerQuests','content.v1.ListPlayerBag','hero.v1.ListPlayerHeroes','chat.v1.ListChatMessages','guild.v1.ListGuildMembers','rank.v1.GetLeaderboard','content.v1.ListPlayerMail']);
async function ready(address) { for(let i=0;i<200;i++){try{if((await fetch(address)).ok)return;}catch{} await pause(100);}throw new Error('service not ready '+address); }
async function stop(child) {
  if(child.exitCode!==null||child.signalCode!==null)return;
  child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null&&child.signalCode===null;i++)await pause(100);
  if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');for(let i=0;i<50&&child.exitCode===null&&child.signalCode===null;i++)await pause(100);}
}
async function enter(page, disabled) {
  page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('websocket',s=>{const u=new URL(s.url());if(s.url()!=='ws://127.0.0.1:19097/ws'&&!(u.origin==='ws://127.0.0.1:16497'&&u.pathname==='/'))report.errors.push('unexpected websocket '+u.origin);});
  const start=routes().length;
  await page.goto(url);await page.locator('li[data-server-id="1"]:not(.disabled)').click();await page.locator('[data-action="enter-game"]').click();
  await page.locator('[data-action="toggle-queue"]').waitFor({state:'visible'});
  // Ordinary login ends at the main toolbar. Bag navigation below is a read, not a fixture mutation.
  const boundary=routes().length;
  await page.locator('[data-action="toggle-bag"]').click();
  await page.locator('[data-role="bag-list"] [data-item-cfg-id="2004"]').waitFor({state:'visible'});
  assert.ok(routes().slice(boundary).includes('content.v1.ListPlayerBag'));
  assert.equal(await page.locator('[data-role="bag-list"] [data-item-cfg-id="2003"]').count(),disabled?0:1);
  await page.locator('[data-action="toggle-queue"]').click();
  await page.waitForFunction(({button,disabled})=>document.querySelectorAll(button).length===2&&[...document.querySelectorAll(button)].every(b=>b.disabled===disabled),{button,disabled});
  return {start,boundary,bootstrap:routes().slice(start,boundary)};
}
async function loaded(page) { await page.waitForFunction(icon=>document.querySelectorAll(icon).length===2&&[...document.querySelectorAll(icon)].every(x=>x.complete&&x.naturalWidth>0),icon); }
async function refresh(page, keyboard=false) {
  const count=()=>routes().filter(x=>x==='domestic.v1.GetCityState').length,before=count();
  await page.evaluate(button=>window.__qaOldQueueButton=document.querySelector(button),button);
  const control=page.locator('[data-action="refresh-queue"]');
  if(keyboard){await control.focus();await page.keyboard.press('Enter');}else await control.click();
  for(let i=0;i<200&&count()<=before;i++)await pause(100);assert.ok(count()>before,'real queue refresh read');
  await page.waitForFunction(button=>!window.__qaOldQueueButton?.isConnected&&document.querySelectorAll(button).length===2,button);
}
async function inspect(page, phase, disabled, dpr, expectedImages=true, skin=true) {
  const results=[];
  assert.equal(await page.locator(button).count(),2);assert.equal(await page.locator(icon).count(),expectedImages?2:0);
  for(let i=0;i<2;i++) {
    // QueuePanels replaces rows every second. Select, instant-scroll and measure one live node
    // synchronously so the application tick cannot detach a Playwright action's retained handle.
    const e=await page.evaluate(({button,i})=>{
      const hosts=document.querySelectorAll(button),el=hosts[i];
      if(hosts.length!==2||!el?.isConnected)throw new Error('queue host membership changed');
      el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});
      if(document.querySelectorAll(button)[i]!==el||!el.isConnected)throw new Error('queue host detached during observation');
      const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
      const bounds=[{kind:'button',...rect(el.getBoundingClientRect())}],clips=[];
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const n=walker.currentNode;if(n.textContent.trim()){const range=document.createRange();range.selectNodeContents(n);bounds.push(...[...range.getClientRects()].map(r=>({kind:'text',...rect(r)})));}}
      for(let a=el;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),x=/(auto|scroll|hidden|clip)/.test(s.overflowX),y=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(x||y)clips.push({self:a===el,tag:a.tagName,role:a.dataset.role,className:a.className,x,y,left:b.left+a.clientLeft,top:b.top+a.clientTop,right:b.left+a.clientLeft+a.clientWidth,bottom:b.top+a.clientTop+a.clientHeight});}
      const img=el.querySelector('img.queue-speedup-item-icon'),s=img&&getComputedStyle(img),visible=img&&s.display!=='none';
      if(visible)bounds.push({kind:'image',...rect(img.getBoundingClientRect())});
      return {text:el.textContent,title:el.title,disabled:el.disabled,item:el.dataset.queueSpeedupItem,bounds,clips,img:img?{visible,complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,src:img.getAttribute('src'),alt:img.alt,aria:img.getAttribute('aria-hidden'),tabIndex:img.tabIndex,pointer:s.pointerEvents,fit:s.objectFit,gap:parseFloat(s.marginInlineEnd)}:null,pass:bounds.some(r=>r.kind==='text')&&bounds.every(r=>r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&clips.every(c=>(r.kind==='button'&&c.self)||((!c.x||(r.left>=c.left&&r.right<=c.right))&&(!c.y||(r.top>=c.top&&r.bottom<=c.bottom)))))};
    },{button,i});
    report.lastGeometry={phase,index:i,...e};assert.ok(e.pass,`clipping: ${phase}/${i}`);
    assert.equal(e.text,'使用短促工符');assert.equal(e.title,disabled?'背包中无短促工符（道具 2003）':'');assert.equal(e.disabled,disabled);assert.equal(e.item,'2003');
    if(expectedImages){assert.ok(e.img.complete&&e.img.naturalWidth>0&&e.img.naturalHeight>0,'current image must be loaded');assert.equal(e.img.visible,skin);assert.equal(e.img.alt,'');assert.equal(e.img.aria,'true');assert.equal(e.img.tabIndex,-1);assert.equal(e.img.pointer,'none');assert.equal(e.img.fit,'contain');assert.ok(e.img.gap>=0&&e.img.gap<=4);assert.ok(e.img.src.includes(`/textures/${dpr>=1.5?2:1}x/items/2003.png`));if(skin){const r=e.bounds.find(x=>x.kind==='image');assert.equal(r.width,20);assert.equal(r.height,20);}}
    results.push(e);
  }
  return {phase,results};
}
const captureSessions = new WeakMap();
async function capture(page, path, phase, disabled, dpr, expectedImages=true, skin=true) {
  const evidence={path,phase,times:{start:performance.now()}};report.captures.push(evidence);
  if(!captureSessions.has(page))captureSessions.set(page,await page.context().newCDPSession(page));
  await page.evaluate(({button,icon})=>{
    if(!window.__qaCaptureTracker){
      const ids=new WeakMap();let next=0,previous=[];
      const token=x=>{if(!ids.has(x))ids.set(x,++next);return ids.get(x);};
      const tracker={generation:0,changes:[]};
      const update=()=>{const hosts=[...document.querySelectorAll(button)];if(hosts.length!==previous.length||hosts.some((x,i)=>x!==previous[i])){previous=hosts;tracker.generation++;tracker.changes.push({at:performance.now(),generation:tracker.generation,hosts:hosts.map(token)});}};
      tracker.snapshot=()=>{update();return {at:performance.now(),generation:tracker.generation,hosts:[...document.querySelectorAll(button)].map(x=>({token:token(x),connected:x.isConnected})),images:[...document.querySelectorAll(icon)].map(x=>({token:token(x),connected:x.isConnected,src:x.currentSrc,complete:x.complete,width:x.naturalWidth,height:x.naturalHeight}))};};
      tracker.observer=new MutationObserver(update);tracker.observer.observe(document.body,{childList:true,subtree:true});window.__qaCaptureTracker=tracker;
    }
    window.__qaCaptureBefore=document.querySelector(button);
  },{button,icon});
  evidence.start=await page.evaluate(()=>window.__qaCaptureTracker.snapshot());
  // One natural redraw, no timer freeze or retry if capture is invalidated.
  await page.waitForFunction(button=>window.__qaCaptureBefore&&!window.__qaCaptureBefore.isConnected&&document.querySelectorAll(button).length===2,button);
  evidence.times.redraw=performance.now();
  if(phase==='dom-image-error'){await loaded(page);await page.locator(icon).evaluateAll(xs=>xs.forEach(x=>x.src='/missing-queue-qa.png'));await page.waitForFunction(icon=>!document.querySelector(icon),icon);}
  evidence.decoded=await page.evaluate(async ({button,icon,expectedImages})=>{
    const hosts=[...document.querySelectorAll(button)],images=[...document.querySelectorAll(icon)],before=window.__qaCaptureTracker.snapshot();
    window.__qaCaptureNodes={hosts,images};
    if(hosts.length!==2||images.length!==(expectedImages?2:0))throw new Error('capture membership mismatch');
    await Promise.all(images.map(x=>x.decode()));const decodedAt=performance.now();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(hosts.some(x=>!x.isConnected)||images.some(x=>!x.isConnected||!x.complete||!x.naturalWidth||!x.naturalHeight))throw new Error('capture changed during decode/paint');
    return {before,decodedAt,painted:window.__qaCaptureTracker.snapshot()};
  },{button,icon,expectedImages});
  evidence.times.decoded=performance.now();
  const geometry=await inspect(page,phase,disabled,dpr,expectedImages,skin);
  evidence.times.geometry=performance.now();
  evidence.beforeCapture=await page.evaluate(()=>window.__qaCaptureTracker.snapshot());
  const {visualViewport}=await captureSessions.get(page).send('Page.getLayoutMetrics');
  const viewport=page.viewportSize();evidence.metrics=visualViewport;
  assert.ok(Number.isFinite(visualViewport.scale)&&visualViewport.scale>0);
  assert.ok(Number.isFinite(visualViewport.pageX)&&Number.isFinite(visualViewport.pageY));
  // Match locked Playwright device-scale screenshot clip; no DPR division or post-resampling.
  const clip={x:visualViewport.pageX,y:visualViewport.pageY,width:Math.floor(viewport.width/visualViewport.scale+1e-3),height:Math.floor(viewport.height/visualViewport.scale+1e-3),scale:visualViewport.scale};
  evidence.clip=clip;evidence.times.captureStart=performance.now();
  const png=await captureSessions.get(page).send('Page.captureScreenshot',{format:'png',clip,fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});
  evidence.times.captureReturned=performance.now();
  try { evidence.after=await page.evaluate(({button,icon,startGeneration})=>{
    const {hosts,images}=window.__qaCaptureNodes,currentHosts=[...document.querySelectorAll(button)],currentImages=[...document.querySelectorAll(icon)],tracker=window.__qaCaptureTracker;
    return {sameHosts:hosts.length===currentHosts.length&&hosts.every((x,i)=>x===currentHosts[i]&&x.isConnected),sameImages:images.length===currentImages.length&&images.every((x,i)=>x===currentImages[i]&&x.isConnected),ready:currentImages.every(x=>x.complete&&x.naturalWidth>0&&x.naturalHeight>0),current:tracker.snapshot(),changes:tracker.changes.filter(x=>x.generation>startGeneration)};
  },{button,icon,startGeneration:evidence.start.generation}); } catch(e) { evidence.postcheckError=String(e); }
  evidence.times.postcheck=performance.now();
  const bytes=Buffer.from(png.data,'base64');writeFileSync(path,bytes);evidence.times.persisted=performance.now();
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  evidence.png={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length};
  assert.equal(evidence.png.width,page.viewportSize().width*dpr);assert.equal(evidence.png.height,page.viewportSize().height*dpr);
  assert.ok(!evidence.postcheckError&&evidence.after?.sameHosts&&evidence.after?.sameImages&&evidence.after?.ready,'capture crossed a redraw or image readiness changed');
  return geometry;
}
async function context(width,height,dpr,mode) {
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
  await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==url)return r.abort();
    if(mode==='missing-image'&&/textures\/1x\/items\/2003.png$/.test(u.pathname))return r.abort();
    if(mode==='missing-cache'&&u.pathname.endsWith('/manifest.json')){const response=await r.fetch(),data=await response.json();data.assets=data.assets.filter(a=>a.id!=='item.icon.2003.v1');return r.fulfill({response,json:data});}return r.continue();});
  return ctx;
}
try {
  await ready(url);await ready(gateway);browser=await chromium.launch({chromiumSandbox:true});
  for(const [width,height,dpr] of [[1280,720,1],[1280,720,1.5],[1280,720,2],[1600,900,1],[1600,900,1.5],[1600,900,2]])for(const disabled of [false,true]) {
    writeFileSync(modeFile,JSON.stringify({disabled}));const ctx=await context(width,height,dpr);
    const page=await ctx.newPage();lastPage=page;const routeEvidence=await enter(page,disabled);await loaded(page);
    const name=`${width}-dpr${dpr}-${disabled?'disabled':'enabled'}`,geometry=[];report.activeCase={width,height,dpr,disabled,geometry,routeEvidence};
    geometry.push(await capture(page,`${out}/${name}-on.png`,'on',disabled,dpr));
    await refresh(page,true);await loaded(page);
    await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');
    geometry.push(await inspect(page,'off',disabled,dpr,true,false));
    await refresh(page);await loaded(page);geometry.push(await capture(page,`${out}/${name}-off.png`,'off-redraw',disabled,dpr,true,false));
    await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');
    geometry.push(await inspect(page,'on-restored',disabled,dpr));
    await page.locator('[data-action="refresh-queue"]').focus();await page.keyboard.press('Escape');assert.equal(await page.locator(button).first().isVisible(),false);
    await page.locator('[data-action="toggle-queue"]').click();await loaded(page);
    for(let i=0;i<3;i++){await refresh(page,i===1);await loaded(page);}
    geometry.push(await capture(page,`${out}/${name}-restored.png`,'reopened-repeated',disabled,dpr));
    routeEvidence.after=routes().slice(routeEvidence.boundary);routeEvidence.mutations=routeEvidence.after.filter(x=>!reads.has(x));
    report.cases.push({width,height,dpr,disabled,geometry,routeEvidence});assert.deepEqual(routeEvidence.mutations,[]);await ctx.close();
  }
  for(const mode of ['missing-image','missing-cache','dom-image-error']) {
    writeFileSync(modeFile,JSON.stringify({disabled:false}));const ctx=await context(1280,720,1,mode);
    const page=await ctx.newPage();lastPage=page;const routeEvidence=await enter(page,false);
    const geometry=await capture(page,`${out}/1280-${mode}.png`,mode,false,1,false);
    routeEvidence.after=routes().slice(routeEvidence.boundary);routeEvidence.mutations=routeEvidence.after.filter(x=>!reads.has(x));report.cases.push({mode,geometry,routeEvidence});assert.deepEqual(routeEvidence.mutations,[]);await ctx.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e) { report.failure=String(e);if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;
} finally {
  try { await browser?.close(); } catch(e) { report.errors.push(String(e)); }
  await stop(vite);await stop(mock);rmSync(fixture,{force:true});rmSync(modeFile,{force:true});
  report.routes=routes();report.cleanup={browserClosed:!browser?.isConnected(),viteStopped:vite.exitCode!==null||vite.signalCode!==null,mockStopped:mock.exitCode!==null||mock.signalCode!==null};
  if(!Object.values(report.cleanup).every(Boolean)||report.errors.length){report.passed=false;process.exitCode=1;}
  writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
