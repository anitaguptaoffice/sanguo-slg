// Native Chromium component fixture using recorded real report; no live gateway/DB.
import assert from 'node:assert/strict';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const client = resolve(import.meta.dirname, '..'), out = process.env.QA_OUT ?? '/tmp/report-troop-scan';
const baseline = process.env.QA_BASELINE === '1', port = process.env.QA_PORT ?? '16694', url = `http://127.0.0.1:${port}`;
const recorded = JSON.parse(readFileSync(client + '/qa/fixtures/native-report1-detail.json', 'utf8'));
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'],
  { cwd: client, stdio: ['ignore', openSync(out + '/vite.log', 'w'), 'inherit'] });
const exited = new Promise(resolve => server.once('exit', resolve));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: client }).toString().trim(), baseline,
  boundary: 'Recorded-data production component fixture; NOT live backend acceptance', cases: [], errors: [] };
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'owned Vite ready');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/tmp/sanguo-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell', chromiumSandbox: true });
  for (const [width, height] of [[1280, 720], [1600, 900]]) for (const mode of ['on', 'off', 'missing-image', 'missing-metadata']) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.route('**/src/main.ts', route => route.fulfill({ contentType: 'text/javascript', body: '// Isolated component fixture.' }));
    await page.goto(url);
    await page.evaluate(async ({ recorded, mode }) => {
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
      const root = frame.querySelector('[data-center-panel="battle-report"]');
      if (mode === 'off') root.dataset.artSkin = 'off';
      const assets = new AssetLoader(); await assets.loadAll(1);
      const img = assets.getImageForAsset('ui.panel.battle-report.v1').img;
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const paper = [...ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].slice(0, 3);
      if (mode === 'missing-image') assets.getImageForAsset = () => undefined;
      if (mode === 'missing-metadata') assets.getArtMeta = () => undefined;
      skinBattleReportPanel(root, assets);
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const surface = el => {
        if (!el) return [26, 20, 16];
        const s = getComputedStyle(el);
        if (el === root && s.borderImageSource !== 'none' && s.borderImageSlice.includes('fill')) return paper;
        const bg = s.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        const alpha = bg.length === 4 ? bg[3] : 1, behind = surface(el.parentElement);
        return bg.slice(0, 3).map((v, i) => v * alpha + behind[i] * (1 - alpha));
      };
      const metrics = el => {
        const s = getComputedStyle(el), bg = surface(el), a = luminance(rgb(s.color)), b = luminance(bg);
        return { text: el.textContent, color: s.color, background: s.backgroundColor, surface: bg, font: s.fontSize,
          effectiveFontPx: parseFloat(s.fontSize) * root.getBoundingClientRect().width / root.offsetWidth,
          contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), overflow: el.scrollWidth - el.clientWidth };
      };
      const audit = () => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), findings = [];
        let node;
        while ((node = walker.nextNode())) {
          const el = node.parentElement, text = node.textContent.trim();
          if (!text || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
          const m = metrics(el);
          if (m.contrast < 4.5) findings.push({ text, tag: el.tagName, class: el.className,
            role: el.dataset.role, contrast: m.contrast, color: m.color, surface: m.surface,
            disabled: !!el.closest(':disabled, [aria-disabled="true"]') });
        }
        return findings;
      };
      window.fixture = { panel, root, snapshot() {
        const labels = [...root.querySelectorAll(':scope > h3, :scope > [data-role="report-hint"], .battle-report-filters > span:not(.hidden), .battle-report-time-chip-group > span')];
        return { paperApplied: root.hasAttribute('data-report-paper-skin'), labels: labels.map(metrics),
          narrative: metrics(root.querySelector('.report-detail > pre')),
          troopScan: [...root.querySelectorAll('.battle-report-troop-scan th, .battle-report-troop-scan td')].map(metrics),
          contrastAudit: audit(),
          table: [...root.querySelectorAll('.battle-report-rounds-table th, .battle-report-rounds-table td')].map(metrics),
          scrollOverflow: [...root.querySelectorAll('.panel-scroll-body, .report-detail')].map(el => el.scrollWidth - el.clientWidth) };
      } };
    }, { recorded, mode });
    await page.screenshot({ path: `${out}/${width}-${mode}-labels.png` });
    await page.locator('.battle-report-troop-scan').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-${mode}-troop-scan.png` });
    const metrics = await page.evaluate(() => window.fixture.snapshot());
    if (!baseline) {
      assert.equal(metrics.paperApplied, mode === 'on');
      assert.deepEqual(metrics.contrastAudit.filter(m => !m.disabled), [], 'no active low-contrast text remains in this recorded report panel');
      assert.equal(metrics.troopScan.length, 6);
      assert.ok(metrics.troopScan.every(m => m.contrast >= 4.5 && m.effectiveFontPx >= 13.9), 'troop-scan AA contrast and readable type');
      assert.ok([...metrics.labels, metrics.narrative].every(m => m.contrast >= 4.5 && m.effectiveFontPx >= 13.9));
      assert.ok(metrics.narrative.overflow <= 1 && metrics.scrollOverflow.every(n => n <= 1), 'no horizontal overflow');
    }
    assert.equal(metrics.table.length, 45); assert.ok(metrics.table.every(m => m.contrast >= 4.5 && m.font === '14px'));
    await page.locator('[data-action="jump-round"][data-round="8"]').click();
    await page.locator('.battle-report-rounds-table tr[data-round="8"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${width}-${mode}-table.png` });
    const highlighted = await page.evaluate(() => window.fixture.snapshot().table.slice(-5));
    assert.ok(highlighted.every(m => m.contrast >= 4.5));
    await page.evaluate(async () => { window.fixture.panel.toggle(); await window.fixture.panel.openPanelWithDeepLink(1); });
    const reopened = await page.evaluate(() => window.fixture.snapshot());
    assert.equal(reopened.narrative.text, metrics.narrative.text);
    assert.deepEqual(reopened.troopScan.map(m => m.text), metrics.troopScan.map(m => m.text));
    assert.deepEqual(reopened.table.map(m => m.text), metrics.table.map(m => m.text));
    report.cases.push({ width, height, mode, metrics, highlighted, reopenedTextUnchanged: true });
    await page.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally {
  await browser?.close(); if (server.exitCode === null) server.kill('SIGTERM'); await exited;
  writeFileSync(out + '/browser-report.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, baseline, cases: report.cases.length, errors: report.errors }));
