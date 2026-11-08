import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEND, LIST, observer, destination, validateTraffic, clockBracket, pendingWitness, validateEnvironment, provenance, guarded, finishOwned } from './live_chat_runtime.mjs';
let checks = 0;
const reject = fn => { assert.throws(fn); checks++; };
const good = { server_id: 1, channel: 1, recipient_player_id: 0, guild_id: 0 };
const packet = (trace = 'a', route = SEND, request = good) => ({ trace_id: trace, route, payload: request });
const response = (trace = 'a', code = 0) => ({ trace_id: trace, code, data: { message: { message_id: 1 }, player: { player_id: 2 } } });
const make = () => { const requests = []; return { requests, wire: observer((_, value) => value, requests) }; };
for (const [key, value] of [['server_id', 2], ['server_id', 0], ['channel', 2], ['channel', 3], ['guild_id', 1], ['peer_player_id', 1], ['recipient_player_id', 1]]) reject(() => destination({ ...good, [key]: value }));
destination(good); destination({ server_id: 1, channel: 1 });
for (const route of ['hero.v1.RecruitHero', 'hero.v1.ListPlayerHeroes', 'military.v1.CreateMarch', 'guild.v1.JoinGuild', 'unknown']) reject(() => make().wire.sent(packet('a', route), 1));
for (const route of [SEND, LIST]) {
  const { requests, wire } = make(); wire.sent(packet('a', route), 1); wire.received(response(), 2);
  assert.equal(wire.pending.size, 0); assert.equal(requests.length, 1); assert.equal(requests[0].code, 0);
  assert.equal(requests[0].id, 1); assert.equal(requests[0].sentAt, 1); assert.equal(requests[0].receivedAt, 2);
  assert.ok(!JSON.stringify(requests).includes('trace_id')); assert.ok(!JSON.stringify(requests).includes('session_id'));
  reject(() => wire.received(response(), 3)); reject(() => wire.sent(packet('a', route), 4));
}
for (const trace of ['', undefined]) reject(() => make().wire.sent({ ...packet(), trace_id: trace }, 1));
{
  const { wire } = make(); wire.sent(packet(), 1); reject(() => wire.sent(packet(), 2));
  reject(() => wire.received(response('other'), 2)); reject(() => wire.received(response(), 0));
}
{
  const { wire } = make(); for (let n = 0; n < 6; n++) { wire.sent(packet(String(n)), n); wire.received(response(String(n)), n + 0.5); }
  reject(() => wire.sent(packet('seventh'), 8));
}
{
  const { requests, wire } = make(); wire.sent(packet('login', 'account.v1.Login'), 1); wire.received(response('login'), 2);
  assert.equal(requests[0].owner, 2); assert.equal(requests[0].request, undefined); assert.equal(requests[0].response, undefined);
  wire.sent(packet('failed', 'account.v1.Login'), 3); wire.received(response('failed', 20001), 4); assert.equal(requests[1].owner, undefined);
}
const base = ['account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.CreateCity'].map(route => ({ route, code: 0, receivedAt: 2 }));
const sends = Array.from({ length: 6 }, () => ({ route: SEND, request: { ...good }, code: 0, receivedAt: 3 }));
validateTraffic(base, 'baseline'); validateTraffic([...base, ...sends], 'fixed');
for (const name of ['account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.CreateCity']) {
  reject(() => validateTraffic(base.filter(r => r.route !== name), 'baseline'));
  reject(() => validateTraffic([...base, base.find(r => r.route === name)], 'baseline'));
  reject(() => validateTraffic(base.map(r => r.route === name ? { ...r, code: 1 } : r), 'baseline'));
}
for (const rows of [[...base, sends[0]], [...base, ...sends.slice(1)], [...base, ...sends, sends[0]]]) reject(() => validateTraffic(rows, 'fixed'));
reject(() => validateTraffic([...base, sends[0]], 'baseline')); reject(() => validateTraffic(base, 'other'));
for (const extra of [{ route: 'unknown', receivedAt: 2 }, { route: LIST, request: good }, { route: LIST, request: good, receivedAt: 3, code: 1 }]) reject(() => validateTraffic([...base, extra], 'baseline'));
const env = { GITHUB_ACTIONS: 'true', DATABASE_URL: 'postgres://test@127.0.0.1/live_chat_unicode', PGHOST: '127.0.0.1', PGDATABASE: 'live_chat_unicode', REDIS_ADDR: '127.0.0.1:6379', QA_PRODUCT: 'fixed' };
validateEnvironment(env); validateEnvironment({ ...env, QA_PRODUCT: 'baseline' });
for (const [key, value] of Object.entries({ GITHUB_ACTIONS: 'false', DATABASE_URL: 'postgres://test@remote/live_chat_unicode', PGHOST: 'remote', PGDATABASE: 'production', REDIS_ADDR: 'remote:6379', QA_PRODUCT: 'other' })) reject(() => validateEnvironment({ ...env, [key]: value }));
reject(() => validateEnvironment({ ...env, DATABASE_URL: 'postgres://test@127.0.0.1/production' }));
const head = '1'.repeat(40), tree = '2'.repeat(40), parents = '3'.repeat(40), actual = { head, tree, parents };
provenance(actual, head, tree, parents);
for (const key of ['head', 'tree', 'parents']) reject(() => provenance({ ...actual, [key]: '4'.repeat(40) }, head, tree, parents));
reject(() => provenance(actual, undefined, tree, parents)); reject(() => provenance(actual, head, '', parents));
assert.deepEqual(clockBracket(1000, 102, 2000), [100, 101]);
for (const args of [[2, 1, 1], [NaN, 1, 2], [1, Infinity, 2], [1, 2, NaN]]) reject(() => clockBracket(...args));
const event = { trusted: true, at: 2000 };
assert.equal(pendingWitness([99.9, 100.1], [99.95, 100.05], event, 101, 103), true);
for (const [sent, reply] of [[102, 103], [101, 102], [101.9, 103], [101, 102.1], [103, 101]]) assert.equal(pendingWitness([99.9, 100.1], [99.95, 100.05], event, sent, reply), false);
reject(() => pendingWitness([99, 100], [101, 102], event, 98, 110));
reject(() => pendingWitness([101, 100], [99, 102], event, 98, 110));
reject(() => pendingWitness([NaN, 100], [99, 102], event, 98, 110));
reject(() => pendingWitness([99, 100], [99, 100], { ...event, trusted: false }, 98, 110));
reject(() => pendingWitness([99, 100], [99, 100], { ...event, at: NaN }, 98, 110));
reject(() => pendingWitness([99, 100], [99, 100], event, NaN, 110));
{
  const controller = new AbortController(); let called = 0;
  assert.equal(await guarded(controller.signal, () => ++called), 1);
  await assert.rejects(guarded(controller.signal, () => { controller.abort(new Error('during action')); return ++called; }), /during action/);
  await assert.rejects(guarded(controller.signal, () => ++called), /during action/); assert.equal(called, 2);
}
{
  const controller = new AbortController(); let continued = false, release;
  const waiting = guarded(controller.signal, () => new Promise(resolve => { release = resolve; })).then(() => { continued = true; });
  controller.abort(new Error('late action')); release(); await assert.rejects(waiting, /late action/); assert.equal(continued, false);
}
for (const failure of ['prior-exit', 'kill-throws', 'none']) {
  const report = { passed: true, errors: [], cleanup: [] };
  const child = { pid: 17, exitCode: failure === 'prior-exit' ? 0 : null, signalCode: null,
    kill() { if (failure === 'kill-throws') throw new Error('kill failed'); this.exitCode = 0; return true; } };
  const state = { report, stopped: new WeakSet(), children: [{ child, name: 'server', pid: 17 }] };
  await finishOwned(state); assert.equal(report.passed, failure === 'none'); assert.equal(report.errors.length > 0, failure !== 'none');
}
{
  const report = { passed: true, errors: [], cleanup: [] };
  await finishOwned({ report, children: [], stopped: new WeakSet() }, { server: { process() { throw new Error('browser failed'); } } });
  assert.equal(report.passed, false); assert.deepEqual(report.errors, ['browser failed']);
}
const source = readFileSync(new URL('./live_chat_runtime.mjs', import.meta.url), 'utf8');
for (const required of ['chromiumSandbox: true', 'acquireOwned', 'deadlineRace', 'Network.webSocketFrameSent', 'Network.webSocketFrameReceived', "timeDomain: 'timeTicks'", 'event.isTrusted', 'document.addEventListener', 'networkStart', 'networkEnd']) assert.ok(source.includes(required), required);
for (const forbidden of ['withHeroRuntime(', 'page.route(', 'routeWebSocket(', 'dispatchEvent(', '.fill(', 'new WebSocket(']) assert.ok(!source.includes(forbidden), forbidden);
console.log(`PASS ${checks} rejection controls plus protocol, timing, lifecycle and provenance positives; no browser or service started`);
