import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
process.chdir(new URL('..',import.meta.url).pathname);
const out=process.env.OUT_DIR||'/tmp/sanguo-minimap-art';await mkdir(out,{recursive:true});
const mock=spawn('node',['mock-server/server.mjs'],{env:{...process.env,MOCK_GATEWAY_PORT:'19301',MOCK_EVIDENCE_PRESET:'mail-empty'},stdio:'inherit'});
const app=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','16301','--strictPort'],{env:{...process.env,VITE_GATEWAY_WS_URL:'ws://127.0.0.1:19301/ws'},stdio:'inherit'});
let browser;
try{
for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:16301')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
browser=await chromium.launch({args:['--no-sandbox']});
for(const [width,height,dpr] of [[1280,720,1],[1600,900,1],[1600,900,2]]){
 const tag=`${width}x${height}-dpr${dpr}`;const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));await page.goto('http://127.0.0.1:16301');
 await page.locator('.server-list li').first().waitFor({timeout:20000});
 await page.evaluate(async()=>{const {GatewayClient}=await import('/src/net/GatewayClient.ts');GatewayClient.prototype.listMarches=async()=>({marches:[{march_id:91,phase:2,from_x:1,from_y:1,to_x:5,to_y:5,depart_at_ms:Date.now()-60000,arrive_at_ms:Date.now()+120000},{march_id:92,phase:4,from_x:1,from_y:1,to_x:8,to_y:3,depart_at_ms:Date.now()-60000,arrive_at_ms:Date.now()+180000}]})});
 await page.locator('.server-list li').first().click();await page.locator('[data-action="enter-game"]').click();await page.locator('[data-action="toggle-marches"]').waitFor();
 await page.waitForTimeout(1500);await page.screenshot({path:`${out}/${tag}-minimap-unselected.png`});
 await page.locator('[data-action="toggle-marches"]').click();await page.locator('li[data-march-id="91"]').first().click();await page.waitForTimeout(200);await page.screenshot({path:`${out}/${tag}-minimap-selected.png`});
 await page.locator('[data-action="toggle-marches"]').click();
 const x=width===1280?1130:1440,y=height===720?150:170;
 await page.mouse.move(x,y);await page.mouse.wheel(0,-300);await page.screenshot({path:`${out}/${tag}-minimap-zoom.png`});
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y+15,{steps:5});await page.mouse.up();await page.screenshot({path:`${out}/${tag}-minimap-pan.png`});
 await page.evaluate(()=>document.querySelector('#layout-frame').dataset.artSkin='off');await page.waitForTimeout(100);await page.screenshot({path:`${out}/${tag}-minimap-skin-off.png`});
 await page.close();
}
}catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();mock.kill();app.kill()}
