import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withHeroRuntime } from './live_hero_layout_runtime.mjs';
import { inspect, visibleTarget, hasFullVisibility, wheelPlan, wheelReady, targetDelta } from './live_hero_layout_geometry.mjs';
import { installRadioObserver } from './live_hero_radio_observer.mjs';
import { correlateCity, validateBefore, validateRefresh, validateCompletion } from './live_hero_refresh_assertions.mjs';

const panelSelector = '[data-center-panel="hero"]';
const rosterSelector = '[data-role="hero-scroll"]';
const variants = ['baseline', 'fixed'];
const cityRoute = 'domestic.v1.GetCityState';

async function verify(h) {
  const { page, panel, hero, report, save, settled, responseAfter, screenshot } = h;
  const variant = process.env.QA_VARIANT;
  assert.ok(variants.includes(variant)); assert.equal(process.env.QA_PRODUCT, 'standalone');
  const provenance = JSON.parse(readFileSync(process.env.QA_PROVENANCE, 'utf8'));
  assert.equal(provenance.product.head, report.productHead); assert.equal(provenance.product.tree, report.tree);
  assert.deepEqual(provenance.product.parents, report.parents.split(' '));
  assert.equal(provenance.qa.head, report.qaHead); assert.equal(provenance.runtime.head, report.runtimeHead);
  const evidence = report.refresh = { schema: 1, variant, hero, viewport: { width: report.width, height: report.height }, provenance, complete: false };
  report.refreshInputs = []; report.refreshGeometry = []; report.refreshRasters = [];
  const roster = panel.locator(rosterSelector), row = panel.locator(`li[data-hero-id="${hero}"]`);
  const gold = panel.locator('input[data-action="hero-largess-kind"][value="gold"]');
  const item = panel.locator('input[data-action="hero-largess-kind"][value="item"]');
  let observer, rows;
  const stage = value => { report.phase = value; save(); };
  const samples = heldId => observer.evaluate(async (o, id) => {
    const frames = [o.snapshot(id)];
    for (let i = 0; i < 2; i++) { await new Promise(requestAnimationFrame); frames.push(o.snapshot(id)); }
    return frames;
  }, heldId);
  async function wheel(delta, label) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await settled();
      const geometry = await roster.evaluate(inspect), plan = wheelPlan(geometry, delta);
      await page.mouse.move(plan.x, plan.y);
      const current = await roster.evaluate((node, point) => ({ at: Date.now(), hit: node.contains(document.elementFromPoint(point.x, point.y)),
        open: null, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }), plan);
      const dispatched = wheelReady(current);
      report.refreshInputs.push({ kind: 'wheel', label, attempt, geometry, plan, current, dispatched }); save();
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
      report.refreshGeometry.push(geometry); save();
      if (hasFullVisibility(geometry.name) && hasFullVisibility(geometry.avatar)) return geometry;
      assert.ok(attempt < 6, 'Six native roster wheels did not reach both targets');
      await wheel(targetDelta(geometry), `${label}-${attempt}`);
    }
  }
  async function click(target, label) {
    const geometry = await target.evaluate(inspect); visibleTarget(geometry, true);
    report.refreshInputs.push({ kind: 'click', label, geometry }); save();
    await target.click();
  }
  async function capture(label, heldId = null) {
    const before = await observer.evaluate((o, id) => o.snapshot(id), heldId);
    const geometry = { gold: await gold.evaluate(inspect), item: await item.evaluate(inspect), roster: await roster.evaluate(inspect) };
    const entry = { label, before, geometry }; report.refreshRasters.push(entry); save();
    await screenshot(label);
    entry.after = await observer.evaluate((o, id) => o.snapshot(id), heldId); save();
  }
  stage('native actual hero detail entry');
  await reach(row.locator('.hero-list-row-primary'), row.locator('[data-role="hero-list-avatar"]'), 'detail-entry');
  const detail = await responseAfter(() => click(row.locator('.hero-list-row-primary'), 'actual-name'), 'hero.v1.GetHeroDetail');
  assert.equal(detail.detail.hero_id, hero); await gold.waitFor(); await settled();
  observer = await page.evaluateHandle(installRadioObserver, { panelSelector, maxEvents: 256 });
  try {
    stage('observe one natural refresh without input');
    await reach(gold, item, 'natural-refresh');
    assert.equal(await gold.isChecked(), true); assert.equal(await item.isChecked(), false);
    assert.equal(await panel.locator('[data-action="hero-largess-submit"]').isDisabled(), true);
    await click(gold, 'natural-refresh-checked-gold');
    const begin = await observer.evaluate(o => ({ cursor: o.readEvents().events.length, windowStart: { at: Date.now(), mono: performance.now() } }));
    const phase = evidence.refresh = { ...begin, before: null, after: [], rows: [], events: null }; save();
    try {
      await settled(); await capture('natural-refresh-before');
      await observeRefresh({ phase, requests: report.requests, save, now: Date.now, responseAfter, settled,
        readBefore: () => observer.evaluate(o => o.snapshot()),
        retainRow: async () => { rows = await row.evaluateHandle(installRowWitness, hero); },
        readRow: () => rows.evaluate(o => o.snapshot()),
        awaitReplacement: async () => { const handle = await page.waitForFunction(o => o.detached(), rows); await handle.dispose(); },
        clock: () => observer.evaluate(() => ({ at: Date.now(), mono: performance.now() })), samples,
        readEvents: () => observer.evaluate((o, start) => {
          const read = o.readEvents();
          return { events: { events: read.events.slice(start), overflow: read.overflow }, eventsEnd: { at: Date.now(), mono: performance.now() } };
        }, phase.cursor), disposeRow: async () => { await rows?.dispose(); }
      }, variant, hero);
      await capture('natural-refresh-after', phase.before.active.id);
      evidence.complete = true; save(); validateCompletion(evidence, { variant, width: report.width, provenance });
    } finally { save(); }
  } finally {
    report.refreshObserverEvents = await observer.evaluate(o => o.readEvents()); save();
    await observer.evaluate(o => o.dispose()); await observer.dispose();
  }
}
// Independent DOM identity registry; retained references never write product state.
export function installRowWitness(original, hero) {
  const identities = new WeakMap(); let nextId = 1;
  const id = node => {
    if (!node) return null;
    if (!identities.has(node)) identities.set(node, nextId++);
    return identities.get(node);
  };
  const describe = node => {
    if (!node) return null;
    const ancestorIds = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) ancestorIds.push(id(parent));
    return { id: id(node), tag: node.tagName, hero: node.getAttribute('data-hero-id'), role: node.getAttribute('data-role'),
      connected: node.isConnected, parentId: id(node.parentElement), ancestorIds };
  };
  return { detached: () => !original.isConnected, snapshot: () => {
    const roster = document.querySelector('[data-role="hero-scroll"]');
    return { at: Date.now(), mono: performance.now(), original: describe(original), roster: describe(roster),
      replacement: describe(roster?.querySelector(`li[data-hero-id="${hero}"]`)) };
  } };
}
export async function observeRefresh(io, variant, hero) {
  const { phase, requests, save } = io;
  try {
    phase.before = await io.readBefore(); save(); validateBefore(phase.before);
    await io.retainRow(); phase.rows.push(await io.readRow()); save();
    phase.arm = { count: requests.length, lastId: requests.at(-1)?.id, at: io.now(),
      pendingCityIds: requests.filter(row => row.route === cityRoute && row.code === undefined).map(row => row.id) };
    save(); assert.deepEqual(phase.arm.pendingCityIds, []);
    const response = await io.responseAfter(() => {}, cityRoute);
    phase.response = { id: response.id, sentAt: response.sentAt, receivedAt: response.receivedAt, returnedAt: io.now() }; save();
    correlateCity(phase.arm, requests, response, phase.response.returnedAt);
    await io.awaitReplacement(); phase.rows.push(await io.readRow()); save();
    await io.settled(); phase.settled = await io.clock(); phase.after = await io.samples(phase.before.active.id);
    Object.assign(phase, await io.readEvents()); phase.requestRows = structuredClone(requests); save();
    validateRefresh(phase, variant, hero);
  } finally {
    try { if (!phase.events) Object.assign(phase, await io.readEvents()); }
    finally { phase.requestRows = structuredClone(requests); save(); await io.disposeRow(); }
  }
}
if (process.argv.includes('--native')) await withHeroRuntime(verify);
