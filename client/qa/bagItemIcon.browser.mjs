import assert from 'node:assert/strict';

import {mkdirSync,writeFileSync,openSync} from 'node:fs';

import {spawn,execFileSync} from 'node:child_process';

import {resolve} from 'node:path';

import {chromium} from 'playwright';

const client=resolve(import.meta.dirname,'..'),out=resolve(process.env.QA_OUT ?? '/tmp/bag-item-icon-qa'),url='http://127.0.0.1:16497';

const assetRoot=resolve(process.env.QA_ITEM_ROOT ?? '../candidate/docs/art/samples/art-item-icons-001/textures');
mkdirSync(out,{recursive:true});

const baseline=process.env.QA_BASELINE==='true';
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:client}).toString().trim(),baseline,boundary:'One Chromium launch;  localhost isolated component/mock only, candidate PNG route injection, no production connection or asset delivery',cases:[],errors:[]};

const entry=`import {ContentPanels} from '/src/ui/ContentPanels.ts';import {computeLayoutViewport,applyLayoutFrameStyles,syncLayoutViewportRootClass} from '/src/engine/layoutViewport.ts';
const mount=document.getElementById('layout-frame');mount.replaceChildren();const vp=computeLayoutViewport(innerWidth,innerHeight);applyLayoutFrameStyles(mount,vp);syncLayoutViewportRootClass(mount,vp);
const s={serverId:1,cityId:1,cityName:'城',player:{player_id:1},wallet:{food:100},buildings:[],cityTroops:[],bag:Array.from({length:49},(_,i)=>({item_cfg_id:2001+i,quantity:i+1})).concat([{item_cfg_id:9999,quantity:3}])};let reads=0;const gateway={getBoundServerId:()=>1,listPlayerBag:async()=>{reads++;return {items:s.bag}}};const scale=devicePixelRatio>=1.5?2:1;const assets={getImageForAsset:id=>{const n=Number(id.split('.')[2]);if(n<2001||n>2049)return;const img=new Image();img.src='/qa-icons/'+scale+'x/'+n+'.png';return {img,scale}}};const p=new ContentPanels(mount,gateway,()=>s,()=>{},()=>{},undefined,assets);p.attach();p.toggleBag();window.qa={p,get reads(){return reads}};`;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','16497','--strictPort','--force'],{cwd:client,stdio:['ignore',openSync(out+'/vite.log','w'),openSync(out+'/vite-error.log','w')]});
let browser;

try{for(let i=0;
i<100;
i++){try{if((await fetch(url)).ok){report.viteReady=true;
break}}catch{}await new Promise(r=>setTimeout(r,100))}
assert.equal(report.viteReady,true,'Vite readiness');

browser=await chromium.launch({chromiumSandbox:true});

for(const [width,height,dpr] of [[1280,720,1],[1280,720,1.5],[1280,720,2],[1600,900,1],[1600,900,1.5],[1600,900,2]]){const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
await context.route('**/*',async r=>{const u=new URL(r.request().url());
if(u.origin!==url){report.errors.push('Blocked nonfixture request: '+u.origin);
return r.abort();
}if(u.pathname==='/src/main.ts')return r.fulfill({contentType:'application/javascript',body:entry});
if(u.pathname.startsWith('/qa-icons/'))return r.fulfill({path:resolve(assetRoot,u.pathname.replace('/qa-icons/','').replace(/^(1x|2x)\//,'$1/items/'))});
return r.continue()});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(String(e)));
await page.goto(url);
await page.locator('[data-item-cfg-id="2001"]').waitFor();
if(baseline){assert.equal(await page.locator('.bag-item-icon').count(),0);await page.screenshot({path:out+'/'+width+'-dpr'+dpr+'-baseline.png'});report.cases.push({width,height,dpr,checks:['same fixture baseline, no optional icons']});await context.close();continue;}
const icon=page.locator('[data-item-cfg-id="2001"] .bag-item-icon');
await icon.waitFor();
await page.waitForFunction(()=>[...document.querySelectorAll('.bag-item-icon')].every(x=>x.complete&&x.naturalWidth>0));
assert.equal(await icon.getAttribute('aria-hidden'),'true');
assert.ok((await icon.getAttribute('src')).includes('/'+(dpr>=1.5?2:1)+'x/'));
assert.equal(await icon.evaluate(el=>parseFloat(getComputedStyle(el).width)),20);
assert.equal(await icon.evaluate(el=>parseFloat(getComputedStyle(el).height)),20);

const b=await icon.boundingBox();
assert.ok(b.width>0&&b.x>=0&&b.x+b.width<=width);
assert.equal(await page.locator('[data-item-cfg-id="9999"] .bag-item-icon').count(),0);

assert.equal((await page.locator('[data-item-cfg-id="2001"] .bag-stack-id').innerText()).trim(),'2001');
assert.equal((await page.locator('[data-item-cfg-id="2001"] .bag-stack-qty').innerText()).trim(),'×1');

await page.screenshot({path:out+'/'+width+'-dpr'+dpr+'-on.png'});

await page.locator('[data-bag-category="cultivation"]').click();
await page.screenshot({path:out+'/'+width+'-dpr'+dpr+'-cultivation.png'});
await page.locator('[data-bag-category="consumable"]').click();
await icon.waitFor();
const refresh=page.locator('[data-action="refresh-bag"]');
await refresh.focus();
await page.keyboard.press('Enter');
await page.waitForFunction(()=>qa.reads>=2);
assert.equal(await icon.count(),1);
const selector=page.locator('[data-field="item-id"]');
await selector.selectOption('2001');
await selector.focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Tab');
assert.notEqual(await selector.inputValue(),'2001','ArrowDown changes native selection');
await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');
assert.equal(await icon.isVisible(),false);
assert.ok((await page.locator('[data-item-cfg-id="2001"] .bag-stack-name').innerText()).includes('谷袋'));
await page.screenshot({path:out+'/'+width+'-dpr'+dpr+'-off.png'});
await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');
assert.equal(await icon.isVisible(),true);
await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='off');
await refresh.click();
await page.waitForFunction(()=>qa.reads>=3);
assert.equal(await icon.count(),0);
await page.evaluate(()=>document.getElementById('layout-frame').dataset.artSkin='on');
assert.equal(await icon.count(),0,'reenabling after off-state redraw waits for refresh');
await refresh.click();
await icon.waitFor();
await page.screenshot({path:out+'/'+width+'-dpr'+dpr+'-restored.png'});
report.cases.push({width,height,dpr,iconBounds:b,checks:['candidate image loaded','DPR source','mouse category switches','keyboard Enter refresh','immediate off and on','off refresh removes images','on refresh restores images']});
await context.close()}
assert.equal(report.errors.length,0);
report.passed=true;

}catch(e){report.failure=String(e);
process.exitCode=1}finally{await browser?.close();
if(vite.exitCode===null){const stopped=new Promise(r=>vite.once('exit',r));
vite.kill('SIGTERM');
await stopped;
}report.cleanup={browserClosed:!browser?.isConnected(),viteStopped:vite.exitCode!==null||vite.signalCode!==null};
writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report))}
