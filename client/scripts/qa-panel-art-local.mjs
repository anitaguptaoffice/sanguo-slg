import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
process.chdir(new URL('..',import.meta.url).pathname);
const out=process.env.OUT_DIR||'/tmp/sanguo-panel-art-after';await mkdir(out,{recursive:true});
const mock=spawn('node',['mock-server/server.mjs'],{env:{...process.env,MOCK_GATEWAY_PORT:'19301',MOCK_EVIDENCE_PRESET:'mail-empty'},stdio:'inherit'});
const app=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','16301','--strictPort'],{env:{...process.env,VITE_GATEWAY_WS_URL:'ws://127.0.0.1:19301/ws'},stdio:'inherit'});
let browser,lastPage;
try{
for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:16301')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
browser=await chromium.launch({args:['--no-sandbox']});
for(const [width,height,dpr] of [[1280,720,1],[1600,900,1],[1600,900,2]]){
 const tag=`${width}x${height}-dpr${dpr}`;const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
 lastPage=page;page.on('console',m=>console.log('CONSOLE',m.text()));page.on('pageerror',e=>console.log('PAGEERROR',e.message));await page.goto('http://127.0.0.1:16301');
 await page.locator('.server-list li').first().waitFor({timeout:20000});await page.locator('.server-list li').first().click();await page.locator('[data-action="enter-game"]').click();await page.locator('[data-action="toggle-mail"]').waitFor();
 await page.evaluate(async()=>{const {GatewayClient}=await import('/src/net/GatewayClient.ts');window.__qaState='empty';GatewayClient.prototype.listPlayerMail=async()=>{if(window.__qaState==='loading')await new Promise(r=>(window.__qaReleases??=[]).push(r));if(window.__qaState==='error')throw new Error('QA controlled gateway failure');return {mails:[]}}});
 await page.locator('[data-action="toggle-mail"]').click();
 for(const state of ['empty','error','loading']){
 await page.evaluate(s=>window.__qaState=s,state);await page.locator('[data-action="refresh-mail"]').click();
 const sel=`.content-panel[data-center-panel="mail"] [data-panel-state="${state}"]`;await page.locator(sel).waitFor();
 await page.screenshot({path:`${out}/${tag}-mail-${state}.png`});await page.locator(sel).screenshot({path:`${out}/${tag}-mail-${state}-crop.png`});
 const probe=await page.locator(sel).evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return {text:el.textContent,rect:{x:r.x,y:r.y,w:r.width,h:r.height},color:c.color,borderImageSource:c.borderImageSource,borderImageSlice:c.borderImageSlice,borderImageRepeat:c.borderImageRepeat}});
 await writeFile(`${out}/${tag}-mail-${state}.json`,JSON.stringify(probe,null,2));console.log(tag,state,probe);
 }
 await page.evaluate(()=>{window.__qaState='empty';window.__qaReleases?.forEach(r=>r())});await page.locator('.content-panel[data-center-panel="mail"] [data-panel-state="empty"]').waitFor();
 await page.evaluate(()=>{document.querySelector('.content-panel[data-center-panel="mail"] [data-role="mail-list"]').dataset.artSkin='off'});
 await page.locator('[data-action="refresh-mail"]').click();await page.locator('.content-panel[data-center-panel="mail"] [data-panel-state="empty"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('.content-panel[data-center-panel="mail"] [data-panel-state="empty"]')?.style.borderImageSource==='');
 await page.screenshot({path:`${out}/${tag}-mail-skin-off.png`});
 console.log('SKINOFF',await page.locator('.content-panel[data-center-panel="mail"] [data-panel-state="empty"]').evaluate(el=>({color:getComputedStyle(el).color,parentColor:getComputedStyle(el.parentElement).color,rootColor:getComputedStyle(el.closest('.content-panel')).color,border:el.style.borderImageSource})));
 await page.evaluate(async()=>{const {GatewayClient}=await import('/src/net/GatewayClient.ts');GatewayClient.prototype.listPlayerHeroes=async()=>({heroes:[]});GatewayClient.prototype.listMarches=async()=>({marches:[]})});
 await page.locator('[data-action="toggle-mail"]').click();
 for(const [action,panel] of [['toggle-hero','hero'],['toggle-queue','queue'],['toggle-marches','march']]){
 await page.locator(`[data-action="${action}"]`).click();
 const target=page.locator(`.content-panel[data-center-panel="${panel}"] [data-panel-state="empty"]`).first();
 await target.waitFor({timeout:10000});await target.scrollIntoViewIfNeeded();await page.waitForTimeout(250);console.log('ROOTS',panel,await page.locator('.content-panel').evaluateAll(es=>es.map(e=>({panel:e.dataset.centerPanel,cls:e.className,display:getComputedStyle(e).display,inline:e.getAttribute('style')}))));console.log('PANEL',panel,await target.evaluate(e=>({text:e.textContent,root:e.closest('.content-panel').className,bg:getComputedStyle(e).background,color:getComputedStyle(e).color,html:e.outerHTML})));await page.screenshot({path:`${out}/${tag}-${panel}-empty.png`});
 await page.locator(`[data-action="${action}"]`).click();
 }
 await page.close();
}
}catch(e){if(lastPage){console.log('FAILED BODY',await lastPage.locator('body').innerText());await lastPage.screenshot({path:`${out}/failure.png`})}console.error(e);process.exitCode=1}finally{if(browser)await browser.close();mock.kill();app.kill()}
