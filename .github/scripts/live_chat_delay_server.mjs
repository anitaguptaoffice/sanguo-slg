#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRelay, PROFILE } from './live_chat_tcp_delay.mjs';
let sequence = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function bounded(promise, deadline) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Cleanup deadline')), Math.max(0, deadline - performance.now()));
  })]); } finally { clearTimeout(timer); }
}
export function startServer(options) {
  const { binary, out, fixture = false, args = [], listenPort = 8080, targetPort = 18080,
    readyTimeout = 60000, childTimeout = 5000, expectedHash, acquireRelay = createRelay } = options;
  assert.ok(Object.keys(options).every(key => ['binary', 'out', 'fixture', 'args', 'listenPort', 'targetPort', 'readyTimeout', 'childTimeout', 'expectedHash', 'acquireRelay'].includes(key)));
  assert.equal(typeof fixture, 'boolean'); assert.ok(path.isAbsolute(binary) && path.isAbsolute(out));
  assert.ok(Number.isInteger(readyTimeout) && readyTimeout > 0 && readyTimeout <= 60000);
  assert.ok(Number.isInteger(childTimeout) && childTimeout > 0 && childTimeout <= 5000);
  for (const port of [listenPort, targetPort]) assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  assert.notEqual(listenPort, targetPort); assert.ok(Array.isArray(args) && args.every(arg => typeof arg === 'string'));
  if (!fixture) {
    assert.equal(acquireRelay, createRelay); assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(args.length, 0);
    assert.equal(realpathSync(binary), path.join(process.env.RUNNER_TEMP, 'live-chat-unicode-server'));
    assert.deepEqual([listenPort, targetPort, readyTimeout, childTimeout], [8080, 18080, 60000, 5000]);
    assert.match(expectedHash || '', /^[a-f0-9]{64}$/);
  }
  const binaryHash = createHash('sha256').update(readFileSync(binary)).digest('hex');
  if (expectedHash) assert.equal(binaryHash, expectedHash);
  mkdirSync(out, { recursive: true });
  const file = path.join(out, `delay-server-${process.pid}-${++sequence}.json`);
  const report = { profile: PROFILE, launcherPid: process.pid, binaryHash, listenPort, targetPort,
    errors: [], requested: null, child: null, relay: null, clean: false, phase: 'starting' };
  const save = () => { try { writeFileSync(file, JSON.stringify(report, null, 2)); }
    catch { report.errors.push('Evidence write failed'); report.clean = false; } }; save();
  assert.deepEqual(report.errors, []);
  const abort = new AbortController(); let child, relay, startup, stopping = false, stopPromise, readyResolve, readyReject, doneResolve;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; }); ready.catch(() => {});
  const done = new Promise(resolve => { doneResolve = resolve; });
  async function stop(reason = 'requested') {
    if (stopPromise) return stopPromise;
    stopping = true; report.requested = reason; abort.abort();
    stopPromise = (async () => {
      const end = performance.now() + 8000;
      try { await bounded(startup, end - 7500); } catch { report.errors.push('Startup cleanup wait failed'); }
      try { if (relay) report.relay = await bounded(relay.stop(), end - 5400); }
      catch { report.errors.push('Relay cleanup rejected or timed out'); }
      finally {
        if (report.relay?.errors.length) report.errors.push('Relay failed');
        if (child) {
          const owned = Number.isInteger(child.pid) && child.pid > 0 && report.child?.pid === child.pid;
          const alive = child.exitCode === null && child.signalCode === null;
          let requested = false, forced = false;
          try {
            if (owned && alive) {
              requested = child.kill('SIGTERM');
              const until = Math.min(end - 400, performance.now() + childTimeout);
              while (child.exitCode === null && child.signalCode === null && performance.now() < until) await pause(10);
            }
          } catch { report.errors.push('Real child termination rejected'); }
          finally {
            if (owned && child.exitCode === null && child.signalCode === null) {
              forced = true;
              try { child.kill('SIGKILL'); } catch { report.errors.push('Owned forced cleanup rejected'); }
              while (child.exitCode === null && child.signalCode === null && performance.now() < end) await pause(10);
            }
            report.child = { ...report.child, owned, aliveBeforeStop: alive, termRequested: requested, forced,
              exitCode: child.exitCode, signal: child.signalCode };
            if (!owned || !alive || !requested || forced || child.exitCode !== 0 || child.signalCode !== null) report.errors.push('Unclean real child shutdown');
          }
        } else report.errors.push('No owned child');
        if (!relay || !relay.report.stopped || relay.report.pending || !relay.report.connections.length) report.errors.push('Incomplete relay lifecycle');
        readyReject(new Error('Launcher stopped before readiness'));
        process.removeListener('SIGTERM', sigterm); process.removeListener('SIGINT', sigint);
        report.phase = 'stopped'; report.clean = report.errors.length === 0; save(); doneResolve(report);
      }
      return report;
    })(); return stopPromise;
  }
  const sigterm = () => { void stop('SIGTERM'); }, sigint = () => { void stop('SIGINT'); };
  process.on('SIGTERM', sigterm); process.on('SIGINT', sigint);
  startup = (async () => {
    const reservation = net.createServer();
    try { await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(targetPort, '127.0.0.1', resolve); }); }
    finally { if (reservation.listening) await new Promise(resolve => reservation.close(resolve)); }
    abort.signal.throwIfAborted();
    child = spawn(binary, args, { env: { ...process.env, HTTP_ADDR: `127.0.0.1:${targetPort}` }, stdio: ['ignore', 'inherit', 'inherit'] });
    report.child = { pid: child.pid ?? null }; save();
    child.on('error', () => { report.errors.push('Real child spawn error'); void stop('child error'); });
    child.on('exit', () => { if (!stopping) { report.errors.push('Real child exited early'); void stop('early exit'); } });
    const until = performance.now() + readyTimeout;
    while (true) {
      abort.signal.throwIfAborted();
      assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
      if (performance.now() >= until) throw new Error('Upstream readiness deadline');
      try {
        const response = await fetch(`http://127.0.0.1:${targetPort}/healthz`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(500)]) });
        await response.arrayBuffer(); if (response.ok) break;
      } catch { abort.signal.throwIfAborted(); }
      await pause(25);
    }
    abort.signal.throwIfAborted();
    relay = await acquireRelay({ fixture, listenPort, targetPort });
    if (stopping) {
      report.errors.push('Relay acquired after cancellation'); report.clean = false;
      try { report.relay = await bounded(relay.stop(), performance.now() + 2100); }
      catch { report.errors.push('Late relay cleanup failed'); } finally { save(); }
      abort.signal.throwIfAborted();
    }
    relay.failure.then(() => { if (!stopping) { report.errors.push('Relay failed during service'); void stop('relay error'); } });
    abort.signal.throwIfAborted(); report.phase = 'ready'; save(); readyResolve();
  })().catch(() => {
    if (!stopping) report.errors.push('Startup failed');
    readyReject(new Error('Launcher startup stopped')); void stop('startup stopped');
  });
  return { ready, done, stop, report, file };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const owned = startServer({ binary: process.env.QA_ACTUAL_SERVER, out: process.env.QA_OUT,
      expectedHash: process.env.QA_ACTUAL_SERVER_SHA });
    const result = await owned.done; if (!result.clean) process.exitCode = 1;
  } catch { console.error('Controlled server launcher failed preflight'); process.exitCode = 1; }
}
