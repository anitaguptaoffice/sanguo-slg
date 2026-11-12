import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stopOwned, stopBrowser, deadlineRace, commandTimeout, acquireOwned, redact, economy, validateTraffic } from './live_hero_layout_runtime.mjs';
const source = readFileSync(new URL('./live_hero_layout_runtime.mjs', import.meta.url), 'utf8');
let checks = 0;
async function check(label, options = {}) {
  const report = { passed: false, phase: 'freshaccount', errors: [], cleanup: [] }, stopped = new WeakSet(), signals = [];
  let ticks = 0;
  const child = {
    pid: options.pid ?? 101,
    exitCode: options.priorExit ?? null,
    signalCode: options.priorSignal ?? null,
    kill(signal) {
      signals.push(signal);
      if (options.killThrows) throw new Error('kill failed');
      if (signal === 'SIGTERM' && !options.hang) {
        this.exitCode = options.termExit ?? 0;
        this.signalCode = options.termSignal ?? null;
      }
      if (signal === 'SIGKILL' && !options.stayLive) {
        this.exitCode = options.killExit ?? null;
        this.signalCode = Object.hasOwn(options, 'killSignal') ? options.killSignal : 'SIGKILL';
      }
      return options.killAccepted !== false;
    }
  };
  const name = options.name ?? 'client';
  const entry = { child: options.otherObject ? { ...child } : child, name: options.registeredName ?? name, pid: options.registeredPid ?? child.pid };
  const children = options.unowned ? [] : [entry];
  const delay = async () => { ticks++; };
  const stop = (child, name) => stopOwned(child, name, { children, stopped, report }, delay);
  await stop(child, name).catch(error => report.errors.push(error.message));
  assert.equal(report.errors.length === 0, options.pass === true, `${label}: ${JSON.stringify(report)}`);
  if (options.error) assert.ok(report.errors.some(e => e.includes(options.error)), label);
  assert.deepEqual(signals, options.signals ?? ['SIGTERM'], label);
  if (!options.killThrows) {
    const cleanup = report.cleanup[0];
    assert.equal(cleanup.pid, child.pid, label);
    assert.equal(cleanup.owned, options.expectOwned ?? true, label);
    assert.equal(cleanup.aliveBeforeStop, options.expectAlive ?? true, label);
    assert.equal(cleanup.requestedSignal, options.requested === false ? null : 'SIGTERM', label);
    assert.equal(cleanup.exitCode, child.exitCode, label);
    assert.equal(cleanup.signal, child.signalCode, label);
    const errors = [...report.errors], records = report.cleanup.length, count = signals.length;
    await stop(child, name);
    assert.deepEqual(report.errors, errors, `${label}: idempotent errors`);
    assert.equal(report.cleanup.length, records, `${label}: idempotent records`);
    assert.equal(signals.length, count, `${label}: idempotent signals`);
  }
  if (options.hang) assert.equal(ticks, 101, `${label}: 100 bounded polls + forced-kill wait`);
  checks++; console.log(`PASS ${label}`);
}
await check('owned Vite requested SIGTERM -> 143/null', { pass: true, termExit: 143 });
for (const name of ['client', 'server', 'bootstrap']) await check(`${name} requested SIGTERM -> 0/null`, { pass: true, name });
for (const priorExit of [0, 1, 143]) await check(`prior exit ${priorExit} rejected`, { priorExit, signals: [], requested: false, expectAlive: false, error: 'exited before requested shutdown' });
await check('prior signal rejected', { priorSignal: 'SIGTERM', signals: [], requested: false, expectAlive: false, error: 'exited before requested shutdown' });
for (const name of ['server', 'bootstrap']) await check(`${name} 143 rejected`, { name, termExit: 143, error: 'not a clean exit' });
for (const termExit of [1, 137, 142, 144]) await check(`client nonzero ${termExit} rejected`, { termExit, error: 'not a clean exit' });
await check('post-TERM signal rejected', { termSignal: 'SIGTERM', error: 'not a clean exit' });
await check('143 with signal rejected', { termExit: 143, termSignal: 'SIGTERM', error: 'not a clean exit' });
for (const termExit of [0, 143]) await check(`failed SIGTERM request then ${termExit} rejected`, { killAccepted: false, termExit, requested: false, error: 'not a clean exit' });
await check('unowned same-name child rejected without signal', { unowned: true, signals: [], requested: false, expectOwned: false, error: 'unowned' });
await check('different object same name/PID rejected', { otherObject: true, signals: [], requested: false, expectOwned: false, error: 'unowned' });
await check('recorded PID mismatch rejected', { registeredPid: 202, signals: [], requested: false, expectOwned: false, error: 'unowned' });
await check('recorded name mismatch rejected', { registeredName: 'server', signals: [], requested: false, expectOwned: false, error: 'unowned' });
for (const pid of [0, -1, 1.5]) await check(`invalid PID ${pid} rejected`, { pid, signals: [], requested: false, expectOwned: false, error: 'unowned' });
await check('forced SIGKILL rejected', { hang: true, signals: ['SIGTERM', 'SIGKILL'], error: 'required SIGKILL' });
for (const killExit of [0, 143]) await check(`forced kill cannot pass with later exit ${killExit}/null`, { hang: true, killExit, killSignal: null, signals: ['SIGTERM', 'SIGKILL'], error: 'required SIGKILL' });
await check('remaining live child rejected', { hang: true, stayLive: true, signals: ['SIGTERM', 'SIGKILL'], error: 'not a clean exit' });
await check('kill exception reaches cleanup error handling', { killThrows: true, error: 'kill failed' });
const valid = ['account.v1.Register', 'world.v1.CreateCity', 'hero.v1.RecruitHero'].map(route => ({ route, code: 0 }));
validateTraffic(valid);
for (const route of ['hero.v1.BeginHeroExpr', 'hero.v1.FinishHeroExpr', 'hero.v1.CancelHeroExpr', 'hero.v1.FasterHeroExpr', 'hero.v1.UpgradeHero', 'hero.v1.Unexpected']) {
  assert.throws(() => validateTraffic([...valid, { route, code: 0 }]));
}
for (const row of valid) {
  assert.throws(() => validateTraffic(valid.filter(r => r !== row)));
  assert.throws(() => validateTraffic([...valid, row]));
  assert.throws(() => validateTraffic(valid.map(r => r === row ? { ...r, code: 1 } : r)));
}
const before = { wallet: { food: 100, wood: 100, iron: 100, stone: 100, gold: 0 }, production: { ns: '0', food_remainder: 0, wood_remainder: 0, iron_remainder: 0, stone_remainder: 0, server_id: 1, city_id: 1, player_id: 1 } };
const after = { wallet: { food: 215, wood: 90, iron: 100, stone: 100, gold: 0 }, production: { ...before.production, ns: '3600000000000' } };
economy(after, before, { food: 5, wood: 10 });
for (const key of Object.keys(after.wallet)) {
  const changed = structuredClone(after); changed.wallet[key]++;
  assert.throws(() => economy(changed, before, { food: 5, wood: 10 }));
}
for (const key of Object.keys(after.production)) {
  const changed = structuredClone(after); changed.production[key] = key === 'ns' ? '-1' : changed.production[key] + 1;
  assert.throws(() => economy(changed, before, { food: 5, wood: 10 }));
}
assert.equal(redact('demo123 postgres://u:p@host/db 01234567-89ab-cdef-0123-456789abcdef'), '[test-password] [test-dsn] [trace-or-session]');
assert.match(source, /assert\.equal\(report\.vite, '6\.4\.5'\)/);

assert.equal(commandTimeout(40000, 0), 30000); assert.equal(commandTimeout(40000, 39999), 1);
for (const now of [40000, 40001]) assert.throws(() => commandTimeout(40000, now));
assert.equal(await deadlineRace(async () => 42, 50, new AbortController()), 42);
await assert.rejects(deadlineRace(async () => { throw new Error('original failure'); }, 50, new AbortController()), /original failure/);
await assert.rejects(deadlineRace(() => new Promise(() => {}), 5, new AbortController()), /budget expired/);
await assert.rejects(deadlineRace(() => { const end = Date.now() + 30; while (Date.now() < end) {} return 'must reject'; }, 5, new AbortController()), /budget expired/);
const aborted = new AbortController(); aborted.abort(new Error('already aborted')); let started = false;
await assert.rejects(deadlineRace(() => { started = true; }, 50, aborted), /already aborted/); assert.equal(started, false);
const interrupted = new AbortController();
await assert.rejects(deadlineRace(() => { interrupted.abort(new Error('signal')); return new Promise(() => {}); }, 50, interrupted), /signal/);
const late = new AbortController(), disposed = []; let continued = false;
await assert.rejects(deadlineRace(() => acquireOwned(async () => { await new Promise(r => setTimeout(r, 20)); return 'late-owned-resource'; }, async value => { disposed.push(value); }, late.signal).then(() => { continued = true; }), 5, late), /budget expired/);
await new Promise(r => setTimeout(r, 30)); assert.deepEqual(disposed, ['late-owned-resource']); assert.equal(continued, false);
await assert.rejects(acquireOwned(() => { started = true; }, () => {}, aborted.signal), /already aborted/); assert.equal(started, false);
const browserCases = [
  { pass: true }, { prior: 0 }, { prior: 1 }, { priorSignal: 'SIGTERM' }, { pid: 99 }, { pid: 0 },
  { other: true }, { connectionFails: true }, { closeFails: true }, { code: 143 }, { signal: 'SIGTERM' }, { live: true }, { hung: true }, { closeFails: true, killThrows: true },
];
for (const options of browserCases) {
  const report = { errors: [], cleanup: [] }, signals = [];
  const child = { pid: 101, exitCode: options.prior ?? null, signalCode: options.priorSignal ?? null,
    kill(signal) { signals.push(signal); if (options.killThrows) throw new Error('kill failed'); this.signalCode = signal; return true; } };
  const server = { process: () => child, async close() {
    if (options.closeFails) throw new Error('close failed'); if (options.hung) return new Promise(() => {});
    if (!options.live) { child.exitCode = options.code ?? 0; child.signalCode = options.signal ?? null; }
  } };
  await stopBrowser(server, { close: async () => { if (options.connectionFails) throw new Error('connection close failed'); } }, { server: options.other ? {} : server, pid: options.pid ?? 101 }, report, 5);
  assert.equal(report.errors.length === 0, options.pass === true); assert.equal(report.cleanup.length, 1);
  const record = report.cleanup[0]; assert.equal(record.pid, 101); assert.equal(record.owned, options.pid === undefined && !options.other);
  assert.equal(record.aliveBeforeStop, options.prior === undefined && !options.priorSignal);
  assert.equal(record.forced, signals.includes('SIGKILL')); assert.equal(record.exitCode, child.exitCode); assert.equal(record.signal, child.signalCode);
}
console.log(`PASS ${checks} child and ${browserCases.length} browser cleanup cases; hard deadline, late acquisition, protocol, economy and redaction negatives; no browser/services started`);
