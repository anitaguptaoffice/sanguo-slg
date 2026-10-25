/** UI-only proof: production renderer/CSS, mock queued transport, native actions.
 * Skin-off is configured on creation BEFORE production skinning (no style overrides).
 * Completion advances the browser clock; it does not prove PostgreSQL persistence.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const out = path.resolve(process.argv[2] || 'military-contrast-evidence');
await mkdir(out, { recursive: true });
const mock = spawn('node', ['mock-server/server.mjs'], { env: { ...process.env, MOCK_GATEWAY_PORT: '19188', MOCK_EVIDENCE_PRESET: 'queue-recruit' }, stdio: 'ignore' });
const app = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '16288', '--strictPort'], { env: { ...process.env, VITE_GATEWAY_WS_URL: 'ws://127.0.0.1:19188/ws' }, stdio: 'ignore' });
let browser;
const results = { boundary: 'UI-only mock gateway, production DOM/CSS; native actions; no screenshot style overrides. Clock advancement is not server completion acceptance.', cases: [] };
function contrast(a,b) {
  const lum = c => c.match(/[\d.]+/g).slice(0,3).map(Number).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
  const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:16288')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  for (const width of [1280,1600]) for (const skin of ['on','off']) {
    const page=await browser.newPage({viewport:{width,height:width===1280?720:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install();
    if(skin==='off') await page.addInitScript(()=>{
      const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'className');
      Object.defineProperty(Element.prototype,'className',{...descriptor,set(value){descriptor.set.call(this,value);if(this.classList.contains('military-panel'))this.dataset.artSkin='off';}});
    });
    await page.goto('http://127.0.0.1:16288');
    await page.locator('.server-list li').first().click();
    await page.locator('[data-action="enter-game"]').click();
    await page.locator('[data-action="toggle-military"]').click();
    await page.locator('[data-field="recruit-count"]').fill('1');
    await page.locator('[data-action="recruit"]').click();
    const row=page.locator('.military-recruit-queue li.queue-list-row').first();
    await row.waitFor();
    const item={width,skin,states:[]};results.cases.push(item);
    const sample=async state=>{
      const computed=await row.evaluate(node=>{const s=getComputedStyle(node);const t=getComputedStyle(node.querySelector('span'));const r=node.getBoundingClientRect();return {foreground:t.color,background:s.backgroundColor,outline:s.outlineColor,text:node.textContent,selected:node.classList.contains('selected'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},skin:node.closest('.military-panel').dataset.artSkin||'on',borderImage:getComputedStyle(node.closest('.military-panel')).borderImageSource};});
      computed.contrast=contrast(computed.foreground,computed.background);assert.ok(computed.contrast>=4.5);
      assert.equal(computed.skin,skin);if(skin==='off')assert.equal(computed.borderImage,'none');
      item.states.push({state,...computed});await page.screenshot({path:path.join(out,`${width}-${skin}-${state}.png`)});
    };
    await sample('queued');
    await row.click(); await page.locator('[data-action="toggle-military"]').click();
    await page.waitForTimeout(50);await sample('selected');
    assert.equal(item.states[1].selected,true);
    assert.deepEqual(item.states[0].rect,item.states[1].rect);
    await page.locator('[data-field="recruit-count"]').fill('999999');
    await page.locator('[data-role="troop-recruit-form-error"]').waitFor();
    await sample('validation-error');
    assert.equal(await page.locator('[data-action="recruit"]').isDisabled(),true);
    item.errorText=await page.locator('[data-role="troop-recruit-form-error"]').innerText();
    // The production sync prunes finished recruit entries: no fabricated "completed row" state.
    await page.clock.fastForward(181000);
    assert.equal(await page.locator('.military-recruit-queue').isVisible(),false);
    item.completedQueueHidden=true;
    await page.screenshot({path:path.join(out,`${width}-${skin}-completed.png`)});
    assert.deepEqual(errors,[]);item.errors=errors;await page.close();
  }
}finally{await writeFile(path.join(out,'result.json'),JSON.stringify(results,null,2));await browser?.close();mock.kill();app.kill();}
console.log(JSON.stringify(results,null,2));
