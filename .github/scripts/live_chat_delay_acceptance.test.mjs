import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { controlled, relayEvidence } from './live_chat_delay_acceptance.mjs';
import { SEND, LIST } from './live_chat_runtime.mjs';
import { MIXED, CASES } from './live_chat_unicode.mjs';
import { PROFILE } from './live_chat_tcp_delay.mjs';
const hash = 'a'.repeat(64), clone = value => structuredClone(value);
function fixture() {
  const event = { at: 1000, trusted: true, value: MIXED + 'Z', counter: '501/500', draft: MIXED + 'Z' };
  const report = { passed: true, product: 'fixed', fixedAcceptance: true, errors: [], cases: CASES.map(c => c[0]), inputs: [event],
    cleanup: [10, 11].map((pid, i) => ({ pid, name: i ? 'server' : 'bootstrap', owned: true, aliveBeforeStop: true, requestedSignal: 'SIGTERM', exitCode: 0, signal: null })),
    pending: { observed: true, events: [event], start: [0, 0], end: [0, 0], send: 6 },
    requests: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, route: SEND, sentAt: 0.5, receivedAt: 1.5, code: 0, request: { server_id: 1, channel: 1, guild_id: 0, content: MIXED },
      response: { message: { message_id: i + 1, sender_player_id: 1, server_id: 1, channel: 1, recipient_player_id: 0, guild_id: 0, content: MIXED, sent_at_ms: 1000 }, limits: { max_content_length: 500 } } })) };
  const databaseRows = report.requests.map(s => ({ ...s.response.message, channel_id: 1, ref_id: 0 }));
  report.requests.push({ id: 7, route: LIST, sentAt: 2, receivedAt: 2.5, code: 0,
    request: { server_id: 1, channel: 1, guild_id: 0, peer_player_id: 0, before_message_id: 0, limit: 30 },
    response: { messages: report.requests.map(s => clone(s.response.message)), limits: { max_content_length: 500 } } });
  const relay = { profile: PROFILE, clock: 'node performance.now milliseconds', stopped: true, pending: 0, errors: [], connections: [
    { id: 1, pending: 0, closed: 2, directions: ['c2s', 's2c'].map((name, i) => ({ name, delay: i * 500, received: 1, written: 1,
      discarded: 0, eof: true, fin: true, inputHash: hash, outputHash: hash, chunks: [
        { ordinal: 0, offset: 0, length: 1, arrived: 0, eligible: i * 500, start: i * 500, complete: i * 500 + 1, backpressure: false }] })) }] };
  return { report, signals: [{ index: 0, original: event, trusted: true, value: event.value, disabled: true }],
    db: { total: 6, rows: databaseRows },
    launchers: [10, 11].map(launcherPid => ({ launcherPid, profile: PROFILE, binaryHash: hash, clean: true, phase: 'stopped', requested: 'SIGTERM', errors: [],
      listenPort: 8080, targetPort: 18080, child: { pid: launcherPid + 100, owned: true, aliveBeforeStop: true, termRequested: true, forced: false, exitCode: 0, signal: null }, relay: clone(relay) })), hash };
}
const run = x => controlled(x.report, x.signals, x.db, x.launchers, x.hash, 1);
run(fixture()); const baseline = fixture(); baseline.report.product = 'baseline'; baseline.report.requests = []; baseline.db = { total: 0, rows: [] }; run(baseline);
const mutations = [
  x => { const r = clone(x.report.requests.at(-1)); r.id = 8; r.sentAt = 3; r.receivedAt = 4; r.response.messages.pop(); x.report.requests.push(r); },
  x => { const r = clone(x.report.requests.at(-1)); r.id = 8; r.sentAt = 3; r.receivedAt = 4; r.response.messages.push({ ...r.response.messages[0], message_id: 99 }); x.report.requests.push(r); },
  x => x.report.requests.at(-1).response.messages.pop(), x => x.report.requests.at(-1).code = 1,
  x => x.report.requests.at(-1).response.messages.push({ ...x.report.requests[0].response.message, message_id: 99 }),
  x => x.report.requests.push({ ...clone(x.report.requests.at(-1)), id: 8, sentAt: 3, receivedAt: 4, code: 1 }),
  x => x.report.errors.push('error'), x => x.report.cases.pop(), x => x.report.pending.send = 'wrong',
  x => x.report.pending.start = [2, 2], x => x.report.pending.end = [2, 2], x => x.report.pending.events[0].trusted = false,
  x => x.report.pending.events[0].counter = '1/500', x => x.report.pending.events[0].draft = 'Z',
  x => x.report.requests[5].receivedAt = 0.9, x => x.report.requests[5].sentAt = 1.1,
  x => x.report.passed = false, x => x.report.product = 'other', x => x.report.fixedAcceptance = false,
  x => x.report.pending.observed = false, x => x.report.pending.events = [], x => x.report.pending.events.push(x.report.pending.events[0]),
  x => x.signals = [], x => x.signals.push(x.signals[0]), x => x.signals[0].disabled = false,
  x => x.signals[0].trusted = false, x => x.signals[0].value = 'Z', x => x.signals[0].index = 1,
  x => x.report.inputs = [], x => x.signals[0].original = { ...x.signals[0].original, at: 1001 },
  x => x.db.total = 5, x => x.db.rows.pop(), x => x.db.rows[1] = x.db.rows[0],
  x => x.report.requests.splice(5, 1), x => x.report.requests.push(x.report.requests[0]), x => x.hash = 'invalid',
  x => x.report.cleanup.pop(), x => x.launchers.pop(), x => x.launchers.push(x.launchers[0]),
  x => x.launchers[0].launcherPid = 9, x => x.launchers[0].clean = false, x => x.launchers[0].phase = 'ready',
  x => x.launchers[0].requested = 'early exit', x => x.launchers[0].binaryHash = 'b'.repeat(64),
  x => x.launchers[0].profile = 'undelayed', x => x.launchers[0].errors.push('failure'),
  x => x.launchers[0].listenPort = 8081, x => x.launchers[0].targetPort = 8080,
  x => x.launchers[0].child.pid = 10, x => x.launchers[0].child.pid = 111,
];
for (const key of ['message_id', 'sender_player_id', 'server_id', 'channel', 'content', 'sent_at_ms', 'ref_id', 'channel_id']) mutations.push(x => x.db.rows[0][key] = -1);
for (const key of ['owned', 'aliveBeforeStop', 'termRequested']) mutations.push(x => x.launchers[0].child[key] = false);
mutations.push(x => x.launchers[0].child.forced = true, x => x.launchers[0].child.exitCode = 1, x => x.launchers[0].child.signal = 'SIGKILL');
for (const key of ['owned', 'aliveBeforeStop', 'requestedSignal', 'exitCode', 'signal']) mutations.push(x => x.report.cleanup[0][key] = 'invalid');
const relayMutations = [
  r => r.clock = 'wall clock',
  r => r.profile = 'wrong', r => r.stopped = false, r => r.pending = 1, r => r.errors.push('error'), r => r.connections = [],
  r => r.connections[0].id = 2, r => r.connections[0].pending = 1, r => r.connections[0].closed = 1,
  r => r.connections[0].directions.reverse(), r => r.connections[0].directions.pop(),
];
for (const key of ['delay', 'discarded', 'received', 'written']) relayMutations.push(r => r.connections[0].directions[0][key] = 9);
for (const key of ['eof', 'fin']) relayMutations.push(r => r.connections[0].directions[0][key] = false);
for (const key of ['inputHash', 'outputHash']) relayMutations.push(r => r.connections[0].directions[0][key] = 'bad');
for (const key of ['ordinal', 'offset', 'length', 'eligible', 'start', 'complete']) relayMutations.push(r => r.connections[0].directions[1].chunks[0][key] = -1);
relayMutations.push(r => r.connections[0].directions[0].chunks = [], r => r.connections[0].directions[0].chunks[0].arrived = NaN);
let negatives = 0;
for (const mutate of mutations) { const x = fixture(); mutate(x); assert.throws(() => run(x)); negatives++; }
for (const mutate of relayMutations) { const r = fixture().launchers[0].relay; mutate(r); assert.throws(() => relayEvidence(r)); negatives++; }
assert.throws(() => run({ ...baseline, db: { total: 1, rows: [] } })); negatives++;
console.log(`${negatives} controlled gate rejection controls plus fixed/baseline positives; pure fixtures, not native acceptance`);
const source = readFileSync(new URL('./live_chat_delay_acceptance.mjs', import.meta.url), 'utf8').split('export async function run()')[1];
assert.ok(source.indexOf('await withChatRuntime(') < source.indexOf('controlled(report, result.signals'));
assert.ok(source.indexOf('controlled(report, result.signals') < source.indexOf('result.controlledAcceptance ='));
