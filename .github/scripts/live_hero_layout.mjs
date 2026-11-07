import assert from 'node:assert/strict';
import { withHeroRuntime } from './live_hero_layout_runtime.mjs';

const expectedCases = ['default-visible-name-and-avatar', 'default-name-click', 'details-loaded', 'return-avatar-click',
  'mouse-disclosures', 'keyboard-disclosures', 'manual-expanded-detail', 'recruit-wheel', 'capture-wheel', 'roster-wheel',
  'visible-controls-tab', 'refresh-detail', 'escape-reopen'];
const assertCases = actual => assert.deepEqual([...actual].sort(), [...expectedCases].sort());
const regionSelectors = { recruit: '.hero-recruit-host', capture: '[data-role="hero-capture-sections-row"]', roster: '[data-role="hero-scroll"]' };
function inspect(el) {
  const describe = node => node ? `${node.tagName.toLowerCase()}#${node.id || ''}.${node.className} ${node.getAttribute('data-role') || node.getAttribute('data-action') || ''}` : null;
  const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const bounds = el.getBoundingClientRect(), chain = []; let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
    const r = ancestor.getBoundingClientRect(), css = getComputedStyle(ancestor);
    chain.push({ name: describe(ancestor), rect: rect(ancestor), overflowX: css.overflowX, overflowY: css.overflowY,
      display: css.display, visibility: css.visibility, position: css.position, zIndex: css.zIndex,
      scrollTop: ancestor.scrollTop, clientHeight: ancestor.clientHeight, scrollHeight: ancestor.scrollHeight });
    if (ancestor !== el && /auto|scroll|hidden|clip/.test(css.overflowX)) { clip.left = Math.max(clip.left, r.left + ancestor.clientLeft); clip.right = Math.min(clip.right, r.left + ancestor.clientLeft + ancestor.clientWidth); }
    if (ancestor !== el && /auto|scroll|hidden|clip/.test(css.overflowY)) { clip.top = Math.max(clip.top, r.top + ancestor.clientTop); clip.bottom = Math.min(clip.bottom, r.top + ancestor.clientTop + ancestor.clientHeight); }
  }
  const visible = { left: Math.max(clip.left, bounds.left), top: Math.max(clip.top, bounds.top), right: Math.min(clip.right, bounds.right), bottom: Math.min(clip.bottom, bounds.bottom) }, points = [];
  if (visible.right > visible.left && visible.bottom > visible.top) for (const fy of [0.1, 0.5, 0.9]) for (const fx of [0.1, 0.5, 0.9]) {
    const x = visible.left + (visible.right - visible.left) * fx, y = visible.top + (visible.bottom - visible.top) * fy, hit = document.elementFromPoint(x, y);
    points.push({ x, y, hit: describe(hit), reachesTarget: !!hit && el.contains(hit) });
  }
  return { name: describe(el), rect: rect(el), visible, points, ancestors: chain, scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight };
}
function visibleTarget(value, fullyVisible = false) {
  assert.ok(value.rect.width > 0 && value.rect.height > 0, 'Target has no positive dimensions');
  assert.ok(value.visible.right > value.visible.left && value.visible.bottom > value.visible.top, 'Target is fully clipped');
  assert.ok(value.points.some(point => point.reachesTarget), 'No sampled target hit');
  if (fullyVisible) {
    assert.ok(value.visible.bottom - value.visible.top >= value.rect.height - 1, 'Target height is clipped');
    assert.ok(value.visible.right - value.visible.left >= value.rect.width - 1, 'Target width is clipped');
  }
}
function usableRoster(geometry) {
  visibleTarget(geometry.roster);
  assert.ok(geometry.roster.visible.bottom - geometry.roster.visible.top >= 64, 'Roster has less than64px usable height');
  assert.ok(geometry.roster.rect.y >= geometry.panel.rect.y, 'Roster starts outside panel');
  assert.ok(geometry.roster.rect.y + geometry.roster.rect.height <= geometry.panel.rect.y + geometry.panel.rect.height + 1, 'Roster ends outside panel');
  assert.ok(geometry.roster.visible.bottom <= geometry.toolbar.rect.y + 1, 'Roster overlaps bottom toolbar');
}
async function verify(h) {
  const { page, panel, action, hero, report, save, responseAfter, settled, screenshot } = h;
  report.expectedCases = expectedCases; report.cases = []; report.controls = []; report.scrolls = [];
  const complete = name => { assert.ok(expectedCases.includes(name) && !report.cases.includes(name)); report.cases.push(name); save(); };
  const row = panel.locator(`li[data-hero-id="${hero}"]`), name = row.locator('.hero-list-row-primary'), avatar = row.locator('[data-role="hero-list-avatar"]');
  const details = panel.locator('details.hero-recruit-host, details.hero-capture-info');
  async function capture(label) {
    const geometry = { label, panel: await panel.evaluate(inspect), toolbar: await page.locator('.main-city-toolbar').evaluate(inspect) };
    for (const [key, selector] of Object.entries(regionSelectors)) geometry[key] = await panel.locator(selector).evaluate(inspect);
    for (const [key, target] of [['row', row], ['name', name], ['avatar', avatar]]) geometry[key] = await target.evaluate(inspect);
    geometry.details = await details.evaluateAll(nodes => nodes.map(node => ({ open: node.open, summary: node.querySelector('summary').textContent })));
    report.geometry.push(geometry); save(); await screenshot(label); return geometry;
  }
  async function detailClick(target) {
    const response = await responseAfter(() => target.click(), 'hero.v1.GetHeroDetail');
    assert.equal(response.detail.hero_id, hero); await action('hero-expr-finish').waitFor(); await settled();
  }
  report.phase = 'original default state, before any manual fold';
  const original = await capture('default-original'); usableRoster(original);
  assert.equal(original.details.length, 4); assert.equal(original.details[0].open, true);
  for (const detail of original.details.slice(1)) assert.equal(detail.open, report.width === 1600, 'Preserve viewport-native capture defaults');
  visibleTarget(original.name, true); visibleTarget(original.avatar, true); complete('default-visible-name-and-avatar');
  await detailClick(name); complete('default-name-click');
  assert.equal(await details.first().evaluate(node => node.open), false, 'Existing detail auto-collapse must remain');
  usableRoster(await capture('default-name-detail')); complete('details-loaded');
  await action('hero-back-to-list').click(); await settled();
  const returned = await capture('native-return-before-avatar'); usableRoster(returned);
  assert.equal(returned.details[0].open, true, 'Native return must restore recruitment chrome');
  // This is returned native state, not a second virgin/default-state claim.
  await detailClick(avatar); await capture('native-return-avatar-detail'); complete('return-avatar-click');
  for (let i = 0; i < await details.count(); i++) {
    const detail = details.nth(i), summary = detail.locator(':scope > summary'), before = await detail.evaluate(node => node.open);
    await summary.click(); assert.equal(await detail.evaluate(node => node.open), !before); await capture(`mouse-summary-${i}-toggled`);
    await summary.click(); assert.equal(await detail.evaluate(node => node.open), before);
    for (const key of ['Enter', 'Space']) {
      assert.equal(await summary.evaluate(node => node === document.activeElement), true, 'Native mouse focus must remain on summary');
      await page.keyboard.press(key); assert.equal(await detail.evaluate(node => node.open), !before);
      await page.keyboard.press(key); assert.equal(await detail.evaluate(node => node.open), before);
    }
    await capture(`keyboard-summary-${i}-restored`);
  }
  complete('mouse-disclosures'); complete('keyboard-disclosures');
  for (let i = 0; i < await details.count(); i++) if (!(await details.nth(i).evaluate(node => node.open))) await details.nth(i).locator(':scope > summary').click();
  const expanded = await capture('manual-expanded-with-detail'); usableRoster(expanded);
  assert.ok(expanded.details.every(detail => detail.open)); assert.equal(await action('hero-expr-finish').count(), 1);
  await action('hero-expr-finish').hover();
  report.manualDetailControl = { disabled: await action('hero-expr-finish').isDisabled(), geometry: await action('hero-expr-finish').evaluate(inspect) };
  visibleTarget(report.manualDetailControl.geometry, true); await capture('manual-expanded-detail-control'); complete('manual-expanded-detail');
  for (const [region, selector] of Object.entries(regionSelectors)) {
    const target = panel.locator(selector), before = await target.evaluate(inspect); visibleTarget(before);
    await capture(`${region}-wheel-before`);
    assert.ok(before.scrollHeight > before.clientHeight + 1, `${region} must expose its real overflow for wheel acceptance`);
    const x = (before.visible.left + before.visible.right) / 2, y = (before.visible.top + before.visible.bottom) / 2;
    await page.mouse.move(x, y); await page.mouse.wheel(0, -10000);
    await page.waitForFunction(selector => document.querySelector(selector).scrollTop <= 1, selector);
    await page.mouse.wheel(0, 10000);
    await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 1, selector);
    const end = await target.evaluate(inspect); await capture(`${region}-wheel-end`);
    await page.mouse.wheel(0, -10000);
    await page.waitForFunction(selector => document.querySelector(selector).scrollTop <= 1, selector);
    await capture(`${region}-wheel-return`);
    report.scrolls.push({ region, before, end, returned: await target.evaluate(inspect) }); save(); complete(`${region}-wheel`);
  }
  const controlNames = ['refresh-templates', 'recruit-hero', 'refresh-hotel-candidates', 'refresh-hotel-pool', 'recruit-hotel-candidate',
    'refresh-captive-list', 'captive-summon-confirm', 'captive-release', 'refresh-persuade-targets', 'persuade-primary',
    'refresh-coming-list', 'coming-accept-confirm', 'coming-reject'];
  const expectedFocus = new Set();
  const visibleControlKeys = await panel.locator('.hero-recruit-host button, .hero-recruit-host select, [data-role="hero-capture-sections-row"] button, [data-role="hero-capture-sections-row"] select').evaluateAll(nodes =>
    nodes.filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').map(node => node.getAttribute('data-action') || node.getAttribute('data-field')));
  assert.ok(visibleControlKeys.every(Boolean), 'Every visible control needs an observable identity');
  for (const key of new Set([...controlNames, 'template-select', ...visibleControlKeys])) {
    const target = key === 'template-select' ? panel.locator('[data-field="template-select"]') : action(key);
    assert.equal(await target.count(), 1);
    const state = await target.evaluate(node => ({ disabled: node.disabled, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, tabIndex: node.tabIndex }));
    assert.notEqual(state.display, 'none'); assert.notEqual(state.visibility, 'hidden'); assert.equal(state.tabIndex, 0);
    report.controls.push({ key, ...state }); if (!state.disabled) expectedFocus.add(key);
  }
  const focused = new Set();
  for (let n = 0; n < 300 && focused.size < expectedFocus.size; n++) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate(() => ({ key: document.activeElement.getAttribute('data-action') || document.activeElement.getAttribute('data-field'), inPanel: !!document.activeElement.closest('[data-center-panel="hero"]') }));
    assert.equal(current.inPanel, true, 'Keyboard focus escaped the open panel');
    if (expectedFocus.has(current.key) && !focused.has(current.key)) {
      const geometry = await page.locator(':focus').evaluate(inspect); visibleTarget(geometry, true);
      report.controls.find(control => control.key === current.key).focused = geometry; focused.add(current.key); save(); await screenshot(`focused-control-${focused.size}`);
    }
  }
  assert.deepEqual([...focused].sort(), [...expectedFocus].sort()); complete('visible-controls-tab');
  await responseAfter(() => action('refresh-heroes').click(), 'hero.v1.ListPlayerHeroes'); await settled();
  await detailClick(name); usableRoster(await capture('refreshed-detail')); complete('refresh-detail');
  await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
  assert.equal(await action('toggle-hero').evaluate(node => node === document.activeElement), true, 'Escape must return toolbar focus');
  await responseAfter(() => action('toggle-hero').click(), 'hero.v1.ListPlayerHeroes'); await settled();
  await detailClick(name); usableRoster(await capture('escape-reopened-detail')); complete('escape-reopen');
  assertCases(report.cases); save();
}
if (process.argv.includes('--self-test')) {
  const rect = { x: 10, y: 10, width: 100, height: 100, left: 10, top: 10, right: 110, bottom: 110 };
  const node = (className, box = rect) => ({ tagName: 'SPAN', className, getAttribute: () => null, getBoundingClientRect: () => box, clientLeft: 0, clientTop: 0, clientWidth: box.width, clientHeight: box.height, contains(hit) { return hit === this; } });
  const target = node('target'), parent = node('clip', { ...rect, width: 50, right: 60 }); target.parentElement = parent;
  globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
  globalThis.getComputedStyle = () => ({ overflowX: 'hidden', overflowY: 'hidden' }); globalThis.document = { elementFromPoint: () => target };
  let value = inspect(target); assert.equal(value.points.length, 9); assert.equal(value.visible.right, 60); visibleTarget(value);
  assert.throws(() => visibleTarget(value, true), /width is clipped/);
  document.elementFromPoint = () => parent; assert.throws(() => visibleTarget(inspect(target)), /No sampled target hit/);
  document.elementFromPoint = () => null; assert.throws(() => visibleTarget(inspect(target)), /No sampled target hit/);
  parent.getBoundingClientRect = () => ({ ...rect, left: 200, right: 250 }); assert.throws(() => visibleTarget(inspect(target)), /fully clipped/);
  document.elementFromPoint = () => target; parent.getBoundingClientRect = () => ({ ...rect, height: 50, bottom: 60 }); parent.clientHeight = 50;
  assert.throws(() => visibleTarget(inspect(target), true), /height is clipped/);
  target.getBoundingClientRect = () => ({ ...rect, height: 0, bottom: 10 }); assert.throws(() => visibleTarget(inspect(target)), /positive dimensions/);
  const rosterBoundary = { roster: { rect: { x: 10, y: 20, width: 100, height: 64 }, visible: { left: 10, top: 20, right: 110, bottom: 84 }, points: [{ reachesTarget: true }] }, panel: { rect: { y: 20, height: 64 } }, toolbar: { rect: { y: 84 } } };
  usableRoster(rosterBoundary);
  let invalid = structuredClone(rosterBoundary); invalid.roster.rect.height = 63; invalid.roster.visible.bottom = 83;
  assert.throws(() => usableRoster(invalid), /less than64px/);
  invalid = structuredClone(rosterBoundary); invalid.panel.rect.y = 21; assert.throws(() => usableRoster(invalid), /starts outside panel/);
  invalid = structuredClone(rosterBoundary); invalid.panel.rect.height = 62; assert.throws(() => usableRoster(invalid), /ends outside panel/);
  invalid = structuredClone(rosterBoundary); invalid.toolbar.rect.y = 82; assert.throws(() => usableRoster(invalid), /overlaps bottom toolbar/);
  assertCases(expectedCases);
  for (const candidate of [expectedCases.slice(1), [...expectedCases, expectedCases[0]], [...expectedCases.slice(1), 'unknown']]) assert.throws(() => assertCases(candidate));
  console.log(`PASS geometry clipping/hit/zero/partial and roster-boundary negatives and exact${expectedCases.length}-case completeness; no browser/services started`);
} else await withHeroRuntime(verify);
