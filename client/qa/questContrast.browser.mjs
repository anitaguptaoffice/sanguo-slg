// Actual ContentPanels + production CSS with deterministic read-only fixtures.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/quest-contrast-browser';
mkdirSync(out, { recursive: true });
const url = 'http://127.0.0.1:16491';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','16491','--strictPort'], {cwd:client,stdio:['ignore',openSync(out+'/vite.log','w'),'inherit']});
let browser;
const report = {source:execFileSync('git',['rev-parse','HEAD'],{cwd:client}).toString().trim(),boundary:'Component fixtures only, not native progression or art acceptance',cases:[],errors:[]};
try {
 for (let i=0;i<100;i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
 browser = await chromium.launch({executablePath:'/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',chromiumSandbox:true});
 for (const [width,height] of [[1280,720],[1600,900]]) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror', e=>report.errors.push(String(e)));
  await page.route('**/src/main.ts', r=>r.fulfill({contentType:'text/javascript',body:'// Component fixture'}));
  await page.goto(url);
  await page.evaluate(async()=>{
   const {ContentPanels}=await import('/src/ui/ContentPanels.ts');
   const layout=await import('/src/engine/layoutViewport.ts');
   const mount=document.getElementById('layout-frame'); mount.replaceChildren();
   const vp=layout.computeLayoutViewport(innerWidth,innerHeight); layout.applyLayoutFrameStyles(mount,vp);layout.syncLayoutViewportRootClass(mount,vp);
   const session={serverId:1,cityId:1,player:{player_id:1},wallet:{food:3200,wood:1700,iron:2500,stone:900,gold:0},buildings:[],bag:[],cityTroops:[]};
   const gateway={getBoundServerId:()=>1,listPlayerQuests:async()=>({quests:[{quest_cfg_id:1005,quest_code:'tutorial_barracks_2',state:4,progress_json:'{"count":1}'},{quest_cfg_id:1006,quest_code:'tutorial_next',state:2,progress_json:'{"count":0}'}]})};
   window.panels=new ContentPanels(mount,gateway,()=>session,()=>{},()=>{}); window.panels.attach();window.panels.toggleQuest();
  });
  await page.locator('.quest-panel .quest-list li').first().waitFor();
  const result=await page.locator('.quest-panel').evaluate(panel=>{
   const rgb=s=>s.match(/\d+/g).slice(0,3).map(Number);
   const lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   const background=getComputedStyle(panel).backgroundColor;
   const ratios=[panel,panel.querySelector('h3'),panel.querySelector('label'),panel.querySelector('li')].map(el=>{
    const color=getComputedStyle(el).color; const a=lum(color),b=lum(background);return {tag:el.tagName,color,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   });
   return {background,ratios,bagColor:getComputedStyle(document.querySelector('[data-center-panel="bag"]')).color};
  });
  assert.ok(result.ratios.every(x=>x.ratio>=4.5)); assert.equal(result.bagColor,'rgb(61, 46, 31)');
  await page.screenshot({path:`${out}/${width}-quest-readable.png`});
  await page.getByRole('button',{name:'刷新列表',exact:true}).click();
  await page.evaluate(()=>{window.panels.toggleQuest();window.panels.toggleQuest()});
  await page.locator('.quest-panel:not(.hidden) .quest-list li').first().waitFor();
  report.cases.push({width,height,...result}); await page.close();
 }
 assert.equal(report.errors.length,0);
} finally {
 await browser?.close(); server.kill('SIGTERM'); await new Promise(r=>server.once('exit',r));
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
}
