import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm, statfs } from 'node:fs/promises';
import { createServer as createHTTPServer } from 'node:http';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const client = resolve(import.meta.dirname, '..');
const repo = dirname(client);
const binary = process.env.CHROMIUM_PATH;
const output = process.env.RECRUIT_JOURNAL_EVIDENCE;
assert.ok(binary && output, 'Set CHROMIUM_PATH and RECRUIT_JOURNAL_EVIDENCE');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(os.tmpdir(), 'sanguo-recruit-journal-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const source = ['client/src/net/recruitJournal.ts', 'client/scripts/recruitJournal.native.mjs', 'client/scripts/RECRUIT_JOURNAL_NATIVE.md'];
const report = {
  head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  source: Object.fromEntries(await Promise.all(source.map(async file =>
    [file, createHash('sha256').update(await readFile(join(repo, file))).digest('hex')]))),
  chromiumPath: await realpath(binary), profile, filesystem: (await statfs(profile)).type,
  platform: [os.platform(), os.release(), os.arch()], chromium: [], cases: [], network: [], exits: [],
};
const database = 'sanguo-recruit-journal';
const keyA = '000102030405060708090a0b0c0d0e0f', keyB = 'fe0102030405060708090a0b0c0d0e0f';
const intent = { city_id: '9', unit_cfg_id: 1, count: 2 };
const defaultScope = ['1', '1', '1', 'RecruitTroop'];
const recordHash = row => sha(['recruit-record-v1', row.payloadDigest, row.phase, String(row.attempt), row.uncertain, row.outcome]);
const record = (scope = defaultScope, key = keyA, overrides = {}) => {
  const payload = ['recruit-journal-v1', ...scope, key, '1', '9', '1', '2'];
  const row = { payload, payloadDigest: sha(payload), phase: 'prepared', attempt: 0, uncertain: false, outcome: null, ...overrides };
  return { ...row, recordDigest: recordHash(row) };
};
const acceptedOutcome = ['1', '9', '1', '2', '8', '9', '0', '0', '2', '1', '0', '0', '2000',
  Buffer.from('recruit-v1:' + '1'.repeat(64)).toString('hex'), 'aa'.repeat(32)];
const rejected = record(defaultScope, keyA, { phase: 'rejected', attempt: 1, outcome: '50004' });
const accepted = record(defaultScope, keyA, { phase: 'accepted', attempt: 1, uncertain: true, outcome: acceptedOutcome });

let server, http, origin, child, exit, browser, ctx, page;
async function bounded(promise, label, ms = 10000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, fail) => {
      timer = setTimeout(() => fail(new Error(label + ' timed out')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
const rawQuery = '/recruit-journal-fixture';
async function launch() {
  const endpoint = join(profile, 'DevToolsActivePort');
  await rm(endpoint, { force: true });
  const logs = [];
  child = spawn(binary, ['--headless=new', '--user-data-dir=' + profile, '--remote-debugging-port=0',
    '--no-first-run', '--disable-background-networking', '--disable-breakpad', 'about:blank'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  exit = once(child, 'exit');
  exit.catch(() => {});
  child.stderr.on('data', data => { if (logs.length < 40) logs.push(String(data)); });
  const port = await bounded((async () => {
    while (child && child.exitCode === null && child.signalCode === null) {
      const text = await readFile(endpoint, 'utf8').catch(() => '');
      const value = text.split('\n')[0];
      if (/^[1-9][0-9]{0,4}$/.test(value)) return value;
      await delay(25);
    }
    throw new Error(logs.join('') || 'Owned Chromium did not start');
  })(), 'Chromium DevTools readiness');
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { timeout: 10000 });
  report.chromium.push({ pid: child.pid, version: browser.version(), args: child.spawnargs.slice(1) });
  ctx = browser.contexts()[0];
  ctx.setDefaultTimeout(6000);
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const known = url.pathname === rawQuery || url.pathname === '/favicon.ico' ||
      /^\/src\/net\/(recruitJournal|loadProto|recruitV2Codec)\.ts$/.test(url.pathname) ||
      url.pathname.startsWith('/proto/sanguo/') && url.pathname.endsWith('.proto') ||
      url.pathname.startsWith('/@fs' + repo + '/spec/proto/sanguo/') && url.pathname.endsWith('.proto');
    const dependency = url.pathname.startsWith('/@fs' + profile + '/vite-cache/deps/') ||
      url.pathname.startsWith('/node_modules/') && url.pathname.includes('protobufjs');
    if (url.origin === origin && req.method() === 'GET' && (known || dependency)) await route.continue();
    else {
      report.network.push({ method: req.method(), url: url.origin + url.pathname });
      await route.abort();
    }
  });
  const first = ctx.pages()[0] ?? await ctx.newPage();
  page = await boot(first);
}
async function halt(crash) {
  if (!child) return;
  const pid = child.pid;
  if (child.exitCode === null && child.signalCode === null) {
    if (crash) assert.equal(child.kill('SIGKILL'), true);
    else child.kill('SIGTERM');
  }
  const [code, signal] = await bounded(exit, 'Owned Chromium exit');
  if (crash) assert.equal(signal, 'SIGKILL');
  report.exits.push({ pid, code, signal, crash });
  await browser?.close();
  child = browser = ctx = page = undefined;
}
async function boot(p) {
  p.on('websocket', socket => { report.network.push({ websocket: socket.url() }); });
  await p.goto(origin + rawQuery);
  await p.evaluate(async database => {
    const { openRecruitJournal } = await import('/src/net/recruitJournal.ts');
    const identity = { accountId: '1', serverId: 1, playerId: 1, generation: 1 };
    const request = req => new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const done = tx => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
    const raw = async (mode, action) => {
      const db = await request(indexedDB.open(database, 1));
      try {
        const tx = db.transaction(['commands', 'slots'], mode, { durability: 'strict' });
        const completed = done(tx);
        const result = action(tx.objectStore('commands'), tx.objectStore('slots'));
        await completed;
        return await result;
      } finally { db.close(); }
    };
    const f = window.fixture = {
      identity, journal: null, acquired: null, prepared: null, persisted: await navigator.storage.persisted(),
      live: () => f.identity,
      async open() {
        f.journal?.close();
        f.journal = await openRecruitJournal(f.live);
      },
      close() { f.journal?.close(); f.journal = null; },
      async reset() {
        f.close();
        const req = indexedDB.deleteDatabase(database);
        req.onblocked = () => { throw Error('Fixture database deletion blocked'); };
        await request(req);
        f.identity = { ...identity };
        await f.open();
      },
      dump: () => raw('readonly', (c, s) => Promise.all([request(c.getAllKeys()), request(c.getAll()),
        request(s.getAllKeys()), request(s.getAll())])),
      seed: (c, s) => raw('readwrite', (commands, slots) => {
        for (const [key, row] of c) commands.put(row, key);
        for (const [key, value] of s) slots.put(value, key);
      }),
      async inspect(key) {
        const result = await f.journal.inspect(key);
        return result && [result.phase, result.command.commandHex, result.command.payloadDigest,
          result.command.intent, Array.from(result.command.encodeRequest())];
      },
      async prepare(expected, intent) {
        const a = f.prepared = await f.journal.prepare(expected, intent);
        return [a.commandHex, a.payloadDigest, a.intent, Object.isFrozen(a) && Object.isFrozen(a.intent), Array.from(a.encodeRequest())];
      },
      async failure(action) {
        try { await action(); return 'resolved'; }
        catch (error) { return error?.name + ': ' + error?.message; }
      },
    };
  }, database);
  return p;
}
async function test(name, expected, run) {
  const networkStart = report.network.length;
  const result = { name, expected, passed: false };
  report.cases.push(result);
  try {
    result.actual = await bounded(run(), name, 40000);
    assert.equal(report.network.length - networkStart, 0, 'unexpected network traffic');
    result.passed = true;
  } catch (error) {
    result.error = String(error.stack ?? error);
    throw error;
  } finally {
    result.networkSubmissions = report.network.length - networkStart;
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
const ev = (fn, arg) => page.evaluate(fn, arg);
const reset = () => ev(() => fixture.reset());
const dump = () => ev(() => fixture.dump());
const seed = (row, key = [...defaultScope, keyA], slot = keyA) => ev(async ({ row, key, slot, scope }) =>
  fixture.seed([[key, row]], slot === null ? [] : [[scope, slot]]), { row, key, slot, scope: defaultScope });
const mustRefuse = (error, pattern = /^Error: Recruit journal unavailable$/) => {
  assert.match(error, pattern);
  return error;
};
const openFailure = () => ev(() => fixture.failure(() => fixture.open()));
const prepare = (expected = null, data = intent) => ev(({ expected, data }) => fixture.prepare(expected, data), { expected, data });

try {
  server = await createServer({ root: client, configFile: false, logLevel: 'error', cacheDir: join(profile, 'vite-cache'),
    optimizeDeps: { noDiscovery: true, include: ['protobufjs'] },
    plugins: [{ name: 'recruit-journal-fixture', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url !== rawQuery) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><title>Recruit journal fixture</title><link rel="icon" href="data:,">');
      });
    } }],
    server: { middlewareMode: true, hmr: false, fs: { allow: [repo, profile, await realpath(join(client, 'node_modules'))] } } });
  http = createHTTPServer(server.middlewares);
  const listening = once(http, 'listening');
  http.listen(0, '127.0.0.1');
  await bounded(listening, 'Fixture server readiness');
  origin = 'http://127.0.0.1:' + http.address().port;
  await launch();
  report.storagePersisted = await ev(() => fixture.persisted);
  await test('canonical boundary and independently reproduced golden digest', 'strict durable readback and exact immutable wire', async () => {
    await reset();
    await ev(async () => {
      fixture.close();
      fixture.identity = { accountId: '9223372036854775807', serverId: 2147483647, playerId: 9007199254740991, generation: 1 };
      fixture.random = crypto.getRandomValues;
      crypto.getRandomValues = bytes => {
        bytes.set(bytes.map((_, i) => i));
        return bytes;
      };
      await fixture.open();
    });
    const saved = await prepare(null, { city_id: '9223372036854775807', unit_cfg_id: 4, count: 2147483647 });
    await ev(() => { crypto.getRandomValues = fixture.random; });
    assert.equal(saved[0], keyA);
    assert.equal(saved[1], 'd8fe11e820bda766f805f497a59c1134976bd23046b54487beb5010d1f7bd4bf');
    assert.equal(saved[3], true);
    const rows = await dump();
    assert.deepEqual(rows[0][0], ['9223372036854775807', '2147483647', '9007199254740991', 'RecruitTroop', keyA]);
    assert.equal(rows[1][0].recordDigest, sha(['recruit-record-v1', saved[1], 'prepared', '0', false, null]));
    assert.deepEqual((await ev(() => fixture.inspect())).at(-1), saved.at(-1));
    return { key: saved[0], payloadDigest: saved[1] };
  });
  for (const [name, edit] of [
    ['payload account', x => { x.payload[1] = '2'; }],
    ['payload shard', x => { x.payload[2] = '2'; }],
    ['payload player', x => { x.payload[3] = '2'; }],
    ['payload operation', x => { x.payload[4] = 'Other'; }],
    ['payload command', x => { x.payload[5] = keyB; }],
    ['payload version', x => { x.payload[6] = '2'; }],
    ['canonical changed city with stale digest', x => { x.payload[7] = '10'; }],
    ['canonical changed unit with stale digest', x => { x.payload[8] = '2'; }],
    ['canonical changed count with stale digest', x => { x.payload[9] = '3'; }],
    ['positive overflow city', x => { x.payload[7] = '9223372036854775808'; }],
    ['negative overflow city', x => { x.payload[7] = '-9223372036854775809'; }],
    ['negative zero', x => { x.payload[8] = '-0'; }],
    ['alternate count spelling', x => { x.payload[9] = '02'; }],
    ['unknown metadata field', x => { x.alternate = null; }],
    ['malformed payload digest', x => { x.payloadDigest = 'x'.repeat(64); }],
    ['incorrect record digest', x => { x.recordDigest = '0'.repeat(64); }],
    ['prepared with attempts', x => { x.attempt = 1; }],
    ['attempting without attempt', x => { x.phase = 'attempting'; }],
    ['unknown without sticky uncertainty', x => { x.phase = 'unknown'; }],
    ['rejection carrying uncertainty', x => Object.assign(x, { phase: 'rejected', uncertain: true, attempt: 1, outcome: '50004' })],
    ['rejection with unavailable code', x => Object.assign(x, { phase: 'rejected', attempt: 1, outcome: '10003' })],
    ['accepted with inconsistent immutable intent', x => Object.assign(x, {
      phase: 'accepted', attempt: 1, outcome: acceptedOutcome.map((v, i) => i === 1 ? '10' : v),
    })],
    ['accepted with wrong duration', x => Object.assign(x, {
      phase: 'accepted', attempt: 1, outcome: acceptedOutcome.map((v, i) => i === 12 ? '2200' : v),
    })],
  ]) await test(name, 'open rejects and storage remains equal', async () => {
    await reset();
    const row = record();
    edit(row);
    // Re-sign semantic mutations so they cannot pass merely because the
    // fixture has stale checksums. Digest controls leave only their named fault.
    if (!name.includes('stale digest') && !name.includes('payload digest')) row.payloadDigest = sha(row.payload);
    if (name !== 'incorrect record digest') row.recordDigest = recordHash(row);
    await seed(row);
    const before = await dump();
    const error = mustRefuse(await openFailure(), /^Error: Recruit journal unavailable$|^RangeError: Invalid Recruit V2 /);
    assert.deepEqual(await dump(), before);
    return error;
  });
  for (const [name, key, slot] of [
    ['foreign account key', ['2', '1', '1', 'RecruitTroop', keyA], keyA],
    ['foreign shard key', ['1', '2', '1', 'RecruitTroop', keyA], keyA],
    ['foreign player key', ['1', '1', '2', 'RecruitTroop', keyA], keyA],
    ['unclassifiable operation key', ['1', '1', '1', 'Other', keyA], keyA],
    ['unclassifiable global key', ['02', '2', '2', 'RecruitTroop', keyA], null],
    ['same scope mismatched command suffix', [...defaultScope, keyB], keyB],
    ['all-zero command key', [...defaultScope, '0'.repeat(32)], keyA],
    ['orphan command without slot', [...defaultScope, keyA], null],
    ['orphan slot pointing elsewhere', [...defaultScope, keyA], keyB],
  ]) await test(name, 'open rejects and raw rows survive', async () => {
    await reset();
    await seed(record(), key, slot);
    const before = await dump();
    const error = mustRefuse(await openFailure());
    assert.deepEqual(await dump(), before);
    return error;
  });
  for (const [phase, row, expected] of [
    ['prepared', record(), 'unknown'],
    ['attempting', record(defaultScope, keyA, { phase: 'attempting', attempt: 2 }), 'unknown'],
    ['unknown', record(defaultScope, keyA, { phase: 'unknown', uncertain: true }), 'unknown'],
    ['accepted', accepted, 'accepted'], ['rejected', rejected, 'rejected'],
  ]) await test('retained ' + phase, expected, async () => {
    await reset();
    await seed(row);
    const before = await dump();
    await ev(() => fixture.open());
    const status = await ev(() => fixture.inspect());
    assert.equal(status[0], expected);
    assert.equal(status[1], keyA);
    assert.deepEqual(await dump(), before);
    return status.slice(0, 3);
  });
  await test('historical quarantine blocks a newer slot', 'quarantined evidence preserved', async () => {
    await reset();
    const prior = [rejected.payload, rejected.payloadDigest, rejected.phase, String(rejected.attempt), rejected.uncertain, rejected.outcome, rejected.recordDigest];
    const quarantine = record(defaultScope, keyA, { phase: 'quarantined', attempt: 1, uncertain: true,
      outcome: ['known-restored', JSON.stringify(prior), ''] });
    const newer = record(defaultScope, keyB, { phase: 'rejected', attempt: 1, outcome: '50002' });
    await ev(({ scope, a, b, first, second }) => fixture.seed([[[...scope, a], first], [[...scope, b], second]], [[scope, b]]),
      { scope: defaultScope, a: keyA, b: keyB, first: quarantine, second: newer });
    const before = await dump();
    const error = mustRefuse(await openFailure());
    assert.deepEqual(await dump(), before);
    return error;
  });
  await test('multiple unresolved commands under one slot', 'open rejects and both records survive', async () => {
    await reset();
    await ev(({ scope, a, b }) => fixture.seed([[[...scope, a.payload[5]], a], [[...scope, b.payload[5]], b]],
      [[scope, a.payload[5]]]), { scope: defaultScope, a: record(), b: record(defaultScope, keyB) });
    const before = await dump();
    const error = mustRefuse(await openFailure());
    assert.deepEqual(await dump(), before);
    return error;
  });
  await test('unsupported schema version and store layout', 'no repair or destructive downgrade', async () => {
    await reset();
    await ev(async database => {
      fixture.close();
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(database, 2);
        req.onupgradeneeded = () => req.result.createObjectStore('validation-extra');
        req.onsuccess = () => { req.result.close(); resolve(); };
        req.onerror = () => reject(req.error);
      });
    }, database);
    const error = mustRefuse(await openFailure(), /database unavailable/);
    const version = await ev(database => new Promise((resolve, reject) => {
      const req = indexedDB.open(database);
      req.onsuccess = () => { resolve([req.result.version, [...req.result.objectStoreNames]]); req.result.close(); };
      req.onerror = () => reject(req.error);
    }), database);
    assert.deepEqual(version, [2, ['commands', 'slots', 'validation-extra']]);
    return { version, error };
  });
  await test('same-origin tabs compare and swap against one predecessor', 'exactly one commit, loser creates no command', async () => {
    await reset();
    const tab = await boot(await ctx.newPage());
    try {
      await tab.evaluate(() => fixture.open());
      const states = await Promise.all([page, tab].map(p =>
        p.evaluate(i => fixture.failure(() => fixture.prepare(null, i)), intent)));
      assert.equal(states.filter(v => v === 'resolved').length, 1);
      mustRefuse(states.find(v => v !== 'resolved'));
      const stored = await dump();
      assert.equal(stored[1].length, 1);
      assert.equal(stored[1][0].payload[5], stored[3][0]);
      const stale = await tab.evaluate(i => fixture.failure(() => fixture.prepare(null, { ...i, count: i.count + 1 })), intent);
      mustRefuse(stale);
      assert.deepEqual(await dump(), stored);
      return { states, stale };
    } finally { await tab.close(); }
  });
  await test('distinct equal intents after terminal CAS and genuine random-key collision', 'collision aborts; fresh exact predecessor advances', async () => {
    await reset();
    await seed(rejected);
    await ev(({ a, b }) => {
      const native = crypto.getRandomValues;
      const add = IDBObjectStore.prototype.add;
      fixture.random = native;
      fixture.add = add;
      fixture.collisions = [];
      IDBObjectStore.prototype.add = function (...args) {
        const req = add.apply(this, args);
        req.addEventListener('error', () => { fixture.collisions.push(req.error.name); });
        return req;
      };
      let calls = 0;
      crypto.getRandomValues = bytes => {
        bytes.set(Uint8Array.from((calls++ ? b : a).match(/../g), x => parseInt(x, 16)));
        return bytes;
      };
    }, { a: keyA, b: keyB });
    const next = await prepare(keyA);
    const collisions = await ev(() => {
      crypto.getRandomValues = fixture.random;
      IDBObjectStore.prototype.add = fixture.add;
      return fixture.collisions;
    });
    assert.deepEqual(collisions, ['ConstraintError']);
    assert.equal(next[0], keyB);
    assert.equal((await ev(k => fixture.inspect(k), keyA))[0], 'rejected');
    assert.equal((await dump())[1].length, 2);
    return { key: next[0], collisions };
  });
  await test('scope switch and stale generation fence handles', 'old data retained without publication in new scope', async () => {
    await reset();
    const saved = await prepare();
    const original = await dump();
    const guards = await ev(async () => {
      fixture.identity = null;
      const logout = await fixture.failure(() => fixture.journal.inspect());
      fixture.identity = { accountId: '1', serverId: 1, playerId: 1, generation: 2 };
      const renewed = await fixture.failure(() => fixture.prepared.encodeRequest());
      fixture.identity = { accountId: '1', serverId: 2, playerId: 1, generation: 3 };
      await fixture.open();
      const otherShard = await fixture.inspect();
      fixture.identity = { accountId: '1', serverId: 1, playerId: 2, generation: 4 };
      await fixture.open();
      const otherPlayer = await fixture.inspect();
      fixture.identity = { accountId: '2', serverId: 1, playerId: 1, generation: 5 };
      await fixture.open();
      const otherAccount = await fixture.inspect();
      fixture.identity = { accountId: '1', serverId: 1, playerId: 1, generation: 6 };
      await fixture.open();
      return [logout, renewed, otherShard, otherPlayer, otherAccount, await fixture.inspect()];
    });
    mustRefuse(guards[0]);
    mustRefuse(guards[1]);
    assert.deepEqual(guards.slice(2, 5), [null, null, null]);
    assert.equal(guards[5][1], saved[0]);
    assert.deepEqual(await dump(), original);
    return guards.slice(0, 5);
  });
  for (const mode of ['random', 'zero-exhaustion', 'hash', 'relaxed', 'abort-after-request', 'readback-abort', 'scope-mid-hash']) {
    await test(mode, mode === 'readback-abort' ? 'reject but committed command remains' : 'reject and no state mutation', async () => {
      await reset();
      const result = await ev(async ({ mode, intent }) => {
        const tx = IDBDatabase.prototype.transaction, put = IDBObjectStore.prototype.put;
        const random = crypto.getRandomValues, hash = crypto.subtle.digest;
        let completed = false, requestSuccess = false, attempts = 0;
        try {
          if (mode === 'random') crypto.getRandomValues = () => { throw Error('random fault'); };
          if (mode === 'zero-exhaustion') crypto.getRandomValues = bytes => { attempts++; return bytes; };
          if (mode === 'hash') crypto.subtle.digest = () => Promise.reject(Error('hash fault'));
          if (mode === 'scope-mid-hash') crypto.subtle.digest = async function (...args) {
            const value = await hash.apply(this, args);
            fixture.identity = { ...fixture.identity, generation: 2 };
            return value;
          };
          if (mode === 'relaxed' || mode === 'readback-abort') IDBDatabase.prototype.transaction = function (stores, modeArg, options) {
            const current = tx.call(this, stores, modeArg, modeArg === 'readwrite' && mode === 'relaxed' ? { durability: 'relaxed' } : options);
            if (mode === 'readback-abort') {
              if (modeArg === 'readwrite') current.addEventListener('complete', () => { completed = true; });
              if (modeArg === 'readonly' && completed) {
                const native = current.objectStore('slots').getAll;
                IDBObjectStore.prototype.getAll = function (...args) {
                  const req = native.apply(this, args);
                  req.addEventListener('success', () => current.abort(), { once: true });
                  return req;
                };
                current.addEventListener('abort', () => { IDBObjectStore.prototype.getAll = native; }, { once: true });
              }
            }
            return current;
          };
          if (mode === 'abort-after-request') IDBObjectStore.prototype.put = function (...args) {
            const req = put.apply(this, args);
            req.addEventListener('success', () => { requestSuccess = true; this.transaction.abort(); });
            return req;
          };
          return { error: await fixture.failure(() => fixture.prepare(null, intent)), completed, requestSuccess, attempts };
        } finally {
          IDBDatabase.prototype.transaction = tx; IDBObjectStore.prototype.put = put;
          crypto.getRandomValues = random; crypto.subtle.digest = hash;
        }
      }, { mode, intent });
      assert.notEqual(result.error, 'resolved');
      const persisted = await dump();
      assert.equal(persisted[1].length, mode === 'readback-abort' ? 1 : 0);
      assert.equal(persisted[3].length, persisted[1].length);
      if (mode === 'abort-after-request') assert.equal(result.requestSuccess, true);
      if (mode === 'readback-abort') assert.equal(result.completed, true);
      if (mode === 'zero-exhaustion') assert.equal(result.attempts, 4);
      return result;
    });
  }
  await test('native Chromium quota rejection', 'QuotaExceededError aborts atomically', async () => {
    // Reopen Chromium so IndexedDB cannot use allowance cached before the override.
    await reset();
    await halt(false);
    await launch();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: 1 });
    try {
      const quota = await cdp.send('Storage.getUsageAndQuota', { origin });
      assert.equal(quota.overrideActive, true);
      assert.equal(quota.quota, 1);
      await ev(() => fixture.open());
      const failure = await ev(i => fixture.failure(() => fixture.prepare(null, i)), intent);
      assert.match(failure, /^QuotaExceededError:/);
      assert.deepEqual(await dump(), [[], [], [], []]);
      return failure;
    } finally {
      await cdp.send('Storage.overrideQuotaForOrigin', { origin });
      await cdp.detach();
    }
  });
  await test('process terminated after successful storage request but before commit', 'no partial command or slot after fresh Chromium', async () => {
    await reset();
    await ev(i => {
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        const req = add.apply(this, args);
        req.addEventListener('success', () => {
          const deadline = performance.now() + 4500;
          const hold = () => {
            if (performance.now() >= deadline) { this.transaction.abort(); return; }
            this.count().onsuccess = hold;
          };
          hold();
          fixture.beforeCommit = true;
        });
        return req;
      };
      void fixture.prepare(null, i).catch(() => { fixture.ended = true; });
    }, intent);
    await page.waitForFunction(() => fixture.beforeCommit && !fixture.ended);
    await halt(true);
    await launch();
    await ev(() => fixture.open());
    assert.equal(await ev(() => fixture.inspect()), null);
    assert.deepEqual(await dump(), [[], [], [], []]);
    return { fresh: 'empty' };
  });
  await test('process terminated after completed readback', 'same disk profile recovers exact command as unknown', async () => {
    const before = await prepare();
    const raw = await dump();
    await halt(true);
    await launch();
    await ev(() => fixture.open());
    const after = await ev(() => fixture.inspect());
    assert.deepEqual(after, ['unknown', before[0], before[1], before[2], before[4]]);
    assert.deepEqual(await dump(), raw);
    return after.slice(0, 3);
  });
  assert.deepEqual(report.network, []);
} finally {
  await halt(false);
  if (http) await new Promise((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
  await server?.close();
  await rm(profile, { recursive: true, force: true });
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.cases.filter(r => r.passed).length + '/' + report.cases.length + ' cases passed');
}
