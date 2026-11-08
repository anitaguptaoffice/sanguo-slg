import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { redact, commandTimeout, deadlineRace, acquireOwned, stopOwned, stopBrowser } from './live_hero_layout_runtime.mjs';
export const CREATE = 'guild.v1.CreateGuild', LIST = 'guild.v1.ListGuildMembers';
const allowed = new Set(['account.v1.ListGameServers', 'account.v1.Login', 'account.v1.Register', 'account.v1.EnterGameServer',
  'world.v1.ListPlayerCities', 'world.v1.CreateCity', 'domestic.v1.GetCityState', 'content.v1.ListPlayerMail',
  'quest.v1.ListPlayerQuests', 'military.v1.ListBattleReports', 'military.v1.ListMarches', 'content.v1.ListPlayerBag',
  'hero.v1.ListPlayerHeroes', 'chat.v1.ListChatMessages', CREATE, LIST]);
export async function guarded(signal, action) {
  signal.throwIfAborted(); const result = await action(); signal.throwIfAborted(); return result;
}
export function observer(decode, requests, enums) {
  assert.equal(enums.loginFailure, 20001); assert.equal(enums.guildChannel, 3);
  const pending = new Map(), seen = new Set(); let owner, guild, city;
  const count = route => requests.filter(row => row.route === route).length;
  return { pending, sent(bytes, timestamp) {
    const packet = decode('common.v1.ClientPacket', bytes);
    assert.ok(allowed.has(packet.route), 'Unapproved route');
    assert.ok(packet.trace_id && !seen.has(packet.trace_id), 'Missing/duplicate trace'); seen.add(packet.trace_id);
    const row = { id: requests.length + 1, route: packet.route, sentAt: timestamp };
    if ([CREATE, LIST, 'hero.v1.ListPlayerHeroes', 'chat.v1.ListChatMessages'].includes(row.route)) {
      const req = decode(`${row.route}Request`, packet.payload); assert.equal(packet.server_id, 1); assert.equal(req.server_id, 1);
      if (row.route === CREATE) { assert.equal(count(CREATE), 0); assert.equal(req.name, 'GuildPresenceQA'); }
      if (row.route === LIST) { assert.ok(guild > 0); assert.deepEqual(req, { server_id: 1, guild_id: guild, page: 1, page_size: 50 }); assert.ok(count(LIST) < 2); }
      if (row.route === 'hero.v1.ListPlayerHeroes') { assert.equal(count(row.route), 0); assert.deepEqual(req, { server_id: 1, page_size: 50, page_offset: 0 }); }
      if (row.route === 'chat.v1.ListChatMessages') {
        assert.ok(req.channel === 1 || (req.channel === enums.guildChannel && guild > 0));
        assert.deepEqual(req, { server_id: 1, channel: req.channel, peer_player_id: 0, guild_id: req.channel === 1 ? 0 : guild, before_message_id: 0, limit: 30 });
      }
      row.request = req;
    }
    if (['world.v1.CreateCity', 'domestic.v1.GetCityState'].includes(row.route)) assert.equal(packet.server_id, 1);
    if (row.route === 'domestic.v1.GetCityState') { row.city = decode(`${row.route}Request`, packet.payload).city_id; assert.equal(row.city, city); }
    pending.set(packet.trace_id, row); requests.push(row);
  }, received(bytes, timestamp) {
    const packet = decode('common.v1.ServerPacket', bytes), row = pending.get(packet.trace_id);
    assert.ok(row, 'Unmatched response'); assert.ok(timestamp >= row.sentAt, 'Reply before request');
    pending.delete(packet.trace_id); Object.assign(row, { code: packet.code, receivedAt: timestamp });
    if (row.route === 'account.v1.Login' && count(row.route) === 1) assert.equal(row.code, enums.loginFailure);
    else assert.equal(row.code, 0);
    if (!packet.code && ['account.v1.Login', 'account.v1.EnterGameServer'].includes(row.route)) {
      const id = decode(`${row.route}Response`, packet.data).player.player_id;
      assert.ok(Number.isSafeInteger(id) && id > 0); if (owner) assert.equal(id, owner); owner = id; row.owner = id;
    }
    if (!packet.code && [CREATE, LIST].includes(row.route)) {
      const res = decode(`${row.route}Response`, packet.data), g = res.guild;
      assert.ok(Number.isSafeInteger(g.guild_id) && g.guild_id > 0); assert.equal(g.server_id, 1);
      assert.equal(g.leader_player_id, owner); assert.equal(g.name, 'GuildPresenceQA'); assert.equal(g.member_count, 1);
      if (guild) assert.equal(g.guild_id, guild); guild = g.guild_id;
      row.guild = { guild_id: guild, server_id: g.server_id, leader_player_id: owner, member_count: g.member_count };
      if (row.route === LIST) {
        assert.equal(res.total_count, 1); assert.equal(res.members.length, 1);
        const member = res.members[0]; assert.equal(member.player_id, owner); assert.equal(member.role, 1);
        assert.ok(!('is_online' in member) && !('online_count' in res) && !('online_count' in g));
        row.member = { player_id: member.player_id, role: member.role }; row.total = res.total_count;
      }
    }
    if (!packet.code && row.route === 'world.v1.CreateCity') {
      const created = decode(`${row.route}Response`, packet.data).city; city = created.city_id;
      assert.ok(Number.isSafeInteger(city) && city > 0); row.city = city;
    }
    if (!packet.code && row.route === 'domestic.v1.GetCityState') {
      row.rates = decode(`${row.route}Response`, packet.data).production_rates;
      assert.deepEqual(row.rates, { food: 120, wood: 0, stone: 0, iron: 0, gold: 0 });
    }
    if (!packet.code && row.route === 'chat.v1.ListChatMessages') assert.deepEqual(decode(`${row.route}Response`, packet.data).messages, []);
  } };
}
export function validateTraffic(requests) {
  assert.ok(requests.every(row => allowed.has(row.route) && Number.isFinite(row.receivedAt)));
  for (const name of ['account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.CreateCity', CREATE, 'hero.v1.ListPlayerHeroes'])
    assert.deepEqual(requests.filter(row => row.route === name).map(row => row.code), [0]);
  assert.deepEqual(requests.filter(row => row.route === 'account.v1.Login').map(row => row.code), [20001, 0]);
  assert.deepEqual(requests.filter(row => row.route === LIST).map(row => row.code), [0, 0]);
  assert.ok(requests.some(row => row.rates), 'Missing actual production rate observation');
}
export function economy(before, after, exact = false) {
  assert.deepEqual(after.assets, before.assets); assert.deepEqual(after.identity, before.identity);
  assert.ok(Number.isSafeInteger(before.wallet.gold) && before.wallet.gold >= 0); assert.equal(after.wallet.gold, before.wallet.gold);
  for (const s of [before, after]) { assert.match(s.ns, /^\d+$/); for (const r of Object.values(s.remainders)) assert.match(r, /^\d+$/); }
  const D = 3600000000000n, dt = BigInt(after.ns) - BigInt(before.ns);
  assert.ok(dt >= 0n && dt <= 300000000000n);
  for (const key of ['food', 'wood', 'stone', 'iron']) {
    const oldR = BigInt(before.remainders[key]), newR = BigInt(after.remainders[key]);
    assert.ok(oldR >= 0n && oldR < D && newR >= 0n && newR < D);
    for (const snapshot of [before, after]) assert.ok(Number.isSafeInteger(snapshot.wallet[key]) && snapshot.wallet[key] >= 0 && snapshot.wallet[key] < 50000);
    const n = (key === 'food' ? 120n : 0n) * dt + oldR - newR;
    assert.ok(n >= 0n && n % D === 0n); assert.equal(BigInt(after.wallet[key] - before.wallet[key]), n / D);
  }
  if (exact) assert.deepEqual(after.wallet, before.wallet);
}
export function membership(snapshot, owner, guild) {
  assert.deepEqual(snapshot.guilds, [{ server_id: 1, guild_id: guild, leader_player_id: owner, member_count: 1 }]);
  assert.deepEqual(snapshot.members, [{ server_id: 1, guild_id: guild, player_id: owner, role: 1 }]);
}
export function validateEnvironment(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Official runner only');
  const db = new URL(env.DATABASE_URL);
  assert.equal(db.hostname, '127.0.0.1'); assert.equal(db.pathname, '/live_guild_presence');
  for (const [key, value] of Object.entries({ PGHOST: '127.0.0.1', PGDATABASE: 'live_guild_presence', REDIS_ADDR: '127.0.0.1:6379' })) assert.equal(env[key], value);
  assert.ok(['baseline', 'fixed'].includes(env.QA_PRODUCT)); assert.ok(['1280', '1600'].includes(env.QA_WIDTH));
}
export async function finishOwned(state, browser) {
  if (browser) await stopBrowser(browser.server, browser.connection, browser.ownership, state.report).catch(error => state.report.errors.push(redact(error.message)));
  for (const { child, name } of [...state.children].reverse()) {
    await stopOwned(child, name, state).catch(error => state.report.errors.push(redact(`${name}: ${error.message}`)));
  }
  if (state.report.errors.length) state.report.passed = false;
}
export function provenance(actual, head, tree, parents) {
  assert.match(head || '', /^[a-f0-9]{40}$/); assert.match(tree || '', /^[a-f0-9]{40}$/);
  assert.deepEqual(actual, { head, tree, parents });
}
async function boundedClose(close) {
  let timer;
  try { return await Promise.race([close(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Late resource close timeout')), 10000); })]); }
  finally { clearTimeout(timer); }
}
export async function withGuildRuntime(check) {
  const report = { passed: false, phase: 'preflight', requests: [], snapshots: [], errors: [], cleanup: [] };
  const out = path.resolve(process.env.QA_OUT || 'evidence'), client = process.cwd(), repo = path.resolve(client, '..');
  const abort = new AbortController(), state = { children: [], stopped: new WeakSet(), report }, deadline = Date.now() + 300000;
  let browserState, page, cdp;
  const save = () => { mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); };
  const act = fn => guarded(abort.signal, fn);
  const command = (cmd, args, cwd = repo) => { abort.signal.throwIfAborted(); return execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: commandTimeout(deadline) }).trim(); };
  const sql = query => command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query]);
  const pause = ms => act(() => delay(ms, undefined, { signal: abort.signal }));
  const eventually = async (fn, message) => {
    for (let n = 0; n < 150; n++) { if (await act(fn)) return; await pause(100); }
    assert.fail(message);
  };
  function start(cmd, args, name, cwd = repo) {
    abort.signal.throwIfAborted(); commandTimeout(deadline);
    const child = spawn(cmd, args, { cwd, env: { ...process.env, HTTP_ADDR: '127.0.0.1:8080', MIL_FRESH_PROFILE_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', error => report.errors.push(redact(`${name}: ${error.message}`)));
    for (const [stream, suffix] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
      let buffer = ''; stream.on('data', data => { buffer += data; const lines = buffer.split('\n'); buffer = lines.pop(); for (const line of lines) appendFileSync(path.join(out, `${name}-${suffix}.log`), `${redact(line)}\n`); });
      stream.on('end', () => { if (buffer) appendFileSync(path.join(out, `${name}-${suffix}.log`), redact(buffer)); });
    }
    state.children.push({ child, name, pid: child.pid }); return child;
  }
  async function ready(url, child) {
    for (let n = 0; n < 600; n++) {
      abort.signal.throwIfAborted(); assert.deepEqual([child.exitCode, child.signalCode], [null, null]);
      try { if ((await act(() => fetch(url, { signal: AbortSignal.timeout(1000) }))).ok) return; } catch { abort.signal.throwIfAborted(); }
      await pause(100);
    }
    assert.fail(`Readiness timeout: ${url}`);
  }
  const interrupt = () => abort.abort(new Error('Runtime interrupted'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt); save();
  try { await deadlineRace(async () => {
    validateEnvironment(process.env); report.product = process.env.QA_PRODUCT;
    for (const [label, cwd, head, tree, parents] of [
      ['product', repo, process.env.QA_PRODUCT_HEAD, process.env.QA_PRODUCT_TREE, process.env.QA_PRODUCT_PARENTS],
      ['runtime', path.resolve(repo, '../guild-runtime-source'), process.env.QA_RUNTIME_HEAD, process.env.QA_RUNTIME_TREE, process.env.QA_RUNTIME_PARENTS],
      ['helper', path.resolve(repo, '../runtime-source'), '7dc5939f9753a8aa59c94f7101c62a8e4a8eda79', 'dc151c5513ea2a2d937e45d4dee12d9f59792c7e', process.env.QA_HELPER_PARENTS],
    ]) {
      const actual = { head: command('git', ['rev-parse', 'HEAD'], cwd), tree: command('git', ['rev-parse', 'HEAD^{tree}'], cwd), parents: command('git', ['show', '-s', '--format=%P', 'HEAD'], cwd) };
      provenance(actual, head, tree, parents); report[label + 'Provenance'] = actual;
      command('git', ['diff', '--exit-code'], cwd); command('git', ['diff', '--cached', '--exit-code'], cwd);
    }
    const qa = path.resolve(repo, '../qa-source');
    report.qa = { head: command('git', ['rev-parse', 'HEAD'], qa), tree: command('git', ['rev-parse', 'HEAD^{tree}'], qa), parents: command('git', ['show', '-s', '--format=%P', 'HEAD'], qa) };
    assert.equal(report.qa.head, process.env.QA_QA_HEAD); assert.equal(command('git', ['status', '--porcelain'], qa), '');
    report.node = process.version; assert.match(report.node, /^v22\./);
    report.go = command('go', ['version']); assert.match(report.go, /go1\.23\.12 /);
    for (const [pkg, version] of [['playwright', '1.49.1'], ['vite', '6.4.5']]) {
      report[pkg] = JSON.parse(readFileSync(path.join(client, `node_modules/${pkg}/package.json`))).version; assert.equal(report[pkg], version);
    }
    report.postgres = sql('SHOW server_version_num'); assert.equal(Math.floor(Number(report.postgres) / 10000), 17);
    assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"), '0'); report.phase = 'bootstrap';
    const boot = start(process.env.QA_SERVER, [], 'bootstrap'); await ready('http://127.0.0.1:8080/healthz', boot);
    await act(() => stopOwned(boot, 'bootstrap', state)); assert.deepEqual(report.errors, []);
    for (const name of ['cfg_item', 'cfg_quest', 'cfg_shop', 'cfg_shop_shelf', 'cfg_shop_offer', 'cfg_hero_template', 'cfg_unit']) command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(repo, `spec/data/generated/${name}.sql`)]);
    await ready('http://127.0.0.1:8080/healthz', start(process.env.QA_SERVER, [], 'server'));
    await ready('http://127.0.0.1:5173', start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'client', client));
    const protobuf = (await import('protobufjs')).default, { chromium } = await import('playwright'), root = new protobuf.Root();
    for (const file of ['common/v1/envelope.proto', 'common/v1/types.proto', 'account/v1/account.proto', 'chat/v1/chat.proto', 'guild/v1/guild.proto', 'domestic/v1/domestic.proto', 'world/v1/world.proto']) protobuf.parse(readFileSync(path.join(repo, 'spec/proto/sanguo', file), 'utf8'), root, { keepCase: true });
    protobuf.parse(readFileSync(path.join(client, 'proto/sanguo/hero/v1/hero.proto'), 'utf8'), root, { keepCase: true }); root.resolveAll();
    const decode = (name, bytes) => { const type = root.lookupType(`sanguo.${name}`); return type.toObject(type.decode(bytes), { longs: Number, defaults: true }); };
    const traffic = observer(decode, report.requests, { loginFailure: root.lookupEnum('sanguo.common.v1.ErrorCode').values.ACCOUNT_LOGIN_FAILED, guildChannel: root.lookupEnum('sanguo.chat.v1.ChatChannel').values.CHAT_CHANNEL_GUILD });
    const server = await acquireOwned(() => chromium.launchServer({ chromiumSandbox: true, timeout: commandTimeout(deadline) }), async server => { await stopBrowser(server, null, { server, pid: server.process().pid }, report); save(); }, abort.signal);
    browserState = { server, ownership: { server, pid: server.process().pid } };
    browserState.connection = await acquireOwned(() => chromium.connect(server.wsEndpoint(), { timeout: commandTimeout(deadline) }), connection => boundedClose(() => connection.close()), abort.signal);
    page = await acquireOwned(() => browserState.connection.newPage({ viewport: { width: Number(process.env.QA_WIDTH), height: Number(process.env.QA_WIDTH) === 1280 ? 720 : 900 } }), late => boundedClose(() => late.close()), abort.signal);
    report.chromium = browserState.connection.version(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(redact(error.message)));
    page.on('request', request => { const url = new URL(request.url()); if (!['http://127.0.0.1:5173', 'http://127.0.0.1:8080'].includes(url.origin)) report.errors.push('Nonlocal request'); });
    page.on('requestfailed', () => report.errors.push('Failed page request'));
    cdp = await act(() => page.context().newCDPSession(page));
    await act(() => cdp.send('Network.enable')); await act(() => cdp.send('Performance.enable', { timeDomain: 'timeTicks' }));
    const networkStart = (await act(() => cdp.send('Performance.getMetrics'))).metrics.find(m => m.name === 'Timestamp').value;
    const sockets = new Set();
    cdp.on('Network.webSocketCreated', event => { if (event.url === 'ws://127.0.0.1:8080/ws' && sockets.size === 0) sockets.add(event.requestId); else report.errors.push('Unexpected socket'); });
    for (const [name, method] of [['Network.webSocketFrameSent', 'sent'], ['Network.webSocketFrameReceived', 'received']]) cdp.on(name, event => {
      try { assert.ok(Number.isFinite(event.timestamp) && event.timestamp >= networkStart, 'Network clock domain'); assert.ok(sockets.has(event.requestId)); assert.equal(event.response.opcode, 2); traffic[method](Buffer.from(event.response.payloadData, 'base64'), event.timestamp); save(); }
      catch (error) { report.errors.push(redact(error.message)); }
    });
    const action = name => page.locator(`[data-action="${name}"]`), panel = page.locator('[data-center-panel="guild"]');
    const settled = () => eventually(() => traffic.pending.size === 0, 'Unsettled replies');
    report.phase = 'fresh account'; await act(() => page.goto('http://127.0.0.1:5173'));
    await act(() => page.locator('.server-list li[data-server-id="1"]').click());
    await act(() => action('enter-game').click()); await act(() => action('toggle-guild').waitFor()); await settled();
    for (const route of ['account.v1.Register', 'world.v1.CreateCity', 'domestic.v1.GetCityState']) assert.ok(report.requests.some(r => r.route === route && r.code === 0));
    const owners = report.requests.filter(r => r.owner !== undefined); assert.equal(owners.length, 2);
    const owner = owners[0].owner; assert.ok(Number.isSafeInteger(owner) && owner > 0); assert.ok(owners.every(r => r.owner === owner));
    for (const table of ['account', 'player', 'player_wallet', 'player_city']) assert.equal(sql(`SELECT count(*) FROM ${table}`), '1');
    function snapshot(label) {
      const owned = `server_id=1 AND player_id=${owner}`;
      const value = JSON.parse(sql(`SELECT jsonb_build_object(
        'identity',jsonb_build_array(p.server_id,p.player_id,p.city_id),
        'wallet',(SELECT to_jsonb(w)-'updated_at'-'server_id'-'player_id' FROM player_wallet w WHERE ${owned}),
        'ns',((extract(epoch FROM p.settled_at)*1000000000)::bigint+p.settled_submicro_ns)::text,
        'remainders',jsonb_build_object('food',p.food_remainder::text,'wood',p.wood_remainder::text,'stone',p.stone_remainder::text,'iron',p.iron_remainder::text),
        'assets',jsonb_build_object('items',(SELECT coalesce(jsonb_agg(i ORDER BY item_cfg_id),'[]') FROM player_item i WHERE ${owned}),
          'heroes',(SELECT coalesce(jsonb_agg(h ORDER BY hero_id),'[]') FROM player_hero h WHERE ${owned}),
          'buildings',(SELECT coalesce(jsonb_agg(b ORDER BY slot_key),'[]') FROM city_building b WHERE server_id=1 AND city_id=p.city_id)),
        'guilds',(SELECT coalesce(jsonb_agg(jsonb_build_object('server_id',g.server_id,'guild_id',g.guild_id,'leader_player_id',g.leader_player_id,'member_count',g.member_count)),'[]') FROM guild g),
        'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('server_id',m.server_id,'guild_id',m.guild_id,'player_id',m.player_id,'role',m.role)),'[]') FROM guild_member m))
        FROM city_production_checkpoint p WHERE ${owned}`));
      assert.deepEqual(value.identity.slice(0, 2), [1, owner]); assert.equal(value.identity[2], report.requests.find(row => row.route === 'world.v1.CreateCity').city);
      report.snapshots.push({ label, ...value }); save(); return value;
    }
    const screenshot = label => act(() => page.screenshot({ path: path.join(out, `${label}.png`), timeout: 5000 }));
    await act(() => action('toggle-guild').click()); await settled(); report.phase = 'native cases';
    const before = snapshot('before guild'); assert.deepEqual(before.guilds, []); assert.deepEqual(before.members, []);
    await act(() => check({ page, panel, action, report, owner, act, pause, eventually, settled, screenshot, save, snapshot, before }));
    await settled(); const after = snapshot('after UI'); economy(before, after);
    membership(after, owner, report.requests.find(row => row.route === CREATE).guild.guild_id);
    const networkEnd = (await act(() => cdp.send('Performance.getMetrics'))).metrics.find(m => m.name === 'Timestamp').value;
    assert.ok(report.requests.every(r => r.sentAt <= networkEnd && r.receivedAt <= networkEnd), 'Network clock domain');
    report.networkClock = { start: networkStart, end: networkEnd, domain: 'CDP monotonic timeTicks' };
    validateTraffic(report.requests); assert.deepEqual(report.errors, []);
    for (const { child, name } of state.children) if (!state.stopped.has(child)) assert.deepEqual([child.exitCode, child.signalCode], [null, null], `${name} exited early`);
    commandTimeout(deadline); abort.signal.throwIfAborted(); report.passed = true; report.phase = 'native gates complete';
  }, deadline - Date.now(), abort); } catch (error) {
    report.failure = redact(error.stack); report.passed = false;
    if (page) await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 }).catch(() => {});
  } finally {
    abort.abort(new Error('Runtime closed')); process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
    await finishOwned(state, browserState); save(); if (!report.passed) process.exitCode = 1;
    console.log(JSON.stringify({ passed: report.passed, phase: report.phase, failure: report.failure, errors: report.errors }));
  }
  return report;
}
