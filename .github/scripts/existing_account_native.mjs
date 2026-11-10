import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

let phase = 'preflight';
export function loadCanonicalProto(root, protobuf) {
  const result = new protobuf.Root();
  for (const folder of ['spec/proto', 'client/proto/sanguo/content', 'client/proto/sanguo/hero']) {
    for (const file of readdirSync(join(root, folder), { recursive: true }).filter(path => path.endsWith('.proto'))) {
      protobuf.parse(readFileSync(join(root, folder, file), 'utf8'), result, { keepCase: true });
    }
  }
  return result.resolveAll();
}

export function verifyFixtures(snapshot, accounts) {
  const values = Object.values(accounts);
  assert.deepEqual(Object.keys(accounts).sort(), ['a', 'b', 'demo', 'empty']);
  assert.equal(values.length, 4);
  for (const key of ['accountId', 'playerId']) assert.equal(new Set(values.map(a => String(a[key]))).size, 4);
  assert.equal(new Set(values.filter(a => a.cityId).map(a => a.cityId)).size, 3);
  assert.equal(snapshot.accounts.length, 4); assert.equal(snapshot.players.length, 4);
  assert.equal(snapshot.cities.length, 3);
  for (const account of values) {
    assert.ok(Number.isSafeInteger(account.accountId) && account.accountId > 0);
    assert.ok(Number.isSafeInteger(account.playerId) && account.playerId > 0);
    assert.equal(account.serverId, 1);
    assert.ok(snapshot.accounts.some(a => a.account_id === account.accountId && a.status === 1));
    assert.ok(snapshot.players.some(p => p.player_id === account.playerId && p.account_id === account.accountId && p.server_id === 1));
    const cities = snapshot.cities.filter(c => c.player_id === account.playerId);
    assert.equal(cities.length, account.cityId ? 1 : 0);
    if (account.cityId) assert.ok(cities[0].city_id === account.cityId && cities[0].name === account.cityName && cities[0].server_id === 1);
  }
}

export function verifyOutcomes(result, width, accounts) {
  assert.deepEqual(result.viewport, { width, height: width === 1280 ? 720 : 900 });
  const names = result.outcomes.map(row => row.name);
  assert.equal(new Set(names).size, names.length, 'duplicate browser case');
  const expected = { 'account-a': ['a', 'city'], 'wrong-password': ['a', 'bad'], 'no-city': ['empty', 'empty'], 'account-b': ['b', 'city'], 'network-recovered': ['a', 'city'], 'legacy-demo': ['demo', 'city'] };
  assert.deepEqual([...names].sort(), Object.keys(expected).sort(), 'incomplete browser cases');
  for (const row of result.outcomes) {
    const [key, outcome] = expected[row.name], account = accounts[key];
    assert.deepEqual(row, { name: row.name, outcome, accountId: account.accountId, playerId: account.playerId, cityId: account.cityId ?? null });
  }
  assert.ok(result.requests.length > 0, 'no native wire observations');
}

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'official isolated Actions only');
  const root = process.cwd(), out = resolve(process.env.EVIDENCE);
  assert.ok(out.startsWith(`${process.env.RUNNER_TEMP}/`));
  const require = createRequire(join(root, 'client/package.json'));
  const { chromium } = require('playwright'), protobuf = require('protobufjs'), WebSocket = require('ws');
  const write = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2));
  const command = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', timeout: 120000 }).trim();
  const sql = query => JSON.parse(command('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query]));
  assert.equal(process.env.PGDATABASE, 'existing_account_native');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(command('psql', ['-XAtc', 'SELECT current_database()']), 'existing_account_native');
  assert.equal(command('go', ['env', 'GOVERSION']), 'go1.23.12');
  assert.equal(command('go', ['env', 'GOTOOLCHAIN']), 'local');
  assert.equal(Math.floor(Number(command('psql', ['-XAtc', 'SHOW server_version_num'])) / 10000), 17);
  assert.equal(require('playwright/package.json').version, '1.49.1');
  assert.equal(command('git', ['status', '--porcelain', '--untracked-files=all']), '');
  assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"), 0, 'database was not fresh');
  mkdirSync(out, { recursive: true });
  write('source.json', { head: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['rev-parse', 'HEAD^{tree}']),
    go: command('go', ['version']), postgres: command('psql', ['-XAtc', 'SELECT version()']), node: process.version });
  writeFileSync(join(out, 'tracked-tree.txt'), command('git', ['ls-tree', '-r', 'HEAD']));
  const snapshot = () => sql(`SELECT json_build_object(
    'accounts', (SELECT COALESCE(json_agg(t ORDER BY account_id),'[]') FROM (SELECT account_id,status FROM account) t),
    'players', (SELECT COALESCE(json_agg(t ORDER BY player_id),'[]') FROM (SELECT server_id,player_id,account_id FROM player) t),
    'cities', (SELECT COALESCE(json_agg(t ORDER BY city_id),'[]') FROM (SELECT server_id,city_id,player_id,name,x,y,is_capital FROM player_city) t))`);
  const children = [], sockets = new Set(), cleanup = [];
  let browser, failed = false;
  function start(name, bin, args, env = {}) {
    const fd = openSync(join(out, `${name}.log`), 'w');
    const child = spawn(bin, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] });
    const exited = once(child, 'exit').catch(() => null);
    closeSync(fd); children.push({ name, child, exited });
    child.on('error', () => { failed = true; });
    return child;
  }
  async function ready(url, child) {
    for (let i = 0; i < 120; i++) {
      assert.ok(child.exitCode === null && child.signalCode === null && !failed, 'owned service exited before ready');
      try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
      await delay(500);
    }
    throw new Error('owned service readiness timed out');
  }
  const protoRoot = loadCanonicalProto(root, protobuf);
  const type = name => protoRoot.lookupType(`sanguo.${name}`);
  const packet = type('common.v1.ClientPacket'), reply = type('common.v1.ServerPacket');
  const gatewayUrl = 'ws://127.0.0.1:18080/ws', baseUrl = 'http://127.0.0.1:14173';
  const fixtureRows = [], accounts = {};
  async function fixture(label, cell) {
    const socket = new WebSocket(gatewayUrl); sockets.add(socket);
    await Promise.race([once(socket, 'open'), delay(10000).then(() => { throw new Error('fixture connection timeout'); })]);
    let session = '', sequence = 0;
    async function rpc(route, input) {
      await delay(70); // Preserve the production 20/s gateway limiter.
      const trace = `fixture-${label}-${++sequence}`, request = type(`${route}Request`);
      const response = new Promise((resolveReply, reject) => {
        const timer = setTimeout(() => { dispose(); reject(new Error(`fixture timeout ${route}`)); }, 10000);
        const dispose = () => { clearTimeout(timer); socket.off('message', receive); socket.off('error', error); socket.off('close', error); };
        const error = () => { dispose(); reject(new Error(`fixture disconnected ${route}`)); };
        const receive = bytes => {
          try {
            const envelope = reply.decode(bytes);
            if (envelope.trace_id !== trace) return;
            dispose(); assert.equal(envelope.code, 0, `fixture failed ${route}`);
            const responseType = type(`${route}Response`);
            resolveReply(responseType.toObject(responseType.decode(envelope.data), { longs: Number, defaults: true }));
          } catch { dispose(); reject(new Error(`invalid fixture response ${route}`)); }
        };
        socket.on('message', receive); socket.on('error', error); socket.on('close', error);
      });
      socket.send(packet.encode(packet.create({ route, payload: request.encode(request.create(input)).finish(), trace_id: trace, session_id: session, server_id: 1 })).finish());
      const result = await response;
      if (result.session_id) session = result.session_id;
      fixtureRows.push({ label, route, code: 0 }); return result;
    }
    try {
      const login = label === 'demo' ? 'demo' : `native_${label}_${randomUUID().slice(0, 8)}`;
      const password = label === 'demo' ? 'demo123' : randomUUID();
      const registered = await rpc('account.v1.Register', { login_name: login, password });
      const logged = await rpc('account.v1.Login', { login_name: login, password, server_id: 1 });
      const entered = await rpc('account.v1.EnterGameServer', { server_id: 1 });
      assert.ok(entered.account_id === registered.account_id && entered.player.player_id === logged.player.player_id && entered.server_id === 1);
      const account = { login, password, accountId: entered.account_id, playerId: entered.player.player_id, serverId: 1 };
      if (cell) {
        const created = await rpc('world.v1.CreateCity', { server_id: 1, name: `Native ${label}`, x: cell.x, y: cell.y });
        assert.ok(created.city.x === cell.x && created.city.y === cell.y, 'fixture coordinates changed');
        account.cityId = created.city.city_id; account.cityName = created.city.name;
      }
      const listed = await rpc('world.v1.ListPlayerCities', {});
      assert.deepEqual(listed.cities.map(c => c.city_id), account.cityId ? [account.cityId] : []);
      if (cell) await rpc('domestic.v1.GetCityState', { city_id: account.cityId });
      accounts[label] = account;
    } finally {
      const closed = once(socket, 'close'); socket.close();
      await Promise.race([closed, delay(5000).then(() => { throw new Error('fixture socket did not close'); })]);
      sockets.delete(socket);
    }
  }
  try {
    phase = 'service-readiness';
    const server = start('gateway', join(out, 'server'), []);
    await ready('http://127.0.0.1:18080/healthz', server);
    const vite = start('preview', process.execPath, ['client/node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '14173', '--strictPort', '--outDir', 'client/dist']);
    await ready(baseUrl, vite);
    // Read-only disposable-fixture precondition, never a product spawn policy.
    phase = 'real-rpc-fixtures';
    const cells = sql("SELECT json_agg(t) FROM (SELECT x,y FROM map_cell WHERE server_id=1 AND terrain=0 AND COALESCE(resource_type,0)=0 AND (x,y) NOT IN ((0,0),(60,60)) ORDER BY x,y LIMIT 3) t");
    assert.equal(cells.length, 3); write('fixture-cells.json', cells);
    await fixture('a', cells[0]); await fixture('b', cells[1]); await fixture('empty'); await fixture('demo', cells[2]);
    const before = snapshot(); verifyFixtures(before, accounts); write('before.json', before); write('fixture-routes.json', fixtureRows);
    phase = 'chromium-sandbox';
    browser = await chromium.launch({ channel: 'chromium', headless: true, chromiumSandbox: true });
    const cdp = await browser.newBrowserCDPSession(), version = await cdp.send('Browser.getVersion');
    const args = (await cdp.send('Browser.getBrowserCommandLine')).arguments;
    assert.ok(!args.some(arg => /no-sandbox|disable-setuid-sandbox|single-process/.test(arg)));
    assert.match(version.product, /^HeadlessChrome\/131\.|^Chrome\/131\./);
    assert.match(chromium.executablePath(), /chromium(?:_headless_shell)?-1148\//);
    assert.equal(args[0], chromium.executablePath());
    const sandboxPage = await browser.newPage();
    await sandboxPage.goto('chrome://sandbox');
    const sandbox = await sandboxPage.locator('body').innerText();
    assert.match(sandbox, /Seccomp-BPF sandbox\s+Yes/);
    assert.match(sandbox, /PID namespaces\s+Yes/);
    await sandboxPage.close();
    write('browser.json', { version, args, sandbox, playwright: require('playwright/package.json').version,
      binary: command('sha256sum', [args[0]]), executable: chromium.executablePath(), sandboxRequested: true });
    const { runExistingAccountScenario } = await import(pathToFileURL(join(root, 'client/qa/existingAccount.browser.mjs')));
    for (const width of [1280, 1600]) {
      phase = `native-${width}`;
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 900 } });
      context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(15000);
      try {
        const result = await runExistingAccountScenario({ page: await context.newPage(), baseUrl, gatewayUrl, protoRoot, accounts, artifactDir: join(out, String(width)) });
        verifyOutcomes(result, width, accounts);
        const after = snapshot(); verifyFixtures(after, accounts); assert.deepEqual(after, before, 'persisted actor/city identity changed');
        write(`after-${width}.json`, after);
      } finally { await context.close(); }
    }
    for (const { child } of children) assert.ok(child.exitCode === null && child.signalCode === null, 'service died during native acceptance');
  } finally {
    const failedPhase = phase; phase = 'owned-cleanup';
    for (const socket of sockets) socket.terminate();
    if (browser) await browser.close().catch(() => { failed = true; });
    for (const { name, child, exited } of children.reverse()) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await Promise.race([exited, delay(10000)]);
      if (child.exitCode === null && child.signalCode === null) { failed = true; child.kill('SIGKILL'); await exited; }
      cleanup.push({ name, code: child.exitCode, signal: child.signalCode });
    }
    write('cleanup.json', cleanup);
    assert.equal(failed, false, 'owned process cleanup failed');
    phase = failedPhase;
  }
  assert.equal(command('git', ['status', '--porcelain', '--untracked-files=all']), '');
  write('result.json', { passed: true, widths: [1280, 1600], fixtureAccounts: 4, fixtureCities: 3 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error(`Native acceptance failed at ${phase}; inspect redacted evidence.`); process.exitCode = 1; });
}
