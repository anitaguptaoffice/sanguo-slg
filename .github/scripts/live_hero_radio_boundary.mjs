import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withHeroRuntime } from './live_hero_layout_runtime.mjs';
import { inspect, visibleTarget, hasFullVisibility, wheelPlan, wheelReady, targetDelta } from './live_hero_layout_geometry.mjs';
import { installRadioObserver, validateRadioTrial, validateCompletion } from './live_hero_radio_observer.mjs';

const panelSelector = '[data-center-panel="hero"]';
const rosterSelector = '[data-role="hero-scroll"]';
const variants = ['baseline', 'fixed'];
const trialOrder = variant => [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => [index, direction]));
function assertOrder(trials, variant) {
  assert.ok(variants.includes(variant));
  assert.deepEqual(trials.map(t => [t.index, t.direction]), trialOrder(variant));
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
          const before = await observer.evaluate(o => o.snapshot());
          const cursor = await observer.evaluate(o => o.readEvents().events.length);
          const trial = { index, direction, before, after: [], events: null }; radio.trials.push(trial); save();
          await page.keyboard.press('Tab');
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
  console.log('PASS exact native trial ordering; no browser or services started');
} else await withHeroRuntime(verify);
