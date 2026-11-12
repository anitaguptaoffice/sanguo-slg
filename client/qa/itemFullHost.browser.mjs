import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,openSync,unlinkSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const client=resolve(import.meta.dirname,'..'),out=process.env.QA_OUT??'/tmp/item-full-host';
const url='http://127.0.0.1:16498',gateway='http://127.0.0.1:19098';
mkdirSync(out,{recursive:true});
const report={tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:client}).toString().trim(),boundary:'Real main.ts, MainCityScene, Canvas, skin, AssetLoader and production files; local mock gateway only, NOT native backend/gameplay acceptance',cases:[],errors:[]};
assert.equal(report.tree,'c01987a3ca9f8bcd8c89e6323ab18037a4ea0ec7');
const fixture=resolve(client,'mock-server/item-qa.fixture.mjs');
let source=readFileSync(resolve(client,'mock-server/server.mjs'),'utf8');
assert.equal(source.split('bag: { 2004: 2 },').length,2);
source=source.replace('bag: { 2004: 2 },','bag: Object.fromEntries(Array.from({length:49},(_,i)=>[2001+i,i+1]).concat([[9999,1]])),');
assert.equal(source.split('server.listen(PORT, () => {').length,2);
source=source.replace('server.listen(PORT, () => {',"server.listen(PORT, '127.0.0.1', () => {");
writeFileSync(fixture,source);
const launch=(file,args,name,env={})=>spawn(process.execPath,[file,...args],{cwd:client,env:{...process.env,...env},stdio:['ignore',openSync(`${out}/${name}.log`,'w'),openSync(`${out}/${name}-error.log`,'w')]});
const mock=launch(fixture,[],'mock',{MOCK_GATEWAY_PORT:'19098'});
const vite=launch('node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port','16498','--strictPort'],'vite',{VITE_GATEWAY_WS_URL:'ws://127.0.0.1:19098/ws'});
let browser,lastPage;
async function ready(address){for(let i=0;i<200;i++){try{if((await fetch(address)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('service not ready '+address);}
async function stop(child){if(child.exitCode!==null||child.signalCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}
try {
 await ready(url);await ready(gateway);browser=await chromium.launch({chromiumSandbox:true});
 for(const [width,height,dpr] of [[1280,720,1],[1280,720,1.5],[1280,720,2],[1600,900,1],[1600,900,1.5],[1600,900,2]]){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
  const page=await ctx.newPage();lastPage=page;page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('websocket',s=>{const u=new URL(s.url());if(s.url()!=='ws://127.0.0.1:19098/ws'&&!(u.origin==='ws://127.0.0.1:16498'&&u.pathname==='/'))report.errors.push('unexpected websocket origin '+u.origin);});
  await page.goto(url);await page.locator('li[data-server-id="1"]:not(.disabled)').click();
  await page.locator('[data-action="enter-game"]').click();
  const open=page.locator('[data-action="toggle-bag"]');await open.waitFor();await open.click();
  const row=page.locator('[data-item-cfg-id="2001"]'),icon=row.locator('.bag-item-icon');
  await icon.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.bag-item-icon')].every(x=>x.complete&&x.naturalWidth>0));
  assert.ok(await page.locator('canvas').count()>0);
  assert.equal(await page.locator('.bag-item-icon').count(),49);
  assert.equal(await page.locator('[data-item-cfg-id="9999"] .bag-item-icon').count(),0);
  assert.ok(await page.locator('[data-item-cfg-id="9999"] .bag-stack-name').innerText());
  assert.equal(await icon.getAttribute('aria-hidden'),'true');
  assert.ok((await icon.getAttribute('src')).includes(`/textures/${dpr>=1.5?2:1}x/items/2001.png`));
  assert.equal(await icon.evaluate(x=>parseFloat(getComputedStyle(x).width)),20);
  const visibleItems=[];
  for(let id=2001;id<=2049;id++){
   const candidate=page.locator(`[data-item-cfg-id="${id}"] .bag-item-icon`);await candidate.scrollIntoViewIfNeeded();
   const evidence=await candidate.evaluate(x=>{
    const r=x.getBoundingClientRect(),clips=[];let insideList=true;
    for(let a=x.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),clipX=/(auto|scroll|hidden|clip)/.test(s.overflowX),clipY=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(clipX||clipY){const left=b.left+a.clientLeft,top=b.top+a.clientTop,right=left+a.clientWidth,bottom=top+a.clientHeight;clips.push({role:a.getAttribute('data-role'),className:a.className,left,top,right,bottom,clipX,clipY});insideList&&=(!clipX||(r.left>=left&&r.right<=right))&&(!clipY||(r.top>=top&&r.bottom<=bottom));}}
    return {src:x.getAttribute('src'),x:r.x,y:r.y,width:r.width,height:r.height,insideList,clips,text:x.closest('[data-item-cfg-id]').querySelector('.bag-stack-name').textContent};
   });
   assert.ok(evidence.clips.length>0,'missing actual clipping ancestor');
   assert.ok(evidence.insideList&&evidence.width===20&&evidence.height===20&&evidence.x>=0&&evidence.y>=0&&evidence.x+20<=width&&evidence.y+20<=height,`item ${id} clipped`);
   assert.ok(evidence.text&&evidence.src.includes(`/textures/${dpr>=1.5?2:1}x/items/${id}.png`));visibleItems.push({id,...evidence});
  }
  await icon.scrollIntoViewIfNeeded();const bounds=await icon.boundingBox();
  assert.ok(bounds&&bounds.width>0&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height,'icon clipped');
  assert.ok(await row.locator('.bag-stack-name').innerText());
  await page.screenshot({path:`${out}/${width}-dpr${dpr}-on.png`});
  await page.locator('[data-bag-category="cultivation"]').click();
  await page.screenshot({path:`${out}/${width}-dpr${dpr}-cultivation.png`});
  await page.locator('[data-bag-category="consumable"]').click();
  const refresh=page.locator('[data-action="refresh-bag"]');await refresh.focus();await page.keyboard.press('Enter');await icon.waitFor();
  const select=page.locator('[data-field="item-id"]');await select.selectOption('2001');await select.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');assert.notEqual(await select.inputValue(),'2001');
  await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');assert.equal(await icon.isVisible(),false);
  await page.screenshot({path:`${out}/${width}-dpr${dpr}-off.png`});
  await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');assert.equal(await icon.isVisible(),true);
  await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');await refresh.click();await page.waitForFunction(()=>document.querySelectorAll('.bag-item-icon').length===0);
  await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');await refresh.click();await icon.waitFor();
  await open.click();assert.equal(await icon.isVisible(),false);await open.click();await icon.waitFor();
  for(let i=0;i<3;i++){await refresh.click();await icon.waitFor();}
  assert.equal(await row.locator('.bag-item-icon').count(),1,'duplicate icons');
  await page.screenshot({path:`${out}/${width}-dpr${dpr}-restored.png`});
  report.cases.push({width,height,dpr,bounds,visibleItems,checks:['real host visible','production PNG','keyboard and mouse','skin off/on','off redraw recovery','close/reopen','repeated refresh']});
  await ctx.close();
 }
 for(const mode of ['missing-image','missing-entry','dom-image-error']) {
  const ctx=await browser.newContext({viewport:{width:1280,height:720}});
  await ctx.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!==url)return r.abort();
   if(mode==='missing-image'&&/textures\/1x\/items\/2001.png$/.test(u.pathname))return r.abort();
   if(mode==='missing-entry'&&u.pathname.endsWith('/manifest.json')){const response=await r.fetch();const data=await response.json();data.assets=data.assets.filter(a=>a.id!=='item.icon.2001.v1');return r.fulfill({response,json:data});}
   return r.continue();
  });
  const page=await ctx.newPage();lastPage=page;page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(url);await page.locator('li[data-server-id="1"]:not(.disabled)').click();await page.locator('[data-action="enter-game"]').click();
  await page.locator('[data-action="toggle-bag"]').click();const row=page.locator('[data-item-cfg-id="2001"]');await row.waitFor();
  if(mode==='dom-image-error'){const icon=row.locator('.bag-item-icon');await icon.waitFor();await icon.evaluate(x=>x.src='/deliberately-missing-qa-icon.png');await page.waitForFunction(()=>!document.querySelector('[data-item-cfg-id="2001"] .bag-item-icon'));}
  assert.equal(await row.locator('.bag-item-icon').count(),0);assert.ok(await row.locator('.bag-stack-name').innerText());
  await row.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/1280-${mode}.png`});report.cases.push({mode,checks:['actual error/missing source fallback preserves text','no startup failure']});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.failure=String(e);if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;} finally {
 await browser?.close();await stop(vite);await stop(mock);unlinkSync(fixture);
 report.cleanup={browserClosed:!browser?.isConnected(),viteStopped:vite.exitCode!==null||vite.signalCode!==null,mockStopped:mock.exitCode!==null||mock.signalCode!==null};
 writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
