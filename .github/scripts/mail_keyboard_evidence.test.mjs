import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { setup, spec, timestamp } from './mail_keyboard_state.test.mjs';
import { createMailVerifier, verifyMailObservations } from './mail_keyboard_evidence.mjs';
const repository = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(join(repository, 'client/package.json'));
const protobuf = require('protobufjs'), root = new protobuf.Root();
for (const folder of ['spec/proto', 'client/proto/sanguo/content', 'client/proto/sanguo/hero']) {
  for (const file of readdirSync(join(repository, folder), {recursive: true}).filter(file => file.endsWith('.proto')))
    protobuf.parse(readFileSync(join(repository, folder, file), 'utf8'), root, {keepCase: true});
}
root.resolveAll();
// Mirror CLIENT-059 only on older product pins where field 3 is not yet declared.
const cityType = root.lookupType('sanguo.domestic.v1.GetCityStateResponse');
if (!cityType.fields.production_rates) cityType.add(new protobuf.Field('production_rates', 3, 'sanguo.common.v1.ResourceWallet'));
const encode = (name, value) => { const type = root.lookupType(`sanguo.${name}`); return type.encode(type.fromObject(value)).finish(); };
const make = () => createMailVerifier({ protoRoot: root, fixtureSpec: [] });
function wire(v = make()) {
  let seq = 0, clock = 0, token = '', server = 0;
  function send(route, input, envelope = {}) {
    const trace = `t${++seq}`;
    v.observeSent(encode('common.v1.ClientPacket', { route, payload: encode(`${route}Request`, input), trace_id: trace, session_id: token, server_id: server, ...envelope }), ++clock);
    return trace;
  }
  function receive(trace, route, output, code = 0) {
    v.observeReceived(encode('common.v1.ServerPacket', { trace_id: trace, code, data: code ? new Uint8Array() : encode(`${route}Response`, output) }), ++clock);
  }
  const rpc = (route, input, output, code = 0) => receive(send(route, input), route, output, code);
  function startup() {
    rpc('account.v1.ListGameServers', { page: 1, page_size: 50 }, { servers: [{ shard: { server_id: 1 } }], total_count: 1 });
    rpc('account.v1.Login', { login_name: 'demo', password: 'demo123', server_id: 1 }, {}, 20001);
    rpc('account.v1.Register', { login_name: 'demo', password: 'demo123' }, { account_id: '1' });
    const login = { session_id: 'secret-session', player: { server_id: 1, player_id: '2' } };
    rpc('account.v1.Login', { login_name: 'demo', password: 'demo123', server_id: 1 }, login); token = login.session_id; server = 1;
    rpc('account.v1.EnterGameServer', { server_id: 1 }, { ...login, server_id: 1, account_id: '1' });
    rpc('world.v1.ListPlayerCities', {}, { cities: [] });
    rpc('world.v1.CreateCity', { server_id: 1, name: '主城', x: 60, y: 60 }, { city: { city_id: '3', name: '主城', x: 60, y: 60 } });
    rpc('domestic.v1.GetCityState', { city_id: '3' }, {});
  }
  return { v, send, receive, rpc, startup, advanceClock: value => { clock = value; } };
}
test('actual production protobuf startup captures identity without token disclosure', () => {
  const w = wire(); w.startup();
  assert.deepEqual(w.v.identity(), { account_id: '1', player_id: '2', server_id: 1, city_id: '3' });
  w.rpc('content.v1.ListPlayerMail', { server_id: 1, filter: 1, page_size: 1, page_offset: 0 }, { mails: [], total_count: 0 });
  assert.equal(w.v.pendingCount, 0);
  assert.ok(!JSON.stringify(w.v.evidence()).includes('secret-session'));
  assert.equal(w.v.evidence().nativeAcceptance, false);
});
const invalidRequests = [
  ['content.v1.ClaimPlayerMailAttachments', { server_id: 1, mail_id: '1' }],
  ['content.v1.MarkPlayerMailRead', { server_id: 1, mail_id: '1' }],
  ['account.v1.Register', { login_name: 'demo', password: 'demo123' }],
  ['domestic.v1.StartBuildingUpgrade', { city_id: '3' }],
  ['content.v1.ListPlayerMail', { server_id: 2, filter: 1, page_size: 1 }],
  ['content.v1.ListPlayerMail', { server_id: 1, filter: 2, page_size: 50 }],
  ['content.v1.ListPlayerMail', { server_id: 1, filter: 1, page_size: 20 }],
  ['content.v1.ListPlayerMail', { server_id: 1, filter: 1, page_size: 1, page_offset: 1 }],
  ['domestic.v1.GetCityState', { city_id: '4' }],
  ['quest.v1.ListPlayerQuests', { server_id: 1, chain_id: 401, include_completed: true }],
  ['chat.v1.ListChatMessages', { server_id: 1, channel: 2, limit: 30 }],
];
for (const [index, [route, input]] of invalidRequests.entries()) test(`forbidden request ${index}`, () => {
  const w = wire(); w.startup(); assert.throws(() => w.send(route, input), /^Error: MAIL_TRACE_REJECTED$/);
  assert.equal(w.v.evidence().phase, 'rejected'); assert.throws(() => w.v.identity());
});
for (const envelope of [{ session_id: 'wrong-secret' }, { server_id: 2 }, { trace_id: 't1' }]) test(`invalid envelope ${Object.keys(envelope)[0]}`, () => {
  const w = wire(); w.startup(); assert.throws(() => w.send('world.v1.ListPlayerCities', {}, envelope));
});
test('malformed, unknown protobuf fields and unmatched replies fail closed', () => {
  for (const bytes of [Uint8Array.of(255), Uint8Array.of(120, 1), new Uint8Array()]) assert.throws(() => make().observeSent(bytes, 1));
  const w = wire(); w.startup(); assert.throws(() => w.receive('missing', 'world.v1.ListPlayerCities', { cities: [] }));
});
test('unsuccessful, duplicate, pending and nonmonotonic observations are rejected', () => {
  let w = wire(); w.startup(); const trace = w.send('world.v1.ListPlayerCities', {});
  assert.throws(() => w.receive(trace, 'world.v1.ListPlayerCities', {}, 10004));
  w = wire(); w.startup(); assert.throws(() => w.v.observeReceived(encode('common.v1.ServerPacket', { trace_id: 't8' }), 100));
  w = wire(); w.startup(); w.send('world.v1.ListPlayerCities', {}); assert.throws(() => w.v.beginFixtures({}));
  w = wire(); w.startup(); assert.throws(() => w.v.observeSent(new Uint8Array(), 0));
});
test('startup order, wrong expected failure and actor mismatch are rejected', () => {
  let w = wire(); assert.throws(() => w.send('account.v1.Register', { login_name: 'demo', password: 'demo123' }));
  w = wire(); assert.throws(() => w.rpc('account.v1.Login', { login_name: 'demo', password: 'demo123', server_id: 1 }, {}, 10004));
  w = wire(); assert.throws(() => w.send('account.v1.Login', { login_name: 'demo', password: 'secret', server_id: 1 }));
});
const old = [{ mail_id: '2', status: 0 }, { mail_id: '1', status: 0 }];
const updated = [{ mail_id: '2', status: 1 }, { mail_id: '1', status: 0 }];
const list = (filter, count, mails, sent = 10, received = 20, page_size = 50) => ({ input: { filter, page_size }, output: { total_count: count, mails }, sent, received });
const window = [{ sent: 0, received: 100 }];
test('COUNT-before SELECT-after and unchanged-count changed-page have feasible common commit', () => {
  verifyMailObservations([old, updated], window, [list(1, 2, [old[1]])]);
  verifyMailObservations([old, updated], window, [list(0, 2, updated)]);
  verifyMailObservations([old, updated], window, [list(1, 2, [old[0]], 0, 10, 1), list(1, 1, [old[1]], 70, 80, 1)]);
});
test('COUNT-after SELECT-before and incompatible global intervals fail', () => {
  assert.throws(() => verifyMailObservations([old, updated], window, [list(1, 1, old)]));
  assert.throws(() => verifyMailObservations([old, updated], window, [list(1, 1, [old[1]], 10, 20), list(1, 2, old, 70, 80)]));
  assert.throws(() => verifyMailObservations([old, updated], window, [list(0, 3, old)]));
  assert.throws(() => verifyMailObservations([old, updated], window, [list(0, 2, [...old].reverse())]));
});
test('unchanged row ambiguity retains alternatives rather than greedily choosing an old state', () => {
  const before = [old[1], old[0]], after = [old[1], updated[0]];
  verifyMailObservations([before, after], window, [list(1, 1, [old[1]], 10, 20), list(0, 2, [old[1]], 70, 80, 1)]);
});
test('fixture insertions use ordered mutation windows, not final-row membership alone', () => {
  const states = [[], [old[1]], old], changes = [{ sent: 5, received: 10 }, { sent: 30, received: 40 }];
  verifyMailObservations(states, changes, [list(0, 1, [old[1]], 15, 20), list(0, 2, old, 45, 50)]);
  assert.throws(() => verifyMailObservations(states, changes, [list(0, 2, old, 15, 20)]));
});
function completeFixture() {
  const x = setup(), w = wire(createMailVerifier({protoRoot: root, fixtureSpec: spec}));
  w.startup(); w.v.beginFixtures(x.initial);
  x.receipts.forEach((receipt, i) => w.v.acceptFixture(receipt, 20 + i * 2, 21 + i * 2));
  x.canonical = x.oracle.finishFixtures(x.state, x.receipts).after;
  w.v.finishFixtures(x.state); w.advanceClock(30);
  return {...x, ...w};
}
for (const mode of ['fixed', 'baseline-pointer']) test(`complete ${mode} wire and SQL combination never claims native acceptance`, () => {
  const x = completeFixture(); assert.deepEqual(x.v.ids(), { D: '1', C: '2', B: '3', A: '4' });
  x.v.beginStep({expectedReadId: null});
  x.rpc(listRoute(), {server_id: 1, filter: 0, page_size: 50}, {mails: x.canonical, total_count: 4});
  x.v.endStep(x.state);
  for (const [index, id] of ['3', '4', '1', '2'].entries()) {
    x.v.beginStep({expectedReadId: id});
    const trace = x.send('content.v1.MarkPlayerMailRead', {server_id: 1, mail_id: id});
    x.state.pgNow = timestamp(index + 8);
    Object.assign(x.state.player_mail.find(row => String(row.mail_id) === id), {status: 1, read_at: timestamp(index + 7)});
    const after = x.oracle.advance(x.state, id).after;
    x.receive(trace, 'content.v1.MarkPlayerMailRead', {mail: after.find(row => row.mail_id === id)});
    x.rpc(listRoute(), {server_id: 1, filter: 1, page_size: 50}, {mails: after.filter(row => row.status === 0), total_count: 3 - index});
    x.v.endStep(x.state);
  }
  assert.equal(x.v.finish(x.state).nativeAcceptance, false);
  assert.equal(x.v.evidence().complete, true);
  const evidence = x.v.evidence(); assert.equal(evidence.steps.length, 5); assert.equal(evidence.mutations.length, 8);
  assert.ok(evidence.observations.filter(row => row.route === 'content.v1.MarkPlayerMailRead').every(row => row.mail.mail.status === 1 && row.received >= row.sent));
  assert.ok(!JSON.stringify(evidence).includes('secret-session'));
  evidence.observations[0].route = 'tampered'; assert.notEqual(x.v.evidence().observations[0].route, 'tampered');
  assert.throws(() => x.v.beginStep({}));
});
function listRoute() { return 'content.v1.ListPlayerMail'; }
for (const mode of ['missing', 'duplicate', 'wrong-id', 'wrong-output', 'pending', 'no-read-state-change']) test(`combined read rejection ${mode}`, () => {
  const x = completeFixture(); x.v.beginStep({expectedReadId: '3'});
  const invoke = () => {
    if (mode === 'missing') return x.v.endStep(x.state);
    const trace = x.send('content.v1.MarkPlayerMailRead', {server_id: 1, mail_id: mode === 'wrong-id' ? '4' : '3'});
    if (mode === 'duplicate') return x.send('content.v1.MarkPlayerMailRead', {server_id: 1, mail_id: '3'});
    if (mode === 'pending') return x.v.endStep(x.state);
    x.state.pgNow = timestamp(8); Object.assign(x.state.player_mail[2], {status: 1, read_at: timestamp(7)});
    const mail = x.oracle.advance(x.state, '3').after.find(row => row.mail_id === '3');
    if (mode === 'wrong-output') mail.body = 'secret-unexpected';
    x.receive(trace, 'content.v1.MarkPlayerMailRead', {mail});
    if (mode === 'no-read-state-change') Object.assign(x.state.player_mail[2], {status: 0, read_at: null});
    return x.v.endStep(x.state);
  };
  assert.throws(invoke, /^Error: MAIL_TRACE_REJECTED$/);
  assert.ok(!JSON.stringify(x.v.evidence()).includes('secret'));
});
test('wrong authenticated player/server and Enter account fail without leaking payload', () => {
  for (const mode of ['player', 'server', 'account', 'session']) {
    const w = wire();
    w.rpc('account.v1.ListGameServers', {page: 1, page_size: 50}, {servers: [{shard: {server_id: 1}}]});
    w.rpc('account.v1.Login', {login_name: 'demo', password: 'demo123', server_id: 1}, {}, 20001);
    w.rpc('account.v1.Register', {login_name: 'demo', password: 'demo123'}, {account_id: '1'});
    if (mode === 'server') assert.throws(() => w.rpc('account.v1.Login', {login_name: 'demo', password: 'demo123', server_id: 1}, {session_id: 'secret', player: {server_id: 2, player_id: '2'}}));
    else {
      // The send helper token remains empty here, so encode the authenticated Enter explicitly.
      w.rpc('account.v1.Login', {login_name: 'demo', password: 'demo123', server_id: 1}, {session_id: 'secret', player: {server_id: 1, player_id: '2'}});
      const trace = w.send('account.v1.EnterGameServer', {server_id: 1}, {session_id: 'secret', server_id: 1});
      assert.throws(() => w.receive(trace, 'account.v1.EnterGameServer', {session_id: mode === 'session' ? 'other-secret' : 'secret', server_id: 1,
        account_id: mode === 'account' ? '99' : '1', player: {server_id: 1, player_id: mode === 'player' ? '99' : '2'}}));
    }
    assert.ok(!JSON.stringify(w.v.evidence()).includes('secret'));
  }
});
