import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { withGuildRuntime, economy, membership, CREATE, LIST } from './live_guild_presence_runtime.mjs';
export function productPins(env) {
  const pins = { baseline: ['5302dcfb86e46d0a5f900eaafb37eaa255fac5f4', '3a7eb9626e345ae54dd760bfc43eee2351a29284'],
    fixed: ['1ae318cf46321985a89b4e2cae06ea3d9527fb80', 'ed2662eeb2328b05784e4dc8e66fc9493eb426f0'] };
  assert.ok(pins[env.QA_PRODUCT]); assert.deepEqual([env.QA_PRODUCT_HEAD, env.QA_PRODUCT_TREE], pins[env.QA_PRODUCT]);
}
export function checkText(state, mode, expanded, empty = false) {
  assert.ok(['baseline', 'fixed'].includes(mode));
  const summary = mode === 'fixed' ? '在线未知 / 共 1 人' : '在线 0 / 共 1 人';
  assert.equal(state.summary, summary);
  assert.equal(state.rows, empty || !expanded ? 0 : 1);
  if (empty) { assert.equal(state.headers.length, 0); return; }
  assert.equal(state.headers.length, 1); assert.equal(state.count, '1'); assert.equal(state.expanded, String(expanded));
  const phrase = mode === 'fixed' ? '本组在线 未知/1' : '本组在线 0/1';
  assert.equal(state.headers[0].split(phrase).length - 1, 8);
  if (mode === 'fixed') assert.ok(!state.headers[0].includes('在线 0'));
}
const rgba = color => {
  const match = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(color || '');
  if (!match) return null; const values = [...match.slice(1, 4).map(Number), Number(match[4] ?? 1)];
  return values.every((v, i) => Number.isFinite(v) && v >= 0 && v <= (i === 3 ? 1 : 255)) ? values : null;
};
export function paintSurface(sample) {
  const bad = reason => ({ reason, contrast: null });
  const ink = rgba(sample.ink); if (!ink || ink[3] !== 1) return bad('ink');
  if (!sample.chain?.length || sample.chain.some(s => s.opacity !== 1 || s.filter !== 'none' || s.backdrop !== 'none' || s.blend !== 'normal' || s.mask !== 'none' || s.pseudo)) return bad('effects');
  for (const surface of sample.chain) {
    if (surface.image !== 'none' || surface.borderImage !== 'none') return { ...bad('artwork'), surface };
    const color = rgba(surface.color); if (!color || (color[3] !== 0 && color[3] !== 1)) return bad('alpha');
    if (color[3] === 0) continue;
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(ink), b = luminance(color);
    return { reason: 'opaque-css', surface, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
  }
  return bad('no-surface');
}
const geometryReadable = sample => sample.font >= 10 && sample.opacity === 1 && sample.rects.length > 0 && sample.rects.every(r => r.width > 0 && r.height > 0 && r.visible && r.hit);
export const readable = sample => geometryReadable(sample) && paintSurface(sample).contrast >= 4.5;
export function fixedSummary(sample) {
  assert.ok(readable(sample)); assert.equal(paintSurface(sample).surface, sample.chain[0]);
  assert.equal(sample.ink, 'rgb(255, 243, 214)'); assert.equal(sample.chain[0].color, 'rgb(36, 23, 15)');
}
export function baselineSummary(sample) {
  const paint = paintSurface(sample); assert.ok(geometryReadable(sample)); assert.equal(sample.ink, 'rgb(245, 230, 200)');
  assert.equal(sample.chain[0].color, 'rgba(0, 0, 0, 0)'); assert.equal(paint.reason, 'artwork');
  assert.equal(paint.surface.color, 'rgba(0, 0, 0, 0)'); assert.equal(paint.surface.panel, 'guild'); assert.equal(paint.surface.image, 'none'); assert.ok(paint.surface.slice.includes('fill'));
  assert.equal(paint.surface.borderImage, 'url("http://127.0.0.1:5173/assets/art/v1/textures/1x/ui/panel_default.png")');
}
export function focusGate(state, baseline) {
  assert.equal(state.focusInPanel, !baseline); if (baseline) assert.equal(state.focusTag, 'BODY');
  else { assert.equal(state.focusAction, 'toggle-guild-role-group'); assert.equal(state.focusRole, '1'); }
}
export function expectedDefects(defects) {
  assert.deepEqual(defects, ['summary-artwork-contrast', 'role-toggle-body-focus', 'escape-remains-open']);
}
export function inspect(root) {
  const summary = root.querySelector('[data-role="guild-member-online-summary"]');
  const residual = root.querySelector('[data-role="guild-role-group-header-line"]');
  const toggle = root.querySelector('[data-action="toggle-guild-role-group"]');
  function sample(el, start, end) {
    const css = getComputedStyle(el), range = document.createRange(); range.setStart(el.firstChild, start); range.setEnd(el.firstChild, end);
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, opacity = 1; const chain = [];
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect(); opacity *= Number(style.opacity);
      chain.push({ tag: node.tagName, role: node.dataset.role || null, className: node.className, panel: node.dataset.centerPanel || null, color: style.backgroundColor, image: style.backgroundImage, borderImage: style.borderImageSource, slice: style.borderImageSlice,
        opacity: Number(style.opacity), filter: style.filter, backdrop: style.backdropFilter, blend: style.mixBlendMode, mask: style.maskImage,
        pseudo: ['::before', '::after'].some(p => { const c = getComputedStyle(node, p); return !['none', 'normal'].includes(c.content) && c.display !== 'none'; }) });
      if (style.display === 'none' || style.visibility !== 'visible') opacity = 0;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { clip.left = Math.max(clip.left, rect.left); clip.right = Math.min(clip.right, rect.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { clip.top = Math.max(clip.top, rect.top); clip.bottom = Math.min(clip.bottom, rect.bottom); }
    }
    const rects = [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height,
      visible: r.left >= clip.left - 1 && r.right <= clip.right + 1 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1,
      hit: el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }));
    return { font: parseFloat(css.fontSize), opacity, ink: css.color, chain, rects };
  }
  const phrases = [];
  if (residual) for (const match of residual.textContent.matchAll(/本组在线 (?:未知|0)\/1/g)) phrases.push(sample(residual, match.index, match.index + match[0].length));
  return { summary: summary?.textContent, headers: residual ? [residual.textContent] : [],
    count: root.querySelector('[data-role="guild-role-group-count"]')?.textContent,
    expanded: toggle?.getAttribute('aria-expanded'), rows: root.querySelectorAll('.guild-member-row').length,
    summaryGeometry: summary?.firstChild ? sample(summary, 0, summary.textContent.length) : null, phrases,
    focusInPanel: root.contains(document.activeElement), focusTag: document.activeElement?.tagName, focusRole: document.activeElement?.getAttribute('data-role-key'), focusAction: document.activeElement?.getAttribute('data-action'),
    scroll: root.querySelector('[data-role="guild-members"]')?.scrollTop };
}
export async function verify(h) {
  const { page, panel, action, report, owner, act, pause, eventually, settled, screenshot, save, snapshot, before } = h;
  report.cases = []; report.geometry = []; report.findings = []; report.expectedDefects = [];
  const baseline = report.product === 'baseline'; report.resultKind = baseline ? 'baseline-defect-control' : 'fixed-native-acceptance';
  if (baseline) report.nativeAcceptance = false;
  const lists = () => report.requests.filter(row => row.route === LIST && row.code === 0).length;
  const capture = async label => { const value = await act(() => panel.evaluate(inspect)); report.geometry.push({ label, ...value, summaryPaint: value.summaryGeometry ? paintSurface(value.summaryGeometry) : null }); await screenshot(label); save(); return value; };
  const gate = (label, fn) => { try { fn(); report.cases.push(label); } catch (error) { report.findings.push(`${label}: ${error.message}`); } save(); };
  await act(() => panel.locator('[data-field="guild-name"]').fill('GuildPresenceQA'));
  await act(() => action('create-guild').click()); await eventually(() => lists() === 1, 'Creation member list missing; never retry creation'); await settled();
  const created = snapshot('after create'); economy(before, created, true);
  membership(created, owner, report.requests.find(row => row.route === CREATE).guild.guild_id);
  let value = await capture('created-expanded'); gate('created text', () => checkText(value, report.product, true));
  gate('summary surface', () => { if (baseline) { baselineSummary(value.summaryGeometry); report.expectedDefects.push('summary-artwork-contrast'); } else fixedSummary(value.summaryGeometry); });
  const seen = new Set(), ul = panel.locator('[data-role="guild-members"]');
  for (let step = 0; step < 12; step++) {
    value = await capture(`residual-scroll-${step}`);
    value.phrases.forEach((sample, index) => { if (readable(sample)) seen.add(index); });
    if (seen.size === 8) break;
    await act(() => ul.hover()); await act(() => page.mouse.wheel(0, 70)); await pause(80);
  }
  gate('all eight segments readable by native scroll', () => assert.equal(seen.size, 8));
  await act(() => ul.hover()); await act(() => page.mouse.wheel(0, -1600)); await pause(100);
  await act(() => action('toggle-guild-role-group').click()); value = await capture('mouse-collapsed');
  gate('mouse collapsed text', () => checkText(value, report.product, false));
  if (!baseline) {
    focusGate(value, false);
    await act(() => page.keyboard.press('Shift+Tab')); value = await capture('keyboard-predecessor');
    assert.equal(value.focusAction, 'refresh-members');
    assert.equal(await act(() => action('refresh-members').isVisible()), true);
    assert.equal(await act(() => action('refresh-members').isEnabled()), true);
  }
  await act(() => page.keyboard.press('Tab')); value = await capture('keyboard-return');
  if (!baseline) focusGate(value, false);
  for (let n = 0; n < 30 && value.focusAction !== 'toggle-guild-role-group'; n++) { await act(() => page.keyboard.press('Tab')); value = await act(() => panel.evaluate(inspect)); }
  assert.equal(value.focusAction, 'toggle-guild-role-group', 'Role toggle must be keyboard reachable');
  await act(() => page.keyboard.press('Enter')); value = await capture('keyboard-expanded');
  gate('keyboard expanded text', () => checkText(value, report.product, true));
  gate('keyboard focus', () => { focusGate(value, baseline); if (baseline) report.expectedDefects.push('role-toggle-body-focus'); });
  await act(() => page.keyboard.press('Escape'));
  if (baseline) { await pause(250); assert.equal(await panel.isVisible(), true); report.expectedDefects.push('escape-remains-open'); await screenshot('baseline-escape-defect'); await act(() => action('toggle-guild').click()); }
  await eventually(() => panel.isHidden(), 'Guild did not close');
  await act(() => action('toggle-guild').click()); await settled(); value = await capture('reopened-no-fetch');
  gate('reopen keeps honest summary without fetching', () => { assert.equal(lists(), 1); checkText(value, report.product, true, true); });
  await act(() => action('refresh-members').click()); await eventually(() => lists() === 2, 'Explicit refresh missing'); await settled();
  value = await capture('refreshed'); gate('explicit refresh restores real roster', () => checkText(value, report.product, true));
  gate('refreshed summary surface', () => { if (baseline) baselineSummary(value.summaryGeometry); else fixedSummary(value.summaryGeometry); });
  if (baseline) expectedDefects(report.expectedDefects); else assert.deepEqual(report.expectedDefects, []);
  assert.deepEqual(report.findings, [], 'Native findings are blockers, including existing clipping/focus defects');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { productPins(process.env); await withGuildRuntime(verify); }
