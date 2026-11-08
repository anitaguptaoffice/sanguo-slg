import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { validate, trials, preparation, directions, cityRoute, withProbe, installProbe, InfrastructureError } from './live_hero_focus_probe.mjs';
const clone = structuredClone;
let checks = 0;
function check(id, run) { run(); checks++; console.log(`PASS ${id}`); }
function negative(id, stage, fixture, mutate, expected) {
  check(id, () => { const value = clone(fixture); mutate(value); assert.throws(() => validate(stage, value, expected)); });
}
const names = ['panel', 'host', 'summary', 'templates', 'select', 'outside', 'captive'];
function snap(active, open, wall) {
  return { schema: 1, active, open, wall, mono: wall, value: '1017', nodes: Object.fromEntries(names.map(name => [name, {
    connected: true, same: true, inPanel: true, inHost: ['host', 'summary', 'templates', 'select'].includes(name), direct: true, visible: true, enabled: true,
  }])) };
}
const row = (id, sentAt, receivedAt, route = cityRoute) => ({ id, sentAt, receivedAt, route, code: 0 });
const boundary = wall => ({ wall, watermark: 1, rows: [row(1, 1, 2)] });
function input(key, before, after, open, time, wasOpen = true) {
  return { key, before: snap(before, wasOpen, time + 1), after: snap(after, open, time + 2), start: time, end: time + 3, enclosure: [time, time + 3] };
}
function trial(name = 'templates', variant = 'fixed') {
  const focus = name === 'outside' ? 'outside' : variant === 'fixed' ? 'summary' : 'BODY';
  const close = snap(focus, false, 110), frame = snap(focus, false, 111);
  const inputs = preparation[name].map((key, index) => input(key, index < 2 ? 'summary' : 'templates', index === 0 ? 'summary' : name === 'outside' ? 'outside' : index === 1 ? 'templates' : 'select', true, 10 + index * 5, index !== 0));
  return { name, inputs, arm: { before: snap(name, true, 91), after: snap(name, true, 92), left: boundary(90), right: boundary(93) }, requests: [row(1, 1, 2), row(2, 100, 112)], responseId: 2,
    close, frame, trace: [{ kind: 'close', target: 'host', related: 'null', snapshot: close }, { kind: 'frame', target: 'host', related: 'null', snapshot: frame }], overflow: false, complete: true,
    outcome: variant === 'baseline' && name !== 'outside' ? 'expected-baseline-defect' : 'scoped-focus-pass' };
}
const directionFixture = directions.map((key, i) => ({ ...input(key, ['outside', 'summary', 'summary', 'summary', 'captive'][i], ['summary', 'summary', 'summary', 'captive', 'summary'][i], i === 1, 200 + i * 10, i === 2), left: boundary(200 + i * 10), right: boundary(203 + i * 10) }));
const object = { head: 'a'.repeat(40), tree: 'b'.repeat(40), parents: ['c'.repeat(40)], clean: true };
const provenance = { product: 'standalone', qaObject: object, productObject: object, runtimeObject: object };
const session = { schemaVersion: 1, variant: 'fixed', viewport: { width: 1280, height: 720 }, provenance,
  preparation: { hero: 7, response: { route: 'hero.v1.GetHeroDetail', code: 0, detail: { hero_id: 7 } }, loaded: true, closed: true }, trials: trials.map(name => trial(name)), directions: directionFixture };
negative('N40-before-input-interrupted', 'before-input', snap('summary', false, 1), x => {}, ['summary', true]);
negative('N46-before-input-pending', 'proof-boundary', [boundary(10), boundary(11)], x => { delete x[0].rows[0].code; delete x[0].rows[0].receivedAt; });
check('positive-complete', () => validate('complete', session, provenance));
for (const variant of ['fixed', 'baseline']) for (const name of trials) check(`positive-${variant}-${name}`, () => validate('trial', trial(name, variant), { variant }));
const identityMutations = { N01: x => delete x.variant, N02: x => x.variant = 'other', N03: x => x.viewport.width = 1024, N04: x => x.provenance.productObject.head = 'd'.repeat(40) };
for (const [id, mutate] of Object.entries(identityMutations)) negative(id, 'identity', session, mutate, provenance);
for (const source of ['productObject', 'runtimeObject', 'qaObject']) for (const field of ['head', 'tree', 'parents', 'clean']) negative(`N04-${source}-${field}`, 'identity', session, x => { x.provenance[source] = { ...x.provenance[source], [field]: field === 'clean' ? false : field === 'parents' ? [] : 'd'.repeat(40) }; }, provenance);
for (const [id, mutate] of Object.entries({ N05: x => x.trials.pop(), N06: x => x.trials[1] = x.trials[0], N07: x => x.trials[0].name = 'unknown' })) negative(id, 'complete', session, mutate, provenance);
const bad = (id, mutate, fixture = trial(), variant = 'fixed') => negative(id, 'trial', fixture, mutate, { variant });
const mutations = {
  N08: x => x.arm.before.open = false, N09: x => x.arm.before.active = 'BODY', N10: x => x.frame.active = 'summary-child',
  N11: x => x.frame.nodes.templates.connected = false, N12: x => x.frame.nodes.templates.same = false,
  N13: x => x.frame.nodes.host.connected = false, N14: x => x.frame.nodes.host.same = false,
  N15: x => x.frame.nodes.summary.connected = false, 'N16-replaced': x => x.frame.nodes.summary.same = false, 'N16-indirect': x => x.frame.nodes.summary.direct = false,
  N17: x => x.frame.nodes.summary.inPanel = false, N18: x => x.frame.value = 'other', N19: x => x.frame.active = 'BODY',
  N20: x => x.frame.active = 'other', N21: x => x.frame.active = 'outside', N22: x => x.frame.nodes.summary.visible = false,
  N26: x => x.requests.pop(), N27: x => x.requests[1].route = 'hero.v1.GetHeroDetail', N28: x => x.requests[1].code = 7,
  N29: x => x.requests[1].sentAt = 80, N30: x => { delete x.arm.left.rows[0].receivedAt; delete x.arm.left.rows[0].code; },
  N31: x => x.arm.right.rows.push(row(2, 91, 92)), N32: x => x.arm.right.rows[0].receivedAt = 91,
  N33: x => x.close.wall = 99, N34: x => x.requests.push(row(3, 109, 114)), N35: x => x.responseId = 3,
  N36: x => delete x.close, N37: x => delete x.frame, N38: x => x.overflow = true,
  N40: x => x.inputs[0].after.open = false, N41: x => x.inputs.pop(), N42: x => x.inputs.push(x.inputs[0]), N43: x => x.inputs[1].key = 'Shift+Tab',
};
for (const [id, mutate] of Object.entries(mutations)) bad(id, mutate);
bad('N23', x => x.outcome = 'scoped-focus-pass', trial('templates', 'baseline'), 'baseline');
bad('N24', x => x.frame.active = 'summary', trial('templates', 'baseline'), 'baseline');
bad('N25', x => x.frame.active = 'BODY', trial('outside'));
for (const id of [undefined, NaN, Infinity, 1.5, 0, Number.MAX_SAFE_INTEGER + 1, 1]) bad(`N39-id-${String(id)}`, x => x.requests[1].id = id);
bad('N39-unordered-id', x => x.requests.reverse());
for (const field of ['sentAt', 'receivedAt']) for (const value of [undefined, NaN, Infinity]) bad(`N39-${field}-${String(value)}`, x => x.requests[1][field] = value);
bad('N39-inverted-receipt', x => x.requests[1].receivedAt = 99);
for (const field of ['kind', 'target', 'related', 'snapshot']) bad(`N39-trace-${field}`, x => delete x.trace[0][field]);
for (const field of ['schema', 'wall', 'mono', 'active', 'value', 'nodes']) bad(`N39-snapshot-${field}`, x => delete x.frame[field]);
for (const field of ['active', 'visible', 'enabled']) negative(`N44-${field}`, 'directions', directionFixture, x => field === 'active' ? x[3].after.active = 'other' : x[3].after.nodes.captive[field] = false);
negative('N45', 'directions', directionFixture, x => x[4].after.active = 'BODY');
negative('N46-gap', 'directions', directionFixture, x => { for (const record of x.slice(2)) for (const side of ['left', 'right']) { record[side].rows.push(row(2, 215, 216)); record[side].watermark = 2; } });
negative('N46', 'directions', directionFixture, x => x[1].right.rows.push(row(2, 211, 212)));
for (const [id, mutate] of Object.entries({ missing: x => delete x.response.detail, wrong: x => x.response.detail.hero_id = 8, unloaded: x => x.loaded = false, closed: x => x.closed = false })) negative(`N47-${id}`, 'preparation', session.preparation, mutate);
const brackets = {
  B01: x => delete x.inputs[0].start, B02: x => delete x.inputs[0].end, B03: x => x.inputs[0].start = NaN, B04: x => x.inputs[0].end = Infinity,
  B05: x => x.inputs[0].end = 0, B06: x => x.inputs[0].start = 0, B07: x => x.inputs[0].end = 100, B08: x => x.inputs.reverse(),
  B09: x => x.arm.left.wall = 94, B10: x => x.frame.mono = NaN, B11: x => x.frame.mono = 13000,
  B12: x => { const event = snap('summary', false, 110); event.mono = 109; x.trace.splice(1, 0, { kind: 'focusin', target: 'summary', related: 'BODY', snapshot: event }); },
  B13: x => { const event = snap('summary', false, 110); event.wall = 109; x.trace.splice(1, 0, { kind: 'focusin', target: 'summary', related: 'BODY', snapshot: event }); },
};
for (const [id, mutate] of Object.entries(brackets)) bad(id, mutate);
check('positive-transient-BODY', () => { const x = trial(); x.trace.unshift({ kind: 'focusout', target: 'templates', related: 'null', snapshot: snap('BODY', true, 100) }); validate('trial', x, { variant: 'fixed' }); });
check('positive-intermediate-event', () => { const x = trial(); x.trace.splice(1, 0, { kind: 'focusin', target: 'summary', related: 'BODY', snapshot: snap('summary', false, 110) }); validate('trial', x, { variant: 'fixed' }); });
check('positive-equal-boundaries', () => { const x = trial(); x.arm.after.wall = x.arm.before.wall; x.arm.after.mono = x.arm.before.mono; validate('trial', x, { variant: 'fixed' }); });
let released = 0, cleaned = 0, stopped = false;
const handle = { evaluate: async fn => fn({ dispose: () => cleaned++ }), dispose: async () => released++ };
await withProbe(async () => handle, async () => {}, () => {}, () => {});
check('positive-clean-disposal', () => assert.deepEqual([cleaned, released], [1, 1]));
await assert.rejects(withProbe(async () => { stopped = true; return handle; }, async () => assert.fail('late use'), () => { if (stopped) throw new InfrastructureError('stopped'); }, () => {}));
check('N51-late-acquisition', () => assert.deepEqual([cleaned, released], [2, 2]));
for (const operation of ['evaluate', 'dispose']) {
  await assert.rejects(withProbe(async () => ({ ...handle, [operation]: async () => { throw new Error('transport'); } }), async () => {}, () => {}, () => {}), InfrastructureError);
  check(`N56-${operation}`, () => {});
}
// Exercise actual browser installer without launching a browser or mutating product code.
function browser(failObserve = false) {
  let clock = 1, frame, disconnected = 0, removed = 0;
  const nodes = Object.fromEntries(names.map(name => [name, { name, isConnected: true, open: true, value: '1017', parentElement: null, getClientRects: () => [1], matches: () => false,
    contains(other) { return name === 'panel' || ['host', 'summary', 'templates', 'select'].includes(other?.name) && name === 'host'; },
    addEventListener() {}, removeEventListener() { removed++; } }]));
  nodes.summary.parentElement = nodes.host;
  const map = { '[data-role="hero-recruit-host"]': nodes.host, '[data-role="hero-recruit-host"] > summary': nodes.summary, '[data-action="refresh-templates"]': nodes.templates, '[data-field="template-select"]': nodes.select, '[data-action="refresh-heroes"]': nodes.outside, '[data-action="refresh-captive-list"]': nodes.captive };
  nodes.panel.querySelector = selector => map[selector];
  const document = { body: {}, activeElement: nodes.templates, querySelector: () => nodes.panel, addEventListener() {}, removeEventListener() { removed++; } };
  const state = { document, performance: { now: () => clock }, Date: { now: () => clock }, getComputedStyle: () => ({ visibility: 'visible', display: 'block' }), structuredClone,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frame = fn; return 1; }, cancelAnimationFrame() {},
    MutationObserver: class { constructor(fn) { state.mutate = fn; } observe() { if (failObserve) throw Error('install interrupted'); } disconnect() { disconnected++; } } };
  return { state, nodes, next: () => { clock++; }, frame: () => frame(), counts: () => [disconnected, removed] };
}
const broken = browser(true);
check('N57-partial-install', () => { assert.throws(() => runInNewContext(`(${installProbe})()`, broken.state)); assert.deepEqual(broken.counts(), [1, 3]); });
const b = browser(), probe = runInNewContext(`(${installProbe})()`, b.state);
probe.arm(); b.next(); b.nodes.host.open = false; b.state.document.activeElement = b.nodes.summary; b.state.mutate(); b.next(); b.frame();
check('positive-actual-first-close-frame', () => { const saved = probe.read(); assert.equal(saved.close.wall, 2); assert.equal(saved.frame.wall, 3); b.next(); b.state.mutate(); assert.equal(probe.read().close.wall, 2); assert.equal(saved.trace.length, 3); });
probe.dispose(); check('positive-actual-cleanup', () => assert.deepEqual(b.counts(), [1, 3]));
console.log(`${checks} observer actual-helper controls passed`);
