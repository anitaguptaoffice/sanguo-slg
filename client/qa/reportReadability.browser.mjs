// Recorded native data through production report component/CSS/art. No live gateway.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..'), out = process.env.QA_OUT ?? '/tmp/report-readability-browser';
const port = process.env.QA_PORT ?? '16692', url = `http://127.0.0.1:${port}`;
const recorded = JSON.parse(readFileSync(client + '/qa/fixtures/native-report1-detail.json', 'utf8'));
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'],
  { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const exited = new Promise(resolve => server.once('exit', resolve));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: client }).toString().trim(),
  boundary: 'Recorded real report; production component fixture, NOT live backend acceptance', cases: [], errors: [] };
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'owned Vite ready');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) {
    for (const art of ['on', 'off']) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      page.on('pageerror', error => report.errors.push(String(error)));
      await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: '// Isolated component fixture.' }));
      await page.goto(url);
      await page.evaluate(async ({ recorded, art }) => {
        const layout = await import('/src/engine/layoutViewport.ts');
        const { AssetLoader } = await import('/src/engine/AssetLoader.ts');
        const { skinBattleReportPanel } = await import('/src/engine/artPanelSkin.ts');
        const { BattleReportPanel } = await import('/src/ui/BattleReportPanel.ts');
        const frame = document.getElementById('layout-frame'); frame.replaceChildren();
        const vp = layout.computeLayoutViewport(innerWidth, innerHeight);
        layout.applyLayoutFrameStyles(frame, vp); layout.syncLayoutViewportRootClass(frame, vp);
        const panel = new BattleReportPanel(frame, {
          listBattleReports: async () => ({ reports: [recorded.value.report.summary], total: 1 }),
          getBattleReport: async () => structuredClone(recorded.value),
        }, () => {});
        panel.attach(); await panel.openPanelWithDeepLink(1);
        const root = frame.querySelector('[data-center-panel="battle-report"]'); root.dataset.artSkin = art;
        const assets = new AssetLoader(); await assets.loadAll(1); skinBattleReportPanel(root, assets);
        window.fixture = { panel, root };
      }, { recorded, art });
      const table = page.locator('.battle-report-rounds-table');
      await table.locator('thead').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${width}-${art}-header.png` });
      for (const selected of [false, true]) {
        if (selected) await page.locator('[data-action="jump-round"][data-round="8"]').click();
        await table.locator('tr[data-round="8"]').scrollIntoViewIfNeeded();
        const metrics = await table.evaluate(table => {
          const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
            .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          const rgb = color => color.match(/\d+/g).slice(0, 3).map(Number);
          const host = table.closest('.report-detail');
          return { rows: table.tBodies[0].rows.length, overflow: host.scrollWidth - host.clientWidth,
            cells: [...table.querySelectorAll('th,td')].map(el => {
              const s = getComputedStyle(el), r = el.getBoundingClientRect(), a = luminance(rgb(s.color)), b = luminance(rgb(s.backgroundColor));
              return { text: el.textContent, color: s.color, background: s.backgroundColor, font: s.fontSize,
                effectiveFontPx: parseFloat(s.fontSize) * r.height / el.offsetHeight, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
                width: r.width, height: r.height };
            }), selected: !!table.querySelector('tr[data-round="8"].battle-report-round-row-highlight') };
        });
        assert.equal(metrics.rows, 8); assert.equal(metrics.selected, selected); assert.ok(metrics.overflow <= 1, 'no horizontal overflow');
        assert.ok(metrics.cells.every(cell => cell.contrast >= 4.5 && cell.effectiveFontPx >= 13.9), 'AA contrast and effective 14px');
        assert.ok(metrics.cells.some(cell => cell.text === '步兵 166'), 'recorded survivors unchanged');
        await page.screenshot({ path: `${out}/${width}-${art}-${selected ? 'highlight' : 'normal'}-round8.png` });
        report.cases.push({ width, height, art, selected, metrics });
      }
      await page.evaluate(async () => { window.fixture.panel.toggle(); await window.fixture.panel.openPanelWithDeepLink(1); });
      assert.equal(await table.locator('tbody tr').count(), 8, 'reopened report retains rounds');
      await page.close();
    }
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally {
  await browser?.close(); if (server.exitCode === null) server.kill('SIGTERM'); await exited;
  writeFileSync(out + '/browser-report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, errors: report.errors }));
