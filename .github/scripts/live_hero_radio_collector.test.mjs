import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installRadioCollector } from './live_hero_radio_collector.mjs';
const { JSDOM } = createRequire(new URL('../../client/package.json', import.meta.url))('jsdom');
const clone = value => JSON.parse(JSON.stringify(value));
const html = '<section id="panel"><button id="first">first</button><input type="radio" name="hero-largess-kind" value="gold" checked><input type="radio" name="hero-largess-kind" value="item"><button data-action="hero-largess-submit" disabled>submit</button></section>';
export function fixture(limit = 256) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.structuredClone = clone;
  // Layout is synthetic only here; these observer tests never establish native hit/traversal.
  w.Element.prototype.getBoundingClientRect = () => ({ x: 1, y: 2, width: 20, height: 10 });
  const observer = w.eval(`(${installRadioCollector.toString()})`)({ panelSelector: '#panel', maxEvents: limit });
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
assert.equal(key.boundary.active.id, heldId);
assert.equal(key.boundary.held.id, heldId);
assert.equal(key.final.boundary.active.id, before.candidates[0].id);
assert.deepEqual(key.boundary.radios.map(n => n.id), key.final.boundary.radios.map(n => n.id));
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

const actualMiddle = fixture();
actualMiddle.gold.insertAdjacentHTML('beforebegin', '<button id="middle">middle</button>');
actualMiddle.gold.focus();
actualMiddle.w.document.addEventListener('keydown', event => {
  actualMiddle.w.document.querySelector('#middle').replaceWith(actualMiddle.w.document.querySelector('#middle').cloneNode(true));
  event.preventDefault(); actualMiddle.first.focus();
}, true);
actualMiddle.gold.dispatchEvent(new actualMiddle.w.KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
await Promise.resolve();
const observedKey = actualMiddle.observer.readEvents().events.find(e => e.type === 'keydown');
assert.notEqual(observedKey.boundary.candidates[1].id, observedKey.final.boundary.candidates[1].id);
assert.equal(observedKey.boundary.candidates[0].id, observedKey.final.boundary.candidates[0].id);
assert.deepEqual(observedKey.boundary.radios.map(n => n.id), observedKey.final.boundary.radios.map(n => n.id));
assert.equal(observedKey.trusted, false, 'actual offline fixture remains untrusted');
actualMiddle.observer.dispose(); actualMiddle.w.close();

// Disposal is a terminal archive boundary, including pending microtasks.
for (const finalizeFirst of [false, true]) {
  const f = fixture(); f.gold.focus();
  f.gold.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  if (finalizeFirst) { await Promise.resolve(); f.observer.readEvents(); }
  f.observer.dispose();
  const archived = clone(f.observer.readEvents());
  f.observer.dispose(); await Promise.resolve();
  f.item.focus(); f.item.dispatchEvent(new f.w.Event('change', { bubbles: true }));
  assert.deepEqual(clone(f.observer.readEvents()), archived, 'disposed archive must not acquire or mutate records');
  assert.throws(() => f.observer.snapshot(), /disposed/);
  assert.deepEqual(clone(f.observer.readEvents()), archived);
  f.w.close();
}
const absent = fixture();
assert.throws(() => absent.w.eval(`(${installRadioCollector.toString()})`)({ panelSelector: '#absent' }), /Missing/);
assert.throws(() => absent.w.eval(`(${installRadioCollector.toString()})`)({ panelSelector: '[' }));
for (const budget of [-1, 1.5, 2049, NaN]) {
  assert.throws(() => absent.w.eval(`(${installRadioCollector.toString()})`)({ panelSelector: '#panel', maxEvents: budget }), /budget/);
}
absent.observer.dispose(); absent.w.close();
for (const phase of ['snapshot', 'capture', 'checkpoint', 'final']) {
  const f = fixture(); f.gold.focus();
  const breakStyle = () => { f.w.getComputedStyle = () => { throw Error('fixture style failure'); }; };
  if (phase === 'snapshot') {
    breakStyle(); assert.throws(() => f.observer.snapshot(), /fixture style failure/);
  } else if (phase === 'capture') {
    breakStyle(); f.gold.dispatchEvent(new f.w.KeyboardEvent('keydown', { bubbles: true }));
  } else {
    f.gold.dispatchEvent(new f.w.KeyboardEvent('keydown', { bubbles: true }));
    if (phase === 'final') await Promise.resolve();
    breakStyle();
    if (phase === 'checkpoint') await Promise.resolve(); else f.observer.readEvents();
  }
  const archive = clone(f.observer.readEvents());
  assert.match(archive.failure, /fixture style failure/);
  f.observer.dispose(); await Promise.resolve();
  assert.deepEqual(clone(f.observer.readEvents()), archive);
  assert.throws(() => f.observer.snapshot(), /disposed/); f.w.close();
}
const budgeted = fixture();
for (let i = 0; i < 2050; i++) {
  const button = budgeted.w.document.createElement('button');
  budgeted.w.document.querySelector('#panel').prepend(button);
}
assert.equal(budgeted.observer.snapshot().overflow, true);
budgeted.observer.dispose(); budgeted.w.close();
console.log('PASS serialized collector, read-only records, lifecycle/failure closure and terminal archive tests; synthetic events only');
