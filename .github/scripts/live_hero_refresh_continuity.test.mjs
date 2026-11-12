import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture } from './live_hero_refresh_assertions.test.mjs';
import { observeRefresh, installRowWitness } from './live_hero_refresh_continuity.mjs';
const { JSDOM } = createRequire(new URL('./package.json', import.meta.url))('jsdom');
function harness(variant, failing = '') {
  const f = fixture(variant), calls = [], requests = structuredClone(f.requestRows.slice(0, 1));
  const phase = { cursor: f.cursor, windowStart: f.windowStart, rows: [], after: [], events: null };
  let rowIndex = 0, timeIndex = 0;
  const step = (name, result) => async () => { calls.push(name); if (name === failing) throw Error(name); return result(); };
  const io = { phase, requests, save: () => calls.push('save'), now: () => [11, 14][timeIndex++],
    readBefore: step('before', () => f.before), retainRow: step('retain', () => {}), readRow: step('row', () => f.rows[rowIndex++]),
    responseAfter: async (action, route) => { calls.push('poll'); assert.equal(route, 'domestic.v1.GetCityState'); await action();
      requests.push(...structuredClone(f.requestRows.slice(1))); if (failing === 'poll') throw Error('poll'); return requests[failing === 'later' ? 2 : 1]; },
    awaitReplacement: step('replacement', () => {}), settled: step('settled', () => {}), clock: step('clock', () => f.settled),
    samples: step('samples', () => f.after), readEvents: step('events', () => ({ events: f.events, eventsEnd: f.eventsEnd })),
    disposeRow: step('dispose', () => {}) };
  return { io, calls, f };
}
let positives = 0, negatives = 0;
for (const variant of ['baseline', 'fixed']) {
  const h = harness(variant); await observeRefresh(h.io, variant, 7); positives++;
  assert.equal(h.calls.filter(c => c === 'poll').length, 1); assert.equal(h.calls.at(-1), 'dispose');
  for (const failing of ['before', 'retain', 'row', 'poll', 'later', 'replacement', 'settled', 'clock', 'samples', 'events', 'dispose']) {
    const h = harness(variant, failing); await assert.rejects(observeRefresh(h.io, variant, 7)); negatives++;
    assert.ok(h.calls.includes('dispose')); assert.deepEqual(h.io.phase.requestRows, h.io.requests);
    assert.ok(h.calls.filter(c => c === 'poll').length <= 1);
    if (failing === 'later') assert.ok(!h.calls.includes('replacement'));
  }
  for (const change of [h => { h.f.before.active.tag = 'BODY'; }, h => { h.f.before.active.inPanel = false; },
    h => { h.f.before.active.connected = false; }, h => { delete h.f.before.geometry; }, h => { delete h.io.requests[0].code; delete h.io.requests[0].receivedAt; }]) {
    const h = harness(variant); change(h); await assert.rejects(observeRefresh(h.io, variant, 7)); negatives++;
    assert.ok(!h.calls.includes('poll')); assert.ok(h.calls.includes('dispose')); assert.ok(h.io.phase.before);
  }
}
for (const variant of ['baseline', 'fixed']) {
  const h = harness(variant); delete h.f.after[1].geometry;
  await assert.rejects(observeRefresh(h.io, variant, 7)); negatives++;
  assert.equal(h.calls.filter(c => c === 'poll').length, 1); assert.ok(h.io.phase.events && h.io.phase.requestRows); assert.equal(h.calls.at(-1), 'dispose');
}
const dom = new JSDOM('<ul data-role="hero-scroll"><li data-hero-id="7"></li></ul>', { runScripts: 'outside-only' });
const old = dom.window.document.querySelector('li');
const witness = dom.window.eval(`(${installRowWitness.toString()})`)(old, 7), before = witness.snapshot();
assert.equal(before.original.id, before.replacement.id); assert.equal(witness.detached(), false);
old.outerHTML = '<li data-hero-id="7"></li>';
const after = witness.snapshot(); assert.equal(witness.detached(), true); assert.equal(after.original.id, before.original.id);
assert.notEqual(after.replacement.id, before.original.id); assert.ok(after.replacement.ancestorIds.includes(after.roster.id));
dom.window.close(); console.log(JSON.stringify({ passed: true, nativeWrapperFixtures: positives, injectedFailures: negatives, rawIdentityFixture: 1 }));
