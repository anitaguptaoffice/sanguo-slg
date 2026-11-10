import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

let phase = 'preflight';
import { loadCanonicalProto, verifyFixtures } from './existing_account_native.mjs';

export function verifyDelta(before, after, identity, stage, interruptedId = null) {
  const { accountId, playerId } = identity;
  assert.ok(Number.isSafeInteger(accountId) && accountId > 0);
  assert.ok(!before.accounts.some(a => a.account_id === accountId));
  const expectedAccounts = [...before.accounts, { account_id: accountId, status: 1 }];
  if (interruptedId !== null) {
    assert.ok(Number.isSafeInteger(interruptedId) && interruptedId > 0 && interruptedId !== accountId);
    assert.ok(!before.accounts.some(a => a.account_id === interruptedId));
    expectedAccounts.push({ account_id: interruptedId, status: 1 });
  }
  assert.deepEqual(after.accounts, expectedAccounts.sort((a,b) => a.account_id-b.account_id));
  const expectedPlayers = [...before.players];
  if (stage !== 'registered') {
    assert.ok(Number.isSafeInteger(playerId) && playerId > 0);
    assert.ok(!before.players.some(p => p.player_id === playerId));
    expectedPlayers.push({ server_id: 1, player_id: playerId, account_id: accountId });
  }
  assert.deepEqual(after.players, expectedPlayers.sort((a,b) => a.player_id-b.player_id));
  assert.deepEqual(after.cities, before.cities);
}

export function verifyOutcomes(result, width) {
  assert.deepEqual(result.viewport, { width, height: width === 1280 ? 720 : 900 });
  assert.deepEqual(result.failures, []);
  const names = ['form', 'close-before-submit', 'offline-before-submit', 'registered', 'logged-in', 'duplicate-name', 'wrong-password', 'known-a', 'known-b', 'lost-reply', 'refresh-no-retry'];
  assert.deepEqual(result.outcomes, names.map(name => ({ name, outcome: 'pass' })));
  const registrations = result.requests.filter(row => row.route === 'account.v1.Register');
  assert.equal(registrations.length, 3);
  assert.ok(registrations.every(row => row.matchesInput === true));
  assert.equal(registrations[0].code, 0); assert.ok(Number.isInteger(registrations[1].code) && registrations[1].code !== 0);
  assert.equal(registrations[2].code, 0); assert.equal(registrations[2].dropped, true);
  assert.equal(result.requests.filter(row => row.route === 'account.v1.Login').length, 4);
  assert.equal(result.requests.filter(row => row.route === 'world.v1.CreateCity').length, 0);
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
  assert.equal(process.env.PGDATABASE, 'explicit_registration_native');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(command('psql', ['-XAtc', 'SELECT current_database()']), 'explicit_registration_native');
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
  let browser, finalSnapshot, failed = false;
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
    const { runExplicitRegistrationScenario } = await import(pathToFileURL(join(root, 'client/qa/explicitRegistration.browser.mjs')));
    for (const width of [1280, 1600]) {
      phase = `native-${width}`;
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 720 : 900 } });
      context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(15000);
      try {
        const fresh = { login: `register_${randomUUID().slice(0, 12)}`, password: randomUUID() };
        const freshInterrupted = { login: `interrupt_${randomUUID().slice(0, 12)}`, password: randomUUID() };
        const baseline = snapshot(), checkpoints = []; let identity;
        if (finalSnapshot) assert.deepEqual(baseline, finalSnapshot, 'late write between viewports');
        write(`${width}-before.json`, baseline);
        const accountFor = login => sql(`SELECT COALESCE(json_agg(account_id),'[]') FROM account WHERE login_name='${login}'`);
        assert.deepEqual(accountFor(fresh.login), []); assert.deepEqual(accountFor(freshInterrupted.login), []);
        const checkpoint = async (stage, actor) => {
          assert.equal(stage, ['registered', 'logged-in', 'finished'][checkpoints.length]);
          if (identity) assert.equal(actor.accountId, identity.accountId);
          if (identity?.playerId) assert.equal(actor.playerId, identity.playerId);
          assert.deepEqual(accountFor(fresh.login), [actor.accountId]);
          const interrupted = accountFor(freshInterrupted.login);
          assert.ok(interrupted.length <= 1);
          if (stage !== 'finished') assert.deepEqual(interrupted, []);
          else assert.deepEqual(interrupted, [actor.interruptedAccountId]);
          const after = snapshot(); verifyDelta(baseline, after, actor, stage, interrupted[0] ?? null);
          write(`${width}-${stage}.json`, after); identity = actor; checkpoints.push(stage);
          if (stage === 'finished') finalSnapshot = after;
        };
        const result = await runExplicitRegistrationScenario({ page: await context.newPage(), baseUrl, gatewayUrl, protoRoot,
          accounts, fresh, freshInterrupted, checkpoint, artifactDir: join(out, String(width)) });
        assert.deepEqual(checkpoints, ['registered', 'logged-in', 'finished']);
        verifyOutcomes(result, width);

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
  assert.deepEqual(snapshot(), finalSnapshot, 'late write after final checkpoint');
  write('after-cleanup.json', finalSnapshot);
  write('result.json', { passed: true, widths: [1280, 1600], fixtureAccounts: 4, fixtureCities: 3, confirmedRegistrationAccounts: 2, lostReplyRegistrationAccounts: 2 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error(`Native acceptance failed at ${phase}; inspect redacted evidence.`); process.exitCode = 1; });
}
