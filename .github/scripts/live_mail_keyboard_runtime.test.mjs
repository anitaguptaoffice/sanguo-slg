import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createFrameCapture, fixtureSpec, mailCommandArgs, parseGmOutput, preflight, runCommand, safeError, validateEnvironment, verifyScenario, verifyStaging } from './live_mail_keyboard_runtime.mjs';
const head = 'a'.repeat(40), root = '/tmp/runner/mail';
const env = { GITHUB_ACTIONS: 'true', QA_WIDTH: '1280', QA_PRODUCT: 'fixed', PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'live_mail_keyboard',
  DATABASE_URL: 'postgres://sanguo:sanguo@127.0.0.1:5432/live_mail_keyboard', REDIS_ADDR: '127.0.0.1:6379', RUNNER_TEMP: '/tmp/runner',
  QA_OUT: root, QA_SERVER: `${root}/server`, QA_GM: `${root}/gm`, QA_PRODUCT_TREE: head, QA_PRODUCT_PARENTS: head,
  ...Object.fromEntries(['PRODUCT', 'RUNTIME', 'TRACE', 'STATE', 'SCENARIO'].map(group => [`QA_${group}_HEAD`, head])) };
test('official isolated environment and every changed boundary', () => {
  validateEnvironment(env); validateEnvironment({ ...env, QA_WIDTH: '1600', QA_PRODUCT: 'baseline' });
  const invalid = { GITHUB_ACTIONS: 'false', QA_WIDTH: '1400', QA_PRODUCT: 'other', PGHOST: 'remote', PGPORT: '6543', PGDATABASE: 'production',
    DATABASE_URL: 'postgres://host/production', REDIS_ADDR: 'remote:6379', GM_TOKEN: 'secret', GM_OPERATOR_WHITELIST: 'someone',
    MIL_FRESH_PROFILE_FILE: 'file', RUNNER_TEMP: 'relative', QA_OUT: '/outside', QA_SERVER: '/usr/bin/server', QA_GM: '/outside/gm',
    QA_PRODUCT_TREE: 'missing', QA_PRODUCT_PARENTS: '' };
  for (const [key, value] of Object.entries(invalid)) assert.throws(() => validateEnvironment({ ...env, [key]: value }), key);
  for (const group of ['PRODUCT', 'RUNTIME', 'TRACE', 'STATE', 'SCENARIO']) assert.throws(() => validateEnvironment({ ...env, [`QA_${group}_HEAD`]: 'unreviewed' }));
  assert.throws(() => validateEnvironment({ ...env, DATABASE_URL: 'SECRET' }), error => !error.message.includes('SECRET'));
});
test('unfiltered actual frame delivery retains raw bytes and monotonic capture time', () => {
  const calls = [], capture = createFrameCapture({ observeSent: (...args) => calls.push(['sent', ...args]), observeReceived: (...args) => calls.push(['received', ...args]) });
  capture.created({ requestId: 'owned', url: 'ws://127.0.0.1:8080/ws' });
  const event = { requestId: 'owned', timestamp: 12.25, response: { opcode: 2, payloadData: 'AQID' } };
  capture.frame('sent', event); capture.frame('received', { ...event, timestamp: 12.5 }); capture.valid();
  assert.deepEqual(calls, [['sent', Buffer.from([1, 2, 3]), 12.25], ['received', Buffer.from([1, 2, 3]), 12.5]]);
  capture.close(); assert.throws(() => capture.valid()); assert.throws(() => capture.frame('sent', event));
});
test('bad event source, payload, duplicate socket and downstream rejection fail closed', () => {
  const event = { requestId: 'owned', timestamp: 1, response: { opcode: 2, payloadData: 'AQ==' } };
  for (const change of [e => e.requestId = 'other', e => e.timestamp = NaN, e => e.response.opcode = 1,
    e => e.response.payloadData = '', e => e.response.payloadData = 'AQ', e => e.response.payloadData = '***']) {
    const capture = createFrameCapture({ observeSent() {} }); capture.created({ requestId: 'owned', url: 'ws://127.0.0.1:8080/ws' });
    const bad = structuredClone(event); change(bad); assert.throws(() => capture.frame('sent', bad));
    assert.throws(() => capture.frame('sent', event)); assert.throws(() => capture.valid());
  }
  const capture = createFrameCapture({ observeSent() { throw new Error('SECRET'); } });
  assert.throws(() => capture.created({ requestId: 'owned', url: 'ws://unapproved/ws' }));
  capture.created({ requestId: 'owned', url: 'ws://127.0.0.1:8080/ws' });
  assert.throws(() => capture.created({ requestId: 'second', url: 'ws://127.0.0.1:8080/ws' }));
  assert.throws(() => capture.frame('sent', event), error => error.message === 'MAIL_RUNTIME_INVALID');
});
test('runtime commands enforce deadline, abort and fixed error text without retry', () => {
  const controller = new AbortController(), calls = [];
  const args = { signal: controller.signal, deadline: Date.now() + 1000, env: {}, execute: (...a) => { calls.push(a); return ' ok\n'; } };
  assert.equal(runCommand(args, 'psql', ['query'], '/repo'), 'ok'); assert.equal(calls.length, 1);
  assert.ok(calls[0][2].timeout > 0 && calls[0][2].timeout <= 1000);
  assert.throws(() => runCommand({ ...args, deadline: 0 }, 'psql', [], '/repo')); assert.equal(calls.length, 1);
  controller.abort(); assert.throws(() => runCommand(args, 'psql', [], '/repo')); assert.equal(calls.length, 1);
  assert.throws(() => runCommand({ ...args, signal: new AbortController().signal, execute() { throw new Error('SECRET'); } }, 'gm', [], '/repo'), error => error.message === 'MAIL_RUNTIME_COMMAND_FAILED');
});
test('staged exact code and documentation inventory, immutable helper and source identity', () => {
  const groups = { live_hero_layout_runtime: 'HELPER', mail_keyboard_state: 'STATE', mail_keyboard_evidence: 'TRACE', live_mail_keyboard_runtime: 'RUNTIME', live_mail_keyboard: 'SCENARIO' };
  const rows = Object.entries(groups).flatMap(([stem, group]) => [stem + '.mjs', stem + '.test.mjs'].map(file => ({ file, group })));
  for (const [file, group] of Object.entries({ 'MAIL_KEYBOARD_STATE.md': 'STATE', 'MAIL_KEYBOARD_EVIDENCE.md': 'TRACE', 'LIVE_MAIL_KEYBOARD_RUNTIME.md': 'RUNTIME', 'LIVE_MAIL_KEYBOARD.md': 'SCENARIO' })) rows.push({ file, group });
  const bytes = Buffer.from('exact source\n'), manifest = rows.map(({ file, group }) => ({ file,
    sourceHead: group === 'HELPER' ? '7dc5939f9753a8aa59c94f7101c62a8e4a8eda79' : head,
    sha256: createHash('sha256').update(bytes).digest('hex'), sourceBlob: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }));
  verifyStaging(manifest, () => bytes, env);
  for (const change of [m => m.pop(), m => m.push(m[0]), m => m[0].sourceHead = head, m => m[2].sourceHead = 'b'.repeat(40),
    m => m[2].sourceBlob = 'b'.repeat(40), m => m[2].sha256 = 'b'.repeat(64), m => m[2].file = '../other']) {
    const bad = structuredClone(manifest); change(bad); assert.throws(() => verifyStaging(bad, () => bytes, env));
  }
  assert.throws(() => verifyStaging(manifest, () => Buffer.from('changed'), env));
});
test('complete native candidate versus genuine baseline defect, no empty callback acceptance', () => {
  const viewport = { width: 1280, height: 720 }, screenshots = Array.from({ length: 8 }, (_, i) => `shot${i}`);
  const result = { product: 'fixed', nativeAcceptance: false, resultKind: 'native-candidate', defectObserved: false, viewport,
    cases: ['open', 'tab-b', 'read-b', 'checkbox', 'unread', 'read-a', 'read-d', 'read-c'], screenshots };
  verifyScenario(result, 'fixed', viewport, screenshots);
  verifyScenario({ ...result, product: 'baseline', resultKind: 'baseline-defect-control', defectObserved: true }, 'baseline', viewport, screenshots);
  for (const change of [r => r.nativeAcceptance = true, r => r.defectObserved = true, r => r.cases.pop(), r => r.viewport.width = 1600,
    r => r.screenshots[1] = r.screenshots[0], r => r.resultKind = 'baseline-defect-control']) {
    const bad = structuredClone(result); change(bad); assert.throws(() => verifyScenario(bad, 'fixed', viewport, screenshots));
  }
  assert.throws(() => verifyScenario(undefined, 'fixed', viewport, screenshots));
});
test('fixture contract and explicit no acceptance before independent review', () => {
  assert.deepEqual(fixtureSpec.map(r => r.label), ['D', 'C', 'B', 'A']);
  assert.ok(fixtureSpec[2].title.length <= 128 && fixtureSpec[2].title.length > 100);
  assert.deepEqual(fixtureSpec.map(r => r.attachments.items?.length ?? 0), [1, 0, 0, 0]);
  const source = readFileSync(new URL('./live_mail_keyboard_runtime.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  assert.equal(source.includes('nativeAcceptance = true'), false);
  assert.match(source, /launchServer\(\{ channel: 'chromium', headless: true, chromiumSandbox: true,/);
});

test('real GM CLI omits empty rewards flag so attachment-free mail can be sent', () => {
  for (const label of ['D', 'C', 'B', 'A']) {
    const args = mailCommandArgs(label, '123');
    assert.equal(args[0], 'send-mail'); assert.ok(args.includes('--player-id=123'));
    const rewards = args.filter(arg => arg.startsWith('--rewards-json='));
    assert.equal(rewards.length, label === 'D' ? 1 : 0);
    if (label === 'D') assert.deepEqual(JSON.parse(rewards[0].slice('--rewards-json='.length)).items, [{ item_cfg_id: 2001, qty: 1 }]);
    assert.equal(args.some(arg => /--food=|--gold=|grant/.test(arg)), false);
  }
  for (const [label, owner] of [['E', '123'], ['D', '0'], ['A', '-1'], ['A', '1;DELETE']]) assert.throws(() => mailCommandArgs(label, owner));
});

test('actual GM stdout requires two validated logs and exactly one matching receipt', () => {
  const common = { time: '2026-11-12T00:00:00Z', level: 'INFO', server_id: 1, player_id: 123, operator_id: 'mail-keyboard-native', operator_name: '', reason: 'isolated keyboard acceptance', ticket_id: '' };
  const logs = [{ ...common, msg: 'gm operation', op: 'LookupPlayer', audit_log_id: 'a'.repeat(32), executed_at_ms: 1 }, { ...common, msg: 'mail sent', mail_id: 4, mail_type: 2 }];
  const receipt = { mail: { PlayerID: 123, MailID: 4, MailType: 2 } };
  const raw = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n' + JSON.stringify(receipt, null, 2);
  assert.deepEqual(parseGmOutput(raw(logs)), receipt);
  for (const change of [r => r.pop(), r => r.push(r[0]), r => r[0].op = 'GrantReward', r => r[1].player_id++, r => r[1].secret = 'SECRET']) {
    const bad = structuredClone(logs); change(bad); assert.throws(() => parseGmOutput(raw(bad)), error => error.message === 'MAIL_RUNTIME_GM_OUTPUT_INVALID');
  }
  assert.throws(() => parseGmOutput(raw(logs) + '{}'));
});
test('preflight retains only fixed checkpoints and safe command failure categories', () => {
  const report = {}; assert.equal(preflight(report, 'redis-info', () => 42), 42);
  assert.equal(report.phase, 'preflight-redis-info'); assert.throws(() => preflight(report, 'SECRET', () => {}));
  assert.equal(report.phase, 'preflight-redis-info');
  for (const name of ['startup-enter', 'startup-mail', 'startup-settle', 'startup-identity', 'snapshot-health', 'snapshot-sql', 'snapshot-json', 'fixtures-begin']) assert.throws(() => preflight(report, name, () => { throw null; }), () => report.phase === `preflight-${name}`);
  const options = { signal: new AbortController().signal, deadline: Date.now() + 1000, execute() { throw Object.assign(new Error('SECRET'), { code: 'ENOENT' }); } };
  assert.throws(() => runCommand(options, 'redis-cli', [], '/repo'), error => error.message === 'MAIL_RUNTIME_COMMAND_ENOENT');
});
test('nullish and throwing-accessor failures stay failed and secret-free', () => {
  for (const error of [null, undefined, { get code() { throw 'SECRET'; }, get message() { throw 'SECRET'; } }]) {
    const options = { signal: new AbortController().signal, deadline: Date.now() + 1000, execute() { throw error; } };
    assert.throws(() => runCommand(options, 'redis-cli', [], '/repo'), value => value.message === 'MAIL_RUNTIME_COMMAND_FAILED');
    assert.equal(safeError(error, 'message', ['MAIL_RUNTIME_COMMAND_ENOENT', 'MAIL_RUNTIME_COMMAND_ETIMEDOUT'], 'RUNTIME_FAILED'), 'RUNTIME_FAILED');
  }
});
