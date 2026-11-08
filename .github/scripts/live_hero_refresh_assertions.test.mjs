import assert from 'node:assert/strict';
import { correlateCity, validateBefore, validateRefresh, validateCompletion } from './live_hero_refresh_assertions.mjs';
const copy = value => structuredClone(value);
const descriptor = (id, extra = {}) => ({ id, tag: 'INPUT', type: 'radio', name: 'hero-largess-kind', value: 'gold', checked: true,
  disabled: false, effectiveDisabled: false, tabIndex: 0, formId: null, scopeId: 1, connected: true, inPanel: true,
  rect: { x: 10, y: 10, width: 20, height: 20 }, ancestors: [],
  own: { hidden: false, inert: false, ariaHidden: null, display: 'block', visibility: 'visible', open: null }, ...extra });
const gold = descriptor(3), item = descriptor(4, { value: 'item', checked: false });
const body = descriptor(99, { tag: 'BODY', type: '', name: '', value: '', checked: false, tabIndex: -1, inPanel: false });
const snapshot = () => copy({ schema: 1, at: 10, mono: 10, rootId: 5, overflow: false, active: gold, held: null,
  candidates: [descriptor(2, { tag: 'BUTTON', type: 'button', name: '', value: '', checked: false }), gold, item],
  eligibleIds: [2, 3, 4], intendedIds: [2, 3], details: [], submit: descriptor(6, { tag: 'BUTTON', type: 'button', disabled: true, effectiveDisabled: true }) });
export function fixture(variant = 'fixed') {
  const row = (id, connected = true) => ({ id, tag: 'LI', hero: '7', connected, parentId: connected ? 102 : null, ancestorIds: connected ? [102] : [] });
  const roster = { id: 102, tag: 'UL', role: 'hero-scroll', connected: true, parentId: null, ancestorIds: [] };
  const phase = { windowStart: { at: 9, mono: 9 }, cursor: 5, before: snapshot(),
    arm: { at: 11, count: 1, lastId: 1, pendingCityIds: [] }, response: { id: 2, sentAt: 12, receivedAt: 13, returnedAt: 14 },
    requestRows: [1, 2, 3].map(id => ({ id, route: 'domestic.v1.GetCityState', sentAt: id * 2 + 8, receivedAt: id * 2 + 9, code: 0 })),
    rows: [{ at: 11, mono: 11, original: row(101), replacement: row(101), roster },
      { at: 14, mono: 14, original: row(101, false), replacement: row(103), roster: copy(roster) }],
    settled: { at: 15, mono: 15 }, after: [16, 17, 18].map(at => ({ ...snapshot(), at, mono: at, held: copy(gold) })),
    eventsEnd: { at: 19, mono: 19 }, events: { overflow: false, events: [] } };
  if (variant === 'baseline') {
    phase.events.events.push({ id: 6, type: 'focusout', phase: 1, at: 13, mono: 13, trusted: true, target: copy(gold), active: copy(body), related: null });
    for (const frame of phase.after) {
      frame.active = copy(body); frame.held = { ...copy(gold), connected: false, inPanel: false, scopeId: 77 };
      frame.candidates[1].id = 40; frame.eligibleIds = [2, 40, 4]; frame.intendedIds = [2, 40];
    }
  }
  return phase;
}
const counts = {};
function reject(label, variant, change) {
  const phase = fixture(variant); change(phase);
  assert.throws(() => validateRefresh(phase, variant, 7), label); counts[label.split(':')[0]] = (counts[label.split(':')[0]] || 0) + 1;
}
for (const variant of ['baseline', 'fixed']) {
  validateRefresh(fixture(variant), variant, 7);
  for (const field of ['schema', 'at', 'mono', 'rootId', 'overflow', 'active', 'candidates', 'eligibleIds', 'intendedIds', 'details', 'submit']) {
    reject(`snapshot:${variant}:${field}`, variant, p => { delete p.after[0][field]; });
  }
  for (const role of ['active', 'held', 'submit', 'gold', 'item']) for (const field of Object.keys(gold)) {
    reject(`descriptor:${variant}:${role}:${field}`, variant, p => {
      const frame = p.after[0], value = role === 'gold' ? frame.candidates[1] : role === 'item' ? frame.candidates[2] : frame[role]; delete value[field];
    });
  }
  for (const field of ['x', 'y', 'width', 'height']) reject(`rect:${variant}:${field}`, variant, p => { p.after[0].active.rect[field] = Infinity; });
  for (const field of Object.keys(gold.own)) reject(`style:${variant}:${field}`, variant, p => { delete p.after[0].active.own[field]; });
  for (const change of [p => { p.after[0].candidates[1].disabled = true; }, p => { p.after[0].candidates[1].own.hidden = true; },
    p => { p.after[0].candidates[1].checked = false; }, p => { p.after[0].candidates[2].checked = true; },
    p => { p.after[0].candidates[2].formId = 55; }, p => { p.after[0].candidates[2].scopeId = 55; },
    p => { p.after[0].eligibleIds = []; }, p => { p.after[0].intendedIds = []; }, p => { p.after[0].submit.disabled = false; }]) reject('group', variant, change);
  for (const change of [p => { p.after.pop(); }, p => { p.rows.pop(); }, p => { p.rows[1].replacement.id = 101; },
    p => { p.rows[1].original.id = 100; }, p => { p.rows[1].original.connected = true; }, p => { p.rows[0].original.connected = false; },
    p => { p.rows[1].replacement.connected = false; }, p => { p.rows[1].roster.id = 88; }, p => { p.rows[1].replacement.hero = '8'; },
    p => { p.rows[1].replacement.ancestorIds = []; }, p => { p.rows[1].replacement.parentId = 55; }, p => { p.rows[1].roster.role = 'other'; },
    p => { p.events.overflow = true; }, p => { p.cursor = -1; }, p => { p.before.active = copy(body); },
    p => { p.after[0].held.id = 333; }, p => { p.after[0].rootId = 333; }, p => { p.after[0].details = [{ id: 10, open: true }]; }]) reject('phase', variant, change);
  for (const point of ['windowStart', 'before', 'settled', 'eventsEnd']) for (const key of ['at', 'mono']) {
    reject('clock', variant, p => { p[point][key] = Infinity; });
    reject('order', variant, p => { p[point][key] = point === 'eventsEnd' ? 0 : 999; });
  }
  for (const collection of ['rows', 'after']) for (let i = 0; i < (collection === 'rows' ? 2 : 3); i++) {
    for (const key of ['at', 'mono']) reject('samples', variant, p => { p[collection][i][key] = NaN; });
  }
  for (const type of ['keydown', 'input', 'change', 'focusin', 'unknown']) reject('forbidden', variant, p => {
    p.events.events.push({ id: p.cursor + p.events.events.length + 1, type, phase: 1, at: 14, mono: 14, trusted: true, target: copy(gold), active: copy(body), related: null });
  });
  for (const change of [p => { p.response.id = 3; }, p => { p.response.sentAt = 0; }, p => { p.response.receivedAt = 0; },
    p => { p.response.returnedAt = 12; }, p => { p.response.returnedAt = Infinity; }, p => { p.arm.pendingCityIds = [1]; },
    p => { p.arm.lastId = 99; }, p => { p.arm.count = 0; }, p => { p.arm.at = 13; }, p => { p.requestRows[0].receivedAt = 12; },
    p => { p.requestRows[1].code = 1; }, p => { delete p.requestRows[1].code; delete p.requestRows[1].receivedAt; },
    p => { p.requestRows[1].id = 99; }, p => { p.requestRows[1].sentAt = Infinity; }, p => { p.requestRows[1].receivedAt = NaN; },
    p => { p.requestRows[1].route = 'unrelated'; }, p => { p.requestRows = []; }, p => { p.arm.lastId = 1.5; }]) reject('protocol', variant, change);
}
for (const field of ['id', 'type', 'phase', 'at', 'mono', 'trusted', 'target', 'active', 'related']) reject('event-schema', 'baseline', p => { delete p.events.events[0][field]; });
for (const change of [p => { p.events.events[0].id = 7; }, p => { p.events.events[0].trusted = false; },
  p => { p.events.events[0].at = 20; }, p => { p.events.events[0].mono = 10; }, p => { p.events.events[0].target.id = 44; },
  p => { p.after[0].active = copy(gold); }, p => { p.after[0].held.connected = true; }, p => { p.after[0].candidates[1].id = 3; },
  p => { p.after[0].active.connected = false; }, p => { p.events.events.push(copy(p.events.events[0])); }]) reject('baseline', 'baseline', change);
for (const change of [p => { p.after[0].active = copy(body); }, p => { p.after[0].held.connected = false; }, p => { p.after[0].held.inPanel = false; },
  p => { p.after[0].held.formId = 9; }, p => { p.after[0].active.id = 40; }]) reject('fixed', 'fixed', change);
const silent = fixture('baseline'); silent.events.events = []; validateRefresh(silent, 'baseline', 7);
for (const change of [p => { p.events.events.push({ ...structuredClone(p.events.events[0]), id: 7 }); },
  p => { p.events.events[0].active = { tag: 'BODY' }; },
  p => { p.events.events = []; p.after[0].held.connected = true; },
  p => { p.events.events = []; p.after[0].active = structuredClone(gold); }]) reject('optional-focusout', 'baseline', change);
const value = fixture();
assert.equal(correlateCity(value.arm, value.requestRows, value.requestRows[1], 14), 2);
assert.throws(() => correlateCity(value.arm, value.requestRows, copy(value.requestRows[1]), 14)); counts['object-identity'] = 1;
assert.equal(validateBefore(snapshot()), 3);
const provenance = Object.fromEntries(['qa', 'assertions', 'observer', 'runtime', 'geometry', 'product'].map(name => [name, { head: 'a'.repeat(40), tree: 'b'.repeat(40), parents: ['c'.repeat(40)], clean: true }]));
const completion = variant => ({ schema: 1, variant, hero: 7, viewport: { width: 1280, height: 720 }, provenance: copy(provenance), refresh: fixture(variant), complete: true });
for (const variant of ['baseline', 'fixed']) {
  validateCompletion(completion(variant), { variant, width: 1280, provenance });
  for (const change of [r => { r.complete = false; }, r => { r.variant = 'unknown'; }, r => { r.schema = 2; }, r => { r.viewport.height = 900; },
    r => { r.refresh.response.id = 3; }, r => { r.provenance.product.head = 'unknown'; }, r => { r.hero = 8; }]) {
    const report = completion(variant); change(report);
    assert.throws(() => validateCompletion(report, { variant, width: 1280, provenance })); counts.completion = (counts.completion || 0) + 1;
  }
}
const wide = completion('fixed'); wide.viewport = { width: 1600, height: 900 };
validateCompletion(wide, { variant: 'fixed', width: 1600, provenance });
const unrelated = fixture(); unrelated.requestRows[1].route = 'unrelated';
assert.equal(correlateCity(unrelated.arm, unrelated.requestRows, unrelated.requestRows[2], 15), 3);
for (const field of ['head', 'tree', 'parents', 'clean']) {
  const report = completion('fixed'); report.provenance.assertions[field] = field === 'parents' ? [] : field === 'clean' ? false : 'invalid';
  assert.throws(() => validateCompletion(report, { variant: 'fixed', width: 1280, provenance: report.provenance })); counts.provenance = (counts.provenance || 0) + 1;
}
console.log(JSON.stringify({ final: true, negatives: Object.values(counts).reduce((a, b) => a + b, 0), categories: counts }));
