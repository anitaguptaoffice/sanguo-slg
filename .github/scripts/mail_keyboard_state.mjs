import { isDeepStrictEqual } from 'node:util';

const HOUR = 3600000000000n, DAY = 24n * HOUR, MAX = 9223372036854775807n;
const resources = ['food', 'wood', 'stone', 'iron'];
const stable = ['account', 'player', 'player_city', 'city_building', 'player_item', 'player_quest',
  'player_hero', 'hero_skill', 'hero_assignment', 'city_troop', 'field_army', 'army_troop',
  'march_order', 'battle_report', 'work_queue', 'player_research', 'reward_grant_queue',
  'player_shop_purchase', 'player_shop_offer_counter'];
const optional = ['hero_expr_session', 'hero_largess_schedule', 'hero_march_force'];
const tables = [...stable, 'player_wallet', 'city_production_checkpoint', 'player_mail'];
const fail = () => { throw new Error('MAIL_STATE_INVALID'); };
const check = value => { if (!value) fail(); };
const equal = (a, b) => check(isDeepStrictEqual(a, b));
const integer = value => {
  check(typeof value === 'string' ? /^(0|[1-9]\d*)$/.test(value) : Number.isSafeInteger(value) && value >= 0);
  const n = BigInt(value); check(n <= MAX); return n;
};
const id = value => { const n = integer(value); check(n > 0n); return String(n); };
function time(value) {
  check(typeof value === 'string');
  const m = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(?:Z|\+00:00)$/.exec(value);
  check(m); const ms = Date.parse(`${m[1]}T${m[2]}Z`); check(Number.isFinite(ms));
  check(new Date(ms).toISOString().slice(0, 19) === `${m[1]}T${m[2]}`);
  return BigInt(ms) * 1000000n + BigInt((m[3] ?? '').padEnd(9, '0'));
}
const ms = value => value === null ? '0' : String(time(value) / 1000000n);
const clone = value => structuredClone(value);
const without = (value, names) => Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)));
function reward(value) {
  check(value && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).every(k => ['resources', 'items'].includes(k)));
  const r = value.resources ?? {}, items = value.items ?? [];
  check(Object.keys(r).every(k => [...resources, 'gold'].includes(k)) && Array.isArray(items));
  const seen = new Set();
  const normalized = items.map(item => {
    equal(Object.keys(item).sort(), ['item_cfg_id', 'qty']);
    check(Number.isSafeInteger(item.item_cfg_id) && item.item_cfg_id > 0 && item.item_cfg_id <= 2147483647);
    check(Number.isSafeInteger(item.qty) && item.qty > 0 && item.qty <= 2147483647 && !seen.has(item.item_cfg_id));
    seen.add(item.item_cfg_id); return { item_cfg_id: item.item_cfg_id, quantity: item.qty };
  });
  return { reward_pack_id: '', items: normalized, resources: Object.fromEntries([...resources, 'gold'].map(k => [k, String(integer(r[k] ?? 0))])) };
}
function canonical(row) {
  return { mail_id: id(row.mail_id), mail_type: row.mail_type, title: row.title, body: row.body,
    status: row.status, attachments: (row.attachments.items?.length || Object.keys(row.attachments.resources ?? {}).length) ? reward(row.attachments) : null, created_at_ms: ms(row.created_at),
    read_at_ms: ms(row.read_at), claimed_at_ms: ms(row.claimed_at) };
}
function rows(snapshot) {
  return [...snapshot.player_mail].sort((a, b) => time(a.created_at) > time(b.created_at) ? -1 : 1).map(canonical);
}
// Run inside REPEATABLE READ READ ONLY: optional dynamic reads must share its snapshot.
export const MAIL_STATE_SQL = `SELECT jsonb_build_object('pgNow', clock_timestamp(), ${tables.map(table => {
  const projection = table === 'account' ? "jsonb_build_object('account_id', account_id, 'status', status)" :
    table === 'player' ? "to_jsonb(t) - 'last_login_at'" : 'to_jsonb(t)';
  return `'${table}', (SELECT COALESCE(jsonb_agg(row ORDER BY row::text), '[]'::jsonb) FROM (SELECT ${projection} AS row FROM ${table} t) q)`;
}).join(', ')}, ${optional.map(table => `'${table}', CASE WHEN to_regclass('${table}') IS NULL THEN NULL ELSE ((xpath('/row/rows/text()', query_to_xml('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb)::text AS rows FROM ${table} t', false, true, '')))[1]::text)::jsonb END`).join(', ')})`;

export function createMailStateOracle({ identity, fixtureSpec }) {
  const owner = clone(identity), spec = clone(fixtureSpec);
  equal(Object.keys(owner).sort(), ['account_id', 'city_id', 'player_id', 'server_id']);
  for (const key of Object.keys(owner)) owner[key] = id(owner[key]);
  equal(spec.map(s => s.label), ['D', 'C', 'B', 'A']);
  for (const [i, s] of spec.entries()) {
    equal(Object.keys(s).sort(), ['attachments', 'body', 'label', 'mail_type', 'title']);
    check(typeof s.title === 'string' && s.title.length > 0 && [...s.title].length <= 128 && typeof s.body === 'string');
    check([1, 2, 3].includes(s.mail_type));
    const r = reward(s.attachments);
    check(r.items.length === (i === 0 ? 1 : 0) && Object.values(r.resources).every(v => v === '0'));
  }
  check(new Set(spec.map(s => s.title)).size === 4);
  let previous, initial, fixtureIds, readIndex = 0, finished = false;
  function validate(snapshot) {
    equal(Object.keys(snapshot).sort(), ['pgNow', ...tables, ...optional].sort());
    time(snapshot.pgNow);
    for (const table of tables) check(Array.isArray(snapshot[table]));
    for (const table of optional) check(snapshot[table] === null || (Array.isArray(snapshot[table]) && snapshot[table].length === 0));
    for (const table of ['account', 'player', 'player_city', 'player_wallet', 'city_production_checkpoint']) check(snapshot[table].length === 1);
    for (const [table, keys] of [['account', ['account_id']], ['player', ['account_id', 'player_id', 'server_id']],
      ['player_city', ['city_id', 'player_id', 'server_id']], ['player_wallet', ['player_id', 'server_id']],
      ['city_production_checkpoint', ['city_id', 'player_id', 'server_id']]]) {
      for (const key of keys) equal(id(snapshot[table][0][key]), owner[key]);
    }
    equal(snapshot.account[0].status, 1);
    const buildings = snapshot.city_building;
    check(buildings.length === 2);
    for (const [slot, cfg] of [['farm', 2], ['hall', 1]]) {
      const b = buildings.find(b => b.slot_key === slot); check(b);
      equal(id(b.server_id), owner.server_id); equal(id(b.city_id), owner.city_id);
      equal([b.building_cfg_id, b.level, b.upgrade_finish_at], [cfg, 1, null]);
    }
    const wallet = snapshot.player_wallet[0], cp = snapshot.city_production_checkpoint[0];
    const settled = time(cp.settled_at) + integer(cp.settled_submicro_ns);
    check(integer(cp.settled_submicro_ns) < 1000n && time(cp.settled_at) % 1000n === 0n && settled <= time(snapshot.pgNow));
    check(time(wallet.updated_at) <= time(snapshot.pgNow));
    for (const key of [...resources, 'gold']) integer(wallet[key]);
    for (const key of resources) check(integer(cp[`${key}_remainder`]) < HOUR);
    const seen = new Set();
    for (const row of snapshot.player_mail) {
      equal(Object.keys(row).sort(), ['server_id', 'mail_id', 'player_id', 'mail_type', 'title', 'body', 'attachments', 'status', 'expire_at', 'created_at', 'read_at', 'claimed_at'].sort());
      const key = id(row.mail_id); check(!seen.has(key)); seen.add(key);
      equal(id(row.server_id), owner.server_id); equal(id(row.player_id), owner.player_id);
      check([0, 1].includes(row.status)); equal(row.expire_at, null); equal(row.claimed_at, null);
      check(time(row.created_at) <= time(snapshot.pgNow));
      if (row.status === 0) equal(row.read_at, null);
      else check(row.read_at !== null && time(row.read_at) >= time(row.created_at) && time(row.read_at) <= time(snapshot.pgNow));
      canonical(row);
    }
  }
  function economy(before, after) {
    check(time(after.pgNow) >= time(before.pgNow));
    for (const table of [...stable, ...optional]) equal(after[table], before[table]);
    const a = before.player_wallet[0], b = after.player_wallet[0];
    const x = before.city_production_checkpoint[0], y = after.city_production_checkpoint[0];
    equal(without(a, [...resources, 'updated_at']), without(b, [...resources, 'updated_at']));
    equal(without(x, ['settled_at', 'settled_submicro_ns', ...resources.map(k => `${k}_remainder`)]),
      without(y, ['settled_at', 'settled_submicro_ns', ...resources.map(k => `${k}_remainder`)]));
    const t0 = time(x.settled_at) + integer(x.settled_submicro_ns), t1 = time(y.settled_at) + integer(y.settled_submicro_ns);
    check(t1 >= t0 && time(b.updated_at) >= time(a.updated_at));
    // The finite native run is under 24 hours: no unknowable intermediate offline-cap truncation.
    check(time(after.pgNow) - time(initial.pgNow) < DAY);
    for (const key of resources) {
      const balance = integer(a[key]), carry = integer(x[`${key}_remainder`]);
      const earned = carry + (key === 'food' ? 120n : 0n) * (t1 - t0);
      const cap = 75000n;
      const full = balance >= cap || balance + earned / HOUR >= cap;
      const expected = t1 === t0 ? balance : full ? (balance >= cap ? balance : cap) : balance + earned / HOUR;
      const remainder = t1 === t0 ? carry : full ? 0n : earned % HOUR;
      equal(integer(b[key]), expected); equal(integer(y[`${key}_remainder`]), remainder);
    }
  }
  function advance(snapshot, expectedReadId = null) {
    check(previous && fixtureIds && !finished); validate(snapshot); economy(previous, snapshot);
    const before = rows(previous), after = rows(snapshot);
    check(snapshot.player_mail.length === 4);
    const expected = expectedReadId === null ? null : id(expectedReadId);
    if (expected !== null) equal(expected, fixtureIds[['B', 'A', 'D', 'C'][readIndex]]);
    for (const old of previous.player_mail) {
      const next = snapshot.player_mail.find(r => id(r.mail_id) === id(old.mail_id)); check(next);
      equal(without(old, ['status', 'read_at']), without(next, ['status', 'read_at']));
      if (id(old.mail_id) === expected) {
        equal([old.status, old.read_at, next.status], [0, null, 1]);
        check(time(next.read_at) >= time(previous.pgNow));
      } else equal([next.status, next.read_at], [old.status, old.read_at]);
    }
    if (expected !== null) readIndex++;
    previous = clone(snapshot); return { before, after };
  }
  return {
    beginFixtures(snapshot) {
      check(!initial && !finished); validate(snapshot); equal(snapshot.player_mail, []);
      for (const table of stable.filter(t => !['account', 'player', 'player_city', 'city_building', 'player_item', 'reward_grant_queue'].includes(t))) equal(snapshot[table], []);
      check(snapshot.player_item.length === 1 && snapshot.reward_grant_queue.length === 1);
      const item = snapshot.player_item[0], grant = snapshot.reward_grant_queue[0];
      for (const row of [item, grant]) { equal(id(row.server_id), owner.server_id); equal(id(row.player_id), owner.player_id); }
      equal([item.item_cfg_id, item.quantity], [2004, 1]);
      equal([grant.status, grant.source_type, grant.source_ref, grant.idempotency_key], [2, 'grant', '', `onboarding:starter-scroll:v1:${owner.player_id}`]);
      equal(reward(grant.rewards), reward({ items: [{item_cfg_id: 2004, qty: 1}] }));
      initial = clone(snapshot); previous = clone(snapshot);
    },
    finishFixtures(snapshot, receipts) {
      check(initial && !fixtureIds && !finished); validate(snapshot); economy(previous, snapshot);
      check(snapshot.player_mail.length === 4 && Array.isArray(receipts) && receipts.length === 4);
      const ids = {}, ordered = [...snapshot.player_mail].sort((a, b) => time(a.created_at) < time(b.created_at) ? -1 : 1);
      const gmNames = { server_id: 'ServerID', mail_id: 'MailID', player_id: 'PlayerID', mail_type: 'MailType', title: 'Title', body: 'Body', attachments: 'Attachments', status: 'Status', expire_at: 'ExpireAt', created_at: 'CreatedAt', read_at: 'ReadAt', claimed_at: 'ClaimedAt' };
      for (let i = 0; i < 4; i++) {
        const row = ordered[i], s = spec[i], receipt = receipts[i]; equal(Object.keys(receipt), ['mail']);
        const gm = receipt.mail; equal(Object.keys(gm).sort(), Object.values(gmNames).sort());
        for (const [key, name] of Object.entries(gmNames)) {
          if (key === 'created_at') check(time(gm[name]) / 1000n === time(row[key]) / 1000n);
          else if (key === 'attachments') equal(reward(gm[name]), reward(row[key]));
          else equal(gm[name], row[key]);
        }
        equal([row.title, row.body, row.mail_type, row.status, row.read_at], [s.title, s.body, s.mail_type, 0, null]);
        equal(reward(row.attachments), reward(s.attachments));
        check(time(row.created_at) >= time(initial.pgNow));
        if (i) check(time(row.created_at) > time(ordered[i - 1].created_at));
        ids[s.label] = id(row.mail_id);
      }
      fixtureIds = ids; previous = clone(snapshot); return { before: [], after: rows(snapshot) };
    },
    advance,
    finish(snapshot) { const result = advance(snapshot); equal(readIndex, 4); finished = true; return result; },
    ids() { check(fixtureIds); return clone(fixtureIds); },
    evidence() { return { fixtures: fixtureIds ? 4 : 0, authorizedReads: readIndex, finished }; },
  };
}
