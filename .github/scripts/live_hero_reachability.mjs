import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
let protobuf, chromium;

const report = { passed: false, phase: 'preflight', requests: [], snapshots: [], geometry: [], errors: [], cleanup: [] };
const out = path.resolve(process.env.QA_OUT || 'evidence'), client = process.cwd(), repo = path.resolve(client, '..');
const abort = new AbortController(), children = [], pending = new Map(), stopped = new WeakSet();
let browser, browserServer, page, budgetTimer, owner, hero;
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
  children.push({ child, name, pid: child.pid }); return child;
}
async function stop(child, name) {
  if (stopped.has(child)) return;
  const owned = Number.isInteger(child.pid) && child.pid > 0 && children.some(entry => entry.child === child && entry.pid === child.pid && entry.name === name);
  const alive = child.exitCode === null && child.signalCode === null; let termRequested = false;
  if (owned && alive) {
    termRequested = child.kill('SIGTERM');
    for (let n = 0; n < 100 && child.exitCode === null && child.signalCode === null; n++) await delay(100);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); report.errors.push(`${name}: required SIGKILL`); await delay(500); }
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
function measurePanel(el, heroId) {
      const name = node => node ? `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}.${node.className} ${node.getAttribute('data-role') || node.getAttribute('data-action') || ''}` : null;
      const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const row = el.querySelector(`li[data-hero-id="${heroId}"]`), chain = []; let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      for (let a = row; a; a = a.parentElement) {
        const r = a.getBoundingClientRect(), css = getComputedStyle(a);
        chain.push({ name: name(a), rect: rect(a), overflowX: css.overflowX, overflowY: css.overflowY, position: css.position, zIndex: css.zIndex,
          scrollTop: a.scrollTop, clientHeight: a.clientHeight, scrollHeight: a.scrollHeight, display: css.display, visibility: css.visibility });
        if (a !== row && /auto|scroll|hidden|clip/.test(css.overflowX)) { clip.left = Math.max(clip.left, r.left + a.clientLeft); clip.right = Math.min(clip.right, r.left + a.clientLeft + a.clientWidth); }
        if (a !== row && /auto|scroll|hidden|clip/.test(css.overflowY)) { clip.top = Math.max(clip.top, r.top + a.clientTop); clip.bottom = Math.min(clip.bottom, r.top + a.clientTop + a.clientHeight); }
      }
      const targets = [row, ...row.querySelectorAll('.hero-list-row-primary, img, canvas')].map(target => {
        const r = target.getBoundingClientRect(), left = Math.max(clip.left, r.left), top = Math.max(clip.top, r.top), right = Math.min(clip.right, r.right), bottom = Math.min(clip.bottom, r.bottom), points = [];
        if (right > left && bottom > top) for (const fy of [0.1, 0.5, 0.9]) for (const fx of [0.1, 0.5, 0.9]) {
          const x = left + (right - left) * fx, y = top + (bottom - top) * fy, hit = document.elementFromPoint(x, y);
          points.push({ x, y, hit: name(hit), reachesTarget: !!hit && target.contains(hit), reachesRow: !!hit && row.contains(hit) });
        }
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        return { name: name(target), rect: rect(target), clipped: { left, top, right, bottom }, center: { x: cx, y: cy, hit: name(document.elementFromPoint(cx, cy)) }, points };
      });
      return { ancestors: chain, targets, details: [...el.querySelectorAll('details')].map(d => ({ name: name(d), open: d.open, rect: rect(d), summary: rect(d.querySelector('summary')) })) };
}
async function run() {
  mkdirSync(out, { recursive: true }); save();
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Official runner only; no local browser retry');
  protobuf = (await import('protobufjs')).default; ({ chromium } = await import('playwright'));
  const width = Number(process.env.QA_WIDTH), height = width === 1280 ? 720 : 900;
  assert.ok([1280, 1600].includes(width));
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/live_hero_reachability');
  for (const [key, value] of Object.entries({ PGHOST: '127.0.0.1', PGDATABASE: 'live_hero_reachability', REDIS_ADDR: '127.0.0.1:6379' })) assert.equal(process.env[key], value);
  Object.assign(report, { width, height, productHead: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['write-tree']), node: process.version,
    vite: JSON.parse(readFileSync(path.join(client, 'node_modules/vite/package.json'))).version,
    source: '409ad569415ea7215dc1297c2306423d0392dea4', sourceParent: 'e2b60dda830d9b25f15fcfced4da4acc090a8f1c',
    main: '757e43a9f40d7c92ded6a536ec334de94d69ff6f', qaHead: command('git', ['rev-parse', 'HEAD'], path.resolve(repo, '../qa-source')),
    go: command('go', ['version']), playwright: JSON.parse(readFileSync(path.join(client, 'node_modules/playwright/package.json'))).version, postgres: sql('SHOW server_version_num') });
  assert.equal(report.productHead, 'a020369eb4f58e835522934c662ab1fd3d4161e3'); assert.equal(report.tree, '16fb9da5b53af34d75cae9cbbd21a8e39f1dcfed');
  assert.equal(report.playwright, '1.49.1'); assert.equal(Math.floor(Number(report.postgres) / 10000), 17);
  assert.equal(report.vite, '6.4.5');
  assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0');
  const expire = () => { abort.abort(new Error('Diagnostic runtime budget expired')); void browser?.close().catch(() => {}); };
  budgetTimer = setTimeout(expire, 5 * 60000);
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
  // Geometry collection is read-only: no DOM/style/scroll mutation and no event injection.
  async function geometry(label) {
    const value = await panel.evaluate(measurePanel, hero);
    report.geometry.push({ label, ...value }); save(); await page.screenshot({ path: path.join(out, `${label}.png`), timeout: 5000 }); return value;
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
  report.phase = 'unfolded inspection'; await geometry('unfolded-original');
  try { await row.click({ trial: true, timeout: 1500 }); report.rowCenterTrial = 'actionable, no click sent'; }
  catch (error) { report.rowCenterTrial = redact(error.stack); }
  await geometry('unfolded-after-center-trial');
  report.phase = 'native summary folds'; report.folds = [];
  const details = panel.locator('details.hero-recruit-host, details.hero-capture-info');
  for (let i = 0; i < await details.count(); i++) {
    const detail = details.nth(i); if (!(await detail.evaluate(el => el.open))) continue;
    const summary = detail.locator(':scope > summary'); report.folds.push(await summary.innerText()); save();
    await summary.click(); assert.equal(await detail.evaluate(el => el.open), false); await geometry(`fold-${i}`);
  }
  report.phase = 'visible hero mouse target';
  const target = row.locator('.hero-list-row-primary'); await target.scrollIntoViewIfNeeded();
  const folded = await geometry('folded-before-click'), primary = folded.targets.find(t => t.name.includes('hero-list-row-primary'));
  const point = primary?.points.find(p => p.reachesTarget); assert.ok(point, 'No sampled actionable hero name after native folds; not proof all pixels are inaccessible');
  const offset = { x: point.x - primary.rect.x, y: point.y - primary.rect.y }; report.mouseTarget = { point, offset }; save();
  const result = await responseAfter(() => target.click({ position: offset }), route('GetHeroDetail'));
  assert.equal(result.detail.hero_id, hero); await action('hero-expr-finish').waitFor(); await geometry('detail-opened-by-mouse');
  await sleep(300); await eventually(() => pending.size === 0, 'Unsettled final reads'); unchanged(snapshot('after mouse detail, no training'), recruited);
  const allowed = ['account.v1.ListGameServers', 'account.v1.Login', 'account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'world.v1.CreateCity',
    'domestic.v1.GetCityState', 'content.v1.ListPlayerMail', 'quest.v1.ListPlayerQuests', 'military.v1.ListBattleReports', 'chat.v1.ListChatMessages', 'military.v1.ListMarches', 'content.v1.ListPlayerBag',
    ...['ListPlayerHeroes', 'ListRecruitTemplates', 'ListHotelRecruitCandidates', 'ListCaptiveHeroes', 'ListPersuadeTargets', 'ListComingHeroes', 'RecruitHero', 'GetHeroDetail'].map(route)];
  assert.deepEqual(report.requests.filter(r => !allowed.includes(r.route)), []);
  for (const expected of ['account.v1.Register', 'world.v1.CreateCity', route('RecruitHero')]) assert.equal(report.requests.filter(r => r.route === expected).length, 1);
  assert.deepEqual(mutations().map(r => [r.route, r.code]), [[route('RecruitHero'), 0]]); assert.deepEqual(report.errors, []);
  for (const { child, name } of children) if (!stopped.has(child)) assert.deepEqual([child.exitCode, child.signalCode], [null, null], `${name} must remain alive until cleanup`);
  abort.signal.throwIfAborted(); report.phase = 'mouse detail reached'; report.passed = true;
}
if (process.argv.includes('--self-test')) {
  const r = { x: 10, y: 10, width: 100, height: 100, left: 10, top: 10, right: 110, bottom: 110 };
  const node = (className, rect = r) => ({ tagName: 'SPAN', className, getAttribute: () => null, getBoundingClientRect: () => rect, clientLeft: 0, clientTop: 0, clientWidth: rect.width, clientHeight: rect.height, querySelectorAll: () => [], contains(hit) { return hit === this; } });
  const primary = node('hero-list-row-primary'), row = node('row'), parent = node('clip', { ...r, width: 50, right: 60 });
  row.parentElement = parent; row.querySelectorAll = () => [primary]; row.contains = hit => hit === row || hit === primary;
  const panel = { querySelector: () => row, querySelectorAll: () => [] };
  globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
  globalThis.getComputedStyle = () => ({ overflowX: 'hidden', overflowY: 'hidden' });
  globalThis.document = { elementFromPoint: () => primary };
  let result = measurePanel(panel, 1); assert.equal(result.targets[1].points.length, 9); assert.equal(result.targets[1].clipped.right, 60);
  assert.ok(result.targets[1].points.every(p => p.reachesRow && p.reachesTarget && p.x < 60));
  document.elementFromPoint = () => parent; result = measurePanel(panel, 1); assert.ok(result.targets[1].points.every(p => !p.reachesRow && !p.reachesTarget));
  parent.getBoundingClientRect = () => ({ ...r, left: 200, right: 250 }); result = measurePanel(panel, 1); assert.deepEqual(result.targets[1].points, []);
  document.elementFromPoint = () => null; assert.equal(measurePanel(panel, 1).targets[0].center.hit, null);
  assert.equal(redact('demo123 postgres://u:p@host/db'), '[test-password] [test-dsn]');
  console.log('PASS: clipped geometry, reachable/occluded/empty/null-hit samples and redaction; no browser or services started');
} else try { await run(); } catch (error) {
  report.failure = redact(error.stack); process.exitCode = 1;
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
  clearTimeout(budgetTimer);
  await bounded(browser?.close(), 10000).catch(error => report.errors.push(redact(error.message)));
  if (browserServer) await bounded(browserServer.close(), 10000).catch(error => { browserServer.process().kill('SIGKILL'); report.errors.push(redact(error.message)); });
  if (browserServer && (browserServer.process().exitCode !== 0 || browserServer.process().signalCode !== null)) report.errors.push('Chromium cleanup was not a clean exit');
  for (const { child, name } of children.reverse()) await stop(child, name).catch(error => report.errors.push(redact(`${name}: ${error.message}`)));
  if (report.errors.length || process.exitCode) { report.passed = false; process.exitCode = 1; }
  mkdirSync(out, { recursive: true }); save();
  console.log(JSON.stringify({ passed: report.passed, phase: report.phase, failure: report.failure, errors: report.errors }));
}
