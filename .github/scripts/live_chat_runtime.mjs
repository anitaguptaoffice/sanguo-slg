import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { redact, commandTimeout, deadlineRace, acquireOwned, stopOwned, stopBrowser } from './live_hero_layout_runtime.mjs';
export const SEND = 'chat.v1.SendChatMessage', LIST = 'chat.v1.ListChatMessages';
const allowed = new Set(['account.v1.ListGameServers', 'account.v1.Login', 'account.v1.Register', 'account.v1.EnterGameServer',
  'world.v1.ListPlayerCities', 'world.v1.CreateCity', 'domestic.v1.GetCityState', 'content.v1.ListPlayerMail',
  'quest.v1.ListPlayerQuests', 'military.v1.ListBattleReports', 'military.v1.ListMarches', 'content.v1.ListPlayerBag', LIST, SEND]);
export async function guarded(signal, action) {
  signal.throwIfAborted(); const result = await action(); signal.throwIfAborted(); return result;
}
export function destination(request) {
  assert.equal(request.server_id, 1); assert.equal(request.channel, 1);
  for (const key of ['recipient_player_id', 'peer_player_id', 'guild_id']) assert.equal(request[key] || 0, 0);
}
export function observer(decode, requests) {
  const pending = new Map(), seen = new Set();
  return { pending, sent(bytes, timestamp) {
    const packet = decode('common.v1.ClientPacket', bytes);
    assert.ok(allowed.has(packet.route), 'Unapproved route');
    assert.ok(packet.trace_id && !seen.has(packet.trace_id), 'Missing/duplicate trace'); seen.add(packet.trace_id);
    const row = { id: requests.length + 1, route: packet.route, sentAt: timestamp };
    if ([SEND, LIST].includes(row.route)) { row.request = decode(`${row.route}Request`, packet.payload); destination(row.request); }
    if (row.route === SEND) assert.ok(requests.filter(r => r.route === SEND).length < 6, 'Extra send');
    pending.set(packet.trace_id, row); requests.push(row);
  }, received(bytes, timestamp) {
    const packet = decode('common.v1.ServerPacket', bytes), row = pending.get(packet.trace_id);
    assert.ok(row, 'Unmatched response'); assert.ok(timestamp >= row.sentAt, 'Reply before request');
    pending.delete(packet.trace_id); Object.assign(row, { code: packet.code, receivedAt: timestamp });
    if (!packet.code && [SEND, LIST].includes(row.route)) row.response = decode(`${row.route}Response`, packet.data);
    if (!packet.code && ['account.v1.Login', 'account.v1.EnterGameServer'].includes(row.route)) {
      row.owner = decode(`${row.route}Response`, packet.data).player.player_id;
    }
  } };
}
export function validateTraffic(requests, mode) {
  assert.ok(['baseline', 'fixed'].includes(mode));
  assert.ok(requests.every(r => allowed.has(r.route) && Number.isFinite(r.receivedAt)));
  for (const name of ['account.v1.Register', 'account.v1.EnterGameServer', 'world.v1.CreateCity']) {
    assert.deepEqual(requests.filter(r => r.route === name).map(r => r.code), [0]);
  }
  assert.equal(requests.filter(r => r.route === SEND).length, mode === 'fixed' ? 6 : 0);
  for (const row of requests.filter(r => [SEND, LIST].includes(r.route))) { destination(row.request); assert.equal(row.code, 0); }
}
export function clockBracket(before, stamp, after) {
  assert.ok([before, stamp, after].every(Number.isFinite) && after >= before);
  return [stamp - after / 1000, stamp - before / 1000];
}
export function pendingWitness(start, end, event, sent, received) {
  assert.ok([...start, ...end].every(Number.isFinite));
  assert.ok(start[0] <= start[1] && end[0] <= end[1]);
  assert.ok(Math.max(start[0], end[0]) <= Math.min(start[1], end[1]), 'Clock intervals inconsistent');
  const lo = Math.min(start[0], end[0]), hi = Math.max(start[1], end[1]);
  assert.ok(event.trusted && Number.isFinite(event.at) && Number.isFinite(sent) && Number.isFinite(received));
  return sent < event.at / 1000 + lo && event.at / 1000 + hi < received;
}
export function validateEnvironment(env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Official runner only');
  const db = new URL(env.DATABASE_URL);
  assert.equal(db.hostname, '127.0.0.1'); assert.equal(db.pathname, '/live_chat_unicode');
  for (const [key, value] of Object.entries({ PGHOST: '127.0.0.1', PGDATABASE: 'live_chat_unicode', REDIS_ADDR: '127.0.0.1:6379' })) assert.equal(env[key], value);
  assert.ok(['baseline', 'fixed'].includes(env.QA_PRODUCT));
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
export async function withChatRuntime(check) {
  const report = { passed: false, phase: 'preflight', requests: [], inputs: [], clocks: [], errors: [], cleanup: [] };
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
      ['runtime', path.resolve(repo, '../chat-runtime-source'), process.env.QA_RUNTIME_HEAD, process.env.QA_RUNTIME_TREE, process.env.QA_RUNTIME_PARENTS],
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
    for (const file of ['common/v1/envelope.proto', 'common/v1/types.proto', 'account/v1/account.proto', 'chat/v1/chat.proto']) protobuf.parse(readFileSync(path.join(repo, 'spec/proto/sanguo', file), 'utf8'), root, { keepCase: true });
    root.resolveAll();
    const decode = (name, bytes) => { const type = root.lookupType(`sanguo.${name}`); return type.toObject(type.decode(bytes), { longs: Number, defaults: true }); };
    const traffic = observer(decode, report.requests);
    const server = await acquireOwned(() => chromium.launchServer({ chromiumSandbox: true, timeout: commandTimeout(deadline) }), async server => { await stopBrowser(server, null, { server, pid: server.process().pid }, report); save(); }, abort.signal);
    browserState = { server, ownership: { server, pid: server.process().pid } };
    browserState.connection = await acquireOwned(() => chromium.connect(server.wsEndpoint(), { timeout: commandTimeout(deadline) }), connection => boundedClose(() => connection.close()), abort.signal);
    page = await acquireOwned(() => browserState.connection.newPage({ viewport: { width: 1280, height: 720 } }), late => boundedClose(() => late.close()), abort.signal);
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
    await act(() => page.addInitScript(() => {
      window.__chatEvidence = [];
      document.addEventListener('input', event => {
        const input = event.target;
        if (input instanceof HTMLInputElement && input.matches('[data-center-panel="chat"] [data-field="chat-content"]')) {
          window.__chatEvidence.push({ at: performance.now(), trusted: event.isTrusted, value: input.value,
            counter: document.querySelector('[data-center-panel="chat"] [data-role="chat-input-counter"]')?.textContent,
            draft: sessionStorage.getItem('guild-chat-draft-v1') });
        }
      });
    }));
    const action = name => page.locator(`[data-action="${name}"]`), panel = page.locator('[data-center-panel="chat"]');
    const settled = () => eventually(() => traffic.pending.size === 0, 'Unsettled replies');
    async function calibrate() {
      const before = await act(() => page.evaluate(() => performance.now()));
      const metrics = await act(() => cdp.send('Performance.getMetrics'));
      const after = await act(() => page.evaluate(() => performance.now()));
      const stamp = metrics.metrics.find(m => m.name === 'Timestamp')?.value;
      const bracket = clockBracket(before, stamp, after); report.clocks.push({ before, stamp, after, bracket }); return bracket;
    }
    report.phase = 'fresh account'; await act(() => page.goto('http://127.0.0.1:5173'));
    await act(() => page.locator('.server-list li[data-server-id="1"]').click());
    await act(() => action('enter-game').click()); await act(() => action('toggle-chat').waitFor()); await settled();
    for (const route of ['account.v1.Register', 'world.v1.CreateCity', 'domestic.v1.GetCityState']) assert.ok(report.requests.some(r => r.route === route && r.code === 0));
    const owners = report.requests.filter(r => r.owner !== undefined); assert.equal(owners.length, 2);
    const owner = owners[0].owner; assert.ok(Number.isSafeInteger(owner) && owner > 0); assert.ok(owners.every(r => r.owner === owner));
    for (const table of ['account', 'player', 'player_wallet', 'player_city']) assert.equal(sql(`SELECT count(*) FROM ${table}`), '1');
    const screenshot = label => act(() => page.screenshot({ path: path.join(out, `${label}.png`), timeout: 5000 }));
    await act(() => action('toggle-chat').click()); await settled(); report.phase = 'native cases';
    await act(() => check({ page, panel, action, report, owner, act, pause, eventually, settled, calibrate, screenshot, save }));
    await settled(); report.inputs = await act(() => page.evaluate(() => window.__chatEvidence));
    const networkEnd = (await act(() => cdp.send('Performance.getMetrics'))).metrics.find(m => m.name === 'Timestamp').value;
    assert.ok(report.requests.every(r => r.sentAt <= networkEnd && r.receivedAt <= networkEnd), 'Network clock domain');
    report.networkClock = { start: networkStart, end: networkEnd, domain: 'CDP monotonic timeTicks' };
    validateTraffic(report.requests, report.product); assert.deepEqual(report.errors, []);
    for (const { child, name } of state.children) if (!state.stopped.has(child)) assert.deepEqual([child.exitCode, child.signalCode], [null, null], `${name} exited early`);
    commandTimeout(deadline); abort.signal.throwIfAborted(); report.passed = true; report.phase = 'native gates complete';
  }, deadline - Date.now(), abort); } catch (error) {
    report.failure = redact(error.stack); report.passed = false;
    if (page) { report.inputs = await boundedClose(() => page.evaluate(() => window.__chatEvidence)).catch(() => []); await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 }).catch(() => {}); }
  } finally {
    abort.abort(new Error('Runtime closed')); process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
    await finishOwned(state, browserState); save(); if (!report.passed) process.exitCode = 1;
    console.log(JSON.stringify({ passed: report.passed, phase: report.phase, failure: report.failure, errors: report.errors }));
  }
  return report;
}
