import assert from 'node:assert/strict';
import { fixture } from './live_hero_radio_collector.test.mjs';
import { validateRadioPrecondition, validateRadioTrial, validateCompletion } from './live_hero_radio_replay.mjs';
const clone = value => JSON.parse(JSON.stringify(value));
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
  event.boundary = clone(before); Object.assign(event.boundary, { mono: 2.2, held: clone(originalNode) });
  event.final.boundary = clone(after[0]); event.final.boundary.mono = 3.2;
  observer.dispose(); w.close();
  return { index: 1, direction, before, after, events: { schema: 2, failure: null, events: [event, { id: 2, type: 'focusout', at: 3, mono: 3, trusted: true, target: originalNode, active: clone(after[0].active) }, ...(variant === 'fixed' ? [{ id: 3, type: 'focusin', at: 3, mono: 3, trusted: true, target: clone(after[0].active), active: clone(after[0].active) }] : [])], overflow: false } };
}
for (const [variant, direction] of [['baseline', 'forward'], ['fixed', 'forward'], ['fixed', 'reverse']]) validateRadioTrial(trial(variant, direction), { variant, direction });
const guardChanges = [s => { s.active.tag = 'BODY'; s.active.inPanel = false; }, s => { s.active = null; },
  s => { s.active.inPanel = false; }, s => { s.active.connected = false; }, s => { s.active.id = 999; },
  s => { s.active.own.visibility = 'hidden'; }, s => { s.candidates[1].checked = false; },
  s => { s.candidates[2].name = 'other'; }, s => { s.overflow = true; }, s => delete s.active.rect];
for (const direction of ['forward', 'reverse']) for (const change of guardChanges) {
  const value = trial('fixed', direction); change(value.before);
  assert.throws(() => validateRadioPrecondition(value.before, { variant: 'fixed', direction }));
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction }), 'post-validation must reuse same guard');
}
for (const [variant, direction] of [['baseline', 'forward'], ['fixed', 'forward'], ['fixed', 'reverse']]) {
  const value = trial(variant, direction), checked = validateRadioPrecondition(value.before, { variant, direction });
  assert.equal(checked.original.id, value.before.active.id); validateRadioTrial(value, { variant, direction });
}
const guardLive = fixture(); guardLive.gold.focus();
validateRadioPrecondition(clone(guardLive.observer.snapshot()), { variant: 'fixed', direction: 'forward' });
guardLive.gold.blur();
assert.throws(() => validateRadioPrecondition(clone(guardLive.observer.snapshot()), { variant: 'fixed', direction: 'forward' }), 'actual BODY rejected');
guardLive.gold.focus(); guardLive.item.checked = true;
assert.throws(() => validateRadioPrecondition(clone(guardLive.observer.snapshot()), { variant: 'fixed', direction: 'forward' }), 'actual changed group rejected');
guardLive.observer.dispose(); guardLive.w.close();
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
// Prospective boundary controls keep every raw middle node while allowing only
// unchanged boundary and complete radio group identities across every sample.
function withMiddle() {
  const value = trial();
  for (const frame of [value.before, value.events.events[0].boundary, value.events.events[0].final.boundary, ...value.after]) {
    const middle = { ...clone(frame.candidates[0]), id: 800 };
    frame.candidates.splice(1, 0, middle); frame.eligibleIds.splice(1, 0, middle.id); frame.intendedIds.splice(1, 0, middle.id);
  }
  return value;
}
const middle = withMiddle();
for (const [index, frame] of [middle.events.events[0].boundary, middle.events.events[0].final.boundary, ...middle.after].entries()) {
  frame.candidates[1].id = 900 + index; frame.eligibleIds[1] = 900 + index; frame.intendedIds[1] = 900 + index;
}
validateRadioTrial(middle, { variant: 'fixed', direction: 'forward' });
const boundaryChanges = [
  frame => { frame.candidates[0].id = 999; frame.eligibleIds[0] = 999; frame.intendedIds[0] = 999; },
  frame => { const n = clone(frame.candidates[0]); n.id = 999; frame.candidates.push(n); frame.eligibleIds.push(n.id); frame.intendedIds.push(n.id); },
  frame => { frame.radios[0].id = 999; },
  frame => { frame.radios.push({ ...clone(frame.radios[0]), id: 999 }); },
  frame => { frame.radios.reverse(); },
  frame => { frame.radios[0].formId = 999; },
  frame => { frame.radios[0].scopeId = 999; },
  frame => { frame.radios[0].checked = !frame.radios[0].checked; },
  frame => { frame.radios[0].own.visibility = 'hidden'; },
  frame => { frame.radios[0].disabled = true; },
  frame => { frame.held.id = 999; },
  frame => { frame.rootId = 999; },
  frame => { frame.details.push({ id: 999, open: true }); },
];
for (let position = 0; position < 5; position++) for (const change of boundaryChanges) {
  const value = withMiddle();
  const frames = [value.events.events[0].boundary, value.events.events[0].final.boundary, ...value.after];
  change(frames[position]);
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }), `boundary ${position}`);
}
for (const phase of ['boundary', 'final']) {
  const value = withMiddle();
  if (phase === 'boundary') delete value.events.events[0].boundary; else delete value.events.events[0].final.boundary;
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }));
}
const provenance = Object.fromEntries(['qa', 'collector', 'replay', 'runtime', 'geometry', 'product'].map(name => [name, { head: 'a'.repeat(40), tree: 'b'.repeat(40), parents: ['c'.repeat(40)], clean: true }]));
function complete(variant = 'fixed') {
  return { schema: 2, variant, viewport: { width: 1280, height: 720 }, provenance: clone(provenance), complete: true,
    trials: [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => ({ ...trial(variant, direction), index }))) };
}
for (const variant of ['baseline', 'fixed']) validateCompletion(complete(variant), { variant, width: 1280, provenance });
for (const change of [r => r.trials.pop(), r => r.trials.push(r.trials[0]), r => r.trials.reverse(), r => { r.trials[0].direction = 'other'; }, r => { r.viewport.height = 900; }, r => { r.complete = false; }, r => { r.provenance.product.head = 'd'.repeat(40); }]) {
  const value = complete(); change(value); assert.throws(() => validateCompletion(value, { variant: 'fixed', width: 1280, provenance }));
}
console.log(`PASS installed read-only observer, baseline/fixed forward/reverse and ${mutations.length + 10} original negative controls plus ${guardChanges.length * 2 + 2} precondition/shared guards plus 67 prospective boundary guards and middle positives; no native browser/services`);

// Join repeated descriptors only within each synchronous frame, never across time.
const frames = value => [value.before, value.events.events[0].boundary, value.events.events[0].final.boundary, ...value.after];
const contradictions = [
  f => { f.radios[0].checked = false; },
  f => { f.radios[0].formId = 999; },
  f => { f.radios[0].scopeId = 999; },
  f => { f.radios[0].own.visibility = 'hidden'; },
  f => { f.radios[0].ancestors.reverse(); },
  f => { f.active.value = 'conflicting'; },
  f => { if (f.held) f.held.name = 'conflicting'; else f.active.name = 'conflicting'; },
  f => { f.radios.splice(0, 1); },
  f => { f.radios.reverse(); },
  f => { f.radios.push({ ...clone(f.radios[0]), id: 777 }); },
  f => { f.failure = 'collector error'; },
  f => { f.schema = 1; },
];
let consistencyRejections = 0;
for (const change of contradictions) for (const position of [0, 1, 2, 3, 4, 5, 'all']) {
  const value = trial();
  if (position === 'all') frames(value).forEach(change); else change(frames(value)[position]);
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }));
  consistencyRejections++;
}
for (const change of [t => { t.events.schema = 1; }, t => { t.events.failure = 'failed'; },
  t => { t.events.events[0].target.value = 'conflict'; }, t => { t.events.events[0].final.active.value = 'conflict'; }]) {
  const value = clone(trial()); change(value);
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }));
}
// Legitimate geometry movement across frames must not become identity replacement.
const moving = clone(trial());
for (const [index, frame] of frames(moving).entries()) {
  for (const descriptor of [...frame.candidates, ...frame.radios, frame.active, frame.held, frame.submit].filter(Boolean)) descriptor.rect.x += index;
}
moving.events.events[0].target = clone(moving.events.events[0].boundary.active);
moving.events.events[0].active = clone(moving.events.events[0].boundary.active);
moving.events.events[0].final.active = clone(moving.events.events[0].final.boundary.active);
validateRadioTrial(moving, { variant: 'fixed', direction: 'forward' });
console.log(`PASS ${consistencyRejections} synchronous consistency rejections, four envelope/event negatives and mutable cross-frame geometry positive`);
for (const position of [0, 1, 2, 3, 4, 5, 'all']) {
  const value = clone(trial());
  const change = frame => { frame.candidates[0].ancestors[0].hidden = true; };
  if (position === 'all') frames(value).forEach(change); else change(frames(value)[position]);
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }));
}
console.log('PASS seven shared ancestor consistency negatives');
for (const change of [f => { f.radios[0].tabIndexAttribute = '0'; }, f => { f.radios[0].effectiveDisabled = true; },
  f => { f.radios[0].connected = false; }, f => { f.radios[0].rect.width = 0; }, f => { f.radios[0].type = 'text'; }]) {
  const value = clone(trial()); frames(value).forEach(change);
  assert.throws(() => validateRadioTrial(value, { variant: 'fixed', direction: 'forward' }));
}
console.log('PASS five all-frame descriptor ownership/eligibility/type negatives');
