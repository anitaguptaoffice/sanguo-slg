import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installRadioObserver, validateRadioTrial, validateCompletion } from './live_hero_radio_observer.mjs';
const { JSDOM } = createRequire(new URL('../../client/package.json', import.meta.url))('jsdom');
const clone = value => JSON.parse(JSON.stringify(value));
const html = '<section id="panel"><button id="first">first</button><input type="radio" name="hero-largess-kind" value="gold" checked><input type="radio" name="hero-largess-kind" value="item"><button data-action="hero-largess-submit" disabled>submit</button></section>';
function fixture(limit = 256) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.structuredClone = clone;
  // Layout is synthetic only here; these observer tests never establish native hit/traversal.
  w.Element.prototype.getBoundingClientRect = () => ({ x: 1, y: 2, width: 20, height: 10 });
  const observer = w.eval(`(${installRadioObserver.toString()})`)({ panelSelector: '#panel', maxEvents: limit });
  const gold = w.document.querySelector('[value="gold"]'), item = w.document.querySelector('[value="item"]'), first = w.document.querySelector('#first');
  return { dom, w, observer, gold, item, first };
}
assert.throws(() => fixture(0), /Invalid event budget/);
const live = fixture();
const { w, observer, gold, item, first } = live;
const originalHTML = w.document.body.innerHTML;
gold.focus();
const before = clone(observer.snapshot()), heldId = before.active.id;
assert.equal(before.candidates.length, 3);
assert.deepEqual(before.intendedIds, [before.candidates[0].id, heldId]);
assert.equal(before.candidates[1].checked, true);
assert.equal(before.candidates[2].checked, false);
assert.equal(before.submit.disabled, true);
assert.equal(before.candidates[1].formId, null);
assert.equal(before.candidates[1].scopeId, before.candidates[2].scopeId);
const handler = event => { if (event.key === 'Tab') { event.preventDefault(); first.focus(); } };
let earlyRead;
w.document.addEventListener('keydown', () => { earlyRead = observer.readEvents().events.find(e => e.type === 'keydown'); }, true);
w.document.addEventListener('keydown', handler, true);
const start = observer.readEvents().events.length;
gold.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
await Promise.resolve();
const captured = observer.readEvents().events.slice(start), key = captured.find(e => e.type === 'keydown');
assert.equal(earlyRead.final, null, 'in-dispatch observation must not claim final');
assert.equal(key.final.phase, 0); assert.equal(key.captureCheckpoint.phase, 0);
assert.equal(key.captureCheckpoint.active.id, before.candidates[0].id);
assert.equal(key.initialPrevented, false);
assert.equal(key.final.prevented, true);
assert.equal(key.active.id, heldId);
assert.equal(key.final.active.id, before.candidates[0].id);
assert.equal(key.trusted, false, 'offline synthetic event must never become native evidence');
assert.deepEqual(captured.map(e => e.type), ['keydown', 'focusout', 'focusin']);
assert.equal(observer.snapshot(heldId).held.id, heldId);
assert.equal(w.document.body.innerHTML, originalHTML, 'observer must not write DOM');
const readCopy = observer.readEvents(); readCopy.events.length = 0;
assert.ok(observer.readEvents().events.length > 0, 'read must return independent copy');
for (const type of ['input', 'change']) gold.dispatchEvent(new w.Event(type, { bubbles: true }));
assert.deepEqual(observer.readEvents().events.slice(-2).map(e => e.type), ['input', 'change']);
const replacement = gold.cloneNode(true); gold.replaceWith(replacement);
assert.equal(observer.snapshot(heldId).held.connected, false);
assert.notEqual(observer.snapshot().candidates[1].id, heldId);
observer.dispose();
const count = observer.readEvents().events.length;
item.dispatchEvent(new w.Event('change', { bubbles: true }));
assert.equal(observer.readEvents().events.length, count);
assert.throws(() => observer.snapshot(), /disposed/); w.close();
const small = fixture(1); small.gold.focus(); small.item.focus();
assert.equal(small.observer.readEvents().overflow, true); assert.equal(small.observer.readEvents().events.length, 1);
small.observer.dispose(); small.w.close();

// Exercise actual descriptor/group projection against form ownership and eligibility.
const grouping = fixture(), d = grouping.w.document;
d.querySelector('#panel').insertAdjacentHTML('beforeend', '<form id="a"><input type="radio" name="same" checked></form><form id="b"><input type="radio" name="same" checked></form><details><summary>S</summary><input type="radio" name="closed" checked></details><fieldset disabled><input type="radio" name="disabled" checked></fieldset><input type="radio" name="hidden" hidden checked>');
const observed = clone(grouping.observer.snapshot());
const formRadios = observed.candidates.filter(n => n.name === 'same');
assert.equal(formRadios.length, 2); assert.notEqual(formRadios[0].formId, formRadios[1].formId);
assert.ok(formRadios.every(n => observed.intendedIds.includes(n.id)));
for (const name of ['closed', 'disabled', 'hidden']) {
  const n = observed.candidates.find(n => n.name === name);
  if (n) assert.ok(!observed.eligibleIds.includes(n.id));
}
const closed = observed.candidates.find(n => n.name === 'closed');
assert.ok(closed.ancestors.some(a => a.tag === 'DETAILS' && a.open === false && a.inSummary === false));
grouping.item.checked = true;
const changed = clone(grouping.observer.snapshot());
assert.equal(changed.candidates.find(n => n.value === 'gold').checked, false);
assert.ok(changed.intendedIds.includes(changed.candidates.find(n => n.value === 'item').id));
const prior = grouping.observer.readEvents().events.length;
grouping.item.dispatchEvent(new grouping.w.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
await Promise.resolve();
assert.equal(grouping.observer.readEvents().events[prior].final.prevented, false);
grouping.observer.dispose(); grouping.w.close();

// Validator fixtures derive real installed-observer records. Trusted=true below is
// an explicit test-data mutation, never a claim that JSDOM generated trusted input.
function trial(variant = 'fixed', direction = 'forward') {
  const f = fixture(), { w, observer, gold, first } = f;
  const original = direction === 'forward' ? gold : first;
  original.focus();
  const before = clone(observer.snapshot()), heldId = before.active.id;
  const expected = direction === 'forward' ? first : gold;
  if (variant === 'fixed') expected.focus(); else original.blur();
  const after = [0, 1, 2].map(() => clone(observer.snapshot(heldId)));
  const originalNode = clone(before.active);
  const event = { id: 1, type: 'keydown', phase: 1, at: 2, mono: 2, trusted: true, target: originalNode, active: originalNode, key: 'Tab', code: 'Tab', shift: direction === 'reverse', alt: false, ctrl: false, meta: false,
    initialPrevented: false, captureCheckpoint: { at: 2.5, mono: 2.5, phase: 1, prevented: false, active: originalNode }, final: { at: 3, mono: 3, phase: 0, prevented: variant === 'fixed', active: clone(after[0].active) } };
  Object.assign(before, { at: 1, mono: 1 }); after.forEach((s, i) => Object.assign(s, { at: 4 + i, mono: 4 + i }));
  observer.dispose(); w.close();
  return { index: 1, direction, before, after, events: { events: [event, { id: 2, type: 'focusout', at: 3, mono: 3, trusted: true, target: originalNode, active: clone(after[0].active) }, ...(variant === 'fixed' ? [{ id: 3, type: 'focusin', at: 3, mono: 3, trusted: true, target: clone(after[0].active), active: clone(after[0].active) }] : [])], overflow: false } };
}
for (const [variant, direction] of [['baseline', 'forward'], ['fixed', 'forward'], ['fixed', 'reverse']]) validateRadioTrial(trial(variant, direction), { variant, direction });
const mutations = [
  t => delete t.before.active.checked,
  t => delete t.before.candidates[1].formId,
  t => delete t.before.candidates[1].effectiveDisabled,
  t => { t.before.eligibleIds.length = 0; },
  t => delete t.before.candidates[1].scopeId,
  t => { t.before.candidates[1].checked = false; },
  t => { t.before.candidates[2].checked = true; },
  t => { t.before.candidates[2].name = 'different'; },
  t => { t.before.candidates[2].formId = 999; },
  t => { t.before.candidates[2].scopeId = 999; },
  t => { t.before.candidates[1].disabled = true; },
  t => { t.before.candidates[1].own.display = 'none'; },
  t => { t.before.candidates[1].ancestors[0].hidden = true; },
  t => { t.before.candidates[1].rect.width = 0; },
  t => { t.before.submit.disabled = false; },
  t => { t.before.intendedIds = [t.before.intendedIds.at(-1)]; },
  t => { t.before.candidates.reverse(); },
  t => { t.events.overflow = true; },
  t => { t.before.overflow = true; },
  t => { t.events.events[0].trusted = false; },
  t => { t.events.events[0].phase = 0; },
  t => { t.events.events[1].mono = 99; },
  t => { t.events.events[0].key = 'Enter'; },
  t => { t.events.events[0].code = 'Enter'; },
  t => { t.events.events[0].shift = true; },
  t => { t.events.events[0].alt = true; },
  t => { t.events.events[0].target.id = 999; },
  t => { t.events.events[0].initialPrevented = true; },
  t => { t.events.events[0].final = null; },
  t => { t.events.events[0].captureCheckpoint = null; },
  t => { t.events.events[0].captureCheckpoint.active = null; },
  t => delete t.events.events[0].captureCheckpoint.active.connected,
  t => { t.events.events[0].captureCheckpoint.mono = 99; },
  t => { t.events.events[0].captureCheckpoint.phase = 9; },
  t => { t.events.events[0].final.phase = 1; },
  t => { t.events.events[0].final.prevented = false; },
  t => { t.events.events[0].final.mono = 99; },
  t => { t.events.events.push(clone(t.events.events[0])); },
  t => { t.events.events.length = 0; },
  t => { t.events.events[1].type = 'change'; },
  t => { t.events.events[1].target.id = 999; },
  t => { t.events.events[2].target.id = 999; },
  t => { t.events.events[0].final.active.id = 999; },
  t => { t.after.length = 2; },
  t => { t.after[2].held.connected = false; },
  t => { t.after[2].held.id = 999; },
  t => { t.after[2].rootId = 999; },
  t => { t.after[2].active.inPanel = false; },
  t => { t.after[2].active.id = 999; },
  t => { t.after[2].candidates[2].id = 999; },
  t => { t.after[2].details.push({ id: 888, open: false }); },
  t => { t.after[2].mono = 0; },
];
mutations.forEach((change, index) => { const value = trial(); change(value); assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }), `negative ${index}`); });
for (const change of [t => { t.after[2].active.inPanel = true; }, t => { t.after[2].active.tag = 'INPUT'; }, t => { t.events.events[0].final.prevented = true; }]) {
  const value = trial('baseline'); change(value); assert.throws(() => validateRadioTrial(value, { variant: 'baseline', direction: 'forward' }));
}
const provenance = Object.fromEntries(['qa', 'observer', 'runtime', 'geometry', 'product'].map(name => [name, { head: 'a'.repeat(40), tree: 'b'.repeat(40), parents: ['c'.repeat(40)], clean: true }]));
function complete(variant = 'fixed') {
  return { schema: 1, variant, viewport: { width: 1280, height: 720 }, provenance: clone(provenance), complete: true,
    trials: [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => ({ ...trial(variant, direction), index }))) };
}
for (const variant of ['baseline', 'fixed']) validateCompletion(complete(variant), { variant, width: 1280, provenance });
for (const change of [r => r.trials.pop(), r => r.trials.push(r.trials[0]), r => r.trials.reverse(), r => { r.trials[0].direction = 'other'; }, r => { r.viewport.height = 900; }, r => { r.complete = false; }, r => { r.provenance.product.head = 'd'.repeat(40); }]) {
  const value = complete(); change(value); assert.throws(() => validateCompletion(value, { variant: 'fixed', width: 1280, provenance }));
}
console.log(`PASS installed read-only observer, baseline/fixed forward/reverse and ${mutations.length + 10} negative controls; no native browser/services`);
