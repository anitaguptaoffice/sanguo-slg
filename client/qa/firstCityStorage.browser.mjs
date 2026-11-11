import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startPeer } from './firstCityStorage.peer.mjs';

const client = resolve(import.meta.dirname, '..'), out = process.env.QA_OUT ?? '/tmp/first-city-storage';
const origin = 'http://127.0.0.1:16509', route = name => `world.v2.${name}`;
const ids = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
mkdirSync(out, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: client }).toString().trim();
const report = { boundary: 'Native Chromium API/storage; controlled peer, not V2 backend or game UI',
  head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), parents: git('show', '-s', '--format=%P'),
  node: process.version, playwright: JSON.parse(readFileSync(resolve(client, 'node_modules/playwright/package.json'))).version,
  cases: [], errors: [], cleanup: {} };
const files = git('ls-files', '--full-name', '--', 'src/net', 'proto', '../spec/proto', 'package-lock.json', 'qa/firstCityStorage*', 'qa/FIRST-CITY-STORAGE.md', '../.github/workflows/first-city-storage.yml').split('\n');
writeFileSync(`${out}/source-manifest.json`, JSON.stringify(files.map(path => ({ path,
  sha256: createHash('sha256').update(readFileSync(resolve(client, '..', path))).digest('hex') })), null, 2));
let browser, peer, vite, context;
const log = openSync(`${out}/vite.log`, 'w');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fresh() {
  if (context) { await context.tracing.stop({ path: `${out}/trace-${report.cases.length}.zip` }); await context.close(); }
  context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.route('**/*', request => {
    const url = new URL(request.request().url());
    if (url.origin !== origin) return request.abort();
    if (url.pathname === '/qa-first-city') return request.fulfill({ contentType: 'text/html', body: '<!doctype html><title>First-city storage acceptance</title><p>Production GatewayClient consumer, controlled peer.</p>' });
    return request.continue();
  });
}
async function boot(actor = '', page) {
  page ??= await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`${origin}/qa-first-city`);
  await page.evaluate(async ({ url, actor }) => {
    const { GatewayClient } = await import('/src/net/GatewayClient.ts');
    const { getTypes } = await import('/src/net/loadProto.ts');
    const { decodeFirstCityRequest } = await import('/src/net/firstCityRequestCodec.ts');
    const { createFirstCityIntent } = await import('/src/net/firstCityCanonical.ts');
    const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const unpack = text => Uint8Array.from(text.match(/../g) ?? [], x => parseInt(x, 16));
    const rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem;
    const q = window.qa = { events: [], sent: [], violations: [], fault: '', rawGet, rawSet };
    const nativeStorage = localStorage, getter = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() {
      if (q.fault === 'getter') throw new DOMException('Injected getter denial', 'SecurityError');
      return getter.get.call(window);
    } });
    q.dump = () => Object.fromEntries(Array.from({ length: nativeStorage.length }, (_, i) => {
      const key = nativeStorage.key(i); return [key, rawGet.call(nativeStorage, key)];
    }));
    q.initial = new Set(Object.keys(q.dump()));
    Storage.prototype.getItem = function(key) {
      if (q.fault === 'read') throw new DOMException('Injected read denial', 'SecurityError');
      const text = rawGet.call(this, key); q.events.push({ operation: 'get', key, text }); return text;
    };
    Storage.prototype.setItem = function(key, text) {
      q.events.push({ operation: 'set', key, text });
      if (q.fault === 'quota' || (q.fault === 'response' && JSON.parse(text).kind === 'response')) throw new DOMException('Injected quota', 'QuotaExceededError');
      if (q.fault === 'write') throw new Error('Injected write denial');
      if (q.fault === 'noop') return;
      rawSet.call(this, key, q.fault === 'corrupt' ? '{}' : text);
      q.duringSet?.();
    };
    const nativeSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(bytes) {
      const packet = getTypes().ClientPacket.decode(bytes);
      if (packet.route.startsWith('world.v2.')) q.sent.push({ route: packet.route, data: hex(packet.payload), trace: packet.trace_id });
      if (/world\.v2\.(Submit|Continue)FirstCity$/.test(packet.route)) {
        const stored = Object.entries(q.dump()).find(([, text]) => {
          const entry = JSON.parse(text); return entry.kind === 'intent' && entry.route === packet.route && entry.data === hex(packet.payload);
        });
        const request = decodeFirstCityRequest(packet.route, packet.payload);
        const intent = createFirstCityIntent(request.expectedScope, request.proposal);
        const reads = stored && q.events.filter(e => e.key === stored[0]);
        if (!stored || !intent.matches(unpack(JSON.parse(stored[1]).c1)) ||
          reads.at(-1)?.operation !== 'get' || reads.at(-1)?.text !== stored[1]) q.violations.push('Effect without full persisted readback');
        if (stored && !q.initial.has(stored[0]) && !reads.slice(0, -1).some(e => e.operation === 'set' && e.text === stored[1])) q.violations.push('New effect without set-before-get');
        q.events.push({ operation: 'effect', route: packet.route, stored, c1: hex(intent.encode()) });
      }
      return nativeSend.call(this, bytes);
    };
    q.g = new GatewayClient(`${url}/?actor=${actor}`);
    q.login = () => q.g.login('qa-synthetic-account', 'qa-synthetic-password', actor === 'shard' ? 2 : 1);
    q.discover = () => q.g.requestFirstCity('world.v2.DiscoverFirstCityIntent', {});
    await q.g.connect(); await q.login(); q.scope = (await q.discover()).scope;
    q.input = id => ({ expectedScope: q.scope, proposal: { commandId: id, name: '城é', x: 0, y: 499, predecessor: q.predecessor ?? { kind: 'empty' } } });
    q.history = () => {
      const h = JSON.parse(JSON.stringify(q.g.readFirstCityHistory(q.scope), (_, v) => typeof v === 'bigint' ? String(v) : v));
      for (const key of ['intents', 'observations']) h[key].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return h;
    };
    q.call = async (name, id) => {
      const request = name === 'DiscoverFirstCityIntent' ? {} : name === 'GetFirstCityResult' ? { expectedScope: q.scope, commandId: id } : q.input(id);
      try { return (await q.g.requestPersistedFirstCity(`world.v2.${name}`, request, { timeoutMs: q.timeout ?? 5000, signal: q.signal })).kind; }
      catch (error) { return error.message; }
    };
  }, { url: peer.url, actor });
  return page;
}
const call = (page, name, id = ids[0]) => page.evaluate(([name, id]) => qa.call(name, id), [name, id]);
const history = page => page.evaluate(() => qa.history());
async function evidence(name) {
  const pages = [];
  for (const page of context?.pages() ?? []) pages.push(await page.evaluate(() => ({
    storage: qa.dump(), history: qa.history(), sent: qa.sent, events: qa.events, violations: qa.violations,
  })));
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ pages, packets: peer.packets, effects: peer.effects }, null, 2));
  for (const page of pages) {
    assert.deepEqual(page.violations, []);
    assert.ok(Object.values(page.storage).map(text => JSON.parse(text)).filter(e => e.kind === 'response').every(e => peer.packets.some(p => p.direction === 'response' && p.route === e.route && p.data === e.data)), 'Response bytes must equal the received payload');
    assert.ok(!JSON.stringify(page.storage).includes('qa-synthetic-'), 'Credentials leaked into storage');
  }
}
async function check(name, fn) {
  report.current = name; await fresh(); await fn(); await evidence(name);
  report.cases.push({ name, passed: true }); console.log(`PASS ${name}`);
}
try {
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked checkout must be clean');
  peer = await startPeer(client);
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '16509', '--strictPort'], { cwd: client, stdio: ['ignore', log, log] });
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    if (i === 199 || vite.exitCode !== null) throw Error('Vite failed to start');
    await wait(100);
  }
  browser = await chromium.launch({ chromiumSandbox: true }); report.chromium = browser.version();
  await check('concurrent-reload-terminal-and-explicit-continue', async () => {
    peer.mode = 'race'; const a = await boot(), b = await boot(), before = peer.effects.length;
    assert.deepEqual((await Promise.all([call(a, 'SubmitFirstCity'), call(b, 'SubmitFirstCity', ids[1])])).sort(), ['command', 'headConflict']);
    for (const effect of peer.effects.slice(before)) assert.deepEqual(effect, { route: route('SubmitFirstCity'), request: {
      expected_scope: { realm_id: '11111111-1111-4111-8111-111111111111', server_id: 1, player_id: '9007199254740993', account_id: '9223372036854775807' },
      proposal: { command_id: effect.request.proposal.command_id, name: '城é', x: 0, y: 499, predecessor: { empty: {} } },
    } });
    assert.deepEqual(peer.effects.slice(before).map(x => x.request.proposal.command_id).sort(), ids);
    const both = await history(b), winner = both.observations.find(x => x.kind === 'headConflict').head.record.intent.proposal.commandId;
    assert.deepEqual(both.intents.map(x => x.proposal.commandId).sort(), ids);
    assert.equal(both.intents[0].scope.playerId, '9007199254740993'); assert.equal(both.intents[0].scope.accountId, '9223372036854775807');
    for (const intent of both.intents) assert.deepEqual(intent.proposal, { commandId: intent.proposal.commandId, name: '城é', x: 0, y: 499, predecessor: { kind: 'empty' } });
    await wait(250); assert.equal(peer.effects.length, before + 2, 'Winner must not be automatically continued');
    await evidence('concurrent-before-reload');
    await b.reload(); await boot('', b); assert.deepEqual((await history(b)).intents, both.intents);
    peer.mode = 'success'; assert.equal(await call(a, 'ContinueFirstCity', winner), 'command');
    const terminal = await history(a); assert.ok(terminal.observations.some(x => x.command?.state.cityId === '9223372036854775807'));
    await evidence('terminal-before-reload');
    await a.reload(); await boot('', a); assert.deepEqual(await history(a), terminal);
    await a.evaluate(async () => { await qa.login(); await qa.g.connect(); await qa.login(); await qa.discover(); });
    assert.deepEqual(await history(a), terminal); assert.equal(peer.effects.length, before + 3);
    const events = await a.evaluate(() => qa.dump());
    assert.ok(Object.values(events).some(text => JSON.parse(text).route === route('ContinueFirstCity')));
  });
  await check('four-part-scope-isolation', async () => {
    peer.mode = 'success'; const a = await boot(); await call(a, 'SubmitFirstCity');
    const original = await history(a);
    for (const actor of ['realm', 'shard', 'player', 'account']) {
      const other = await boot(actor); assert.equal((await history(other)).intents.length, 0);
      assert.equal(await call(other, 'SubmitFirstCity', ids[1]), 'command');
      assert.deepEqual((await history(other)).intents.map(x => x.proposal.commandId), [ids[1]]);
      assert.deepEqual(await history(a), original);
    }
  });
  for (const fault of ['getter', 'read', 'write', 'quota', 'noop', 'corrupt']) {
    for (const action of ['SubmitFirstCity', 'ContinueFirstCity']) await check(`barrier-${action}-${fault}`, async () => {
      const page = await boot(), before = peer.effects.length; await page.evaluate(fault => qa.fault = fault, fault);
      assert.match(await call(page, action), /UNKNOWN/);
      await page.evaluate(() => qa.fault = ''); assert.equal((await history(page)).unavailable, true);
      assert.match(await call(page, action), /UNKNOWN/); assert.equal(peer.effects.length, before);
      assert.deepEqual((await history(page)).intents.map(x => x.proposal.commandId), [ids[0]]);
    });
  }
  for (const loss of ['clear', 'remove', 'overwrite', 'valid-change', 'malformed']) await check(`external-${loss}`, async () => {
    const a = await boot(), b = await boot(); assert.equal(await call(a, 'SubmitFirstCity'), 'command');
    const known = await history(a), before = peer.effects.length;
    await b.evaluate(loss => {
      const key = Object.keys(qa.dump()).find(key => JSON.parse(qa.dump()[key]).kind === 'intent');
      if (loss === 'clear') localStorage.clear();
      if (loss === 'remove') localStorage.removeItem(key);
      if (loss === 'overwrite') { const entry = JSON.parse(localStorage.getItem(key)); entry.c1 = '00'; localStorage.setItem(key, JSON.stringify(entry)); }
      if (loss === 'valid-change') { const entry = JSON.parse(localStorage.getItem(key)); entry.route = 'world.v2.ContinueFirstCity'; localStorage.setItem(key, JSON.stringify(entry)); }
      if (loss === 'malformed') localStorage.setItem(key.replace(/[^:]+$/, 'not-a-uuid'), '{}');
    }, loss);
    const retained = await history(a); assert.equal(retained.unavailable, true);
    assert.deepEqual(retained.intents, known.intents); assert.deepEqual(retained.observations, known.observations);
    assert.match(await call(a, 'SubmitFirstCity', ids[1]), /UNKNOWN/);
    assert.match(await call(a, 'ContinueFirstCity'), /UNKNOWN/); assert.equal(peer.effects.length, before);
  });
  await check('scope-quarantine-and-caller-isolation', async () => {
    const a = await boot();
    assert.equal(await a.evaluate(async id => {
      const value = qa.input(id), promise = qa.g.requestPersistedFirstCity('world.v2.SubmitFirstCity', value);
      value.proposal.name = 'changed'; value.proposal.x = 12;
      return (await promise).kind;
    }, ids[0]), 'command');
    const known = await history(a);
    await a.evaluate(() => {
      const h = qa.g.readFirstCityHistory(qa.scope); h.intents[0].encode().fill(0);
      try { h.intents[0].proposal.name = 'mutated'; } catch {}
      try { h.observations[0].command.state.cityId = 1n; } catch {}
    });
    assert.deepEqual(await history(a), known);
    assert.equal(peer.effects.at(-1).request.proposal.name, '城é');
    await a.evaluate(() => localStorage.setItem(Object.keys(qa.dump())[0], '{}'));
    assert.equal((await history(a)).unavailable, true);
    const b = await boot('account'); assert.equal(await call(b, 'SubmitFirstCity'), 'command');
    assert.equal((await history(b)).unavailable, false);
  });
  await check('rejected-predecessor-continue', async () => {
    const page = await boot(); await page.evaluate(id => qa.predecessor = { kind: 'rejected', commandId: id }, ids[1]);
    assert.equal(await call(page, 'ContinueFirstCity'), 'command');
    assert.deepEqual(peer.effects.at(-1).request.proposal.predecessor, { rejected_command_id: ids[1] });
    await evidence('predecessor-before-reload');
    const known = await history(page); await page.reload(); await boot('', page);
    assert.deepEqual(await history(page), known);
  });
  for (const interruption of ['abort', 'reauth']) await check(`storage-barrier-${interruption}`, async () => {
    const page = await boot(), before = peer.effects.length;
    await page.evaluate(interruption => {
      const controller = new AbortController(); qa.signal = controller.signal;
      qa.duringSet = () => { qa.duringSet = null; if (interruption === 'abort') controller.abort(); else qa.injection = qa.login(); };
    }, interruption);
    assert.match(await call(page, 'SubmitFirstCity'), /UNKNOWN/);
    await page.evaluate(async () => { await qa.injection; }); assert.equal(peer.effects.length, before);
    assert.deepEqual((await history(page)).intents.map(x => x.proposal.commandId), [ids[0]]);
  });
  await check('response-failure-retains-terminal', async () => {
    const page = await boot(), before = peer.effects.length; await page.evaluate(() => qa.fault = 'response');
    assert.match(await call(page, 'SubmitFirstCity'), /UNKNOWN/); await page.evaluate(() => qa.fault = '');
    const retained = await history(page); assert.equal(retained.unavailable, true);
    assert.ok(retained.observations.some(x => x.command?.state.kind === 'succeeded'));
    assert.match(await call(page, 'ContinueFirstCity'), /UNKNOWN/); assert.equal(peer.effects.length, before + 1);
  });
  await check('unknown-empty-not-observed-retain-identity', async () => {
    peer.mode = 'drop'; const page = await boot(), before = peer.effects.length;
    await page.evaluate(() => qa.timeout = 150);
    assert.match(await call(page, 'SubmitFirstCity'), /UNKNOWN/);
    assert.equal(await call(page, 'DiscoverFirstCityIntent'), 'discovery');
    assert.equal(await call(page, 'GetFirstCityResult'), 'notObserved');
    await wait(350); assert.equal(peer.effects.length, before + 1);
    const retained = await history(page); assert.deepEqual(retained.intents.map(x => x.proposal.commandId), [ids[0]]);
    assert.equal(retained.unavailable, false); assert.equal(retained.observations.length, 2);
    await evidence('unknown-before-reload');
    await page.reload(); await boot('', page); assert.deepEqual(await history(page), retained);
    assert.equal(peer.effects.length, before + 1);
  });
  assert.deepEqual(peer.errors, []); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) {
  report.failure = String(error.stack); process.exitCode = 1;
  try {
    for (const [index, page] of (context?.pages() ?? []).entries()) await page.screenshot({ path: `${out}/failure-${index}.png` });
    await evidence('failure');
  } catch (artifactError) { report.artifactError = String(artifactError.stack); }
} finally {
  for (const [name, action] of [
    ['trace', () => context?.tracing.stop({ path: `${out}/trace-final.zip` })],
    ['browser', () => browser?.close()], ['peer', () => peer?.close()],
    ['vite', async () => {
      if (vite && vite.exitCode === null && vite.signalCode === null) {
        const done = new Promise(resolve => vite.once('exit', resolve)); vite.kill('SIGTERM');
        await Promise.race([done, wait(5000)]);
        if (vite.exitCode === null && vite.signalCode === null) { vite.kill('SIGKILL'); await done; }
      }
    }],
  ]) {
    let timer;
    try {
      await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Cleanup timeout')), 10000); })]);
      report.cleanup[name] = true;
    } catch (error) { report.cleanup[name] = String(error); process.exitCode = 1; }
    finally { clearTimeout(timer); }
  }
  closeSync(log); report.cleanup.disconnected = !browser?.isConnected(); report.cleanup.peerClosed = peer?.closed;
  report.cleanup.viteStopped = !vite || vite.exitCode !== null || vite.signalCode !== null;
  if (!report.cleanup.disconnected || !report.cleanup.viteStopped || (peer && !peer.closed)) process.exitCode = 1;
  report.passed = report.passed === true && !process.exitCode;
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
