import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { withGuildRuntime, economy, membership, CREATE, LIST } from './live_guild_presence_runtime.mjs';
export function productPins(env) {
  const pins = { baseline: ['757e43a9f40d7c92ded6a536ec334de94d69ff6f', 'cb3162ade8e15a9ab361b8f2d54ced1f5ea36d40'],
    fixed: ['00b292a9c1f7ab3ec5d6c868c8667cbcf03681bc', '1949038fc542b545a229de4bcf96c86580a08514'] };
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
export function readable(sample) {
  return sample.font >= 10 && sample.opacity === 1 && sample.contrast >= 4.5 && sample.rects.length > 0 &&
    sample.rects.every(r => r.width > 0 && r.height > 0 && r.visible && r.hit);
}
export function inspect(root) {
  const summary = root.querySelector('[data-role="guild-member-online-summary"]');
  const residual = root.querySelector('[data-role="guild-role-group-header-line"]');
  const toggle = root.querySelector('[data-action="toggle-guild-role-group"]');
  function sample(el, start, end) {
    const css = getComputedStyle(el), range = document.createRange(); range.setStart(el.firstChild, start); range.setEnd(el.firstChild, end);
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, opacity = 1, bg;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect(); opacity *= Number(style.opacity);
      if (!bg && style.backgroundColor !== 'rgba(0, 0, 0, 0)') bg = style.backgroundColor;
      if (style.display === 'none' || style.visibility !== 'visible') opacity = 0;
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { clip.left = Math.max(clip.left, rect.left); clip.right = Math.min(clip.right, rect.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { clip.top = Math.max(clip.top, rect.top); clip.bottom = Math.min(clip.bottom, rect.bottom); }
    }
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const fg = luminance(css.color), back = luminance(bg || 'rgb(0, 0, 0)');
    const rects = [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height,
      visible: r.left >= clip.left - 1 && r.right <= clip.right + 1 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1,
      hit: el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }));
    return { font: parseFloat(css.fontSize), opacity, contrast: (Math.max(fg, back) + .05) / (Math.min(fg, back) + .05), rects };
  }
  const phrases = [];
  if (residual) for (const match of residual.textContent.matchAll(/本组在线 (?:未知|0)\/1/g)) phrases.push(sample(residual, match.index, match.index + match[0].length));
  return { summary: summary?.textContent, headers: residual ? [residual.textContent] : [],
    count: root.querySelector('[data-role="guild-role-group-count"]')?.textContent,
    expanded: toggle?.getAttribute('aria-expanded'), rows: root.querySelectorAll('.guild-member-row').length,
    summaryGeometry: summary?.firstChild ? sample(summary, 0, summary.textContent.length) : null, phrases,
    focusInPanel: root.contains(document.activeElement), focusAction: document.activeElement?.getAttribute('data-action'),
    scroll: root.querySelector('[data-role="guild-members"]')?.scrollTop };
}
export async function verify(h) {
  const { page, panel, action, report, owner, act, pause, eventually, settled, screenshot, save, snapshot, before } = h;
  report.cases = []; report.geometry = []; report.findings = [];
  const lists = () => report.requests.filter(row => row.route === LIST && row.code === 0).length;
  const capture = async label => { const value = await act(() => panel.evaluate(inspect)); report.geometry.push({ label, ...value }); await screenshot(label); save(); return value; };
  const gate = (label, fn) => { try { fn(); report.cases.push(label); } catch (error) { report.findings.push(`${label}: ${error.message}`); } save(); };
  await act(() => panel.locator('[data-field="guild-name"]').fill('GuildPresenceQA'));
  await act(() => action('create-guild').click()); await eventually(() => lists() === 1, 'Creation member list missing; never retry creation'); await settled();
  const created = snapshot('after create'); economy(before, created, true);
  membership(created, owner, report.requests.find(row => row.route === CREATE).guild.guild_id);
  let value = await capture('created-expanded'); gate('created text', () => checkText(value, report.product, true));
  gate('summary readable', () => assert.ok(readable(value.summaryGeometry)));
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
  for (let n = 0; n < 30 && value.focusAction !== 'toggle-guild-role-group'; n++) { await act(() => page.keyboard.press('Tab')); value = await act(() => panel.evaluate(inspect)); }
  assert.equal(value.focusAction, 'toggle-guild-role-group', 'Role toggle must be keyboard reachable');
  await act(() => page.keyboard.press('Enter')); value = await capture('keyboard-expanded');
  gate('keyboard expanded text', () => checkText(value, report.product, true));
  gate('keyboard focus remains in panel', () => assert.equal(value.focusInPanel, true));
  await act(() => page.keyboard.press('Escape')); await eventually(() => panel.isHidden(), 'Guild did not close');
  await act(() => action('toggle-guild').click()); await settled(); value = await capture('reopened-no-fetch');
  gate('reopen keeps honest summary without fetching', () => { assert.equal(lists(), 1); checkText(value, report.product, true, true); });
  await act(() => action('refresh-members').click()); await eventually(() => lists() === 2, 'Explicit refresh missing'); await settled();
  value = await capture('refreshed'); gate('explicit refresh restores real roster', () => checkText(value, report.product, true));
  gate('refreshed summary readable', () => assert.ok(readable(value.summaryGeometry)));
  assert.deepEqual(report.findings, [], 'Native findings are blockers, including existing clipping/focus defects');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { productPins(process.env); await withGuildRuntime(verify); }
