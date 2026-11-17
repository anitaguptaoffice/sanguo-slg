import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import protobuf from 'protobufjs';
import { chromium } from 'playwright';

const report = { passed: false, phase: 'preflight', requests: [], snapshots: [], errors: [], cleanup: [] };
const out = path.resolve(process.env.QA_OUT || 'evidence'), client = process.cwd(), repo = path.resolve(client, '..');
const abort = new AbortController(), children = [], pending = new Map(), stopped = new WeakSet();
let browser, browserServer, page, deadlineTimer, budgetTimer, owner, hero, originalSession, acceptanceEnd;
const save = () => writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const redact = value => String(value).replaceAll(process.env.PGPASSWORD || 'sanguo', '[test-db-user]')
  .replaceAll('demo123', '[test-password]').replace(/postgres:\/\/[^\s]+/g, '[test-dsn]')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[trace-or-session]');
const command = (cmd, args, cwd = repo) => execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
const sql = query => command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query]);
const sleep = ms => delay(ms, undefined, { signal: abort.signal });
const clock = () => Number(sql('SELECT extract(epoch FROM clock_timestamp())*1000'));
const route = name => `hero.v1.${name}`;
const mutationNames = ['RecruitHero', 'BeginHeroExpr', 'FinishHeroExpr', 'CancelHeroExpr', 'FasterHeroExpr', 'UpgradeHero'];
const mutations = () => report.requests.filter(r => mutationNames.map(route).includes(r.route));
const balances = wallet => Object.fromEntries(['food', 'wood', 'iron', 'stone', 'gold'].map(k => [k, wallet[k]]));
const rows = (table, where = 'TRUE') => JSON.parse(sql(`SELECT coalesce(jsonb_agg(t ORDER BY to_jsonb(t)::text),'[]') FROM ${table} t WHERE ${where}`));
function snapshot(label) {
  const owned = `server_id=1 AND player_id=${owner}`;
  // Training storage is created lazily by the real service; absence proves no sessions, not permission to create it.
  const sessionRows = sql("SELECT to_regclass('public.hero_expr_session') IS NOT NULL") === 't' ? "coalesce((SELECT jsonb_agg(s ORDER BY hero_id) FROM hero_expr_session s),'[]')" : "'[]'::jsonb";
  const value = JSON.parse(sql(`SELECT jsonb_build_object(
    'wallet',(SELECT to_jsonb(w) FROM player_wallet w WHERE ${owned}),
    'production',(SELECT to_jsonb(p)||jsonb_build_object('ns',((extract(epoch FROM settled_at)*1000000000)::bigint+settled_submicro_ns)::text) FROM city_production_checkpoint p WHERE ${owned}),
    'heroes',coalesce((SELECT jsonb_agg(h ORDER BY hero_id) FROM player_hero h WHERE ${owned}),'[]'),
    'sessions',${sessionRows},
    'items',coalesce((SELECT jsonb_agg(i ORDER BY item_cfg_id) FROM player_item i WHERE ${owned}),'[]'))`));
  report.snapshots.push({ label, pgNow: clock(), ...value }); save(); return value;
}
function economy(after, before, cost = {}) {
  const numerator = 120n * (BigInt(after.production.ns) - BigInt(before.production.ns)) + BigInt(before.production.food_remainder) - BigInt(after.production.food_remainder);
  assert.ok(numerator >= 0n); assert.equal(numerator % 3600000000000n, 0n);
  const expected = Object.fromEntries(Object.entries(balances(before.wallet)).map(([k, v]) => [k, v - (cost[k] || 0)]));
  expected.food += Number(numerator / 3600000000000n); assert.deepEqual(balances(after.wallet), expected);
  for (const k of ['wood_remainder', 'stone_remainder', 'iron_remainder', 'server_id', 'city_id', 'player_id']) assert.equal(after.production[k], before.production[k]);
}
function unchanged(after, before) {
  for (const key of ['heroes', 'sessions', 'items']) assert.deepEqual(after[key], before[key]);
  economy(after, before);
}
async function bounded(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup timeout')), ms); })]); }
  finally { clearTimeout(timer); }
}
async function eventually(check, message) {
  for (let n = 0; n < 150; n++) { abort.signal.throwIfAborted(); if (await check()) return; await sleep(100); }
  assert.fail(message);
}
function start(cmd, args, name, cwd = repo) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, HTTP_ADDR: '127.0.0.1:8080', MIL_FRESH_PROFILE_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', error => report.errors.push(redact(`${name}: ${error.message}`)));
  for (const [stream, suffix] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    let buffer = ''; stream.on('data', data => { buffer += data; const lines = buffer.split('\n'); buffer = lines.pop(); for (const line of lines) appendFileSync(path.join(out, `${name}-${suffix}.log`), `${redact(line)}\n`); });
    stream.on('end', () => { if (buffer) appendFileSync(path.join(out, `${name}-${suffix}.log`), redact(buffer)); });
  }
  children.push({ child, name }); return child;
}
async function stop(child, name) {
  if (stopped.has(child)) return;
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    for (let n = 0; n < 100 && child.exitCode === null && child.signalCode === null; n++) await delay(100);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); report.errors.push(`${name}: required SIGKILL`); await delay(500); }
  } else report.errors.push(`${name}: exited before requested shutdown`);
  if (child.exitCode !== 0 || child.signalCode !== null) report.errors.push(`${name}: shutdown was not a clean exit`);
  stopped.add(child); report.cleanup.push({ name, exitCode: child.exitCode, signal: child.signalCode });
}
async function ready(url, child) {
  for (let n = 0, until = Date.now() + 60000; n < 600 && Date.now() < until; n++) {
    assert.equal(child.exitCode, null, `Process exited before ${url}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await sleep(100);
  }
  assert.fail(`Readiness timed out: ${url}`);
}
async function run() {
  mkdirSync(out, { recursive: true }); save();
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Official runner only; no local browser retry');
  const width = Number(process.env.QA_WIDTH), height = width === 1280 ? 720 : 900;
  assert.ok([1280, 1600].includes(width));
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/live_hero_expr');
  for (const [key, value] of Object.entries({ PGHOST: '127.0.0.1', PGDATABASE: 'live_hero_expr', REDIS_ADDR: '127.0.0.1:6379' })) assert.equal(process.env[key], value);
  Object.assign(report, { width, height, productHead: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['write-tree']), node: process.version,
    source: '409ad569415ea7215dc1297c2306423d0392dea4', sourceParent: 'e2b60dda830d9b25f15fcfced4da4acc090a8f1c',
    main: '757e43a9f40d7c92ded6a536ec334de94d69ff6f', qaHead: command('git', ['rev-parse', 'HEAD'], path.resolve(repo, '../qa-source')),
    go: command('go', ['version']), playwright: JSON.parse(readFileSync(path.join(client, 'node_modules/playwright/package.json'))).version, postgres: sql('SHOW server_version_num') });
  assert.equal(report.productHead, 'a020369eb4f58e835522934c662ab1fd3d4161e3'); assert.equal(report.tree, '16fb9da5b53af34d75cae9cbbd21a8e39f1dcfed');
  assert.equal(report.playwright, '1.49.1'); assert.equal(Math.floor(Number(report.postgres) / 10000), 17);
  assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0');
  acceptanceEnd = Number(process.env.QA_JOB_STARTED) * 1000 + 72 * 60000;
  const remaining = acceptanceEnd - Date.now();
  assert.ok(remaining > 63 * 60000, 'Insufficient original job budget; do not shorten or extend training');
  const expire = () => { abort.abort(new Error('Original acceptance deadline expired')); void browser?.close().catch(() => {}); };
  budgetTimer = setTimeout(expire, remaining);
  process.once('SIGTERM', expire); process.once('SIGINT', expire);
  report.phase = 'bootstrap';
  const boot = start(process.env.QA_SERVER, [], 'bootstrap');
  await ready('http://127.0.0.1:8080/healthz', boot); await stop(boot, 'bootstrap');
  for (const name of ['cfg_item', 'cfg_quest', 'cfg_shop', 'cfg_shop_shelf', 'cfg_shop_offer', 'cfg_hero_template', 'cfg_unit']) command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(repo, `spec/data/generated/${name}.sql`)]);
  const server = start(process.env.QA_SERVER, [], 'server'); await ready('http://127.0.0.1:8080/healthz', server);
  const preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'client', client);
  await ready('http://127.0.0.1:5173', preview);
  const root = new protobuf.Root();
  for (const file of ['spec/proto/sanguo/common/v1/envelope.proto', 'spec/proto/sanguo/common/v1/types.proto', 'spec/proto/sanguo/account/v1/account.proto', 'spec/proto/sanguo/domestic/v1/domestic.proto', 'internal/api/proto/sanguo/hero/v1/hero.proto']) protobuf.parse(readFileSync(path.join(repo, file), 'utf8'), root, { keepCase: true });
  root.resolveAll();
  const decode = (type, bytes) => { const t = root.lookupType(`sanguo.${type}`); return t.toObject(t.decode(bytes), { longs: Number, defaults: true }); };
  browserServer = await chromium.launchServer({ chromiumSandbox: true, timeout: 30000 });
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 }); report.chromium = browser.version();
  page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(redact(error.message)));
  page.on('requestfailed', req => report.errors.push(`Request failed: ${new URL(req.url()).pathname}`));
  page.on('websocket', socket => {
    if (socket.url() !== 'ws://127.0.0.1:8080/ws') { report.errors.push('Unexpected WebSocket destination'); return; }
    socket.on('framesent', ({ payload }) => {
      try {
        const packet = decode('common.v1.ClientPacket', payload), row = { id: report.requests.length + 1, route: packet.route, sentAt: Date.now() };
        if (mutationNames.map(route).includes(row.route)) row.request = decode(`${row.route}Request`, packet.payload);
        report.requests.push(row); pending.set(packet.trace_id, row); if (row.request) save(); // Synthetic safe ID; never archive auth payloads or trace/session IDs.
      } catch (error) { report.errors.push(redact(`Sent decode: ${error.message}`)); }
    });
    socket.on('framereceived', ({ payload }) => {
      try {
        const packet = decode('common.v1.ServerPacket', payload), row = pending.get(packet.trace_id);
        assert.ok(row, 'Unmatched response'); pending.delete(packet.trace_id); Object.assign(row, { code: packet.code, receivedAt: Date.now() });
        if (mutationNames.map(route).includes(row.route)) { row.message = packet.msg; if (!packet.code) row.response = decode(`${row.route}Response`, packet.data); }
        if (!packet.code && ['account.v1.Login', 'account.v1.EnterGameServer'].includes(row.route)) {
          const data = decode(`${row.route}Response`, packet.data); row.owner = Number(data.player.player_id); row.gold = Number(data.wallet.gold);
        }
        if (!packet.code && row.route === route('ListRecruitTemplates')) row.templates = decode(`${row.route}Response`, packet.data).templates;
        if (!packet.code && row.route === 'domestic.v1.GetCityState') row.productionRates = decode(`${row.route}Response`, packet.data).production_rates;
        if (!packet.code && row.route === route('GetHeroDetail')) row.detail = decode(`${row.route}Response`, packet.data);
      } catch (error) { report.errors.push(redact(`Reply decode: ${error.message}`)); }
    });
  });
  const action = name => page.locator(`[data-action="${name}"]`), panel = page.locator('[data-center-panel="hero"]');
  async function responseAfter(actionFn, expectedRoute, code = 0) {
    abort.signal.throwIfAborted(); const start = report.requests.length; await actionFn();
    const response = () => report.requests.slice(start).find(r => r.route === expectedRoute && r.code !== undefined);
    await eventually(response, `Missing ${expectedRoute}; uncertain outcome, never retry`); assert.equal(response().code, code); return response();
  }
  async function login(reload = false) {
    if (reload) { await page.waitForLoadState('networkidle', { timeout: 15000 }); await eventually(() => pending.size === 0, 'Unsettled requests before navigation'); }
    const before = report.requests.length; if (reload) await page.reload(); else await page.goto('http://127.0.0.1:5173');
    await page.locator('.server-list li[data-server-id="1"]').click();
    await responseAfter(() => action('enter-game').click(), 'account.v1.EnterGameServer'); await action('toggle-hero').waitFor();
    const entries = report.requests.slice(before).filter(r => ['account.v1.Login', 'account.v1.EnterGameServer'].includes(r.route) && r.code === 0);
    assert.equal(entries.length, 2); owner ??= entries[0].owner; assert.ok(Number.isSafeInteger(owner) && owner > 0);
    assert.ok(entries.every(r => r.owner === owner)); assert.equal(sql('SELECT count(*) FROM player'), '1'); return entries;
  }
  async function detail() {
    const result = await responseAfter(() => panel.locator(`li[data-hero-id="${hero}"]`).click(), route('GetHeroDetail'));
    assert.equal(result.detail.hero_id, hero); await action('hero-expr-finish').waitFor(); return result.detail;
  }
  async function unknown() {
    assert.match(await panel.locator('[data-role="hero-expr-summary"]').innerText(), /未提供历练状态.*服务器核实/);
    for (const name of ['cancel', 'faster']) assert.equal(await action(`hero-expr-${name}`).isDisabled(), true);
    assert.equal(await action('hero-expr-finish').isEnabled(), true);
  }
  async function inspectControls() {
    await action('refresh-heroes').focus(); const budget = await panel.locator('button, input, select, textarea, [tabindex], summary').count() + 1;
    for (let n = 0; n < budget && !(await action('hero-expr-finish').evaluate(el => el === document.activeElement)); n++) {
      await page.keyboard.press('Tab'); assert.equal(await panel.evaluate(el => el.contains(document.activeElement)), true);
    }
    assert.equal(await action('hero-expr-finish').evaluate(el => el === document.activeElement), true);
    report.focus = await action('hero-expr-finish').evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outline }));
    assert.equal(report.focus.visible, true); assert.doesNotMatch(report.focus.outline, /\b0px\b|\bnone\b/);
    await panel.hover(); await page.mouse.wheel(0, 500); await action('hero-expr-finish').scrollIntoViewIfNeeded();
    const b = await action('hero-expr-finish').boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
    report.geometry = b;
  }
  async function explicit(name, code = 0, message = '', keyboard = false) {
    const before = mutations().length; if (keyboard) await action(`hero-expr-${name}`).focus();
    const result = await responseAfter(() => keyboard ? page.keyboard.press('Enter') : action(`hero-expr-${name}`).click(), route(name === 'begin' ? 'BeginHeroExpr' : 'FinishHeroExpr'), code);
    assert.equal(mutations().length, before + 1); assert.equal(result.request.hero_id, hero); assert.equal(result.request.server_id, 1); assert.equal(result.message, message); save(); return result;
  }
  report.phase = 'fresh account'; await login();
  for (const route of ['account.v1.Register', 'world.v1.CreateCity', 'domestic.v1.GetCityState']) assert.ok(report.requests.some(r => r.route === route && r.code === 0));
  assert.equal(sql('SELECT count(*) FROM account'), '1'); assert.equal(sql('SELECT count(*) FROM player_wallet'), '1');
  assert.deepEqual(report.requests.find(r => r.productionRates)?.productionRates, { food: 120, wood: 0, iron: 0, stone: 0, gold: 0 });
  const fresh = snapshot('before disclosed fixture'); assert.equal(fresh.wallet.gold, 0); assert.deepEqual(fresh.heroes, []); assert.deepEqual(fresh.sessions, []);
  assert.deepEqual(fresh.items, [{ server_id: 1, player_id: owner, item_cfg_id: 2004, quantity: 1 }]);
  report.fixture = JSON.parse(sql(`WITH before AS MATERIALIZED (SELECT * FROM player_wallet WHERE server_id=1 AND player_id=${owner} AND gold=0 FOR UPDATE),
    changed AS (UPDATE player_wallet w SET gold=10 FROM before b WHERE w.server_id=b.server_id AND w.player_id=b.player_id RETURNING to_jsonb(w) AS value)
    SELECT jsonb_build_object('before',(SELECT to_jsonb(b) FROM before b),'after',(SELECT value FROM changed),'count',(SELECT count(*) FROM changed))`));
  assert.equal(report.fixture.count, 1); assert.deepEqual(report.fixture.after, { ...report.fixture.before, gold: 10 });
  const seeded = snapshot('only existing wallet gold 0 to 10'); unchanged(seeded, { ...fresh, wallet: { ...fresh.wallet, gold: 10 } });
  assert.ok((await login(true)).every(r => r.gold === 10));
  await responseAfter(() => action('toggle-hero').click(), route('ListPlayerHeroes'));
  await responseAfter(() => action('refresh-templates').click(), route('ListRecruitTemplates'));
  const tpl = report.requests.filter(r => r.templates).at(-1).templates.find(t => t.template_cfg_id === 1017);
  assert.ok(tpl); assert.equal(tpl.recruit_item.item_cfg_id, 2004); assert.equal(tpl.recruit_item.quantity, 1);
  await panel.locator('[data-field="template-select"]').selectOption('1017');
  const recruit = await responseAfter(() => action('recruit-hero').click(), route('RecruitHero'));
  hero = recruit.response.hero_id; assert.ok(Number.isSafeInteger(hero) && hero > 0); assert.equal(recruit.request.template_cfg_id, 1017); assert.equal(recruit.request.item_cfg_id, 2004);
  await panel.locator(`li[data-hero-id="${hero}"]`).waitFor(); const recruited = snapshot('real recruitment');
  economy(recruited, seeded, tpl.recruit_cost);
  assert.equal(recruited.items.filter(i => i.item_cfg_id !== 2004).length, 0); assert.equal(recruited.items.find(i => i.item_cfg_id === 2004)?.quantity ?? 0, 0);
  assert.equal(recruited.heroes[0].status, 1); assert.equal(recruited.heroes[0].exp, 0); assert.equal(recruited.heroes[0].level, 1);
  assert.equal(recruited.heroes.length, 1); assert.equal(recruited.heroes[0].hero_id, hero); assert.equal(recruited.heroes[0].template_cfg_id, 1017);
  await detail(); await unknown(); await inspectControls(); assert.equal(mutations().length, 1);
  await page.screenshot({ path: path.join(out, 'fresh-keyboard.png'), timeout: 5000 });
  await explicit('finish', 10001, 'hero: hero is not in training', true);
  unchanged(snapshot('idle rejection'), recruited); assert.match(await panel.locator('[data-role="hero-expr-form-error"]').innerText(), /不能确认之前的领取结果/);
  await action('hero-expr-hours').filter({ hasText: /^1h$/ }).focus(); await page.keyboard.press('Space');
  assert.ok(acceptanceEnd - Math.max(clock(), Date.now()) > 3600000 + 120000 + 30000, 'Pre-Begin original hour/grace must fit; no extension');
  const begin = await explicit('begin'); assert.equal(begin.request.hours, 1);
  const training = snapshot('real one-hour begin'); originalSession = training.sessions[0]; assert.equal(training.sessions.length, 1);
  assert.equal(sql(`SELECT extract(epoch FROM ends_at-started_at)=3600 FROM hero_expr_session WHERE server_id=1 AND hero_id=${hero}`), 't');
  assert.equal(Date.parse(originalSession.ends_at) - Date.parse(originalSession.started_at), 3600000); assert.equal(originalSession.hours, 1); assert.equal(originalSession.hero_id, hero);
  assert.deepEqual(begin.response, { hero_id: hero, status: 4, ends_at_ms: Date.parse(originalSession.ends_at), gold_spent: 10, hours: 1 });
  assert.equal(training.heroes[0].status, 4); assert.equal(training.heroes[0].exp, 0); assert.equal(training.heroes[0].level, 1);
  economy(training, recruited, { gold: 10 }); assert.deepEqual(training.items, recruited.items);
  const end = Number(sql(`SELECT extract(epoch FROM ends_at)*1000 FROM hero_expr_session WHERE server_id=1 AND hero_id=${hero}`)), hardEnd = end + 120000; assert.ok(clock() < end); assert.ok(hardEnd <= acceptanceEnd);
  deadlineTimer = setTimeout(expire, hardEnd - Date.now()); report.originalDeadline = { end, hardEnd, session: originalSession };
  assert.equal(await action('hero-expr-finish').isDisabled(), true); await page.screenshot({ path: path.join(out, 'known-future.png'), timeout: 5000 });
  await login(true); await responseAfter(() => action('toggle-hero').click(), route('ListPlayerHeroes')); await detail(); await unknown();
  assert.equal(mutations().length, 3); unchanged(snapshot('reentered before due'), training);
  await explicit('finish', 10001, 'hero: expr not finished yet'); unchanged(snapshot('early rejection'), training);
  assert.match(await panel.locator('[data-role="hero-expr-form-error"]').innerText(), /尚未到期.*未发放经验/);
  await page.screenshot({ path: path.join(out, 'early-rejection.png'), timeout: 5000 });
  report.phase = 'natural wait'; save();
  while (clock() < end) {
    assert.deepEqual(rows('hero_expr_session'), [originalSession]); assert.equal(mutations().length, 4); assert.deepEqual(report.errors, []);
    assert.equal(server.exitCode, null); assert.equal(server.signalCode, null); assert.equal(preview.exitCode, null);
    await sleep(Math.min(30000, Math.max(1, end - clock())));
    report.lastWaitPgNow = clock(); save();
  }
  assert.ok(clock() <= hardEnd); unchanged(snapshot('naturally due, not yet claimed'), training);
  await login(true); await responseAfter(() => action('toggle-hero').click(), route('ListPlayerHeroes')); await detail(); await unknown();
  assert.equal(mutations().length, 4); assert.ok(clock() >= end && clock() <= hardEnd);
  report.phase = 'explicit due finish'; report.finishPgNow = clock(); const finish = await explicit('finish');
  assert.deepEqual(finish.response, { hero_id: hero, status: 1, exp_gained: 20, exp: 20 });
  const claimed = snapshot('claimed once'); assert.deepEqual(claimed.sessions, []); assert.equal(claimed.heroes[0].status, 1); assert.equal(claimed.heroes[0].exp, 20); assert.equal(claimed.heroes[0].level, 1);
  economy(claimed, training); assert.deepEqual(claimed.items, training.items);
  await eventually(() => action('hero-expr-finish').isDisabled(), 'Acknowledged Finish disabled');
  assert.match(await panel.locator('[data-role="hero-expr-success"]').innerText(), /经验 \+20/); assert.equal(await action('hero-upgrade').isDisabled(), true);
  await action('hero-expr-finish').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'acknowledged-success.png'), timeout: 5000 });
  const count = mutations().length; await page.keyboard.press('Escape'); assert.equal(await panel.isVisible(), false);
  await responseAfter(() => action('toggle-hero').click(), route('ListPlayerHeroes')); const finalDetail = await detail(); await unknown();
  assert.equal(finalDetail.level, 1); assert.equal(finalDetail.exp, 20); assert.equal(finalDetail.exp_toward_next, 20); assert.equal(finalDetail.upgrade_exp_required, 100);
  await inspectControls();
  await page.screenshot({ path: path.join(out, 'keyboard-unknown-after-reread.png'), timeout: 5000 });
  await action('refresh-heroes').focus(); await responseAfter(() => page.keyboard.press('Enter'), route('ListPlayerHeroes')); assert.equal(await action('refresh-heroes').evaluate(el => el === document.activeElement), true);
  await inspectControls();
  await page.screenshot({ path: path.join(out, 'final-full-viewport.png'), timeout: 5000 }); await sleep(300);
  assert.equal(mutations().length, count); assert.deepEqual(mutations().map(r => [r.route, r.code]), [['RecruitHero', 0], ['FinishHeroExpr', 10001], ['BeginHeroExpr', 0], ['FinishHeroExpr', 10001], ['FinishHeroExpr', 0]].map(([name, code]) => [route(name), code]));
  unchanged(snapshot('final no extra command'), claimed); assert.deepEqual(report.errors, []);
  for (const { child, name } of children) if (!stopped.has(child)) assert.deepEqual([child.exitCode, child.signalCode], [null, null], `${name} must remain alive until cleanup`);
  abort.signal.throwIfAborted(); assert.ok(clock() <= hardEnd); report.phase = 'complete'; report.passed = true;
}
try { await run(); } catch (error) {
  report.failure = redact(error.stack); process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
  clearTimeout(deadlineTimer); clearTimeout(budgetTimer);
  await bounded(browser?.close(), 10000).catch(error => report.errors.push(redact(error.message)));
  if (browserServer) await bounded(browserServer.close(), 10000).catch(error => { browserServer.process().kill('SIGKILL'); report.errors.push(redact(error.message)); });
  if (browserServer && (browserServer.process().exitCode !== 0 || browserServer.process().signalCode !== null)) report.errors.push('Chromium cleanup was not a clean exit');
  for (const { child, name } of children.reverse()) await stop(child, name).catch(error => report.errors.push(redact(`${name}: ${error.message}`)));
  if (report.errors.length || process.exitCode) { report.passed = false; process.exitCode = 1; }
  mkdirSync(out, { recursive: true }); save();
  console.log(JSON.stringify({ passed: report.passed, phase: report.phase, failure: report.failure, errors: report.errors }));
}
