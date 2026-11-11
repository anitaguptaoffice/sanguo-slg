import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, openSync, unlinkSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/daily-reward-host';
const url = 'http://127.0.0.1:16498', gateway = 'http://127.0.0.1:19098';
mkdirSync(out, { recursive: true });
const report = { tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: client }).toString().trim(), boundary: 'Actual main.ts/MainCityScene/production assets; localhost mock only, not native backend acceptance', cases: [], errors: [] };
assert.equal(report.tree, 'cb864f97e7483a5407f810c9ff7d09e9c5275767');
const fixture = resolve(client, 'mock-server/daily-reward.fixture.mjs');
let source = readFileSync(resolve(client, 'mock-server/server.mjs'), 'utf8');
const quests = Object.fromEntries([[1014,'daily_train_1'],[1032,'daily_build_1'],[1033,'daily_march_1']].map(([id,code],i) => [id,{quest_cfg_id:id,quest_code:code,chain_id:400,state:i?2:1,progress_current:0,progress_target:1}]));
assert.equal(source.split('quests: {},').length, 2);
source = source.replace('quests: {},', `quests: ${JSON.stringify(quests)},`);
assert.equal(source.split('const route = cp.route;').length, 2);
source = source.replace('const route = cp.route;', 'const route = cp.route; console.log("QA_ROUTE", route);');
assert.equal(source.split('server.listen(PORT, () => {').length, 2);
source = source.replace('server.listen(PORT, () => {', "server.listen(PORT, '127.0.0.1', () => {");
writeFileSync(fixture, source);
const launch = (file,args,name,env={}) => spawn(process.execPath,[file,...args],{cwd:client,env:{...process.env,...env},stdio:['ignore',openSync(`${out}/${name}.log`,'w'),openSync(`${out}/${name}-error.log`,'w')]});
const mock = launch(fixture, [], 'mock', { MOCK_GATEWAY_PORT:'19098' });
const vite = launch('node_modules/vite/bin/vite.js',['--host','127.0.0.1','--port','16498','--strictPort'],'vite',{VITE_GATEWAY_WS_URL:'ws://127.0.0.1:19098/ws'});
let browser, lastPage;
async function ready(address) { for(let i=0;i<200;i++){try{if((await fetch(address)).ok)return;}catch{} await new Promise(r=>setTimeout(r,100));}throw new Error('service not ready '+address); }
async function stop(child) { if(child.exitCode!==null||child.signalCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done; }
async function enter(page) {
  page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('websocket',s=>{const u=new URL(s.url());if(s.url()!=='ws://127.0.0.1:19098/ws'&&!(u.origin==='ws://127.0.0.1:16498'&&u.pathname==='/'))report.errors.push('unexpected websocket '+u.origin);});
  await page.goto(url);await page.locator('li[data-server-id="1"]:not(.disabled)').click();await page.locator('[data-action="enter-game"]').click();
  await page.locator('[data-action="toggle-daily"]').click();
  await page.locator('[data-daily-chain-id="400"]').click();
  await page.locator('[data-quest-cfg-id="1014"] .daily-quest-row-main').click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="accept-daily"]')?.disabled);
}
async function loaded(page) { await page.waitForFunction(()=>document.querySelectorAll('.daily-reward-item-icon').length===3&&[...document.querySelectorAll('.daily-reward-item-icon')].every(x=>x.complete&&x.naturalWidth>0)); }
async function refresh(page, keyboard=false) {
  const button=page.locator('[data-action="refresh-daily"]');
  if(keyboard){await button.focus();await page.keyboard.press('Enter');}else await button.click();
  await page.waitForFunction(()=>!document.querySelector('[data-action="accept-daily"]')?.disabled);await loaded(page);
}
try {
  await ready(url);await ready(gateway);browser=await chromium.launch({chromiumSandbox:true});
  for(const [width,height,dpr] of [[1280,720,1],[1280,720,1.5],[1280,720,2],[1600,900,1],[1600,900,1.5],[1600,900,2]]) {
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
    const page=await ctx.newPage();lastPage=page;await enter(page);await loaded(page);
    const evidence=[];
    for(const [quest,item] of [[1014,2003],[1032,2011],[1033,2042]]) {
      const row=page.locator(`[data-quest-cfg-id="${quest}"]`), icon=row.locator('.daily-reward-item-icon');
      await icon.scrollIntoViewIfNeeded();
      const e=await icon.evaluate(x=>{
        const r=x.getBoundingClientRect(),clips=[];let inside=true;
        for(let a=x.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),clipX=/(auto|scroll|hidden|clip)/.test(s.overflowX),clipY=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(clipX||clipY){const left=b.left+a.clientLeft,top=b.top+a.clientTop,right=left+a.clientWidth,bottom=top+a.clientHeight;clips.push({role:a.getAttribute('data-role'),className:a.className,left,top,right,bottom,clipX,clipY});inside&&=(!clipX||(r.left>=left&&r.right<=right))&&(!clipY||(r.top>=top&&r.bottom<=bottom));}}
        const reward=x.parentElement.getBoundingClientRect(),bar=x.closest('.art-filter-row-skin-bar')?.getBoundingClientRect();
        return {reward:{x:reward.x,y:reward.y,width:reward.width,height:reward.height},skinBar:bar?{x:bar.x,y:bar.y,width:bar.width,height:bar.height}:null,src:x.getAttribute('src'),width:r.width,height:r.height,x:r.x,y:r.y,inside,clips,text:x.parentElement.textContent,alt:x.alt,aria:x.getAttribute('aria-hidden'),tabIndex:x.tabIndex};
      });
      report.currentItem={width,height,dpr,quest,item,...e};
      assert.ok(e.inside&&e.clips.length&&e.width===20&&e.height===20&&e.x>=0&&e.y>=0&&e.x+20<=width&&e.y+20<=height);
      assert.ok(e.src.includes(`/textures/${dpr>=1.5?2:1}x/items/${item}.png`));assert.ok(e.text.includes('奖励'));
      assert.equal(e.alt,'');assert.equal(e.aria,'true');assert.equal(e.tabIndex,-1);evidence.push({quest,item,...e});
    }
    await page.locator('[data-quest-cfg-id="1014"] .daily-quest-row-main').click();
    await page.screenshot({path:`${out}/${width}-dpr${dpr}-on.png`});
    await page.locator('[data-quest-cfg-id="1032"] .daily-quest-row-main').click();
    assert.ok((await page.locator('[data-role="daily-detail"]').innerText()).includes('1032'));
    await page.locator('[data-action="daily-filter"][data-filter="in_progress"]').click();assert.equal(await page.locator('.daily-reward-item-icon').count(),2);
    await page.screenshot({path:`${out}/${width}-dpr${dpr}-filtered.png`});
    await page.locator('[data-action="daily-filter"][data-filter="all"]').click();await page.locator('[data-quest-cfg-id="1014"] .daily-quest-row-main').click();
    await refresh(page,true);
    await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');
    assert.equal(await page.locator('.daily-reward-item-icon').first().isVisible(),false);
    await refresh(page);assert.equal(await page.locator('.daily-reward-item-icon').first().isVisible(),false);
    await page.screenshot({path:`${out}/${width}-dpr${dpr}-off.png`});
    await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');assert.equal(await page.locator('.daily-reward-item-icon').first().isVisible(),true);
    const open=page.locator('[data-action="toggle-daily"]');await open.click();assert.equal(await page.locator('.daily-reward-item-icon').first().isVisible(),false);await open.click();await loaded(page);
    for(let i=0;i<3;i++)await refresh(page);assert.equal(await page.locator('.daily-reward-item-icon').count(),3);
    await page.screenshot({path:`${out}/${width}-dpr${dpr}-restored.png`});report.cases.push({width,height,dpr,evidence});await ctx.close();
  }
  for(const mode of ['missing-image','missing-entry','dom-image-error']) {
    const ctx=await browser.newContext({viewport:{width:1280,height:720}});
    await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!==url)return r.abort();
      if(mode==='missing-image'&&/textures\/1x\/items\/2003.png$/.test(u.pathname))return r.abort();
      if(mode==='missing-entry'&&u.pathname.endsWith('/manifest.json')){const response=await r.fetch(),data=await response.json();data.assets=data.assets.filter(a=>a.id!=='item.icon.2003.v1');return r.fulfill({response,json:data});}return r.continue();});
    const page=await ctx.newPage();lastPage=page;await enter(page);const row=page.locator('[data-quest-cfg-id="1014"]');
    if(mode==='dom-image-error'){await loaded(page);await row.locator('img.daily-reward-item-icon').evaluate(x=>x.src='/missing-daily-qa.png');await page.waitForFunction(()=>!document.querySelector('[data-quest-cfg-id="1014"] .daily-reward-item-icon'));}
    assert.equal(await row.locator('.daily-reward-item-icon').count(),0);assert.ok((await row.innerText()).includes('奖励'));await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/1280-${mode}.png`});report.cases.push({mode,text:await row.innerText()});await ctx.close();
  }
  const routes=readFileSync(`${out}/mock.log`,'utf8').split('\n').filter(x=>x.startsWith('QA_ROUTE '));
  report.mutations=routes.filter(x=>/quest.v1.(Claim|Accept|Report)/.test(x));assert.deepEqual(report.mutations,[]);
  assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e) { report.failure=String(e);if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;
} finally { await browser?.close();await stop(vite);await stop(mock);unlinkSync(fixture);
  report.cleanup={browserClosed:!browser?.isConnected(),viteStopped:vite.exitCode!==null||vite.signalCode!==null,mockStopped:mock.exitCode!==null||mock.signalCode!==null};
  writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
