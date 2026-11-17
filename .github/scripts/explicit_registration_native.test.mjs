import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyDelta, verifyOutcomes } from './explicit_registration_native.mjs';
const before = { accounts: [{ account_id: 1, status: 1 }], players: [{ server_id: 1, player_id: 11, account_id: 1 }], cities: [{ city_id: 21, player_id: 11 }] };
const actor = { accountId: 2, playerId: 12 };
function after(stage = 'registered') {
  const result = structuredClone(before); result.accounts.push({ account_id: 2, status: 1 });
  if (stage !== 'registered') result.players.push({ server_id: 1, player_id: 12, account_id: 2 });
  return result;
}
for (const stage of ['registered', 'logged-in', 'finished']) test(`exact ${stage} identities`, () => verifyDelta(before, after(stage), actor, stage));
test('interrupted registration may persist only an account', () => {
  const value = after('finished'); value.accounts.push({ account_id: 3, status: 1 });
  verifyDelta(before, value, actor, 'finished', 3);
  value.players.push({ server_id: 1, player_id: 13, account_id: 3 });
  assert.throws(() => verifyDelta(before, value, actor, 'finished', 3));
});
for (const [name, mutate] of [
  ['extra account', v => v.accounts.push({ account_id: 3, status: 1 })],
  ['missing account', v => v.accounts.pop()], ['banned account', v => { v.accounts[1].status = 2; }],
  ['automatic player', v => v.players.push({ server_id: 1, player_id: 12, account_id: 2 })],
  ['automatic city', v => v.cities.push({ city_id: 22, player_id: 12 })],
  ['known actor changed', v => { v.players[0].account_id = 2; }],
  ['known city changed', v => { v.cities[0].player_id = 12; }],
]) test(`reject ${name}`, () => { const value = after(); mutate(value); assert.throws(() => verifyDelta(before, value, actor, 'registered')); });
test('reject wrong login actor and unsafe account IDs', () => {
  assert.throws(() => verifyDelta(before, after('logged-in'), { ...actor, playerId: 13 }, 'logged-in'));
  assert.throws(() => verifyDelta(before, after(), { accountId: Number.MAX_SAFE_INTEGER + 1 }, 'registered'));
});
test('refuse unofficial runtime without raw errors', () => {
  const run = spawnSync('bash', ['-euo', 'pipefail', '-c', 'node .github/scripts/explicit_registration_native.mjs 2>&1 | tee /dev/null'], { env: { ...process.env, GITHUB_ACTIONS: 'false' }, encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stdout, /failed at preflight/); assert.doesNotMatch(run.stdout, /AssertionError|\.stack/);
});
test('workflow retains exact runtime and failure evidence', () => {
  const workflow = readFileSync('.github/workflows/explicit-registration-native.yml', 'utf8');
  for (const required of ['postgres:17', "go-version: '1.23.12'", 'pipefail', 'if: always()', 'explicitRegistration.browser.mjs']) assert.ok(workflow.includes(required));
  assert.doesNotMatch(workflow.split('    steps:')[0], /\$\{\{\s*runner\./);
});
test('reject incomplete browser cases and missing live route observations', () => {
  assert.throws(() => verifyOutcomes({ viewport: { width: 1280, height: 720 }, failures: [], outcomes: [], requests: [] }, 1280));
});
test('complete receipt inventory passes, missing or extra mutation fails', () => {
  const outcomes = ['form', 'close-before-submit', 'offline-before-submit', 'registered', 'logged-in', 'duplicate-name', 'wrong-password', 'known-a', 'known-b', 'lost-reply', 'refresh-no-retry'].map(name => ({ name, outcome: 'pass' }));
  const requests = [0, 10001, 0].map((code, i) => ({ route: 'account.v1.Register', code, matchesInput: true, dropped: i === 2 }));
  requests.push(...Array.from({ length: 4 }, () => ({ route: 'account.v1.Login' })));
  const result = { viewport: { width: 1280, height: 720 }, failures: [], outcomes, requests }; verifyOutcomes(result, 1280);
  for (const mutate of [r => r.outcomes.pop(), r => r.requests.pop(), r => { r.requests[2].dropped = false; }, r => r.requests.push({ route: 'world.v1.CreateCity' })]) {
    const changed = structuredClone(result); mutate(changed); assert.throws(() => verifyOutcomes(changed, 1280));
  }
});
