import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadCanonicalProto, verifyFixtures, verifyOutcomes } from './existing_account_native.mjs';

const root = resolve(import.meta.dirname, '../..'), require = createRequire(`${root}/client/package.json`);
test('actual canonical loader avoids legacy duplicate declarations', () => {
  const proto = loadCanonicalProto(root, require('protobufjs'));
  for (const route of ['account.v1.Register', 'account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.CreateCity', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState']) {
    for (const suffix of ['Request', 'Response']) assert.ok(proto.lookupType(`sanguo.${route}${suffix}`));
  }
  assert.equal(proto.lookupType('sanguo.account.v1.EnterGameServerResponse').fields.account_id.id, 6);
});
test('refused non-Actions runner stays failed through evidence tee without raw diagnostics', () => {
  const child = spawnSync('bash', ['-euo', 'pipefail', '-c', 'node .github/scripts/existing_account_native.mjs 2>&1 | tee /dev/null'],
    { cwd: root, env: { ...process.env, GITHUB_ACTIONS: 'false' }, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 1); assert.match(child.stdout, /failed at preflight/); assert.doesNotMatch(child.stdout, /AssertionError|\.stack/);
});

function fixture() {
  const accounts = Object.fromEntries(['a', 'b', 'empty', 'demo'].map((label, i) => [label,
    { accountId: i + 1, playerId: i + 11, serverId: 1, ...(label === 'empty' ? {} : { cityId: i + 21, cityName: `Native ${label}` }) }]));
  const snapshot = {
    accounts: Object.values(accounts).map(a => ({ account_id: a.accountId, status: 1 })),
    players: Object.values(accounts).map(a => ({ player_id: a.playerId, account_id: a.accountId, server_id: 1 })),
    cities: Object.values(accounts).filter(a => a.cityId).map(a => ({ city_id: a.cityId, name: a.cityName, player_id: a.playerId, server_id: 1 })),
  };
  return { accounts, snapshot };
}
test('complete real-fixture identity oracle', () => { const f = fixture(); verifyFixtures(f.snapshot, f.accounts); });
for (const [name, change] of [
  ['duplicate accounts', f => { f.accounts.b.accountId = f.accounts.a.accountId; }],
  ['duplicate players', f => { f.accounts.b.playerId = f.accounts.a.playerId; }],
  ['duplicate cities', f => { f.accounts.b.cityId = f.accounts.a.cityId; }],
  ['missing persisted account', f => { f.snapshot.accounts.pop(); }],
  ['unexpected account', f => { f.snapshot.accounts.push({ account_id: 99, status: 1 }); }],
  ['banned actor', f => { f.snapshot.accounts[0].status = 2; }],
  ['cross-account player', f => { f.snapshot.players[0].account_id = 2; }],
  ['cross-shard player', f => { f.snapshot.players[0].server_id = 2; }],
  ['cross-owner city', f => { f.snapshot.cities[0].player_id = 12; }],
  ['missing city', f => { f.snapshot.cities.pop(); }],
  ['no-city unexpectedly provisioned', f => { f.snapshot.cities[2].player_id = 13; }],
  ['unsafe identity', f => { f.accounts.a.accountId = Number.MAX_SAFE_INTEGER + 1; }],
]) test(`reject ${name}`, () => { const f = fixture(); change(f); assert.throws(() => verifyFixtures(f.snapshot, f.accounts)); });
const accounts = fixture().accounts;
const cases = [['account-a', 'a', 'city'], ['wrong-password', 'a', 'bad'], ['no-city', 'empty', 'empty'], ['account-b', 'b', 'city'], ['network-recovered', 'a', 'city'], ['legacy-demo', 'demo', 'city']];
const result = width => ({ viewport: { width, height: width === 1280 ? 720 : 900 }, outcomes: cases.map(([name, key, outcome]) =>
  ({ name, outcome, accountId: accounts[key].accountId, playerId: accounts[key].playerId, cityId: accounts[key].cityId ?? null })), requests: [{}] });
for (const width of [1280, 1600]) test(`complete viewport ${width}`, () => verifyOutcomes(result(width), width, accounts));
for (const name of result(1280).outcomes.map(row => row.name)) test(`missing ${name} fails`, () => {
  const r = result(1280); r.outcomes = r.outcomes.filter(row => row.name !== name); assert.throws(() => verifyOutcomes(r, 1280, accounts));
});
for (const [name, change] of [
  ['duplicate outcome', r => r.outcomes.push(r.outcomes[0])], ['unknown case', r => { r.outcomes[0].name = 'other'; }],
  ['wrong actor', r => { r.outcomes[0].accountId = 99; }], ['wrong outcome', r => { r.outcomes[0].outcome = 'bad'; }],
  ['empty wire evidence', r => { r.requests = []; }],
]) test(`${name} fails`, () => { const r = result(1280); change(r); assert.throws(() => verifyOutcomes(r, 1280, accounts)); });
test('wrong viewport fails', () => assert.throws(() => verifyOutcomes(result(1600), 1280, accounts)));
