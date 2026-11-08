import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import protobuf from 'protobufjs';
import { observer, validateTraffic, economy, membership, validateEnvironment, provenance, guarded, finishOwned, CREATE, LIST } from './live_guild_presence_runtime.mjs';
const root = new protobuf.Root(), repo = path.resolve(process.env.QA_PROTO_ROOT || '..');
for (const file of ['common/v1/envelope.proto', 'common/v1/types.proto', 'account/v1/account.proto', 'chat/v1/chat.proto', 'guild/v1/guild.proto', 'domestic/v1/domestic.proto', 'world/v1/world.proto'])
  protobuf.parse(readFileSync(path.join(repo, 'spec/proto/sanguo', file), 'utf8'), root, { keepCase: true });
protobuf.parse(readFileSync(path.join(repo, 'client/proto/sanguo/hero/v1/hero.proto'), 'utf8'), root, { keepCase: true }); root.resolveAll();
const type = name => root.lookupType(`sanguo.${name}`);
const encode = (name, value) => type(name).encode(type(name).fromObject(value)).finish();
const decode = (name, bytes) => type(name).toObject(type(name).decode(bytes), { longs: Number, defaults: true });
const enums = { loginFailure: root.lookupEnum('sanguo.common.v1.ErrorCode').values.ACCOUNT_LOGIN_FAILED, guildChannel: root.lookupEnum('sanguo.chat.v1.ChatChannel').values.CHAT_CHANNEL_GUILD };
assert.throws(() => observer(decode, [], { ...enums, loginFailure: 20000 }));
assert.throws(() => observer(decode, [], { ...enums, guildChannel: 2 }));
let passes = 0;
const check = (name, fn) => { fn(); passes++; console.log(`PASS ${name}`); };
function fixture() {
  const requests = [], o = observer(decode, requests, enums); let sequence = 0;
  function send(route, request = {}, id = `t${++sequence}`) {
    const bytes = [CREATE, LIST, 'hero.v1.ListPlayerHeroes', 'chat.v1.ListChatMessages', 'domestic.v1.GetCityState'].includes(route) ? encode(`${route}Request`, request) : new Uint8Array();
    o.sent(encode('common.v1.ClientPacket', { route, payload: bytes, trace_id: id, session_id: 'NEVER_SAVE_SESSION', server_id: 1 }), 10); return id;
  }
  function receive(id, route, response = {}, code = 0, at = 11) {
    const data = typeExists(`${route}Response`) ? encode(`${route}Response`, response) : new Uint8Array();
    o.received(encode('common.v1.ServerPacket', { trace_id: id, data, code }), at);
  }
  function exchange(route, request, response, code = 0) { const id = send(route, request); receive(id, route, response, code); }
  exchange('account.v1.Login', {}, {}, enums.loginFailure);
  exchange('account.v1.Register', {}, {});
  exchange('account.v1.Login', {}, { player: { player_id: 9 }, session_id: 'NEVER_SAVE_AUTH' });
  exchange('account.v1.EnterGameServer', {}, { player: { player_id: 9 } });
  exchange('world.v1.CreateCity', {}, { city: { city_id: 5, server_id: 1, player_id: 9 } });
  exchange('hero.v1.ListPlayerHeroes', { server_id: 1, page_size: 50, page_offset: 0 }, {});
  exchange('domestic.v1.GetCityState', { city_id: 5 }, { production_rates: { food: 120 } });
  const guild = { guild_id: 7, server_id: 1, name: 'GuildPresenceQA', leader_player_id: 9, member_count: 1 };
  exchange(CREATE, { server_id: 1, name: 'GuildPresenceQA' }, { guild });
  const list = () => exchange(LIST, { server_id: 1, guild_id: 7, page: 1, page_size: 50 }, { guild, total_count: 1, members: [{ player_id: 9, role: 1 }] });
  return { o, requests, send, receive, exchange, guild, list };
}
function typeExists(name) { try { type(name); return true; } catch { return false; } }
check('real protobuf normal flow and sanitized evidence', () => {
  const f = fixture(); f.list(); f.list(); validateTraffic(f.requests); assert.equal(f.o.pending.size, 0);
  assert.ok(!JSON.stringify(f.requests).includes('NEVER_SAVE')); assert.ok(!JSON.stringify(f.requests).includes('trace_id'));
  f.exchange('chat.v1.ListChatMessages', { server_id: 1, channel: 3, guild_id: 7, limit: 30 }, {});
  validateTraffic(f.requests);
});
for (const route of ['chat.v1.SendChatMessage', 'guild.v1.JoinGuild', 'guild.v1.LeaveGuild', 'hero.v1.RecruitHero', 'unknown'])
  check(`reject ${route}`, () => assert.throws(() => fixture().send(route)));
check('duplicate/missing trace, unmatched/duplicate reply, earlier reply', () => {
  for (const id of ['', 't1']) assert.throws(() => fixture().send('world.v1.ListPlayerCities', {}, id));
  assert.throws(() => fixture().receive('unknown', LIST));
  const completed = fixture(), done = completed.send('world.v1.ListPlayerCities'); completed.receive(done, 'world.v1.ListPlayerCities');
  assert.throws(() => completed.receive(done, 'world.v1.ListPlayerCities'));
  const f = fixture(), id = f.send('world.v1.ListPlayerCities'); assert.throws(() => f.receive(id, 'world.v1.ListPlayerCities', {}, 0, 9));
});
check('extra mutation, hero request, missing/extra list and pending', () => {
  const f = fixture(); assert.throws(() => f.send(CREATE, { server_id: 1, name: 'GuildPresenceQA' }));
  assert.throws(() => f.send('hero.v1.ListPlayerHeroes', { server_id: 1, page_size: 50 }));
  assert.throws(() => validateTraffic(f.requests)); f.list(); f.list(); assert.throws(f.list);
  f.send('world.v1.ListPlayerCities'); assert.throws(() => validateTraffic(f.requests));
});
check('guild request and reply identity guards', () => {
  for (const change of [{ guild_id: 8 }, { server_id: 2 }, { page: 2 }, { page_size: 49 }])
    assert.throws(() => fixture().send(LIST, { server_id: 1, guild_id: 7, page: 1, page_size: 50, ...change }));
  const f = fixture(), id = f.send(LIST, { server_id: 1, guild_id: 7, page: 1, page_size: 50 });
  assert.throws(() => f.receive(id, LIST, { guild: f.guild, total_count: 1, members: [{ player_id: 10, role: 1 }] }));
});
check('private chat and wrong own guild rejected', () => {
  for (const request of [{ channel: 2 }, { channel: 3, guild_id: 8 }, { channel: 1, peer_player_id: 9 }])
    assert.throws(() => fixture().send('chat.v1.ListChatMessages', { server_id: 1, limit: 30, ...request }));
});
const before = { identity: [1, 9, 5], wallet: { food: 100, wood: 0, stone: 0, iron: 0, gold: 0 }, ns: '1794000000000000000', remainders: { food: '0', wood: '0', stone: '0', iron: '0' }, assets: { items: [], heroes: [], buildings: [] } };
check('BigInt exact creation and rational passive food', () => {
  economy(before, structuredClone(before), true);
  const after = structuredClone(before); after.ns = String(BigInt(before.ns) + 30000000000n); after.wallet.food++;
  economy(before, after); assert.throws(() => economy(before, after, true));
});
check('reject economic drift, invalid time, unsafe numbers, cap, asset or owner drift', () => {
  for (const mutate of [s => s.wallet.gold++, s => s.wallet.food++, s => s.wallet.food = 50000,
    s => s.ns = Number(s.ns), s => s.ns = String(BigInt(s.ns) - 1n), s => s.ns = String(BigInt(s.ns) + 300000000001n),
    s => s.remainders.food = '3600000000000', s => s.assets.items.push({}), s => s.identity[1]++]) {
    const after = structuredClone(before); mutate(after); assert.throws(() => economy(before, after));
  }
});
check('SQL membership binds real IDs and role', () => {
  const s = { guilds: [{ server_id: 1, guild_id: 7, leader_player_id: 9, member_count: 1 }], members: [{ server_id: 1, guild_id: 7, player_id: 9, role: 1 }] };
  membership(s, 9, 7); assert.throws(() => membership(s, 8, 7)); s.members.push(s.members[0]); assert.throws(() => membership(s, 9, 7));
});
check('environment and provenance reject local/mismatched inputs', () => {
  const env = { GITHUB_ACTIONS: 'true', DATABASE_URL: 'postgres://localhost@127.0.0.1/live_guild_presence', PGHOST: '127.0.0.1', PGDATABASE: 'live_guild_presence', REDIS_ADDR: '127.0.0.1:6379', QA_PRODUCT: 'fixed', QA_WIDTH: '1280' };
  validateEnvironment(env); assert.throws(() => validateEnvironment({ ...env, GITHUB_ACTIONS: '' })); assert.throws(() => validateEnvironment({ ...env, QA_WIDTH: '800' }));
  const head = 'a'.repeat(40), tree = 'b'.repeat(40); provenance({ head, tree, parents: head }, head, tree, head);
  assert.throws(() => provenance({ head, tree, parents: tree }, head, tree, head));
});
const abort = new AbortController(); abort.abort(); await assert.rejects(guarded(abort.signal, () => assert.fail('must not run')));
const state = { children: [], stopped: new WeakSet(), report: { passed: true, errors: ['failure'], cleanup: [] } };
await finishOwned(state); assert.equal(state.report.passed, false);
console.log(`PASS ${passes} grouped production-protobuf controls; no browser or services started`);
