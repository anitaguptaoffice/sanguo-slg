import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer, bounded } from './live_chat_delay_server.mjs';
import { createRelay } from './live_chat_tcp_delay.mjs';
import { performance } from 'node:perf_hooks';
const root = mkdtempSync(path.join(os.tmpdir(), 'chat-launcher-test-'));
const childFile = path.join(root, 'child.mjs'), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
writeFileSync(childFile, `import http from 'node:http';
const mode = process.argv[2];
if (mode === 'early') process.exit(9);
const server = http.createServer((req, res) => { if (mode === 'unready') return; res.end('healthy'); });
const [host, port] = process.env.HTTP_ADDR.split(':'); server.listen(Number(port), host);
process.on('SIGTERM', () => { if (mode !== 'ignore') server.close(() => process.exit(0)); });
`);
let passed = 0;
async function port() {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const value = s.address().port; await new Promise(resolve => s.close(resolve)); return value;
}
async function config(mode = 'normal', extra = {}) {
  return { fixture: true, binary: process.execPath, args: [childFile, mode], out: root,
    listenPort: await port(), targetPort: await port(), readyTimeout: 1500, childTimeout: 500, ...extra };
}
function gone(pid) { if (pid) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }); }
function clean(report) {
  assert.equal(report.clean, true); assert.deepEqual(report.errors, []);
  assert.equal(report.child.owned, true); assert.equal(report.child.aliveBeforeStop, true);
  assert.equal(report.child.termRequested, true); assert.equal(report.child.forced, false);
  assert.equal(report.child.exitCode, 0); assert.equal(report.child.signal, null);
  assert.equal(report.relay.stopped, true); assert.equal(report.relay.pending, 0);
  assert.deepEqual(report.relay.errors, []); gone(report.child.pid);
}
async function health(session, options) {
  await session.ready;
  const r = await fetch(`http://127.0.0.1:${options.listenPort}/healthz`); assert.equal(await r.text(), 'healthy');
}
async function check(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
try {
  await check('native endpoint, configuration and hash preflight reject', async () => {
    const options = await config();
    for (const extra of [{ binary: 'relative' }, { out: 'relative' }, { targetPort: 0 }, { listenPort: -1 },
      { targetPort: options.listenPort }, { readyTimeout: 60001 }, { childTimeout: 0 }, { args: [7] },
      { host: 'external.example' }, { expectedHash: '0'.repeat(64) }, { fixture: 'yes' }, { fixture: false }]) {
      assert.throws(() => startServer({ ...options, ...extra }));
    }
  });
  await check('normal bootstrap and restart own distinct child records', async () => {
    const files = [];
    for (let n = 0; n < 2; n++) {
      const options = await config(), session = startServer(options);
      try { await health(session, options); clean(await session.stop()); files.push(session.file); }
      finally { await session.stop(); }
    }
    assert.notEqual(files[0], files[1]);
    assert.notEqual(JSON.parse(readFileSync(files[0])).child.pid, JSON.parse(readFileSync(files[1])).child.pid);
  });
  await check('occupied actual-server port preserves foreign listener', async () => {
    const foreign = net.createServer(); foreign.listen(0, '127.0.0.1'); await once(foreign, 'listening');
    try {
      const options = await config('normal', { targetPort: foreign.address().port });
      const session = startServer(options); await assert.rejects(session.ready);
      const report = await session.done; assert.equal(report.clean, false); assert.equal(report.child, null);
      assert.equal(foreign.listening, true);
    } finally { await new Promise(resolve => foreign.close(resolve)); }
  });
  await check('occupied relay port stops actual child after partial startup', async () => {
    const foreign = net.createServer(); foreign.listen(0, '127.0.0.1'); await once(foreign, 'listening');
    try {
      const options = await config('normal', { listenPort: foreign.address().port });
      const session = startServer(options); await assert.rejects(session.ready);
      const report = await session.done; assert.equal(report.clean, false); gone(report.child.pid);
      assert.equal(report.child.termRequested, true); assert.equal(foreign.listening, true);
    } finally { await new Promise(resolve => foreign.close(resolve)); }
  });
  await check('early exit cannot masquerade as requested clean stop', async () => {
    const session = startServer(await config('early')); await assert.rejects(session.ready);
    const report = await session.done; assert.equal(report.clean, false); assert.equal(report.child.exitCode, 9); gone(report.child.pid);
  });
  await check('unready timeout cleans real child and never claims relay ready', async () => {
    const session = startServer(await config('unready', { readyTimeout: 150 }));
    await assert.rejects(session.ready); const report = await session.done;
    assert.equal(report.clean, false); assert.equal(report.relay, null); gone(report.child.pid);
  });
  await check('stop during startup is idempotent and has no late acquisition', async () => {
    const session = startServer(await config('unready'));
    const first = session.stop('startup signal'), second = session.stop('second');
    const [a, b] = await Promise.all([first, second]); assert.equal(a, b);
    assert.equal(a.clean, false); assert.equal(a.requested, 'startup signal'); gone(a.child?.pid);
  });
  await check('forced owned child cleanup is always failure', async () => {
    const options = await config('ignore'), session = startServer(options);
    try { await health(session, options); const report = await session.stop();
      assert.equal(report.clean, false); assert.equal(report.child.forced, true); assert.equal(report.child.signal, 'SIGKILL'); gone(report.child.pid);
    } finally { await session.stop(); }
  });
  await check('unexpected actual child death tears down relay', async () => {
    const options = await config(), session = startServer(options);
    try { await health(session, options); process.kill(session.report.child.pid, 'SIGKILL');
      const report = await session.done; assert.equal(report.clean, false); assert.equal(report.relay.stopped, true); gone(report.child.pid);
    } finally { await session.stop(); }
  });
  await check('real wrapper SIGTERM and SIGINT preserve child ownership', async () => {
    const wrapperFile = path.join(root, 'wrapper.mjs');
    writeFileSync(wrapperFile, `import { startServer } from ${JSON.stringify(new URL('./live_chat_delay_server.mjs', import.meta.url).href)};
const session = startServer(JSON.parse(process.argv[2]));
await session.ready; console.log('READY'); const report = await session.done; process.exitCode = report.clean ? 0 : 1;
`);
    for (const signal of ['SIGTERM', 'SIGINT']) {
      const options = await config(), wrapper = spawn(process.execPath, [wrapperFile, JSON.stringify(options)], { stdio: ['ignore', 'pipe', 'inherit'] });
      try {
        await new Promise((resolve, reject) => { wrapper.stdout.once('data', resolve); wrapper.once('error', reject); });
        const response = await fetch(`http://127.0.0.1:${options.listenPort}/healthz`); await response.text();
        const ended = once(wrapper, 'exit'); wrapper.kill(signal); const [code, stoppedSignal] = await ended;
        assert.equal(code, 0); assert.equal(stoppedSignal, null);
        const files = readdirSync(root).filter(file => file.startsWith(`delay-server-${wrapper.pid}-`)); assert.equal(files.length, 1);
        const report = JSON.parse(readFileSync(path.join(root, files[0]))); assert.equal(report.requested, signal); clean(report);
      } finally { if (wrapper.exitCode === null && wrapper.signalCode === null) wrapper.kill('SIGKILL'); }
    }
  });
  await check('spawn rejection preserves failure without an invented owned PID', async () => {
    const notExecutable = path.join(root, 'not-executable'); writeFileSync(notExecutable, 'fixture');
    const session = startServer(await config('normal', { binary: notExecutable, args: [] }));
    await assert.rejects(session.ready); const report = await session.done;
    assert.equal(report.clean, false); assert.equal(report.child.pid, null);
    assert.ok(report.errors.includes('Real child spawn error'));
  });
  await check('relay failure during real service stops child without replay', async () => {
    const options = await config(), session = startServer(options);
    try { await session.ready;
      const client = net.createConnection(options.listenPort, '127.0.0.1'); client.on('error', () => {});
      await once(client, 'connect'); client.write('GET /healthz HTTP/1.1\r\nHost: localhost\r\n\r\n');
      await pause(100); client.resetAndDestroy();
      const report = await session.done; assert.equal(report.clean, false); gone(report.child.pid);
      assert.ok(report.errors.includes('Relay failed during service')); assert.equal(report.relay.pending, 0);
    } finally { await session.stop(); }
  });
  await check('SIGTERM exception still forces owned cleanup and resolves done', async () => {
    const options = await config(), session = startServer(options), original = ChildProcess.prototype.kill;
    try { await health(session, options);
      ChildProcess.prototype.kill = function(signal) { if (this.pid === session.report.child.pid && signal === 'SIGTERM') throw new Error('fixture'); return original.call(this, signal); };
      const report = await session.stop(); assert.equal(await session.done, report); gone(report.child.pid);
      assert.equal(report.clean, false); assert.equal(report.child.forced, true); assert.ok(report.errors.includes('Real child termination rejected'));
    } finally { ChildProcess.prototype.kill = original; await session.stop(); }
  });
  await check('relay cleanup rejection never skips child finalization', async () => {
    const options = await config('normal', { acquireRelay: async opts => { const r = await createRelay(opts), stop = r.stop;
      r.stop = async () => { await stop(); throw new Error('fixture cleanup rejection'); }; return r; } });
    const session = startServer(options); await health(session, options); const report = await session.stop();
    assert.equal(report.clean, false); assert.equal(await session.done, report); gone(report.child.pid);
  });
  await check('bounded startup wait disposes late actual relay without acceptance', async () => {
    let entered, late; const started = new Promise(resolve => { entered = resolve; });
    const options = await config('normal', { acquireRelay: async opts => { entered(); await pause(700); late = await createRelay(opts); return late; } });
    const session = startServer(options); await started; const report = await session.stop();
    assert.equal(report.clean, false); gone(report.child.pid); await pause(250);
    assert.equal(late.report.stopped, true); assert.ok(report.errors.includes('Relay acquired after cancellation'));
  });
  await check('never-settling cleanup wait is deadline bounded', async () => {
    await assert.rejects(bounded(new Promise(() => {}), performance.now() + 10));
  });
  await check('failed final evidence write cannot strand done or child', async () => {
    const out = mkdtempSync(path.join(root, 'missing-')), options = await config('normal', { out }), session = startServer(options);
    await health(session, options); rmSync(out, { recursive: true }); const report = await session.stop();
    assert.equal(await session.done, report); assert.equal(report.clean, false); gone(report.child.pid);
  });
  console.log(`${passed} owned-server groups passed; fixtures only, no product/browser acceptance`);
} finally { rmSync(root, { recursive: true, force: true }); }
