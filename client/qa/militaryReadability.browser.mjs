// Native Chromium; exact production military markup/CSS/assets + real preview sync.
// Isolated fixture: no MainCityScene startup, gateway, DB, or march submission.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const client = resolve(import.meta.dirname, '..');
const out = process.env.QA_OUT ?? '/tmp/military-readability-browser';
const port = process.env.QA_PORT ?? '16691';
const url = `http://127.0.0.1:${port}`;
mkdirSync(out, { recursive: true });
const markup = readFileSync(client + '/src/scenes/MainCityScene.ts', 'utf8')
  .match(/this\.militaryPanel\.innerHTML = `([\s\S]*?)`;/)[1]
  .replaceAll('${DEFAULT_MARCH_TARGET.x}', '160').replaceAll('${DEFAULT_MARCH_TARGET.y}', '60')
  .replaceAll('${MARCH_FORM_VIEW_INTEL_INFO_ACTION}', 'march-form-view-intel-info')
  .replaceAll('${MARCH_FORM_RESERVE_JUMP_INTEL_ACTION}', 'march-form-reserve-jump-intel');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'],
  { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const serverExited = new Promise(resolve => server.once('exit', resolve));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: client }).toString().trim(),
  boundary: 'Production component fixture, not full-scene/native progression or historical art acceptance', cases: [], errors: [] };
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'owned Vite ready');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) for (const skinMode of ['on', 'off', 'missing-image', 'missing-metadata']) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: '// Isolated component fixture.' }));
    await page.goto(url);
    await page.evaluate(async ({ markup, skinMode }) => {
      const layout = await import('/src/engine/layoutViewport.ts');
      const { AssetLoader } = await import('/src/engine/AssetLoader.ts');
      const { skinMilitaryPanel } = await import('/src/engine/artPanelSkin.ts');
      const { skinPrimaryButtons } = await import('/src/engine/artButtonSkin.ts');
      const summary = await import('/src/net/marchFormSummary.ts');
      const readonly = await import('/src/net/marchFormReadonlyStrip.ts');
      const deep = await import('/src/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeper.ts');
      const reserve = await import('/src/net/marchFormTroopReserve.ts');
      const validation = await import('/src/net/marchFormValidation.ts');
      const submit = await import('/src/net/marchSubmitFeedback.ts');
      const frame = document.getElementById('layout-frame'); frame.replaceChildren();
      const vp = layout.computeLayoutViewport(innerWidth, innerHeight);
      layout.applyLayoutFrameStyles(frame, vp); layout.syncLayoutViewportRootClass(frame, vp);
      const panel = document.createElement('div'); panel.className = 'military-panel';
      panel.dataset.centerPanel = 'military'; panel.innerHTML = markup; frame.appendChild(panel);
      const assets = new AssetLoader(); await assets.loadAll(1);
      const img = assets.getImageForAsset('ui.panel.military.v1').img;
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const paper = [...ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].slice(0, 3);
      if (skinMode === 'off') panel.dataset.artSkin = 'off';
      if (skinMode === 'missing-image') {
        const get = assets.getImageForAsset.bind(assets);
        assets.getImageForAsset = id => id === 'ui.panel.military.v1' ? undefined : get(id);
      }
      if (skinMode === 'missing-metadata') {
        const get = assets.getArtMeta.bind(assets);
        assets.getArtMeta = id => id === 'ui.panel.military.v1' ? undefined : get(id);
      }
      skinMilitaryPanel(panel, assets, 420, 320); skinPrimaryButtons(panel, assets);
      panel.querySelector('[data-field="march-hero"]').innerHTML = '<option value="1" selected>将领</option>';
      panel.querySelector('[data-role="troops"]').textContent = '城内兵力：步兵×300';
      const readout = panel.querySelector('[data-role="march-form-troop-margin-residual-line"]');
      const rows = [...readout.children];
      const surface = skinMode === 'on' ? paper : getComputedStyle(readout).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
      const button = panel.querySelector('[data-action="march"]');
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      window.fixture = { rows, panel, clicks: 0, update(food, count = '200') {
        panel.querySelector('[data-field="march-count"]').value = count;
        const context = { cityX: 60, cityY: 60, cityTroops: [{ unit_cfg_id: 1, count: 300 }], ownedHeroes: [{ hero_id: 1, template_cfg_id: 1001, status: 1 }], wallet: { food }, clockMs: 0 };
        const snapshot = summary.readMarchFormSnapshot(panel, context);
        const result = summary.formatMarchFormSummary(snapshot, 0);
        const troop = reserve.buildMarchFormTroopReserveLine(count, context.cityTroops);
        summary.syncMarchFormInlineFeedback(panel, context); reserve.syncMarchFormTroopReserveLine(panel, troop);
        deep.syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(panel,
          deep.formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(troop, result, context.wallet));
        readonly.syncMarchFormReadonlyStripFromInput(panel, { intelSelectedMarch: null, queueBannerMarchId: null, queueBannerMarch: null, formRoot: panel, ...context, nowMs: 0 });
        submit.syncMarchSubmitButton(panel, 'idle', reserve.marchFormAllowsSubmit(validation.validateMarchForm({ ...snapshot, ...context }), troop));
        return { texts: rows.map(row => row.textContent), disabled: button.disabled, hidden: readout.classList.contains('hidden'), estimate: result.estimatedFoodCost };
      }, metrics() {
        const body = panel.querySelector('.panel-scroll-body');
        return { paper, surface, paperApplied: panel.hasAttribute('data-military-paper-skin'), borderImageSource: panel.style.borderImageSource, rootUiScale: vp.uiScale, frameTransform: getComputedStyle(frame).transform, panel: rect(panel),
          body: { ...rect(body), clientWidth: body.clientWidth, scrollWidth: body.scrollWidth, clientHeight: body.clientHeight, scrollHeight: body.scrollHeight, scrollTop: body.scrollTop }, button: rect(button),
          rows: rows.map(el => {
            const style = getComputedStyle(el); const range = document.createRange(); range.selectNodeContents(el);
            const color = style.color.match(/\d+/g).slice(0, 3).map(Number);
            const a = luminance(color), b = luminance(surface); const bounds = rect(el);
            return { role: el.dataset.role, text: el.textContent, rect: bounds, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color,
              wrapping: { whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak, lineBreak: style.lineBreak, scrollWidth: el.scrollWidth, offsetWidth: el.offsetWidth },
              renderScaleX: bounds.width / el.offsetWidth, renderScaleY: bounds.height / el.offsetHeight,
              effectiveFontPx: parseFloat(style.fontSize) * Math.min(bounds.width / el.offsetWidth, bounds.height / el.offsetHeight),
              contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
              textRects: [...range.getClientRects()].map(r => ({ x: r.x, right: r.right, y: r.y, bottom: r.bottom })) };
          }) };
      } };
      button.addEventListener('click', () => window.fixture.clicks++);
    }, { markup, skinMode });
    const cases = [];
    for (const [food, count] of [[3, '200'], [400, '200'], [5000, '200'], [3, '400']]) {
      const state = await page.evaluate(([food, count]) => window.fixture.update(food, count), [food, count]);
      assert.equal(state.disabled, count === '400'); assert.equal(state.hidden, false);
      assert.ok(state.texts.every(Boolean)); assert.equal(state.texts.length, 10);
      const metrics = await page.evaluate(() => window.fixture.metrics());
      report.current = { width, height, skinMode, food, count, metrics };
      assert.equal(metrics.paperApplied, skinMode === 'on', 'paper marker follows applied skin');
      if (skinMode !== 'on') assert.deepEqual(metrics.surface, [26, 20, 16], 'opaque dark fallback');
      assert.ok(metrics.panel.x >= 0 && metrics.panel.right <= width + 1 && metrics.panel.bottom <= height + 1);
      assert.ok(metrics.body.scrollWidth <= metrics.body.clientWidth + 1, 'no horizontal overflow');
      for (const row of metrics.rows) {
        assert.ok(row.effectiveFontPx >= 14, 'actual rendered type is at least 14px');
        assert.ok(row.contrast >= 4.5, 'normal-text contrast');
        if (!row.textRects.every(r => r.x >= metrics.body.x - 1 && r.right <= metrics.body.right + 1)) {
          await page.screenshot({ path: `${out}/${width}-${skinMode}-failed.png` });
          assert.fail('wrapped glyphs stay inside body');
        }
      }
      for (let i = 1; i < metrics.rows.length; i++) assert.ok(metrics.rows[i].rect.y >= metrics.rows[i - 1].rect.bottom, 'rows do not overlap');
      cases.push({ food, count, state, metrics });
    }
    await page.evaluate(() => window.fixture.update(3));
    await page.locator('[data-role="march-form-troop-margin-residual-primary"]').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `${out}/${width}-${skinMode}-low-first.png` });
    await page.evaluate(() => window.fixture.rows[5].scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/${width}-${skinMode}-low-middle.png` });
    await page.locator('[data-action="march"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-${skinMode}-low-last.png` });
    const bottom = await page.evaluate(() => window.fixture.metrics());
    assert.ok(bottom.button.y >= bottom.body.y && bottom.button.bottom <= bottom.body.bottom + 1, 'submit fully reachable');
    await page.locator('[data-field="march-count"]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'march', 'keyboard submit access');
    await page.locator('[data-action="march"]').click();
    assert.equal(await page.evaluate(() => window.fixture.clicks), 1, 'fixture-only click reached');
    const empty = await page.evaluate(() => window.fixture.update(3, ''));
    assert.ok(empty.disabled && empty.hidden && empty.texts.every(text => text === ''));
    const restored = await page.evaluate(() => window.fixture.update(5000));
    assert.deepEqual(restored.texts, cases[2].state.texts); assert.equal(restored.disabled, false);
    await page.evaluate(() => { window.fixture.panel.classList.add('hidden'); window.fixture.panel.classList.remove('hidden'); });
    await page.locator('[data-role="march-form-troop-margin-residual-primary"]').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: `${out}/${width}-${skinMode}-normal-first.png` });
    await page.evaluate(() => window.fixture.rows[5].scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/${width}-${skinMode}-normal-middle.png` });
    await page.locator('[data-action="march"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-${skinMode}-normal-last.png` });
    report.cases.push({ width, height, skinMode, cases, bottom, clearRestorePass: true, keyboardSubmitPass: true });
    await page.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally {
  await browser?.close(); if (server.exitCode === null) server.kill('SIGTERM'); await serverExited;
  writeFileSync(out + '/browser-report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, widths: report.cases.map(c => c.width), errors: report.errors }));
