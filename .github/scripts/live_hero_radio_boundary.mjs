import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withHeroRuntime } from './live_hero_layout_runtime.mjs';
import { inspect, visibleTarget, hasFullVisibility, wheelPlan, wheelReady, targetDelta } from './live_hero_layout_geometry.mjs';
import { installRadioObserver, validateRadioPrecondition, validateRadioTrial, validateCompletion } from './live_hero_radio_observer.mjs';

const panelSelector = '[data-center-panel="hero"]';
const rosterSelector = '[data-role="hero-scroll"]';
const variants = ['baseline', 'fixed'];
const trialOrder = variant => [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => [index, direction]));
function assertOrder(trials, variant) {
  assert.ok(variants.includes(variant));
  assert.deepEqual(trials.map(t => [t.index, t.direction]), trialOrder(variant));
}
async function dispatchTab(trial, variant, dispatch) {
  validateRadioPrecondition(trial.before, { variant, direction: trial.direction });
  return dispatch();
}
async function verify(h) {
  const { page, panel, hero, report, save, settled, responseAfter, screenshot } = h;
  const variant = process.env.QA_VARIANT;
  assert.ok(variants.includes(variant)); assert.equal(process.env.QA_PRODUCT, 'standalone');
  const provenance = JSON.parse(readFileSync(process.env.QA_PROVENANCE, 'utf8'));
  assert.equal(provenance.product.head, report.productHead); assert.equal(provenance.product.tree, report.tree);
  assert.deepEqual(provenance.product.parents, report.parents.split(' '));
  assert.equal(provenance.qa.head, report.qaHead); assert.equal(provenance.runtime.head, report.runtimeHead);
  const radio = report.radio = { schema: 1, variant, viewport: { width: report.width, height: report.height }, provenance, trials: [], complete: false };
  report.radioInputs = []; report.radioGeometry = []; report.radioRasters = [];
  const roster = panel.locator(rosterSelector), row = panel.locator(`li[data-hero-id="${hero}"]`);
  const gold = panel.locator('input[data-action="hero-largess-kind"][value="gold"]');
  const item = panel.locator('input[data-action="hero-largess-kind"][value="item"]');
  let observer;
  const stage = value => { report.phase = value; save(); };
  async function wheel(delta, label) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await settled();
      const geometry = await roster.evaluate(inspect), plan = wheelPlan(geometry, delta);
      await page.mouse.move(plan.x, plan.y);
      const current = await roster.evaluate((node, point) => ({ at: Date.now(), hit: node.contains(document.elementFromPoint(point.x, point.y)),
        open: null, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }), plan);
      const dispatched = wheelReady(current);
      report.radioInputs.push({ kind: 'wheel', label, attempt, geometry, plan, current, dispatched }); save();
      if (!dispatched) continue;
      await page.mouse.wheel(0, plan.delta);
      await page.waitForFunction(({ selector, start }) => document.querySelector(selector).scrollTop !== start, { selector: rosterSelector, start: current.scrollTop });
      return;
    }
    assert.fail('Three current hit acquisitions failed; no unverified wheel');
  }
  async function reach(first, second, label) {
    for (let attempt = 0; attempt <= 6; attempt++) {
      await settled();
      const geometry = { label, attempt, roster: await roster.evaluate(inspect), name: await first.evaluate(inspect), avatar: await second.evaluate(inspect) };
      report.radioGeometry.push(geometry); save();
      if (hasFullVisibility(geometry.name) && hasFullVisibility(geometry.avatar)) return geometry;
      assert.ok(attempt < 6, 'Six native roster wheels did not reach both targets');
      await wheel(targetDelta(geometry), `${label}-${attempt}`);
    }
  }
  async function click(target, label) {
    const geometry = await target.evaluate(inspect); visibleTarget(geometry, true);
    report.radioInputs.push({ kind: 'click', label, geometry }); save();
    await target.click();
  }
  async function capture(label, heldId = null) {
    const before = await observer.evaluate((o, id) => o.snapshot(id), heldId);
    const geometry = { gold: await gold.evaluate(inspect), item: await item.evaluate(inspect), roster: await roster.evaluate(inspect) };
    const entry = { label, before, geometry }; report.radioRasters.push(entry); save();
    await screenshot(label);
    entry.after = await observer.evaluate((o, id) => o.snapshot(id), heldId); save();
  }
  stage('native actual hero detail entry');
  await reach(row.locator('.hero-list-row-primary'), row.locator('[data-role="hero-list-avatar"]'), 'detail-entry');
  const detail = await responseAfter(() => click(row.locator('.hero-list-row-primary'), 'actual-name'), 'hero.v1.GetHeroDetail');
  assert.equal(detail.detail.hero_id, hero); await gold.waitFor(); await settled();
  observer = await page.evaluateHandle(installRadioObserver, { panelSelector, maxEvents: 256 });
  try {
    for (let index = 1; index <= 3; index++) {
      stage(`radio boundary trial ${index}`);
      await reach(gold, item, `radio-${index}`);
      assert.equal(await gold.isChecked(), true); assert.equal(await item.isChecked(), false);
      assert.equal(await panel.locator('[data-action="hero-largess-submit"]').isDisabled(), true);
      await click(gold, `checked-gold-${index}`); await settled();
      for (const direction of variant === 'fixed' ? ['forward', 'reverse'] : ['forward']) {
        await capture(`trial-${index}-${direction}-before`);
        const reverse = direction === 'reverse';
        if (reverse) await page.keyboard.down('Shift');
        try {
          const { before, cursor } = await observer.evaluate(o => ({ cursor: o.readEvents().events.length, before: o.snapshot() }));
          const trial = { index, direction, before, after: [], events: null }; radio.trials.push(trial); save();
          await dispatchTab(trial, variant, () => page.keyboard.press('Tab'));
          trial.after = await observer.evaluate(async (o, heldId) => {
            const frames = [o.snapshot(heldId)];
            for (let i = 0; i < 2; i++) { await new Promise(requestAnimationFrame); frames.push(o.snapshot(heldId)); }
            return frames;
          }, before.active.id);
          trial.events = await observer.evaluate((o, start) => { const read = o.readEvents(); return { events: read.events.slice(start), overflow: read.overflow }; }, cursor);
          save(); validateRadioTrial(trial, { variant, direction });
          await capture(`trial-${index}-${direction}-after`, before.active.id);
          await settled();
          await capture(`trial-${index}-${direction}-settled`, before.active.id);
        } finally { if (reverse) await page.keyboard.up('Shift'); }
      }
    }
    assertOrder(radio.trials, variant); radio.complete = true; save();
    validateCompletion(radio, { variant, width: report.width, provenance });
  } finally {
    report.radioObserverEvents = await observer.evaluate(o => o.readEvents()); save();
    await observer.evaluate(o => o.dispose()); await observer.dispose();
  }
}
if (process.argv.includes('--self-test')) {
  for (const variant of variants) {
    const valid = trialOrder(variant).map(([index, direction]) => ({ index, direction }));
    assertOrder(valid, variant);
    for (const wrong of [valid.slice(1), [...valid, valid[0]], [...valid].reverse(), [...valid.slice(1), { index: 4, direction: 'forward' }]]) assert.throws(() => assertOrder(wrong, variant));
  }
  assert.throws(() => assertOrder([], 'unknown'));
  const descriptor = (id, extra = {}) => ({ id, tag: 'INPUT', type: 'radio', name: 'hero-largess-kind', value: 'gold', checked: true,
    disabled: false, effectiveDisabled: false, tabIndex: 0, formId: null, scopeId: 1, connected: true, inPanel: true,
    rect: { x: 10, y: 10, width: 20, height: 20 }, ancestors: [],
    own: { hidden: false, inert: false, ariaHidden: null, display: 'block', visibility: 'visible', open: null }, ...extra });
  const first = descriptor(2, { tag: 'BUTTON', type: 'button', name: '', value: '', checked: false });
  const gold = descriptor(3), item = descriptor(4, { value: 'item', checked: false });
  const before = direction => structuredClone({ schema: 1, at: 1, mono: 1, rootId: 5, overflow: false,
    active: structuredClone(direction === 'forward' ? gold : first), held: null, candidates: [first, gold, item],
    eligibleIds: [2, 3, 4], intendedIds: [2, 3], details: [], submit: descriptor(6, { tag: 'BUTTON', type: 'button', disabled: true, effectiveDisabled: true }) });
  const invalid = [
    b => { b.active = descriptor(99, { tag: 'BODY', type: '', inPanel: false }); },
    b => { b.active.inPanel = false; },
    b => { b.active.connected = false; },
    b => { b.active.id = 98; },
    b => { b.active.rect.width = 0; },
    b => { b.active.own.visibility = 'hidden'; },
    b => { b.candidates[1].checked = false; },
    b => { b.candidates[2].formId = 99; },
    b => { b.submit.disabled = false; },
    b => { b.overflow = true; },
  ];
  for (const [variant, direction] of [['baseline', 'forward'], ['fixed', 'forward'], ['fixed', 'reverse']]) {
    let dispatched = 0;
    const dispatch = () => { dispatched++; return 'native-dispatch'; };
    assert.equal(await dispatchTab({ before: before(direction), direction }, variant, dispatch), 'native-dispatch');
    assert.equal(dispatched, 1);
    for (const change of invalid) {
      const value = before(direction); change(value); dispatched = 0;
      await assert.rejects(() => dispatchTab({ before: value, direction }, variant, dispatch));
      assert.equal(dispatched, 0, 'Invalid immediate before must never call native Tab');
    }
  }
  console.log('PASS exact trial ordering and production dispatch guard: 3 valid paths, 30 zero-input negatives; no browser/services');
} else await withHeroRuntime(verify);
