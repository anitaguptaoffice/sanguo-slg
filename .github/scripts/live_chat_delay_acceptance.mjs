import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { withChatRuntime, SEND, LIST } from './live_chat_runtime.mjs';
import { MIXED, CASES, overlap } from './live_chat_unicode.mjs';
import { scenario, readbacks } from './live_chat_controlled_scenario.mjs';
import { PROFILE } from './live_chat_tcp_delay.mjs';
export function relayEvidence(relay) {
  assert.equal(relay.profile, PROFILE); assert.equal(relay.stopped, true); assert.equal(relay.pending, 0); assert.deepEqual(relay.errors, []);
  assert.equal(relay.clock, 'node performance.now milliseconds');
  assert.ok(relay.connections.length > 0 && relay.connections.length <= 64);
  relay.connections.forEach((c, index) => {
    assert.equal(c.id, index + 1); assert.equal(c.pending, 0); assert.equal(c.closed, 2);
    assert.deepEqual(c.directions.map(d => d.name), ['c2s', 's2c']);
    assert.ok(c.directions.reduce((sum, d) => sum + d.chunks.length, 0) <= 4096);
    c.directions.forEach((d, direction) => {
      assert.equal(d.delay, direction ? 500 : 0); assert.equal(d.discarded, 0); assert.equal(d.eof, true); assert.equal(d.fin, true);
      assert.match(d.inputHash, /^[a-f0-9]{64}$/); assert.equal(d.inputHash, d.outputHash); assert.equal(d.received, d.written);
      let offset = 0, previous = 0;
      d.chunks.forEach((chunk, ordinal) => {
        assert.equal(chunk.ordinal, ordinal); assert.equal(chunk.offset, offset); assert.ok(Number.isInteger(chunk.length) && chunk.length > 0);
        assert.ok([chunk.arrived, chunk.eligible, chunk.start, chunk.complete].every(Number.isFinite));
        assert.equal(chunk.eligible, chunk.arrived + d.delay); assert.ok(chunk.arrived >= 0 && chunk.start >= chunk.eligible && chunk.complete >= chunk.start && chunk.start >= previous);
        previous = chunk.complete; offset += chunk.length;
      }); assert.equal(offset, d.received);
    });
  });
}
export function controlled(report, signals, db, launchers, binaryHash, owner) {
  assert.equal(report.passed, true); assert.ok(['baseline', 'fixed'].includes(report.product)); assert.match(binaryHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(report.errors, []); assert.ok(Number.isSafeInteger(owner) && owner > 0);
  readbacks(report.requests, owner, true);
  const children = report.cleanup.filter(c => ['bootstrap', 'server'].includes(c.name)); assert.equal(children.length, 2); assert.equal(launchers.length, 2);
  for (const child of children) {
    assert.deepEqual([child.owned, child.aliveBeforeStop, child.requestedSignal, child.exitCode, child.signal], [true, true, 'SIGTERM', 0, null]);
    const matches = launchers.filter(r => r.launcherPid === child.pid); assert.equal(matches.length, 1); const r = matches[0];
    assert.equal(r.profile, PROFILE); assert.equal(r.binaryHash, binaryHash); assert.equal(r.clean, true); assert.equal(r.phase, 'stopped'); assert.equal(r.requested, 'SIGTERM');
    assert.deepEqual(r.errors, []); assert.deepEqual([r.listenPort, r.targetPort], [8080, 18080]);
    assert.ok(Number.isInteger(r.child.pid) && r.child.pid > 0 && r.child.pid !== r.launcherPid);
    assert.deepEqual([r.child.owned, r.child.aliveBeforeStop, r.child.termRequested, r.child.forced, r.child.exitCode, r.child.signal], [true, true, true, false, 0, null]); relayEvidence(r.relay);
  }
  assert.equal(new Set(launchers.map(r => r.child.pid)).size, 2);
  const sends = report.requests.filter(r => r.route === SEND), count = report.product === 'fixed' ? 6 : 0;
  assert.equal(sends.length, count); assert.equal(db.total, count); assert.equal(db.rows.length, count);
  for (const send of sends) {
    const message = send.response.message, rows = db.rows.filter(row => row.message_id === message.message_id); assert.equal(rows.length, 1);
    for (const key of ['message_id', 'sender_player_id', 'server_id', 'channel', 'content', 'sent_at_ms']) assert.equal(rows[0][key], message[key]);
    assert.equal(rows[0].ref_id, 0); assert.ok(Number.isSafeInteger(rows[0].channel_id) && rows[0].channel_id > 0);
  }
  if (!count) return;
  assert.deepEqual(report.cases, CASES.map(([name]) => name));
  assert.equal(report.fixedAcceptance, true); assert.equal(report.pending.observed, true);
  const pending = report.pending.events.filter(e => e.value === MIXED + 'Z'); assert.equal(pending.length, 1);
  assert.equal(report.pending.send, sends.at(-1).id);
  assert.ok(overlap(report.pending.start, report.pending.end, report.pending.events, MIXED + 'Z', sends.at(-1)));
  const matches = signals.filter(s => s.original.at === pending[0].at); assert.equal(matches.length, 1); const witness = matches[0];
  assert.deepEqual(witness.original, pending[0]); assert.deepEqual(report.inputs[witness.index], pending[0]);
  assert.equal(witness.trusted, true); assert.equal(witness.value, MIXED + 'Z'); assert.equal(witness.disabled, true);
}
export async function run() {
  const deadline = Date.now() + 300000;
  const out = path.resolve(process.env.QA_OUT), result = { profile: PROFILE, controlledAcceptance: false, controlledBaseline: false, retryAuthorized: false };
  mkdirSync(out, { recursive: true }); const save = () => writeFileSync(path.join(out, 'controlled-report.json'), JSON.stringify(result, null, 2)); save();
  try {
    assert.equal(process.env.QA_NETWORK_PROFILE, PROFILE);
    const report = await withChatRuntime(async ctx => {
      await ctx.act(() => ctx.page.evaluate(() => {
        window.__controlledSignals = [];
        document.addEventListener('input', event => {
          if (!event.target.matches?.('[data-center-panel="chat"] [data-field="chat-content"]')) return;
          const index = window.__chatEvidence.length - 1;
          window.__controlledSignals.push({ index, original: window.__chatEvidence[index], trusted: event.isTrusted,
            value: event.target.value, disabled: document.querySelector('[data-center-panel="chat"] [data-action="send-chat"]').disabled });
        });
      }));
      result.owner = ctx.owner; result.fixedNativeStarted = ctx.report.product === 'fixed';
      try { await scenario(ctx); } finally { result.signals = await ctx.act(() => ctx.page.evaluate(() => window.__controlledSignals)); save(); }
    });
    result.originalPassed = report.passed; result.pendingSendObserved = report.requests.filter(r => r.route === SEND).length === 6;
    result.pendingCoverage = report.pending?.coverage || (report.pending?.observed ? 'OBSERVED' : 'NOT_RECORDED');
    assert.ok(Date.now() < deadline, 'Original five-minute budget exhausted');
    assert.equal(process.env.PGHOST, '127.0.0.1'); assert.equal(process.env.PGDATABASE, 'live_chat_unicode');
    const sql = `SELECT json_build_object('total',(SELECT count(*) FROM chat_message),'rows',COALESCE(json_agg(x),'[]'::json)) FROM
      (SELECT m.message_id,m.sender_player_id,m.server_id,m.channel_id,c.channel_type AS channel,c.ref_id,m.content,
      floor(extract(epoch FROM m.created_at)*1000)::bigint AS sent_at_ms FROM chat_message m JOIN chat_channel c USING(server_id,channel_id)) x`;
    result.database = JSON.parse(execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', sql], { encoding: 'utf8', timeout: Math.max(1, Math.min(5000, deadline - Date.now())) }));
    result.launchers = readdirSync(out).filter(f => /^delay-server-\d+-\d+\.json$/.test(f)).map(f => JSON.parse(readFileSync(path.join(out, f))));
    controlled(report, result.signals || [], result.database, result.launchers, process.env.QA_ACTUAL_SERVER_SHA, result.owner);
    result.readbacks = report.requests.filter(r => r.route === LIST).map(r => ({ id: r.id, comparisons: r.displayNameComparisons }));
    result.controlledAcceptance = report.product === 'fixed'; result.controlledBaseline = report.product === 'baseline';
  } catch { result.failure = 'Controlled gate incomplete; inspect original report and layered evidence'; process.exitCode = 1; }
  finally { save(); }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
