import assert from 'node:assert/strict';

const finite = value => assert.ok(Number.isFinite(value), 'Missing finite number');
const id = value => assert.ok(Number.isSafeInteger(value) && value > 0, 'Missing node identity');
function node(value) {
  assert.ok(value); id(value.id); id(value.scopeId);
  assert.ok(value.formId === null || Number.isSafeInteger(value.formId) && value.formId > 0);
  for (const key of ['tag', 'type', 'name', 'value']) assert.equal(typeof value[key], 'string');
  for (const key of ['checked', 'disabled', 'effectiveDisabled', 'connected', 'inPanel']) assert.equal(typeof value[key], 'boolean');
  assert.ok(Number.isInteger(value.tabIndex)); assert.ok(value.tabIndexAttribute === null || typeof value.tabIndexAttribute === 'string');
  for (const ancestor of value.ancestors) { id(ancestor.id); assert.equal(typeof ancestor.tag, 'string'); assert.ok(ancestor.inSummary === null || typeof ancestor.inSummary === 'boolean'); }
  for (const key of ['x', 'y', 'width', 'height']) finite(value.rect[key]);
  for (const entry of [value.own, ...value.ancestors]) {
    for (const key of ['hidden', 'inert']) assert.equal(typeof entry[key], 'boolean');
    for (const key of ['display', 'visibility']) assert.equal(typeof entry[key], 'string');
    assert.ok(entry.ariaHidden === null || typeof entry.ariaHidden === 'string');
    assert.ok(entry.open === null || typeof entry.open === 'boolean');
  }
}
function usable(value) {
  node(value); assert.ok(value.connected && value.inPanel && !value.disabled && !value.effectiveDisabled && value.tabIndex >= 0);
  assert.ok(value.rect.width > 0 && value.rect.height > 0);
  for (const entry of [value.own, ...value.ancestors]) assert.ok(!entry.hidden && !entry.inert && entry.ariaHidden !== 'true' && entry.display !== 'none' && entry.visibility !== 'hidden' && entry.visibility !== 'collapse' && (entry.open !== false || entry.inSummary === true));
}
function snapshot(value) {
  assert.equal(value.schema, 2); finite(value.at); finite(value.mono); id(value.rootId); assert.equal(value.overflow, false); assert.equal(value.failure, null); node(value.active);
  for (const key of ['candidates', 'radios', 'eligibleIds', 'intendedIds', 'details']) assert.ok(Array.isArray(value[key]));
  assert.ok(value.candidates.length > 1); value.candidates.forEach(node);
  assert.equal(new Set(value.candidates.map(n => n.id)).size, value.candidates.length);
  assert.ok(Array.isArray(value.radios)); value.radios.forEach(node);
  assert.equal(new Set(value.radios.map(n => n.id)).size, value.radios.length);
  const records = new Map(), ancestors = new Map();
  for (const record of [...value.candidates, ...value.radios, value.active, value.held, value.submit].filter(Boolean)) {
    node(record);
    if (records.has(record.id)) assert.deepEqual(record, records.get(record.id), 'Conflicting synchronous descriptor');
    else records.set(record.id, record);
    assert.equal(new Set(record.ancestors.map(a => a.id)).size, record.ancestors.length);
    assert.ok(!record.ancestors.some(a => a.id === record.id));
    if (record.inPanel && record.id !== value.rootId) assert.ok(record.ancestors.some(a => a.id === value.rootId));
    for (const ancestor of record.ancestors) {
      const { inSummary, ...state } = ancestor;
      if (ancestors.has(ancestor.id)) assert.deepEqual(state, ancestors.get(ancestor.id));
      else ancestors.set(ancestor.id, state);
    }
  }
  const candidateRadios = value.candidates.filter(n => n.type === 'radio');
  assert.deepEqual(value.radios.filter(n => candidateRadios.some(c => c.id === n.id)).map(n => n.id), candidateRadios.map(n => n.id));
  for (const radio of value.radios) {
    assert.equal(radio.tag, 'INPUT'); assert.equal(radio.type, 'radio');
    const rawEligible = radio.inPanel && (!radio.disabled || radio.tabIndexAttribute !== null && radio.tabIndexAttribute !== '-1') && radio.own.ariaHidden !== 'true' && radio.own.display !== 'none' && radio.own.visibility !== 'hidden';
    assert.equal(candidateRadios.some(n => n.id === radio.id), rawEligible);
  }
  assert.equal(new Set(value.intendedIds).size, value.intendedIds.length);
  assert.ok(value.intendedIds.every(i => value.candidates.some(n => n.id === i)));
  assert.ok(Array.isArray(value.eligibleIds)); assert.equal(new Set(value.eligibleIds).size, value.eligibleIds.length);
  assert.equal(new Set(value.details.map(d => d.id)).size, value.details.length);
  for (const detail of value.details) {
    id(detail.id); assert.equal(typeof detail.open, 'boolean');
    if (ancestors.has(detail.id)) assert.equal(detail.open, ancestors.get(detail.id).open);
  }
}
const group = (a, b) => a.type === 'radio' && b.type === 'radio' && a.name && a.name === b.name && a.formId === b.formId && a.scopeId === b.scopeId;
function radioBoundary(before) {
  snapshot(before);
  node(before.submit); assert.equal(before.submit.disabled, true);
  const eligible = before.candidates.filter(n => n.type !== 'radio' || n.tabIndex >= 0 && !n.effectiveDisabled && [n.own, ...n.ancestors].every(s => !s.hidden && !s.inert && s.display !== 'none' && (s.open !== false || s.inSummary === true)));
  assert.deepEqual(before.eligibleIds, eligible.map(n => n.id));
  const projected = eligible.filter(n => {
    if (n.type !== 'radio' || !n.name) return true;
    const members = eligible.filter(other => group(n, other));
    return n.id === (members.find(other => other.checked) || members[0]).id;
  }).map(n => n.id);
  assert.deepEqual(before.intendedIds, projected);
  const gold = before.candidates.find(n => n.type === 'radio' && n.name === 'hero-largess-kind' && n.value === 'gold');
  const item = before.candidates.find(n => n.type === 'radio' && n.name === 'hero-largess-kind' && n.value === 'item');
  usable(gold); usable(item); assert.ok(group(gold, item) && gold.checked && !item.checked);
  assert.equal(before.candidates.at(-2).id, gold.id); assert.equal(before.candidates.at(-1).id, item.id);
  assert.equal(before.intendedIds.at(-1), gold.id); assert.ok(!before.intendedIds.includes(item.id));
  const first = before.candidates.find(n => n.id === before.intendedIds[0]); usable(first);
  assert.ok(Array.isArray(before.radios)); before.radios.forEach(node);
  assert.equal(new Set(before.radios.map(n => n.id)).size, before.radios.length);
  const members = before.radios.filter(n => group(gold, n));
  assert.ok(members.some(n => n.id === gold.id) && members.some(n => n.id === item.id));
  members.forEach(usable);
  return { first, gold, members: members.map(n => [n.id, n.name, n.value, n.formId, n.scopeId, n.checked, n.disabled, n.effectiveDisabled, n.tabIndex]) };
}
function sameBoundary(before, current) {
  const initial = radioBoundary(before), next = radioBoundary(current);
  assert.equal(current.rootId, before.rootId); assert.deepEqual(current.details, before.details);
  assert.equal(next.first.id, initial.first.id); assert.equal(next.gold.id, initial.gold.id);
  assert.deepEqual(next.members, initial.members);
}
export function validateRadioPrecondition(before, { variant, direction }) {
  assert.ok(['baseline', 'fixed'].includes(variant)); assert.ok(['forward', 'reverse'].includes(direction));
  assert.ok(variant === 'fixed' || direction === 'forward'); usable(before.active);
  const { first, gold } = radioBoundary(before);
  const original = direction === 'forward' ? gold : first, expected = direction === 'forward' ? first : gold;
  assert.equal(before.active.id, original.id);
  return { original, expected };
}
export function validateRadioTrial(trial, { variant, direction }) {
  const before = trial.before, { original, expected } = validateRadioPrecondition(before, { variant, direction });
  assert.equal(trial.direction, direction); assert.ok(Number.isSafeInteger(trial.index) && trial.index >= 1 && trial.index <= 3);
  assert.equal(trial.after.length, 3); trial.after.forEach(snapshot); assert.equal(trial.events.overflow, false); assert.equal(trial.events.schema, 2); assert.equal(trial.events.failure, null);
  let previous = 0;
  for (const event of trial.events.events) {
    id(event.id); assert.ok(event.id > previous); previous = event.id;
    assert.ok(['keydown', 'focusin', 'focusout', 'input', 'change'].includes(event.type));
    assert.equal(event.trusted, true); finite(event.at); finite(event.mono); node(event.target); node(event.active);
  }
  const keys = trial.events.events.filter(e => e.type === 'keydown'); assert.equal(keys.length, 1);
  const key = keys[0]; assert.equal(key, trial.events.events[0]); assert.equal(key.phase, 1); assert.equal(key.key, 'Tab'); assert.equal(key.code, 'Tab'); assert.equal(key.shift, direction === 'reverse');
  for (const modifier of ['alt', 'ctrl', 'meta']) assert.equal(key[modifier], false);
  const capture = validateRadioPrecondition(key.boundary, { variant, direction });
  assert.equal(capture.original.id, original.id); sameBoundary(before, key.boundary);
  assert.deepEqual(key.active, key.boundary.active); assert.deepEqual(key.target, key.boundary.active);
  assert.equal(key.target.id, original.id); assert.equal(key.active.id, original.id); assert.equal(key.initialPrevented, false);
  assert.ok(key.captureCheckpoint); node(key.captureCheckpoint.active); finite(key.captureCheckpoint.at); finite(key.captureCheckpoint.mono);
  assert.ok([0, 1, 2, 3].includes(key.captureCheckpoint.phase)); assert.equal(typeof key.captureCheckpoint.prevented, 'boolean');
  assert.ok(key.final); assert.equal(key.final.phase, 0); finite(key.final.at); finite(key.final.mono); node(key.final.active);
  sameBoundary(before, key.final.boundary);
  assert.deepEqual(key.final.boundary.active, key.final.active);
  usable(key.boundary.held); assert.equal(key.boundary.held.id, original.id);
  usable(key.final.boundary.held); assert.equal(key.final.boundary.held.id, original.id);
  assert.ok(key.mono <= key.boundary.mono && key.boundary.mono <= key.captureCheckpoint.mono);
  assert.ok(key.final.mono <= key.final.boundary.mono && key.final.boundary.mono <= trial.after[0].mono);
  assert.equal(key.final.prevented, variant === 'fixed');
  assert.ok(!key.captureCheckpoint.prevented || key.final.prevented, 'Cancellation cannot be undone');
  if (variant === 'fixed') assert.equal(key.final.active.id, expected.id);
  assert.ok(!trial.events.events.some(e => ['input', 'change'].includes(e.type)), 'Unexpected selection mutation during Tab');
  assert.ok(trial.events.events.some(e => e.type === 'focusout' && e.target.id === original.id));
  if (variant === 'fixed') assert.ok(trial.events.events.some(e => e.type === 'focusin' && e.target.id === expected.id));
  assert.ok(before.mono <= key.mono && key.mono <= key.captureCheckpoint.mono && key.captureCheckpoint.mono <= key.final.mono && key.final.mono <= trial.after[0].mono);
  for (const event of trial.events.events) {
    assert.ok(event.mono >= key.mono && event.mono <= trial.after[0].mono);
    if (event.type === 'focusout') assert.equal(event.target.id, original.id);
    if (event.type === 'focusin' && variant === 'fixed') assert.equal(event.target.id, expected.id);
  }
  let prior = key.final.mono;
  for (const after of trial.after) {
    assert.ok(after.mono >= prior); prior = after.mono; assert.equal(after.rootId, before.rootId);
    usable(after.held); assert.equal(after.held.id, original.id);
    assert.deepEqual(after.details, before.details);
    sameBoundary(before, after);
    if (variant === 'baseline') { assert.equal(after.active.tag, 'BODY'); assert.equal(after.active.inPanel, false); }
    else { usable(after.active); assert.equal(after.active.id, expected.id); }
  }
}
export function validateCompletion(report, { variant, width, provenance }) {
  assert.equal(report.schema, 2); assert.equal(report.variant, variant); assert.equal(report.complete, true);
  assert.ok([1280, 1600].includes(width)); assert.deepEqual(report.viewport, { width, height: width === 1280 ? 720 : 900 });
  assert.deepEqual(report.provenance, provenance);
  for (const name of ['qa', 'collector', 'replay', 'runtime', 'geometry', 'product']) {
    const entry = provenance[name]; assert.equal(entry.clean, true); assert.ok(entry.parents.length > 0);
    for (const sha of [entry.head, entry.tree, ...entry.parents]) assert.match(sha, /^[a-f0-9]{40}$/);
  }
  const expected = [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => [index, direction]));
  assert.deepEqual(report.trials.map(t => [t.index, t.direction]), expected);
  report.trials.forEach(trial => validateRadioTrial(trial, { variant, direction: trial.direction }));
}
