import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
let protobuf, chromium;

const report = { passed: false, phase: 'preflight', requests: [], snapshots: [], geometry: [], errors: [], cleanup: [] };
const out = path.resolve(process.env.QA_OUT || 'evidence'), client = process.cwd(), repo = path.resolve(client, '..');
const abort = new AbortController(), children = [], pending = new Map(), stopped = new WeakSet();
let browser, browserServer, browserOwnership, page, runtimeDeadline, owner, hero;
const save = () => writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
export const redact = value => String(value).replaceAll(process.env.PGPASSWORD || 'sanguo', '[test-db-user]')
  .replaceAll('demo123', '[test-password]').replace(/postgres:\/\/[^\s]+/g, '[test-dsn]')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[trace-or-session]');
export function commandTimeout(deadline, now = Date.now()) {
  assert.ok(deadline > now, 'Live runtime deadline elapsed'); return Math.min(30000, deadline - now);
}
const command = (cmd, args, cwd = repo) => { abort.signal.throwIfAborted(); return execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: commandTimeout(runtimeDeadline) }).trim(); };
const sql = query => command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query]);
const sleep = ms => delay(ms, undefined, { signal: abort.signal });
const clock = () => Number(sql('SELECT extract(epoch FROM clock_timestamp())*1000'));
const route = name => `hero.v1.${name}`;
const mutationNames = ['RecruitHero', 'BeginHeroExpr', 'FinishHeroExpr', 'CancelHeroExpr', 'FasterHeroExpr', 'UpgradeHero'];
const balances = wallet => Object.fromEntries(['food', 'wood', 'iron', 'stone', 'gold'].map(k => [k, wallet[k]]));
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
export function economy(after, before, cost = {}) {
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
export async function deadlineRace(action, ms, controller) {
  controller.signal.throwIfAborted(); const deadline = Date.now() + ms; let rejectAbort;
  const cancelled = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); });
  controller.signal.addEventListener('abort', rejectAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Live runtime budget expired')), ms);
  try {
    const result = await Promise.race([Promise.resolve().then(action), cancelled]);
    if (Date.now() >= deadline) controller.abort(new Error('Live runtime budget expired'));
    controller.signal.throwIfAborted(); return result;
  }
  finally { clearTimeout(timer); controller.signal.removeEventListener('abort', rejectAbort); }
}
export async function acquireOwned(create, dispose, signal) {
  signal.throwIfAborted(); const value = await create();
  if (signal.aborted) { await dispose(value); signal.throwIfAborted(); }
  return value;
}
export async function stopBrowser(server, connection, ownership, report, timeout = 10000) {
  const child = server.process(), { pid } = ownership, owned = ownership.server === server && Number.isInteger(pid) && pid > 0 && child.pid === pid;
  const alive = child.exitCode === null && child.signalCode === null; let requested = false, forced = false;
  try {
    assert.ok(owned && alive, 'Chromium unowned or exited before requested close'); requested = true;
    await bounded(connection?.close(), timeout); await bounded(server.close(), timeout);
    assert.deepEqual([child.exitCode, child.signalCode], [0, null], 'Chromium remained live or exited abnormally');
  } catch (error) {
    report.errors.push(redact(error.message));
    if (owned && child.exitCode === null && child.signalCode === null) { forced = true; try { child.kill('SIGKILL'); } catch (killError) { report.errors.push(redact(killError.message)); } }
  }
  report.cleanup.push({ name: 'chromium', pid: child.pid, owned, aliveBeforeStop: alive, requestedClose: requested, forced, exitCode: child.exitCode, signal: child.signalCode });
  if (!owned || !alive || !requested || forced || child.exitCode !== 0 || child.signalCode !== null) report.errors.push('Chromium cleanup was not a clean requested exit');
}
async function eventually(check, message) {
  for (let n = 0; n < 150; n++) { abort.signal.throwIfAborted(); if (await check()) return; await sleep(100); }
  assert.fail(message);
}
function start(cmd, args, name, cwd = repo) {
  abort.signal.throwIfAborted(); commandTimeout(runtimeDeadline);
  const child = spawn(cmd, args, { cwd, env: { ...process.env, HTTP_ADDR: '127.0.0.1:8080', MIL_FRESH_PROFILE_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', error => report.errors.push(redact(`${name}: ${error.message}`)));
  for (const [stream, suffix] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    let buffer = ''; stream.on('data', data => { buffer += data; const lines = buffer.split('\n'); buffer = lines.pop(); for (const line of lines) appendFileSync(path.join(out, `${name}-${suffix}.log`), `${redact(line)}\n`); });
    stream.on('end', () => { if (buffer) appendFileSync(path.join(out, `${name}-${suffix}.log`), redact(buffer)); });
  }
  children.push({ child, name, pid: child.pid }); return child;
}
export async function stopOwned(child, name, state, pause = delay) {
  const { children, stopped, report } = state;
  if (stopped.has(child)) return;
  const owned = Number.isInteger(child.pid) && child.pid > 0 && children.some(entry => entry.child === child && entry.pid === child.pid && entry.name === name);
  const alive = child.exitCode === null && child.signalCode === null; let termRequested = false;
  if (owned && alive) {
    termRequested = child.kill('SIGTERM');
    for (let n = 0; n < 100 && child.exitCode === null && child.signalCode === null; n++) await pause(100);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); report.errors.push(`${name}: required SIGKILL`); await pause(500); }
  } else report.errors.push(`${name}: unowned or exited before requested shutdown`);
  if (!termRequested || (child.exitCode !== 0 && !(name === 'client' && child.exitCode === 143)) || child.signalCode !== null) report.errors.push(`${name}: shutdown was not a clean exit`);
  stopped.add(child); report.cleanup.push({ name, pid: child.pid, owned, aliveBeforeStop: alive, requestedSignal: termRequested ? 'SIGTERM' : null, exitCode: child.exitCode, signal: child.signalCode });
}
async function ready(url, child) {
  for (let n = 0, until = Date.now() + 60000; n < 600 && Date.now() < until; n++) {
    assert.equal(child.exitCode, null, `Process exited before ${url}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await sleep(100);
  }
  assert.fail(`Readiness timed out: ${url}`);
}
const stop = (child, name) => stopOwned(child, name, { children, stopped, report });
export function validateTraffic(requests) {
  const allowed = ['account.v1.ListGameServers', 'account.v1.Login', 'account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'world.v1.CreateCity',
    'domestic.v1.GetCityState', 'content.v1.ListPlayerMail', 'quest.v1.ListPlayerQuests', 'military.v1.ListBattleReports', 'chat.v1.ListChatMessages', 'military.v1.ListMarches', 'content.v1.ListPlayerBag',
    ...['ListPlayerHeroes', 'ListRecruitTemplates', 'ListHotelRecruitCandidates', 'ListCaptiveHeroes', 'ListPersuadeTargets', 'ListComingHeroes', 'RecruitHero', 'GetHeroDetail'].map(route)];
  assert.deepEqual(requests.filter(r => !allowed.includes(r.route)), []);
  for (const expected of ['account.v1.Register', 'world.v1.CreateCity', route('RecruitHero')]) {
    const matches = requests.filter(r => r.route === expected);
    assert.equal(matches.length, 1); assert.equal(matches[0].code, 0);
  }
  assert.deepEqual(requests.filter(r => mutationNames.map(route).includes(r.route)).map(r => [r.route, r.code]), [[route('RecruitHero'), 0]]);
}
async function run(check) {
  mkdirSync(out, { recursive: true }); save();
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Official runner only; no local browser retry');
  protobuf = (await import('protobufjs')).default; ({ chromium } = await import('playwright'));
  const width = Number(process.env.QA_WIDTH), height = width === 1280 ? 720 : 900;
  assert.ok([1280, 1600].includes(width));
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/live_hero_layout');
  for (const [key, value] of Object.entries({ PGHOST: '127.0.0.1', PGDATABASE: 'live_hero_layout', REDIS_ADDR: '127.0.0.1:6379' })) assert.equal(process.env[key], value);
  Object.assign(report, { width, height, productHead: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['write-tree']), node: process.version,
    vite: JSON.parse(readFileSync(path.join(client, 'node_modules/vite/package.json'))).version,
    parents: command('git', ['show', '-s', '--format=%P', 'HEAD']), product: process.env.QA_PRODUCT,
    runtimeHead: command('git', ['rev-parse', 'HEAD'], path.resolve(repo, '../runtime-source')),
    main: '757e43a9f40d7c92ded6a536ec334de94d69ff6f', qaHead: command('git', ['rev-parse', 'HEAD'], path.resolve(repo, '../qa-source')),
    go: command('go', ['version']), playwright: JSON.parse(readFileSync(path.join(client, 'node_modules/playwright/package.json'))).version, postgres: sql('SHOW server_version_num') });
  for (const [actual, expected] of [[report.productHead, process.env.QA_PRODUCT_HEAD], [report.tree, process.env.QA_PRODUCT_TREE], [report.runtimeHead, process.env.QA_RUNTIME_HEAD]]) {
    assert.match(expected || '', /^[0-9a-f]{40}$/); assert.equal(actual, expected);
  }
  assert.equal(report.parents, process.env.QA_PRODUCT_PARENTS);
  assert.ok(['standalone', 'reentry'].includes(report.product));
  assert.equal(report.playwright, '1.49.1'); assert.equal(Math.floor(Number(report.postgres) / 10000), 17);
  assert.equal(report.vite, '6.4.5');
  assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0');
  report.phase = 'bootstrap';
  const boot = start(process.env.QA_SERVER, [], 'bootstrap');
  await ready('http://127.0.0.1:8080/healthz', boot); await stop(boot, 'bootstrap');
  assert.deepEqual(report.errors, [], 'Bootstrap must stop cleanly before seeding or restarting');
  for (const name of ['cfg_item', 'cfg_quest', 'cfg_shop', 'cfg_shop_shelf', 'cfg_shop_offer', 'cfg_hero_template', 'cfg_unit']) command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(repo, `spec/data/generated/${name}.sql`)]);
  const server = start(process.env.QA_SERVER, [], 'server'); await ready('http://127.0.0.1:8080/healthz', server);
  const preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'client', client);
  await ready('http://127.0.0.1:5173', preview);
  const root = new protobuf.Root();
  for (const file of ['spec/proto/sanguo/common/v1/envelope.proto', 'spec/proto/sanguo/common/v1/types.proto', 'spec/proto/sanguo/account/v1/account.proto', 'spec/proto/sanguo/domestic/v1/domestic.proto', 'internal/api/proto/sanguo/hero/v1/hero.proto']) protobuf.parse(readFileSync(path.join(repo, file), 'utf8'), root, { keepCase: true });
  root.resolveAll();
  const decode = (type, bytes) => { const t = root.lookupType(`sanguo.${type}`); return t.toObject(t.decode(bytes), { longs: Number, defaults: true }); };
  browserServer = await acquireOwned(() => chromium.launchServer({ chromiumSandbox: true, timeout: commandTimeout(runtimeDeadline) }), async server => { await stopBrowser(server, null, { server, pid: server.process().pid }, report); save(); }, abort.signal);
  browserOwnership = { server: browserServer, pid: browserServer.process().pid };
  browser = await acquireOwned(() => chromium.connect(browserServer.wsEndpoint(), { timeout: commandTimeout(runtimeDeadline) }), connection => bounded(connection.close(), 10000), abort.signal); report.chromium = browser.version();
  page = await acquireOwned(() => browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }), latePage => bounded(latePage.close(), 10000), abort.signal); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(redact(error.message)));
  page.on('requestfailed', req => report.errors.push(`Request failed: ${new URL(req.url()).pathname}`));
  page.on('websocket', socket => {
    if (socket.url() !== 'ws://127.0.0.1:8080/ws') { report.errors.push('Unexpected WebSocket destination'); return; }
    socket.on('framesent', ({ payload }) => {
      try {
        const packet = decode('common.v1.ClientPacket', payload), row = { id: report.requests.length + 1, route: packet.route, sentAt: Date.now() };
        if (mutationNames.map(route).includes(row.route)) row.request = decode(`${row.route}Request`, packet.payload);
        report.requests.push(row); pending.set(packet.trace_id, row); save(); // Synthetic safe ID; never archive auth payloads or trace/session IDs.
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
  async function login() {
    await page.goto('http://127.0.0.1:5173');
    await page.locator('.server-list li[data-server-id="1"]').click();
    await responseAfter(() => action('enter-game').click(), 'account.v1.EnterGameServer'); await action('toggle-hero').waitFor();
    const entries = report.requests.filter(r => ['account.v1.Login', 'account.v1.EnterGameServer'].includes(r.route) && r.code === 0);
    assert.equal(entries.length, 2); owner = entries[0].owner; assert.ok(Number.isSafeInteger(owner) && owner > 0);
    assert.ok(entries.every(r => r.owner === owner && r.gold === 0)); assert.equal(sql('SELECT count(*) FROM player'), '1');
  }
  report.phase = 'fresh account'; await login();
  await eventually(() => pending.size === 0 && report.requests.some(r => r.productionRates), 'Fresh city bootstrap incomplete');
  for (const route of ['account.v1.Register', 'world.v1.CreateCity', 'domestic.v1.GetCityState']) assert.ok(report.requests.some(r => r.route === route && r.code === 0));
  assert.equal(sql('SELECT count(*) FROM account'), '1'); assert.equal(sql('SELECT count(*) FROM player_wallet'), '1');
  assert.deepEqual(report.requests.find(r => r.productionRates)?.productionRates, { food: 120, wood: 0, iron: 0, stone: 0, gold: 0 });
  const fresh = snapshot('fresh without fixtures'); assert.equal(fresh.wallet.gold, 0); assert.deepEqual(fresh.heroes, []); assert.deepEqual(fresh.sessions, []);
  assert.deepEqual(fresh.items, [{ server_id: 1, player_id: owner, item_cfg_id: 2004, quantity: 1 }]);
  await responseAfter(() => action('toggle-hero').click(), route('ListPlayerHeroes'));
  await responseAfter(() => action('refresh-templates').click(), route('ListRecruitTemplates'));
  const tpl = report.requests.filter(r => r.templates).at(-1).templates.find(t => t.template_cfg_id === 1017);
  assert.ok(tpl); assert.equal(tpl.recruit_item.item_cfg_id, 2004); assert.equal(tpl.recruit_item.quantity, 1);
  await panel.locator('[data-field="template-select"]').selectOption('1017');
  const recruit = await responseAfter(() => action('recruit-hero').click(), route('RecruitHero'));
  hero = recruit.response.hero_id; assert.ok(Number.isSafeInteger(hero) && hero > 0);
  assert.deepEqual(recruit.request, { server_id: 1, template_cfg_id: 1017, item_cfg_id: 2004, pool: 'standard' });
  const row = panel.locator(`li[data-hero-id="${hero}"]`); await row.waitFor();
  await eventually(() => pending.size === 0, 'Unsettled recruitment reads'); const recruited = snapshot('one real recruitment'); economy(recruited, fresh, tpl.recruit_cost);
  assert.deepEqual(recruited.items, [{ server_id: 1, player_id: owner, item_cfg_id: 2004, quantity: 0 }]); assert.deepEqual(recruited.sessions, []); assert.equal(recruited.heroes.length, 1);
  assert.equal(recruited.heroes[0].hero_id, hero); assert.equal(recruited.heroes[0].template_cfg_id, 1017);
  assert.equal(recruited.heroes[0].status, 1); assert.equal(recruited.heroes[0].exp, 0); assert.equal(recruited.heroes[0].level, 1);
  const settled = () => eventually(() => pending.size === 0, 'Unsettled live reads');
  const screenshot = async label => {
    assert.match(label, /^[a-z0-9-]+$/);
    await page.screenshot({ path: path.join(out, `${label}.png`), timeout: 5000 }); save();
  };
  await check({ page, panel, action, hero, report, save, responseAfter, settled, screenshot });
  await settled(); unchanged(snapshot('after UI checks, no training'), recruited); validateTraffic(report.requests);
  assert.deepEqual(report.errors, []);
  for (const { child, name } of children) if (!stopped.has(child)) assert.deepEqual([child.exitCode, child.signalCode], [null, null], `${name} must remain alive until cleanup`);
  abort.signal.throwIfAborted(); commandTimeout(runtimeDeadline); report.phase = 'runtime and UI postconditions complete'; report.passed = true;
}
export async function withHeroRuntime(check) {
  runtimeDeadline = Date.now() + 5 * 60000;
  const interrupt = () => abort.abort(new Error('Live runtime interrupted'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
try { await deadlineRace(() => run(check), runtimeDeadline - Date.now(), abort); } catch (error) {
  report.failure = redact(error.stack); process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
  abort.abort(new Error('Runtime lifecycle closed'));
  process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
  if (browserServer) await stopBrowser(browserServer, browser, browserOwnership, report);
  for (const { child, name } of children.reverse()) await stop(child, name).catch(error => report.errors.push(redact(`${name}: ${error.message}`)));
  if (report.errors.length || process.exitCode) { report.passed = false; process.exitCode = 1; }
  mkdirSync(out, { recursive: true }); save();
  console.log(JSON.stringify({ passed: report.passed, phase: report.phase, failure: report.failure, errors: report.errors }));
}
}
