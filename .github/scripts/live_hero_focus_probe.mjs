import assert from 'node:assert/strict';
export class InfrastructureError extends Error {}
export const cityRoute = 'domestic.v1.GetCityState';
export const trials = ['templates', 'select', 'outside'];
export const preparation = { templates: ['click', 'Tab'], select: ['click', 'Tab', 'Tab'], outside: ['click', 'Shift+Tab'] };
export const directions = ['Tab', 'Enter', 'Space', 'Tab', 'Shift+Tab'];
const roles = ['panel', 'host', 'summary', 'templates', 'select', 'outside', 'captive'];
const categories = [...roles, 'BODY', 'summary-child', 'other', 'null'];
const finite = value => assert.ok(Number.isFinite(value), 'finite timestamp required');
function ordered(values) {
  values.forEach(finite);
  assert.ok(values.every((value, index) => !index || value >= values[index - 1]), 'unordered timestamps');
}
function snapshot(s) {
  assert.equal(s.schema, 1);
  finite(s.wall);
  finite(s.mono);
  assert.ok(categories.includes(s.active));
  assert.equal(typeof s.open, 'boolean');
  assert.equal(typeof s.value, 'string');
  for (const name of roles) {
    const node = s.nodes[name];
    for (const flag of ['connected', 'same', 'inPanel', 'inHost', 'visible', 'enabled', 'direct']) assert.equal(typeof node[flag], 'boolean');
    assert.ok(node.connected && node.same && node.inPanel, `retained ${name}`);
  }
  assert.ok(s.nodes.summary.direct && s.nodes.summary.inHost);
  assert.ok(s.nodes.templates.inHost && s.nodes.select.inHost);
  assert.ok(!s.nodes.outside.inHost && !s.nodes.captive.inHost);
}
function focused(s, name, open) {
  snapshot(s);
  if (name) assert.ok((Array.isArray(name) ? name : [name]).includes(s.active), 'unexpected focus');
  assert.equal(s.open, open);
  if (roles.includes(name)) assert.ok(s.nodes[name].visible && s.nodes[name].enabled, 'unusable focused node');
}
function requests(rows) {
  let previous = 0;
  for (const row of rows) {
    assert.ok(Number.isSafeInteger(row.id) && row.id > previous, 'unsafe/duplicate/unordered request');
    previous = row.id;
    assert.equal(typeof row.route, 'string'); assert.ok(row.route.length); finite(row.sentAt);
    if (row.receivedAt !== undefined || row.code !== undefined) {
      ordered([row.sentAt, row.receivedAt]); assert.ok(Number.isSafeInteger(row.code));
    }
  }
}
function boundary(b) {
  finite(b.wall); requests(b.rows);
  assert.ok(Number.isSafeInteger(b.watermark) && b.watermark >= 0);
  assert.equal(b.watermark, b.rows.at(-1)?.id ?? 0);
}
function input(record, expected, before, after, open) {
  assert.equal(record.key, expected); snapshot(record.before); focused(record.after, after, open);
  assert.equal(record.before.active, before);
  ordered([record.enclosure[0], record.start, record.before.wall, record.after.wall, record.end, record.enclosure[1]]);
  ordered([record.before.mono, record.after.mono]); assert.equal(record.before.value, record.after.value);
}
function arm(t) {
  const { before, after, left, right } = t.arm;
  boundary(left);
  boundary(right);
  focused(before, t.name, true);
  focused(after, t.name, true);
  ordered([left.wall, before.wall, after.wall, right.wall]); ordered([before.mono, after.mono]);
  assert.equal(before.value, after.value); assert.deepEqual(left.rows, right.rows);
  assert.ok(right.rows.every(row => row.receivedAt !== undefined && row.receivedAt <= left.wall), 'unresolved/crossing read');
}
export function validate(stage, value, expected = {}) {
  if (stage === 'identity') {
    assert.equal(value.schemaVersion, 2); assert.ok(['baseline', 'fixed'].includes(value.variant));
    assert.ok([1280, 1600].includes(value.viewport.width)); assert.equal(value.viewport.height, value.viewport.width === 1280 ? 720 : 900);
    assert.deepEqual(value.provenance, expected); assert.equal(value.provenance.product, 'standalone');
    for (const name of ['qa', 'runtime', 'product']) {
      const item = value.provenance[name + 'Object'];
      for (const sha of [item.head, item.tree, ...item.parents]) assert.match(sha, /^[a-f0-9]{40}$/);
      assert.equal(item.clean, true);
    }
  } else if (stage === 'preparation') {
    assert.ok(Number.isSafeInteger(value.hero) && value.hero > 0);
    assert.equal(value.response.route, 'hero.v1.GetHeroDetail'); assert.equal(value.response.code, 0);
    assert.equal(value.response.detail.hero_id, value.hero); assert.equal(value.loaded, true); assert.equal(value.closed, true);
  } else if (stage === 'before-input') {
    focused(value, ...expected);
  } else if (stage === 'input') {
    input(value, ...expected);
  } else if (stage === 'arm') {
    assert.ok(trials.includes(value.name)); arm(value);
  } else if (stage === 'trial') {
    const t = value;
    assert.ok(trials.includes(t.name));
    arm(t);
    requests(t.requests);
    assert.ok(['baseline', 'fixed'].includes(expected.variant)); assert.equal(t.overflow, false); assert.equal(t.complete, true);
    assert.equal(t.inputs.length, preparation[t.name].length);
    let prior = 'summary';
    t.inputs.forEach((record, index) => {
      const target = index === 0 ? 'summary' : t.name === 'outside' ? 'outside' : index === 1 ? 'templates' : 'select';
      input(record, preparation[t.name][index], index === 0 ? record.before.active : prior, target, true);
      assert.equal(record.before.open, index !== 0);
      prior = target;
      if (index) ordered([t.inputs[index - 1].end, record.start]);
    });
    ordered([t.inputs.at(-1).end, t.arm.left.wall]);
    const eligible = t.requests.filter(row => row.id > t.arm.right.watermark && row.route === cityRoute);
    assert.ok(eligible.length);
    const first = eligible[0];
    assert.equal(first.code, 0); assert.equal(t.responseId, first.id); ordered([t.arm.right.wall, first.sentAt, first.receivedAt]);
    assert.ok(t.close && t.frame); assert.equal(t.settled.length, 2);
    const samples = [t.frame, ...t.settled], last = samples.at(-1);
    const target = t.name === 'outside' ? 'outside' : expected.variant === 'fixed' ? 'summary' : 'BODY';
    snapshot(t.close); assert.equal(t.close.open, false); assert.equal(t.close.value, t.arm.before.value);
    samples.forEach((sample, index) => {
      focused(sample, !index && target === 'BODY' ? [t.name, 'BODY'] : target, false);
      assert.equal(sample.value, t.arm.before.value);
      if (index) assert.ok(sample.mono > samples[index - 1].mono);
    });
    ordered([first.sentAt, t.close.wall, ...samples.map(sample => sample.wall)]);
    ordered([t.arm.before.mono, t.close.mono, ...samples.map(sample => sample.mono)]);
    assert.ok(last.mono - t.arm.before.mono <= 12000 && last.wall - t.arm.before.wall <= 12000);
    assert.ok(!eligible[1] || eligible[1].sentAt > last.wall, 'second poll overlaps settling samples');
    assert.ok(t.trace.some(event => event.kind === 'toggle' && event.target === 'host' && event.snapshot.open === false && event.snapshot.mono >= t.close.mono && event.snapshot.mono <= t.settled[0].mono && event.snapshot.wall >= t.close.wall && event.snapshot.wall <= t.settled[0].wall), 'missing enclosed closed toggle');
    assert.equal(t.outcome, expected.variant === 'baseline' && t.name !== 'outside' ? 'expected-baseline-defect' : 'scoped-focus-pass');
    assert.ok(t.trace.length && t.trace.length <= 256); let mono = t.arm.before.mono, wall = t.arm.before.wall;
    for (const event of t.trace) {
      assert.ok(['focusin', 'focusout', 'toggle', 'mutation', 'close', 'frame', 'settled'].includes(event.kind));
      assert.ok(categories.includes(event.target) && categories.includes(event.related)); snapshot(event.snapshot);
      ordered([mono, event.snapshot.mono]); ordered([wall, event.snapshot.wall]); mono = event.snapshot.mono; wall = event.snapshot.wall;
    }
    const milestones = t.trace.filter(event => ['close', 'frame', 'settled'].includes(event.kind));
    assert.deepEqual(milestones.map(event => [event.kind, event.snapshot]),
      [['close', t.close], ['frame', t.frame], ...t.settled.map(snapshot => ['settled', snapshot])]);
  } else if (stage === 'proof-boundary') {
    value.forEach(boundary);
    assert.ok(value[0].rows.every(row => row.receivedAt !== undefined && row.receivedAt <= value[0].wall));
    assert.deepEqual(value[0].rows, value[1].rows, 'poll overlaps activation proof');
  } else if (stage === 'directions' || stage === 'direction-prefix') {
    assert.ok(value.length > 0 && value.length <= 5);
    if (stage === 'directions') assert.equal(value.length, 5);
    assert.deepEqual(value[0].left.rows, value.at(-1).right.rows, 'poll overlaps whole activation proof');
    const before = ['outside', 'summary', 'summary', 'summary', 'captive'];
    const after = ['summary', 'summary', 'summary', 'captive', 'summary'];
    value.forEach((record, index) => {
      input(record, directions[index], before[index], after[index], index === 1);
      assert.equal(record.before.open, index === 2);
      boundary(record.left); boundary(record.right); assert.deepEqual(record.left.rows, record.right.rows);
      assert.ok(record.left.rows.every(row => row.receivedAt !== undefined && row.receivedAt <= record.left.wall));
      ordered([record.left.wall, record.start, record.end, record.right.wall]);
      if (index) {
        const prior = value[index - 1];
        ordered([prior.end, record.start]);
        for (const key of ['active', 'open', 'value']) assert.equal(record.before[key], prior.after[key]);
      }
    });
  } else if (stage === 'complete') {
    validate('identity', value, expected); validate('preparation', value.preparation);
    assert.deepEqual(value.trials.map(t => t.name), trials);
    for (const trial of value.trials) validate('trial', trial, value);
    validate('directions', value.directions);
  } else assert.fail('unknown validation stage');
}
export async function withProbe(acquire, use, guard, stop) {
  let handle;
  try {
    guard();
    handle = await acquire();
    guard();
    return await use(handle);
  }
  finally {
    if (handle) {
      try { await handle.evaluate(probe => probe.dispose()); }
      catch (error) { stop(error); throw new InfrastructureError('Probe cleanup failed', { cause: error }); }
      finally { await handle.dispose().catch(error => { stop(error); throw new InfrastructureError('Handle disposal failed', { cause: error }); }); }
    }
  }
}
// Serialized by Playwright: all DOM references remain private to this closure.
export function installProbe() {
  const panel = document.querySelector('[data-center-panel="hero"]');
  const selectors = { host: '[data-role="hero-recruit-host"]', summary: '[data-role="hero-recruit-host"] > summary', templates: '[data-action="refresh-templates"]', select: '[data-field="template-select"]', outside: '[data-action="refresh-heroes"]', captive: '[data-action="refresh-captive-list"]' };
  const nodes = { panel, ...Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, panel?.querySelector(selector)])) };
  const category = node => Object.entries(nodes).find(([, original]) => original && node === original)?.[0] ?? (node === document.body ? 'BODY' : node && nodes.summary?.contains(node) ? 'summary-child' : node ? 'other' : 'null');
  const snap = () => ({ schema: 1, mono: performance.now(), wall: Date.now(), active: category(document.activeElement), open: !!nodes.host?.open, value: nodes.select?.value,
    nodes: Object.fromEntries(Object.entries(nodes).map(([name, node]) => [name, {
      connected: !!node?.isConnected, same: node === (name === 'panel' ? document.querySelector('[data-center-panel="hero"]') : panel?.querySelector(selectors[name])),
      inPanel: !!node && panel.contains(node), inHost: !!node && nodes.host.contains(node), direct: name !== 'summary' || node?.parentElement === nodes.host,
      visible: !!node?.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none', enabled: !!node && !node.matches(':disabled'),
    }])) });
  let armed = false, disposed = false, overflow = false, close, raf, timer, observer, ready, resolve;
  const trace = [], listeners = [], samples = [];
  const record = (kind, target = null, related = null, snapshot = snap()) => {
    if (disposed || !armed) return;
    if (trace.length === 256) { overflow = true; return; }
    trace.push({ kind, target: category(target), related: category(related), snapshot });
  };
  const detect = () => {
    if (!armed || disposed || close || nodes.host.open) return;
    close = snap(); record('close', nodes.host, null, close);
    const sample = () => {
      if (disposed || !armed) return;
      samples.push(snap()); record(samples.length === 1 ? 'frame' : 'settled', nodes.host, null, samples.at(-1));
      if (samples.length < 3) raf = requestAnimationFrame(sample); else resolve(true);
    };
    raf = requestAnimationFrame(sample);
  };
  const dispose = () => {
    disposed = true;
    resolve?.(false);
    observer?.disconnect();
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    for (const [node, event, fn] of listeners) node.removeEventListener(event, fn, true);
  };
  try {
    if (Object.values(nodes).some(node => !node)) throw new Error('Missing probe DOM');
    for (const event of ['focusin', 'focusout', 'toggle']) {
      const node = event === 'toggle' ? nodes.host : document;
      const fn = value => { record(event, value.target, value.relatedTarget); detect(); };
      listeners.push([node, event, fn]); node.addEventListener(event, fn, true);
    }
    observer = new MutationObserver(() => { record('mutation', nodes.host); detect(); });
    observer.observe(nodes.host, { attributes: true, attributeFilter: ['open'] });
    return { snapshot: snap, arm: () => {
      armed = true;
      ready = new Promise(done => { resolve = done; });
      timer = setTimeout(() => { armed = false; cancelAnimationFrame(raf); resolve(false); }, 12000);
      return snap();
    }, wait: () => ready,
      read: () => structuredClone({ trace, close, frame: samples[0], settled: samples.slice(1), overflow, complete: samples.length === 3 }), dispose };
  } catch (error) { dispose(); throw error; }
}
