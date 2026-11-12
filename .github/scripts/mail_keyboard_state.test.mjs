import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailStateOracle, MAIL_STATE_SQL } from './mail_keyboard_state.mjs';
const copy = value => structuredClone(value);
const identity = { account_id: 1, player_id: 2, server_id: 1, city_id: 3 };
const timestamp = n => `2026-11-12T00:00:${String(n).padStart(2, '0')}.000000Z`;
const spec = ['D', 'C', 'B', 'A'].map((label, i) => ({label, title: label, body: `Body ${label}`, mail_type: 2,
  attachments: {resources: null, items: i === 0 ? [{item_cfg_id: 2001, qty: 1}] : null}}));
function baseline() {
  const s = Object.fromEntries([...MAIL_STATE_SQL.matchAll(/FROM ([a-z_]+) t/g)].map(m => [m[1], []]));
  Object.assign(s, {pgNow: timestamp(1), account: [{account_id: 1, status: 1}],
    player: [{server_id: 1, player_id: 2, account_id: 1}], player_city: [{server_id: 1, city_id: 3, player_id: 2}],
    city_building: ['farm', 'hall'].map((slot_key, i) => ({server_id: 1, city_id: 3, slot_key, building_cfg_id: 2 - i, level: 1, upgrade_finish_at: null})),
    player_wallet: [{server_id: 1, player_id: 2, food: 8000, wood: 8000, stone: 5000, iron: 5000, gold: 0, updated_at: timestamp(0)}],
    city_production_checkpoint: [{server_id: 1, city_id: 3, player_id: 2, settled_at: timestamp(0), settled_submicro_ns: 0,
      food_remainder: 0, wood_remainder: 0, stone_remainder: 0, iron_remainder: 0}],
    player_item: [{server_id: 1, player_id: 2, item_cfg_id: 2004, quantity: 1}],
    reward_grant_queue: [{server_id: 1, player_id: 2, status: 2, source_type: 'grant', source_ref: '',
      idempotency_key: 'onboarding:starter-scroll:v1:2', rewards: {resources: null, items: [{item_cfg_id: 2004, qty: 1}]}}],
    hero_expr_session: null, hero_largess_schedule: null, hero_march_force: null});
  return s;
}
const names = ['ServerID', 'MailID', 'PlayerID', 'MailType', 'Title', 'Body', 'Attachments', 'Status', 'ExpireAt', 'CreatedAt', 'ReadAt', 'ClaimedAt'];
function setup() {
  const oracle = createMailStateOracle({identity, fixtureSpec: spec}), initial = baseline();
  oracle.beginFixtures(initial);
  const state = copy(initial); state.pgNow = timestamp(6);
  state.player_mail = spec.map((s, i) => ({server_id: 1, mail_id: i + 1, player_id: 2, mail_type: 2,
    title: s.title, body: s.body, attachments: copy(s.attachments), status: 0, expire_at: null, created_at: timestamp(i + 2), read_at: null, claimed_at: null}));
  const receipts = state.player_mail.map(row => ({mail: Object.fromEntries(Object.values(row).map((value, i) => [names[i], value]))}));
  return {oracle, state, receipts, initial};
}
function ready() { const x = setup(); x.oracle.finishFixtures(x.state, x.receipts); return x; }
function rejects(action) { assert.throws(action, error => error.message === 'MAIL_STATE_INVALID' && !error.message.includes('secret')); }
test('complete fixture and B,A,D,C read progression yields canonical state only', () => {
  const {oracle, state, receipts} = setup();
  const fixture = oracle.finishFixtures(state, receipts);
  assert.deepEqual(fixture.after.map(m => m.mail_id), ['4', '3', '2', '1']);
  assert.equal(fixture.after[0].attachments, null);
  assert.equal(fixture.after[3].attachments.items[0].quantity, 1);
  assert.deepEqual(oracle.ids(), {D: '1', C: '2', B: '3', A: '4'});
  for (const [i, mailId] of [3, 4, 1, 2].entries()) {
    state.pgNow = timestamp(i + 8); const row = state.player_mail.find(r => r.mail_id === mailId);
    row.status = 1; row.read_at = timestamp(i + 7);
    const result = oracle.advance(state, mailId);
    assert.equal(result.after.find(r => r.mail_id === String(mailId)).status, 1);
  }
  oracle.finish(state); assert.deepEqual(oracle.evidence(), {fixtures: 4, authorizedReads: 4, finished: true});
  rejects(() => oracle.advance(state));
});
for (const [name, change] of Object.entries({
  owner: s => s.player[0].account_id++, extraOwner: s => s.account.push({...s.account[0]}), missingTable: s => delete s.work_queue,
  noStarter: s => s.player_item = [], extraStarter: s => s.player_item[0].quantity++, wrongGrant: s => s.reward_grant_queue[0].status = 1,
  building: s => s.city_building[0].level++, hero: s => s.player_hero.push({id: 1}), optionalHero: s => s.hero_expr_session = [{hero_id: 9}],
  remainder: s => s.city_production_checkpoint[0].food_remainder = '3600000000000', negative: s => s.player_wallet[0].food = -1,
  unsafe: s => s.player_wallet[0].food = Number.MAX_SAFE_INTEGER + 1, future: s => s.city_production_checkpoint[0].settled_at = timestamp(9),
  timestamp: s => s.pgNow = 'secret-invalid-date', calendar: s => s.pgNow = '2026-02-30T00:00:00Z', malformed: s => s.player_wallet[0].food = 'secret',
})) test(`initial rejects ${name}`, () => {
  const s = baseline(); change(s); rejects(() => createMailStateOracle({identity, fixtureSpec: spec}).beginFixtures(s));
});
for (const [name, change] of Object.entries({
  count: s => s.player_mail.pop(), duplicate: s => s.player_mail[1].mail_id = 1, order: s => s.player_mail[1].created_at = timestamp(2),
  content: s => s.player_mail[0].body = 'secret', attached: s => s.player_mail[1].attachments.items = [{item_cfg_id: 1, qty: 1}],
  preRead: s => {s.player_mail[0].status = 1; s.player_mail[0].read_at = timestamp(5);},
  claimed: s => s.player_mail[0].claimed_at = timestamp(5), expired: s => s.player_mail[0].expire_at = timestamp(5),
})) test(`fixture rejects ${name}`, () => {
  const {oracle, state, receipts} = setup(); change(state); rejects(() => oracle.finishFixtures(state, receipts));
});
test('GM receipt is required, full and matched', () => {
  for (const change of [r => r.pop(), r => r[0].mail.Body = 'secret', r => r[0].mail.CreatedAt = timestamp(9), r => delete r[0].mail.ReadAt]) {
    const {oracle, state, receipts} = setup(); change(receipts); rejects(() => oracle.finishFixtures(state, receipts));
  }
});
for (const [name, change] of Object.entries({
  wallet: s => s.player_wallet[0].food++, gold: s => s.player_wallet[0].gold++, bag: s => s.player_item[0].quantity++,
  queue: s => s.reward_grant_queue[0].status = 3, work: s => s.work_queue.push({queue_id: 1}), research: s => s.player_research.push({level: 1}),
  hero: s => s.player_hero.push({hero_id: 1}), march: s => s.march_order.push({order_id: 1}), optional: s => s.hero_expr_session = [],
  read: s => {s.player_mail[0].status = 1; s.player_mail[0].read_at = timestamp(6);}, immutable: s => s.player_mail[0].title = 'secret',
  checkpoint: s => s.city_production_checkpoint[0].food_remainder++, clock: s => s.pgNow = timestamp(0),
  count: s => s.player_mail.pop(), backdate: s => s.player_wallet[0].updated_at = '2026-11-11T23:59:59Z',
})) test(`unchanged step rejects ${name}`, () => {
  const {oracle, state} = ready(); change(state); rejects(() => oracle.advance(state));
});
test('read authorization requires correct order, exact transition and fresh timestamp', () => {
  for (const mode of ['wrong', 'missing', 'old-time', 'extra']) {
    const {oracle, state} = ready(); state.pgNow = timestamp(8);
    const row = state.player_mail[2]; row.status = 1; row.read_at = timestamp(7);
    if (mode === 'missing') {row.status = 0; row.read_at = null;}
    if (mode === 'old-time') row.read_at = timestamp(5);
    if (mode === 'extra') {state.player_mail[0].status = 1; state.player_mail[0].read_at = timestamp(7);}
    rejects(() => oracle.advance(state, mode === 'wrong' ? 4 : 3));
  }
  const {oracle, state} = ready(); rejects(() => oracle.finish(state));
});
test('exact fraction settlement and submicrosecond carry', () => {
  const {oracle, state} = ready(); state.pgNow = timestamp(31);
  state.player_wallet[0].food = 8001; state.player_wallet[0].updated_at = timestamp(30);
  Object.assign(state.city_production_checkpoint[0], {settled_at: timestamp(30), settled_submicro_ns: 500, food_remainder: 60000});
  oracle.advance(state); state.player_wallet[0].food++; rejects(() => oracle.advance(state));
});
test('snapshot is copied and secret-bearing errors/evidence never echo inputs', () => {
  const {oracle, state} = ready(); const ids = oracle.ids(); ids.B = 'secret';
  assert.equal(oracle.ids().B, '3'); state.player_mail[2].body = 'secret'; rejects(() => oracle.advance(state));
  assert.ok(!JSON.stringify(oracle.evidence()).includes('secret'));
});
test('SQL includes all rows, precise clock and explicit optional absence', () => {
  assert.match(MAIL_STATE_SQL, /clock_timestamp/); assert.match(MAIL_STATE_SQL, /to_regclass\('hero_expr_session'\)/);
  assert.ok(!MAIL_STATE_SQL.includes('WHERE')); assert.ok(!/password|session_id/.test(MAIL_STATE_SQL));
});
test('warehouse caps discard fractions without losing above-cap rewards', () => {
  for (const balance of [74999, 75000, 75001]) {
    const initial = baseline(); initial.player_wallet[0].food = balance;
    const oracle = createMailStateOracle({identity, fixtureSpec: spec}); oracle.beginFixtures(initial);
    const fixture = setup(); fixture.state.player_wallet[0].food = balance;
    oracle.finishFixtures(fixture.state, fixture.receipts);
    fixture.state.pgNow = timestamp(31); fixture.state.player_wallet[0].updated_at = timestamp(30);
    fixture.state.player_wallet[0].food = Math.max(75000, balance);
    fixture.state.city_production_checkpoint[0].settled_at = timestamp(30);
    oracle.advance(fixture.state);
    fixture.state.city_production_checkpoint[0].food_remainder = 1;
    rejects(() => oracle.advance(fixture.state));
  }
});
test('duplicate read, double fixture and cross-step backwards checkpoint are rejected', () => {
  const {oracle, state, receipts} = ready(); rejects(() => oracle.finishFixtures(state, receipts));
  state.pgNow = timestamp(8); state.player_mail[2].status = 1; state.player_mail[2].read_at = timestamp(7);
  oracle.advance(state, 3); rejects(() => oracle.advance(state, 3));
  state.city_production_checkpoint[0].settled_at = '2026-11-11T23:59:59Z'; rejects(() => oracle.advance(state));
});

export { baseline, setup, ready, identity, spec, timestamp };
