import assert from 'node:assert/strict';
import { withHeroRuntime } from './live_hero_layout_runtime.mjs';
import {
  inspect, visibleTarget, usableRoster, layoutSignature, hasFullVisibility,
  wheelReady, wheelPlan, targetDelta, toggleDirection, assertDirections, wheelPosition,
} from './live_hero_layout_geometry.mjs';

const expectedCases = ['default-expanded-visible-name-and-avatar', 'default-name-click', 'details-loaded', 'return-avatar-click',
  'mouse-disclosures', 'keyboard-disclosures', 'manual-expanded-detail', 'recruit-wheel', 'capture-wheel', 'roster-wheel',
  'visible-controls-tab', 'refresh-detail', 'escape-reopen'];
const assertCases = actual => assert.deepEqual([...actual].sort(), [...expectedCases].sort());
const assertFocusInside = snapshot => assert.equal(snapshot?.active?.inPanel, true, 'Observed keyboard focus escaped the open panel');
function assertManualProof(before, after) {
  for (const state of [before, after]) assert.deepEqual(state?.details, [true, true, true, true], 'Finish proof requires all four disclosures open');
}
const changedSinceProof = (proof, raster) => [raster.beforeRaster, raster.afterRaster].some(frame => layoutSignature(frame) !== layoutSignature(proof));
const regionSelectors = { recruit: '.hero-recruit-host', capture: '[data-role="hero-capture-sections-row"]', roster: '[data-role="hero-scroll"]' };
function focusSnapshot(held) {
  const root = document.querySelector('[data-center-panel="hero"]');
  const identify = node => {
    if (!node) return null;
    const ancestors = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent);
      ancestors.push({ tag: parent.tagName, id: parent.id, className: parent.className, hidden: parent.hidden, inert: parent.inert, display: css.display, visibility: css.visibility, open: 'open' in parent ? parent.open : null });
      if (parent === root) break;
    }
    const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
    return { tag: node.tagName, id: node.id, className: node.className, key: node.getAttribute('data-action') || node.getAttribute('data-field'), connected: node.isConnected, inPanel: !!root?.contains(node), tabIndex: node.tabIndex,
      own: { disabled: node.disabled, hidden: node.hidden, ariaHidden: node.getAttribute('aria-hidden'), inert: node.inert, display: css.display, visibility: css.visibility }, rects: node.getClientRects().length, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, ancestors };
  };
  // Mirror the pinned product listOverlayFocusables for observation only, never focus or activation.
  const candidates = [...(root?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])].filter(node => {
    const css = getComputedStyle(node); return node.getAttribute('aria-hidden') !== 'true' && css.visibility !== 'hidden' && css.display !== 'none';
  });
  return { at: Date.now(), active: identify(document.activeElement), held: identify(held), heldIsActive: held === document.activeElement, rootConnected: !!root?.isConnected,
    boundary: { count: candidates.length, activeIndex: candidates.indexOf(document.activeElement), first: identify(candidates[0]), last: identify(candidates.at(-1)) }, details: [...(root?.querySelectorAll('details.hero-recruit-host, details.hero-capture-info') || [])].map(node => node.open) };
}
async function verify(h) {
  const { page, panel, action, hero, report, save, responseAfter, settled, screenshot } = h;
  report.expectedCases = expectedCases; report.cases = []; report.controls = []; report.scrolls = []; report.inputs = []; report.tabObservations = [];
  const stage = phase => { report.phase = phase; save(); };
  const complete = name => { assert.ok(expectedCases.includes(name) && !report.cases.includes(name)); report.cases.push(name); save(); };
  const row = panel.locator(`li[data-hero-id="${hero}"]`), name = row.locator('.hero-list-row-primary'), avatar = row.locator('[data-role="hero-list-avatar"]');
  const details = panel.locator('details.hero-recruit-host, details.hero-capture-info');
  const frame = () => panel.evaluate(root => ({ at: Date.now(), details: [...root.querySelectorAll('details.hero-recruit-host, details.hero-capture-info')].map(node => node.open),
    regions: [...root.querySelectorAll('.hero-recruit-host, [data-role="hero-capture-sections-row"], [data-role="hero-scroll"]')].map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scrollTop: node.scrollTop }; }) }));
  async function capture(label) {
    const geometry = { label, panel: await panel.evaluate(inspect), toolbar: await page.locator('.main-city-toolbar').evaluate(inspect) };
    for (const [key, selector] of Object.entries(regionSelectors)) geometry[key] = await panel.locator(selector).evaluate(inspect);
    for (const [key, target] of [['row', row], ['name', name], ['avatar', avatar]]) geometry[key] = await target.evaluate(inspect);
    geometry.details = await details.evaluateAll(nodes => nodes.map(node => ({ open: node.open, summary: node.querySelector('summary').textContent })));
    geometry.beforeRaster = await frame(); report.geometry.push(geometry); save(); await screenshot(label);
    geometry.afterRaster = await frame(); geometry.layoutChangedDuringRaster = layoutSignature(geometry.beforeRaster) !== layoutSignature(geometry.afterRaster); save(); return geometry;
  }
  async function wheel(target, direction, label) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await settled();
      if (await target.evaluate(node => node.matches('details.hero-recruit-host') && !node.open)) await summaryInput(target, 'mouse', `${label}-open-${attempt}`);
      const before = await target.evaluate(inspect), plan = wheelPlan(before, direction);
      await page.mouse.move(plan.x, plan.y);
      const current = await target.evaluate((node, point) => ({ at: Date.now(), hit: node.contains(document.elementFromPoint(point.x, point.y)), open: 'open' in node ? node.open : null, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }), plan);
      const dispatched = wheelReady(current);
      report.inputs.push({ kind: 'wheel', label, attempt, before, ...plan, current, dispatched }); save();
      if (dispatched) { await page.mouse.wheel(0, plan.delta); return current; }
    }
    assert.fail('Three current pointer acquisitions failed; no unverified wheel input');
  }
  async function summaryInput(detail, key, label) {
    await settled(); const summary = detail.locator(':scope > summary');
    const read = node => ({ at: Date.now(), open: node.open, focused: node.querySelector('summary') === document.activeElement });
    const before = await detail.evaluate(read);
    if (key === 'mouse') await summary.click();
    else { assert.equal(before.focused, true, 'Native summary focus required'); await page.keyboard.press(key); }
    const after = await detail.evaluate(read), direction = toggleDirection(before.open, after.open);
    report.inputs.push({ kind: 'summary', label, key, before, after, direction, interrupted: direction === null }); save(); return direction;
  }
  async function detailClick(target) {
    const response = await responseAfter(() => target.click(), 'hero.v1.GetHeroDetail');
    assert.equal(response.detail.hero_id, hero); await action('hero-expr-finish').waitFor(); await settled();
  }
  stage('original default viewport and native wheel, before any fold');
  const original = await capture('default-original'); usableRoster(original);
  assert.equal(original.details.length, 4); assert.equal(original.details[0].open, true);
  for (const detail of original.details.slice(1)) assert.equal(detail.open, report.width === 1600, 'Preserve viewport-native capture defaults');
  report.initialVisibility = { name: hasFullVisibility(original.name), avatar: hasFullVisibility(original.avatar) }; save();
  let prepared = original;
  for (let attempt = 0; attempt < 6 && !(hasFullVisibility(prepared.name) && hasFullVisibility(prepared.avatar)); attempt++) {
    await settled(); const current = { roster: await panel.locator(regionSelectors.roster).evaluate(inspect), name: await name.evaluate(inspect), avatar: await avatar.evaluate(inspect) };
    const before = await wheel(panel.locator(regionSelectors.roster), targetDelta(current), `default-roster-${attempt}`);
    await page.waitForFunction(old => document.querySelector('[data-role="hero-scroll"]').scrollTop !== old, before.scrollTop);
    prepared = await capture(`default-after-native-wheel-${attempt}`); usableRoster(prepared);
    assert.deepEqual(prepared.details, original.details, 'Default disclosure states changed before first detail click');
  }
  visibleTarget(prepared.name, true); visibleTarget(prepared.avatar, true); complete('default-expanded-visible-name-and-avatar');
  await detailClick(name); complete('default-name-click');
  assert.equal(await details.first().evaluate(node => node.open), false, 'Existing detail auto-collapse must remain');
  usableRoster(await capture('default-name-detail')); complete('details-loaded');
  await action('hero-back-to-list').click(); await settled();
  const returned = await capture('native-return-before-avatar'); usableRoster(returned);
  assert.equal(returned.details[0].open, true, 'Native return must restore recruitment chrome');
  // This is returned native state, not a second virgin/default-state claim.
  await detailClick(avatar); await capture('native-return-avatar-detail'); complete('return-avatar-click');
  stage('fresh native summary transitions after real detail reads'); await settled();
  for (let i = 0; i < await details.count(); i++) {
    const detail = details.nth(i);
    for (const key of ['mouse', 'Enter', 'Space']) {
      const directions = [];
      for (let attempt = 0; attempt < 4 && new Set(directions.filter(Boolean)).size < 2; attempt++) {
        directions.push(await summaryInput(detail, key, `summary-${i}-${key}-${attempt}`));
      }
      assertDirections(directions); await capture(`summary-${i}-${key.toLowerCase()}-completed`);
    }
  }
  complete('mouse-disclosures'); complete('keyboard-disclosures');
  stage('native manually expanded detail access'); await settled();
  for (let i = 0; i < await details.count(); i++) if (!(await details.nth(i).evaluate(node => node.open))) await summaryInput(details.nth(i), 'mouse', `manual-open-${i}`);
  const expanded = await capture('manual-expanded-with-detail'); usableRoster(expanded);
  assert.ok(expanded.details.every(detail => detail.open)); assert.equal(await action('hero-expr-finish').count(), 1);
  for (let i = 0; i < await details.count(); i++) if (!(await details.nth(i).evaluate(node => node.open))) await summaryInput(details.nth(i), 'mouse', `manual-proof-reestablish-${i}`);
  report.manualDetailControl = { beforeProof: await frame() }; save();
  await action('hero-expr-finish').hover();
  Object.assign(report.manualDetailControl, { disabled: await action('hero-expr-finish').isDisabled(), geometry: await action('hero-expr-finish').evaluate(inspect), afterProof: await frame() }); save();
  assertManualProof(report.manualDetailControl.beforeProof, report.manualDetailControl.afterProof);
  visibleTarget(report.manualDetailControl.geometry, true);
  const manualRaster = await capture('manual-expanded-detail-control');
  report.manualDetailControl.rasterChangedAfterProof = changedSinceProof(report.manualDetailControl.afterProof, manualRaster); save(); complete('manual-expanded-detail');
  for (const [region, selector] of Object.entries(regionSelectors)) {
    stage(`${region}-wheel with current pointer`);
    const target = panel.locator(selector);
    await wheel(target, 'top', `${region}-prepare-top`);
    await page.waitForFunction(wheelPosition, { selector, top: true });
    const before = await target.evaluate(inspect); visibleTarget(before);
    await capture(`${region}-wheel-before`);
    const downStart = await wheel(target, 'bottom', `${region}-down`);
    await page.waitForFunction(wheelPosition, { selector, top: false, start: downStart.scrollTop });
    const end = await target.evaluate(inspect); assert.ok(end.open !== false && end.scrollTop > 1); await capture(`${region}-wheel-end`);
    if (await target.evaluate(node => node.scrollTop <= 1)) {
      const restored = await wheel(target, 'bottom', `${region}-return-restore-bottom`); await page.waitForFunction(wheelPosition, { selector, top: false, start: restored.scrollTop });
    }
    const returnStart = await wheel(target, 'top', `${region}-return`); assert.ok(returnStart.scrollTop > 1, 'Return requires genuine upward movement, not collapse reset');
    await page.waitForFunction(wheelPosition, { selector, top: true, start: returnStart.scrollTop });
    await capture(`${region}-wheel-return`);
    report.scrolls.push({ region, before, downStart, end, returnStart, returned: await target.evaluate(inspect) }); save(); complete(`${region}-wheel`);
  }
  stage('all visible controls and native Tab');
  for (let i = 0; i < await details.count(); i++) if (!(await details.nth(i).evaluate(node => node.open))) await summaryInput(details.nth(i), 'mouse', `controls-open-${i}`);
  const controlNames = ['refresh-templates', 'recruit-hero', 'refresh-hotel-candidates', 'refresh-hotel-pool', 'recruit-hotel-candidate',
    'refresh-captive-list', 'captive-summon-confirm', 'captive-release', 'refresh-persuade-targets', 'persuade-primary',
    'refresh-coming-list', 'coming-accept-confirm', 'coming-reject'];
  const expectedFocus = new Set();
  const inventory = await panel.evaluate(root => ({ at: Date.now(), open: [...root.querySelectorAll('details.hero-recruit-host, details.hero-capture-info')].map(node => node.open),
    keys: [...root.querySelectorAll('.hero-recruit-host button, .hero-recruit-host select, [data-role="hero-capture-sections-row"] button, [data-role="hero-capture-sections-row"] select')].filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').map(node => node.getAttribute('data-action') || node.getAttribute('data-field')) }));
  report.controlInventory = inventory; save(); assert.deepEqual(inventory.open, [true, true, true, true], 'Dynamic inventory requires all sections actually open');
  const visibleControlKeys = inventory.keys;
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
    const held = await page.evaluateHandle(() => document.activeElement);
    const observation = { index: n }; report.tabObservations.push(observation); save();
    try {
      observation.before = await held.evaluate(focusSnapshot); save();
      assertFocusInside(observation.before);
      await page.keyboard.press('Tab');
      observation.after = await held.evaluate(focusSnapshot); save();
      assertFocusInside(observation.after);
    } finally { await held.dispose(); }
    const closedSummary = page.locator('[data-center-panel="hero"] details:not([open]) > summary:focus');
    if (await closedSummary.count()) await summaryInput(closedSummary.locator('..'), 'Enter', `tab-open-${n}`);
    const current = await page.evaluate(() => ({ key: document.activeElement.getAttribute('data-action') || document.activeElement.getAttribute('data-field'), inPanel: !!document.activeElement.closest('[data-center-panel="hero"]') }));
    observation.guardFocus = { at: Date.now(), ...current }; save();
    assert.equal(current.inPanel, true, 'Keyboard focus escaped the open panel');
    if (expectedFocus.has(current.key) && !focused.has(current.key)) {
      const geometry = await page.locator(':focus').evaluate(inspect); visibleTarget(geometry, true);
      report.controls.find(control => control.key === current.key).focused = geometry; focused.add(current.key); save(); await capture(`focused-control-${focused.size}`);
    }
  }
  assert.deepEqual([...focused].sort(), [...expectedFocus].sort()); complete('visible-controls-tab');
  stage('real list refresh and detail');
  await responseAfter(() => action('refresh-heroes').click(), 'hero.v1.ListPlayerHeroes'); await settled();
  await detailClick(name); usableRoster(await capture('refreshed-detail')); complete('refresh-detail');
  stage('native Escape focus return and reopen');
  await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
  assert.equal(await action('toggle-hero').evaluate(node => node === document.activeElement), true, 'Escape must return toolbar focus');
  await responseAfter(() => action('toggle-hero').click(), 'hero.v1.ListPlayerHeroes'); await settled();
  await detailClick(name); usableRoster(await capture('escape-reopened-detail')); complete('escape-reopen');
  assertCases(report.cases); save();
}
if (process.argv.includes('--self-test')) {
  const root = { isConnected: true, contains: node => node.inside, querySelectorAll: selector => selector.startsWith('details.') ? [{ open: true }, { open: false }] : candidates };
  const sample = (key, extra = {}) => ({ tagName: 'BUTTON', id: key, className: '', inside: true, isConnected: true, tabIndex: 0, disabled: false, hidden: false, inert: false, getAttribute: name => name === 'data-action' ? key : null, getBoundingClientRect: () => ({ x: 0, y: 0, width: 20, height: 20 }), getClientRects: () => [{}], ...extra });
  const first = sample('first'), last = sample('hidden-descendant', { getClientRects: () => [], parentElement: { tagName: 'DETAILS', open: false, parentElement: root, css: { display: 'block', visibility: 'visible' } } });
  const excluded = sample('excluded', { getAttribute: name => name === 'aria-hidden' ? 'true' : null });
  let candidates = [first, last, excluded, sample('display-none', { css: { display: 'none', visibility: 'visible' } }), sample('visibility-hidden', { css: { display: 'block', visibility: 'hidden' } })];
  globalThis.document = { activeElement: first, querySelector: () => root }; globalThis.getComputedStyle = node => node.css || { display: 'block', visibility: 'visible' };
  let observation = focusSnapshot(first); assert.equal(observation.heldIsActive, true); assert.equal(observation.active.inPanel, true); assert.equal(observation.boundary.count, 2);
  assertFocusInside(observation);
  assert.deepEqual(observation.active.own, { disabled: false, hidden: false, ariaHidden: null, inert: false, display: 'block', visibility: 'visible' });
  assert.equal(observation.boundary.last.key, 'hidden-descendant'); assert.equal(observation.boundary.last.rects, 0); assert.equal(observation.boundary.last.ancestors[0].open, false); assert.deepEqual(observation.details, [true, false]);
  first.isConnected = false; first.inside = false; candidates = [last, excluded]; document.activeElement = sample('outside', { inside: false }); observation = focusSnapshot(first);
  assert.equal(observation.heldIsActive, false);
  assert.throws(() => assertFocusInside(observation));
  assert.equal(observation.held.connected, false); assert.equal(observation.active.inPanel, false); assert.equal(observation.boundary.activeIndex, -1);
  document.querySelector = () => null; observation = focusSnapshot(first); assert.equal(observation.rootConnected, false); assert.equal(observation.boundary.count, 0);
  for (const absent of [undefined, null, {}, { active: null }, { active: {} }]) assert.throws(() => assertFocusInside(absent));
  const open = { at: 1, details: [true, true, true, true] }; assertManualProof(open, open);
  for (let phase = 0; phase < 2; phase++) for (let index = 0; index < 4; index++) {
    const states = [structuredClone(open), structuredClone(open)]; states[phase].details[index] = false; assert.throws(() => assertManualProof(...states));
  }
  for (const missing of [undefined, {}, { details: [] }]) { assert.throws(() => assertManualProof(missing, open)); assert.throws(() => assertManualProof(open, missing)); }
  const raster = { beforeRaster: { ...open, at: 2 }, afterRaster: { ...open, at: 3 } }; assert.equal(changedSinceProof(open, raster), false);
  raster.afterRaster = { at: 4, details: [false, true, true, true] }; assert.equal(changedSinceProof(open, raster), true);
  assertCases(expectedCases);
  for (const candidate of [expectedCases.slice(1), [...expectedCases, expectedCases[0]], [...expectedCases.slice(1), 'unknown']]) assert.throws(() => assertCases(candidate));
  console.log(`PASS exact${expectedCases.length}-case completeness; no browser/services started`);
} else await withHeroRuntime(verify);
