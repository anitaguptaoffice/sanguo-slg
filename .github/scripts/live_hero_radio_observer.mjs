import assert from 'node:assert/strict';

// Serialized into the page. Every operation below observes; no input or DOM writes.
export function installRadioObserver({ panelSelector, maxEvents = 256 }) {
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1 || maxEvents > 2048) throw Error('Invalid event budget');
  const root = document.querySelector(panelSelector);
  if (!root) throw Error('Missing observed panel');
  const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const ids = new WeakMap(), nodes = new Map(), pendingEvents = new Map(), events = [];
  let nextId = 1, overflow = false, disposed = false;
  const identity = node => {
    if (!node) return null;
    if (!ids.has(node)) {
      if (nodes.size >= 2048) { overflow = true; return -1; }
      ids.set(node, nextId++); nodes.set(ids.get(node), node);
    }
    return ids.get(node);
  };
  const clock = () => ({ at: Date.now(), mono: performance.now() });
  const style = node => {
    const css = getComputedStyle(node);
    return { hidden: !!node.hidden, inert: !!node.inert, ariaHidden: node.getAttribute('aria-hidden'), display: css.display, visibility: css.visibility, open: node.tagName === 'DETAILS' ? node.open : null };
  };
  const describe = node => {
    if (!(node instanceof Element)) return null;
    const r = node.getBoundingClientRect(), ancestors = [];
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) ancestors.push({ id: identity(ancestor), tag: ancestor.tagName, ...style(ancestor), inSummary: ancestor.tagName === 'DETAILS' ? !!ancestor.querySelector(':scope > summary')?.contains(node) : null });
    return { id: identity(node), tag: node.tagName, type: node.type || '', name: node.getAttribute('name') || '', value: 'value' in node ? String(node.value) : '',
      checked: !!node.checked, disabled: !!node.disabled, effectiveDisabled: node.matches(':disabled'), tabIndex: node.tabIndex, formId: identity(node.form), scopeId: identity(node.getRootNode()),
      connected: node.isConnected, inPanel: root.contains(node), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, own: style(node), ancestors };
  };
  const finalize = () => {
    for (const [row, event] of pendingEvents) if (event.eventPhase === 0) {
      row.final = { ...clock(), phase: event.eventPhase, prevented: event.defaultPrevented, active: describe(document.activeElement) };
      pendingEvents.delete(row);
    }
  };
  const sameGroup = (a, b) => a.type === 'radio' && b.type === 'radio' && a.name && a.name === b.name && a.formId === b.formId && a.scopeId === b.scopeId;
  const snapshot = (heldId = null) => {
    if (disposed) throw Error('Observer disposed');
    finalize();
    const candidates = [...root.querySelectorAll(selector)].filter(node => {
      const css = getComputedStyle(node); return node.getAttribute('aria-hidden') !== 'true' && css.display !== 'none' && css.visibility !== 'hidden';
    }).map(describe);
    const eligible = candidates.filter(node => node.type !== 'radio' || node.tabIndex >= 0 && !node.effectiveDisabled && [node.own, ...node.ancestors].every(s => !s.hidden && !s.inert && s.display !== 'none' && (s.open !== false || s.inSummary === true)));
    const intendedIds = eligible.filter(node => {
      if (node.type !== 'radio' || !node.name) return true;
      const group = eligible.filter(other => sameGroup(node, other));
      return node.id === (group.find(other => other.checked) || group[0]).id;
    }).map(node => node.id);
    return { schema: 1, ...clock(), rootId: identity(root), active: describe(document.activeElement), held: describe(nodes.get(heldId)), candidates, eligibleIds: eligible.map(node => node.id), intendedIds,
      submit: describe(root.querySelector('[data-action="hero-largess-submit"]')), details: [...root.querySelectorAll('details')].map(node => ({ id: identity(node), open: node.open })), overflow };
  };
  const observe = event => {
    if (events.length >= maxEvents) { overflow = true; return; }
    const row = { id: events.length + 1, type: event.type, phase: event.eventPhase, ...clock(), trusted: event.isTrusted, target: describe(event.target), active: describe(document.activeElement), related: describe(event.relatedTarget) };
    events.push(row);
    if (event.type === 'keydown') {
      Object.assign(row, { key: event.key, code: event.code, shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, initialPrevented: event.defaultPrevented, captureCheckpoint: null, final: null });
      pendingEvents.set(row, event);
      queueMicrotask(() => { row.captureCheckpoint = { ...clock(), phase: event.eventPhase, prevented: event.defaultPrevented, active: describe(document.activeElement) }; });
    }
  };
  const types = ['keydown', 'focusin', 'focusout', 'input', 'change'];
  types.forEach(type => window.addEventListener(type, observe, true));
  return { snapshot, readEvents: () => { finalize(); return { events: structuredClone(events), overflow }; }, dispose: () => {
    types.forEach(type => window.removeEventListener(type, observe, true)); disposed = true; nodes.clear(); pendingEvents.clear();
  } };
}

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
export function validateRadioPrecondition(before, { variant, direction }) {
  assert.ok(['baseline', 'fixed'].includes(variant)); assert.ok(['forward', 'reverse'].includes(direction));
  assert.ok(variant === 'fixed' || direction === 'forward'); snapshot(before); usable(before.active);
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
  const original = direction === 'forward' ? gold : first, expected = direction === 'forward' ? first : gold;
  assert.equal(before.active.id, original.id);
  return { original, expected };
}
export function validateRadioTrial(trial, { variant, direction }) {
  const before = trial.before, { original, expected } = validateRadioPrecondition(before, { variant, direction });
  assert.equal(trial.direction, direction); assert.ok(Number.isSafeInteger(trial.index) && trial.index >= 1 && trial.index <= 3);
  assert.equal(trial.after.length, 3); trial.after.forEach(snapshot); assert.equal(trial.events.overflow, false);
  let previous = 0;
  for (const event of trial.events.events) {
    id(event.id); assert.ok(event.id > previous); previous = event.id;
    assert.ok(['keydown', 'focusin', 'focusout', 'input', 'change'].includes(event.type));
    assert.equal(event.trusted, true); finite(event.at); finite(event.mono); node(event.target); node(event.active);
  }
  const keys = trial.events.events.filter(e => e.type === 'keydown'); assert.equal(keys.length, 1);
  const key = keys[0]; assert.equal(key, trial.events.events[0]); assert.equal(key.phase, 1); assert.equal(key.key, 'Tab'); assert.equal(key.code, 'Tab'); assert.equal(key.shift, direction === 'reverse');
  for (const modifier of ['alt', 'ctrl', 'meta']) assert.equal(key[modifier], false);
  assert.equal(key.target.id, original.id); assert.equal(key.active.id, original.id); assert.equal(key.initialPrevented, false);
  assert.ok(key.captureCheckpoint); node(key.captureCheckpoint.active); finite(key.captureCheckpoint.at); finite(key.captureCheckpoint.mono);
  assert.ok([0, 1, 2, 3].includes(key.captureCheckpoint.phase)); assert.equal(typeof key.captureCheckpoint.prevented, 'boolean');
  assert.ok(key.final); assert.equal(key.final.phase, 0); finite(key.final.at); finite(key.final.mono); node(key.final.active);
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
    assert.deepEqual(after.candidates.map(n => [n.id, n.checked]), before.candidates.map(n => [n.id, n.checked]));
    if (variant === 'baseline') { assert.equal(after.active.tag, 'BODY'); assert.equal(after.active.inPanel, false); }
    else { usable(after.active); assert.equal(after.active.id, expected.id); }
  }
}
export function validateCompletion(report, { variant, width, provenance }) {
  assert.equal(report.schema, 1); assert.equal(report.variant, variant); assert.equal(report.complete, true);
  assert.ok([1280, 1600].includes(width)); assert.deepEqual(report.viewport, { width, height: width === 1280 ? 720 : 900 });
  assert.deepEqual(report.provenance, provenance);
  for (const name of ['qa', 'observer', 'runtime', 'geometry', 'product']) {
    const entry = provenance[name]; assert.equal(entry.clean, true); assert.ok(entry.parents.length > 0);
    for (const sha of [entry.head, entry.tree, ...entry.parents]) assert.match(sha, /^[a-f0-9]{40}$/);
  }
  const expected = [1, 2, 3].flatMap(index => (variant === 'fixed' ? ['forward', 'reverse'] : ['forward']).map(direction => [index, direction]));
  assert.deepEqual(report.trials.map(t => [t.index, t.direction]), expected);
  report.trials.forEach(trial => validateRadioTrial(trial, { variant, direction: trial.direction }));
}
