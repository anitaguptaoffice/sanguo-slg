import assert from 'node:assert/strict';

const finite = value => assert.ok(Number.isFinite(value), 'Missing finite number');
const id = value => assert.ok(Number.isSafeInteger(value) && value > 0, 'Missing node identity');
function node(value) {
  assert.ok(value); id(value.id); id(value.scopeId);
  assert.ok(value.formId === null || Number.isSafeInteger(value.formId) && value.formId > 0);
  for (const key of ['tag', 'type', 'name', 'value']) assert.equal(typeof value[key], 'string');
  for (const key of ['checked', 'disabled', 'effectiveDisabled', 'connected', 'inPanel']) assert.equal(typeof value[key], 'boolean');
  assert.ok(Number.isInteger(value.tabIndex));
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
  assert.equal(value.schema, 1); finite(value.at); finite(value.mono); id(value.rootId); assert.equal(value.overflow, false); node(value.active);
  assert.ok(value.candidates.length > 1); value.candidates.forEach(node);
  assert.equal(new Set(value.candidates.map(n => n.id)).size, value.candidates.length);
  assert.equal(new Set(value.intendedIds).size, value.intendedIds.length);
  assert.ok(value.intendedIds.every(i => value.candidates.some(n => n.id === i)));
  assert.ok(Array.isArray(value.eligibleIds)); assert.equal(new Set(value.eligibleIds).size, value.eligibleIds.length);
  for (const detail of value.details) { id(detail.id); assert.equal(typeof detail.open, 'boolean'); }
}
const group = (a, b) => a.type === 'radio' && b.type === 'radio' && a.name && a.name === b.name && a.formId === b.formId && a.scopeId === b.scopeId;
function boundary(before) {
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
  assert.equal(gold.tag, 'INPUT'); assert.equal(item.tag, 'INPUT');
  usable(gold); usable(item); assert.ok(group(gold, item) && gold.checked && !item.checked);
  assert.equal(before.candidates.at(-2).id, gold.id); assert.equal(before.candidates.at(-1).id, item.id);
  assert.equal(before.intendedIds.at(-1), gold.id); assert.ok(!before.intendedIds.includes(item.id));
  const first = before.candidates.find(n => n.id === before.intendedIds[0]); usable(first);
  return gold;
}
const cityRoute = 'domestic.v1.GetCityState';
const natural = value => assert.ok(Number.isSafeInteger(value) && value >= 0);
const clock = value => { finite(value.at); finite(value.mono); };
const ordered = (a, b) => { clock(a); clock(b); assert.ok(a.at <= b.at && a.mono <= b.mono); };
const identity = value => [value.id, value.tag, value.type, value.name, value.value, value.checked, value.formId, value.scopeId];
export function validateBefore(value) {
  const gold = boundary(value); usable(value.active);
  assert.deepEqual(identity(value.active), identity(gold)); return gold.id;
}
export function correlateCity(arm, rows, returned, returnedAt) {
  finite(arm.at); natural(arm.count); id(arm.lastId); finite(returnedAt);
  assert.ok(arm.count > 0 && arm.count <= rows.length);
  assert.equal(arm.lastId, rows[arm.count - 1].id);
  let previous = -Infinity;
  rows.forEach((row, index) => {
    assert.equal(row.id, index + 1); assert.equal(typeof row.route, 'string'); finite(row.sentAt);
    assert.ok(row.sentAt >= previous); previous = row.sentAt;
    if (row.code !== undefined) { assert.ok(Number.isInteger(row.code)); finite(row.receivedAt); assert.ok(row.receivedAt >= row.sentAt); }
    else assert.equal(row.receivedAt, undefined);
  });
  assert.ok(rows.slice(0, arm.count).every(row => row.sentAt <= arm.at));
  const pending = rows.slice(0, arm.count).filter(row => row.route === cityRoute && (row.receivedAt === undefined || row.receivedAt > arm.at)).map(row => row.id);
  assert.deepEqual(arm.pendingCityIds, pending); assert.deepEqual(pending, []);
  const first = rows.slice(arm.count).find(row => row.route === cityRoute);
  assert.ok(first); assert.equal(returned, first, 'Only first SENT row, never a later completion');
  assert.ok(first.sentAt >= arm.at && first.receivedAt <= returnedAt); assert.equal(first.code, 0);
  return first.id;
}
function rowPoint(point, hero) {
  clock(point);
  for (const value of [point.original, point.replacement, point.roster]) {
    id(value.id); assert.equal(typeof value.connected, 'boolean'); assert.equal(typeof value.tag, 'string');
    assert.ok(value.parentId === null || Number.isSafeInteger(value.parentId) && value.parentId > 0);
    assert.ok(Array.isArray(value.ancestorIds)); value.ancestorIds.forEach(id);
    assert.equal(new Set(value.ancestorIds).size, value.ancestorIds.length);
    assert.equal(value.parentId, value.ancestorIds[0] ?? null);
  }
  for (const value of [point.original, point.replacement]) { assert.equal(value.tag, 'LI'); assert.equal(value.hero, String(hero)); }
  assert.equal(point.roster.role, 'hero-scroll'); assert.equal(point.roster.connected, true);
  assert.equal(point.replacement.connected, true); assert.ok(point.replacement.ancestorIds.includes(point.roster.id));
}
export function validateRefresh(phase, variant, hero) {
  assert.ok(['baseline', 'fixed'].includes(variant)); id(hero); clock(phase.windowStart); natural(phase.cursor);
  const original = validateBefore(phase.before); ordered(phase.windowStart, phase.before);
  assert.equal(phase.after.length, 3); assert.equal(phase.rows.length, 2); assert.equal(phase.events.overflow, false);
  const returned = phase.requestRows.find(row => row.id === phase.response.id);
  assert.equal(correlateCity(phase.arm, phase.requestRows, returned, phase.response.returnedAt), phase.response.id);
  assert.deepEqual([returned.sentAt, returned.receivedAt], [phase.response.sentAt, phase.response.receivedAt]);
  const [start, end] = phase.rows; phase.rows.forEach(point => rowPoint(point, hero));
  assert.equal(start.original.id, start.replacement.id); assert.equal(start.original.connected, true);
  assert.equal(end.original.id, start.original.id); assert.equal(end.original.connected, false);
  assert.notEqual(end.replacement.id, start.original.id); assert.equal(end.roster.id, start.roster.id);
  ordered(phase.before, start); ordered(start, end); ordered(end, phase.settled);
  assert.ok(start.at <= phase.arm.at && phase.arm.at <= end.at && phase.response.returnedAt <= phase.settled.at);
  let previous = phase.settled;
  for (const frame of phase.after) {
    const gold = boundary(frame); node(frame.held); ordered(previous, frame); previous = frame;
    assert.equal(frame.rootId, phase.before.rootId); assert.deepEqual(frame.details, phase.before.details);
    assert.equal(frame.held.id, original);
    assert.deepEqual(identity(gold).slice(1), identity(phase.before.active).slice(1));
    if (variant === 'fixed') {
      usable(frame.active); usable(frame.held);
      for (const value of [gold, frame.active, frame.held]) assert.deepEqual(identity(value), identity(phase.before.active));
    } else {
      assert.equal(frame.active.tag, 'BODY'); assert.equal(frame.active.connected, true); assert.equal(frame.active.inPanel, false);
      assert.equal(frame.held.connected, false); assert.equal(frame.held.inPanel, false); assert.notEqual(gold.id, original);
      assert.deepEqual(identity(frame.held).slice(0, -1), identity(phase.before.active).slice(0, -1));
    }
  }
  ordered(previous, phase.eventsEnd);
  let eventId = phase.cursor, eventTime = phase.windowStart;
  for (const event of phase.events.events) {
    assert.equal(event.id, ++eventId); ordered(eventTime, event); ordered(event, phase.eventsEnd); eventTime = event;
    assert.equal(event.trusted, true); assert.equal(event.phase, 1); node(event.target); node(event.active);
    if (event.related !== null) node(event.related);
    assert.equal(event.type, 'focusout'); assert.equal(variant, 'baseline'); assert.equal(event.target.id, original);
    ordered(phase.rows[0], event); ordered(event, phase.after[0]);
  }
  assert.ok(phase.events.events.length <= (variant === 'baseline' ? 1 : 0));
}
export function validateCompletion(report, { variant, width, provenance }) {
  assert.equal(report.schema, 1); assert.equal(report.variant, variant); assert.equal(report.complete, true);
  assert.ok([1280, 1600].includes(width)); assert.deepEqual(report.viewport, { width, height: width === 1280 ? 720 : 900 });
  assert.deepEqual(report.provenance, provenance);
  for (const name of ['qa', 'assertions', 'observer', 'runtime', 'geometry', 'product']) {
    const entry = provenance[name]; assert.equal(entry.clean, true); assert.ok(entry.parents.length > 0);
    for (const sha of [entry.head, entry.tree, ...entry.parents]) assert.match(sha, /^[a-f0-9]{40}$/);
  }
  validateRefresh(report.refresh, variant, report.hero);
}
