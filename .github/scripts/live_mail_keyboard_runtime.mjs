import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { acquireOwned, commandTimeout, deadlineRace, stopBrowser, stopOwned } from './live_hero_layout_runtime.mjs';
import { MAIL_STATE_SQL } from './mail_keyboard_state.mjs';
import { createMailVerifier } from './mail_keyboard_evidence.mjs';

const fail = () => { throw new Error('MAIL_RUNTIME_INVALID'); };
const check = value => { if (!value) fail(); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const fixtureSpec = ['D', 'C', 'B', 'A'].map(label => ({ label, mail_type: 2,
  title: label === 'B' ? `B ${'Mail keyboard long title '.repeat(5)}` : `Mail ${label}`,
  body: `Native mailbox body ${label}`, attachments: { resources: null, items: label === 'D' ? [{ item_cfg_id: 2001, qty: 1 }] : null } }));
export function mailCommandArgs(label, playerId) {
  const fixture = fixtureSpec.find(row => row.label === label);
  check(fixture && /^[1-9]\d*$/.test(String(playerId)));
  const args = ['send-mail', '--server-id=1', `--player-id=${playerId}`, `--title=${fixture.title}`, `--body=${fixture.body}`,
    '--mail-type=2', '--operator-id=mail-keyboard-native', '--reason=isolated keyboard acceptance'];
  if (fixture.attachments.items?.length) args.push(`--rewards-json=${JSON.stringify(fixture.attachments)}`);
  return args;
}
export function parseGmOutput(raw) {
  try {
    const [lookup, sent, ...body] = raw.split('\n'), logs = [JSON.parse(lookup), JSON.parse(sent)], receipt = JSON.parse(body.join('\n'));
    check(Object.keys(receipt).join() === 'mail');
    for (const [i, row] of logs.entries()) {
      const keys = ['time', 'level', 'msg', 'server_id', 'player_id', 'operator_id', 'operator_name', 'reason', 'ticket_id',
        ...(i === 0 ? ['op', 'audit_log_id', 'executed_at_ms'] : ['mail_id', 'mail_type'])];
      assert.deepEqual(Object.keys(row).sort(), keys.sort());
      check(Number.isFinite(Date.parse(row.time)) && row.level === 'INFO' && row.msg === (i === 0 ? 'gm operation' : 'mail sent'));
      check(row.server_id === 1 && row.player_id === receipt.mail.PlayerID && row.operator_id === 'mail-keyboard-native');
      check(row.operator_name === '' && row.ticket_id === '' && row.reason === 'isolated keyboard acceptance');
      if (i === 0) check(row.op === 'LookupPlayer' && /^[0-9a-f]{32}$/.test(row.audit_log_id) && Number.isSafeInteger(row.executed_at_ms));
      else check(row.mail_id === receipt.mail.MailID && row.mail_type === receipt.mail.MailType);
    }
    return receipt;
  } catch { throw new Error('MAIL_RUNTIME_GM_OUTPUT_INVALID'); }
}
export function validateEnvironment(env) {
  check(env.GITHUB_ACTIONS === 'true' && ['1280', '1600'].includes(env.QA_WIDTH));
  check(['baseline', 'fixed'].includes(env.QA_PRODUCT));
  check(env.PGHOST === '127.0.0.1' && env.PGPORT === '5432' && env.PGDATABASE === 'live_mail_keyboard' && env.REDIS_ADDR === '127.0.0.1:6379');
  let db; try { db = new URL(env.DATABASE_URL); } catch { fail(); }
  check(db.protocol === 'postgres:' && db.hostname === '127.0.0.1' && db.pathname === '/live_mail_keyboard' && ['', '5432'].includes(db.port));
  check(!env.GM_TOKEN && !env.GM_OPERATOR_WHITELIST && !env.MIL_FRESH_PROFILE_FILE);
  for (const name of ['PRODUCT', 'RUNTIME', 'TRACE', 'STATE', 'SCENARIO']) check(/^[0-9a-f]{40}$/.test(env[`QA_${name}_HEAD`] ?? ''));
  check(/^[0-9a-f]{40}$/.test(env.QA_PRODUCT_TREE ?? ''));
  check(/^[0-9a-f]{40}( [0-9a-f]{40})*$/.test(env.QA_PRODUCT_PARENTS ?? ''));
  check(path.isAbsolute(env.RUNNER_TEMP ?? '') && path.resolve(env.QA_OUT ?? '').startsWith(`${path.resolve(env.RUNNER_TEMP)}/`));
  for (const name of ['QA_SERVER', 'QA_GM']) check(path.isAbsolute(env[name] ?? '') && env[name].startsWith(`${path.resolve(env.QA_OUT)}/`));
}
export function createFrameCapture(verifier) {
  let source, closed = false, failed = false;
  return {
    created(event) { check(!source && !closed && event.url === 'ws://127.0.0.1:8080/ws' && typeof event.requestId === 'string'); source = event.requestId; },
    frame(direction, event) {
      try {
        check(!closed && !failed && source && event.requestId === source && ['sent', 'received'].includes(direction));
        check(event.response.opcode === 2 && typeof event.response.payloadData === 'string' && Number.isFinite(event.timestamp));
        const bytes = Buffer.from(event.response.payloadData, 'base64');
        check(bytes.length > 0 && bytes.toString('base64') === event.response.payloadData);
        verifier[direction === 'sent' ? 'observeSent' : 'observeReceived'](bytes, event.timestamp);
      } catch { failed = true; fail(); }
    },
    close() { closed = true; },
    valid() { check(source && !failed && !closed); },
  };
}
export function verifyStaging(manifest, staged, env) {
  const groups = {
    'live_hero_layout_runtime.mjs': 'HELPER', 'live_hero_layout_runtime.test.mjs': 'HELPER',
    'mail_keyboard_state.mjs': 'STATE', 'mail_keyboard_state.test.mjs': 'STATE',
    'mail_keyboard_evidence.mjs': 'TRACE', 'mail_keyboard_evidence.test.mjs': 'TRACE',
    'live_mail_keyboard_runtime.mjs': 'RUNTIME', 'live_mail_keyboard_runtime.test.mjs': 'RUNTIME',
    'live_mail_keyboard.mjs': 'SCENARIO', 'live_mail_keyboard.test.mjs': 'SCENARIO',
    'MAIL_KEYBOARD_STATE.md': 'STATE', 'MAIL_KEYBOARD_EVIDENCE.md': 'TRACE',
    'LIVE_MAIL_KEYBOARD_RUNTIME.md': 'RUNTIME', 'LIVE_MAIL_KEYBOARD.md': 'SCENARIO',
  };
  check(Array.isArray(manifest)); assert.deepEqual(manifest.map(row => row.file).sort(), Object.keys(groups).sort());
  for (const row of manifest) {
    const bytes = staged(row.file), group = groups[row.file];
    const head = group === 'HELPER' ? '7dc5939f9753a8aa59c94f7101c62a8e4a8eda79' : env[`QA_${group}_HEAD`];
    check(row.sourceHead === head && /^[0-9a-f]{40}$/.test(head ?? '') && hash(bytes) === row.sha256);
    check(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === row.sourceBlob);
  }
}
export function safeError(error, field, allowed, fallback) {
  try { const value = error?.[field]; return allowed.includes(value) ? value : fallback; }
  catch { return fallback; }
}
export function runCommand({ signal, deadline, env, execute = execFileSync }, bin, args, cwd) {
  try {
    signal.throwIfAborted(); const timeout = commandTimeout(deadline);
    return execute(bin, args, { cwd, env, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch (error) { throw new Error(`MAIL_RUNTIME_COMMAND_${safeError(error, 'code', ['ENOENT', 'ETIMEDOUT'], 'FAILED')}`); }
}
export function verifyScenario(result, product, viewport, screenshots) {
  check(result?.product === product && result.nativeAcceptance === false);
  check(result.resultKind === (product === 'fixed' ? 'native-candidate' : 'baseline-defect-control'));
  check(result.defectObserved === (product === 'baseline'));
  assert.deepEqual(result.viewport, viewport);
  assert.deepEqual(result.cases, ['open', 'tab-b', 'read-b', 'checkbox', 'unread', 'read-a', 'read-d', 'read-c']);
  assert.deepEqual(result.screenshots, screenshots);
  check(screenshots.length === 8 && new Set(screenshots).size === 8);
}
export function preflight(report, name, action) {
  check(['dependencies', 'node', 'redis-info', 'redis-empty', 'database', 'packages', 'go', 'postgres',
    'product-head', 'product-clean', 'manifest-load', 'manifest-inventory', 'manifest-bytes', 'provenance', 'empty-db',
    'browser-launch', 'browser-connect', 'browser-cdp', 'browser-commandline', 'browser-args', 'browser-binary', 'browser-version', 'browser-sandbox-page', 'browser-sandbox-query', 'browser-sandbox-check', 'browser-evidence', 'startup-enter', 'startup-mail', 'startup-settle', 'startup-identity', 'snapshot-health', 'snapshot-sql', 'snapshot-json', 'fixtures-begin'].includes(name));
  report.phase = `preflight-${name}`;
  return action();
}
export async function withMailRuntime(scenario) {
  const env = process.env, root = path.resolve(process.cwd(), '..'), client = process.cwd();
  const out = path.resolve(env.QA_OUT ?? 'invalid-evidence'), controller = new AbortController();
  const deadline = Date.now() + 300000, children = [], stopped = new WeakSet();
  const report = { nativeAcceptance: false, phase: 'preflight', errors: [], cleanup: [], snapshots: [], screenshots: [] };
  let browserServer, browser, ownership, page, verifier, capture, closing = false, canSave = false, browserStopped = false;
  const save = () => { if (!canSave) return; mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, 'runtime.json'), JSON.stringify(report, null, 2)); };
  const command = (bin, args, cwd = root) => runCommand({ signal: controller.signal, deadline, env }, bin, args, cwd);
  const sql = query => JSON.parse(command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', query]));
  const healthy = () => { controller.signal.throwIfAborted(); commandTimeout(deadline); check(report.errors.length === 0); };
  const settle = async () => {
    for (let i = 0; i < 150; i++) { healthy(); if (verifier.pendingCount === 0) return; await delay(100, undefined, { signal: controller.signal }); }
    fail();
  };
  const snapshot = label => { preflight(report, 'snapshot-health', healthy); const raw = preflight(report, 'snapshot-sql', () => command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ${MAIL_STATE_SQL}; COMMIT`])); const value = preflight(report, 'snapshot-json', () => JSON.parse(raw)); report.snapshots.push({ label, value }); return value; };
  const start = (bin, args, name, cwd = root) => {
    healthy(); const child = spawn(bin, args, { cwd, env: { ...env, HTTP_ADDR: '127.0.0.1:8080' }, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => report.errors.push('OWNED_SERVICE_ERROR'));
    children.push({ child, name, pid: child.pid }); return child;
  };
  const stop = (child, name) => stopOwned(child, name, { children, stopped, report });
  const ready = async (url, child) => {
    for (let i = 0; i < 120; i++) {
      healthy(); check(child.exitCode === null && child.signalCode === null);
      try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
      await delay(250, undefined, { signal: controller.signal });
    }
    fail();
  };
  const interrupt = () => controller.abort(new Error('MAIL_RUNTIME_INTERRUPTED'));
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  try {
    await deadlineRace(async () => {
      validateEnvironment(env); canSave = true; save();
      const require = preflight(report, 'dependencies', () => createRequire(path.join(client, 'package.json')));
      const { chromium } = require('playwright'), protobuf = require('protobufjs');
      preflight(report, 'node', () => check(/^v22\./.test(process.version)));
      preflight(report, 'redis-info', () => check(/^redis_version:7\./m.test(command('redis-cli', ['-h', '127.0.0.1', 'INFO', 'server']))));
      preflight(report, 'redis-empty', () => check(command('redis-cli', ['-h', '127.0.0.1', 'DBSIZE']) === '0'));
      preflight(report, 'database', () => check(command('psql', ['-XAtc', 'SELECT current_database()']) === 'live_mail_keyboard'));
      preflight(report, 'packages', () => check(require('playwright/package.json').version === '1.49.1' && require('vite/package.json').version === '6.4.5'));
      preflight(report, 'go', () => check(command('go', ['env', 'GOVERSION']) === 'go1.23.12' && command('go', ['env', 'GOTOOLCHAIN']) === 'local'));
      preflight(report, 'postgres', () => check(Number(command('psql', ['-XAtc', 'SHOW server_version_num'])) >= 170000 && Number(command('psql', ['-XAtc', 'SHOW server_version_num'])) < 180000));
      preflight(report, 'product-head', () => check(command('git', ['rev-parse', 'HEAD']) === env.QA_PRODUCT_HEAD && command('git', ['rev-parse', 'HEAD^{tree}']) === env.QA_PRODUCT_TREE));
      preflight(report, 'product-clean', () => check(command('git', ['show', '-s', '--format=%P', 'HEAD']) === env.QA_PRODUCT_PARENTS && command('git', ['diff', '--name-only']) === '' && command('git', ['diff', '--cached', '--name-only']) === ''));
      const staged = path.dirname(new URL(import.meta.url).pathname), manifest = preflight(report, 'manifest-load', () => JSON.parse(readFileSync(path.join(staged, 'manifest.json'), 'utf8')));
      preflight(report, 'manifest-inventory', () => assert.deepEqual(readdirSync(staged).sort(), [...manifest.map(row => row.file), 'manifest.json'].sort()));
      preflight(report, 'manifest-bytes', () => verifyStaging(manifest, name => readFileSync(path.join(staged, name)), env));
      report.provenance = preflight(report, 'provenance', () => ({ manifest, productHead: env.QA_PRODUCT_HEAD, productTree: env.QA_PRODUCT_TREE, parents: env.QA_PRODUCT_PARENTS, node: process.version,
        go: command('go', ['version']), server: hash(readFileSync(env.QA_SERVER)), gm: hash(readFileSync(env.QA_GM)) }));
      preflight(report, 'empty-db', () => check(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'") === 0));
      report.phase = 'services'; const server = start(env.QA_SERVER, [], 'server'); await ready('http://127.0.0.1:8080/healthz', server);
      const preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'client', client);
      await ready('http://127.0.0.1:5173', preview);
      const protoRoot = new protobuf.Root();
      for (const folder of ['spec/proto', 'client/proto/sanguo/content', 'client/proto/sanguo/hero']) {
        for (const file of readdirSync(path.join(root, folder), { recursive: true }).filter(f => f.endsWith('.proto'))) {
          protobuf.parse(readFileSync(path.join(root, folder, file), 'utf8'), protoRoot, { keepCase: true });
        }
      }
      const cityState = protoRoot.lookupType('sanguo.domestic.v1.GetCityStateResponse');
      if (!cityState.fields.production_rates) cityState.add(new protobuf.Field('production_rates', 3, 'sanguo.common.v1.ResourceWallet'));
      protoRoot.resolveAll(); verifier = createMailVerifier({ protoRoot, fixtureSpec });
      browserServer = await preflight(report, 'browser-launch', () => acquireOwned(() => chromium.launchServer({ channel: 'chromium', headless: true, chromiumSandbox: true, timeout: commandTimeout(deadline) }),
        async value => stopBrowser(value, null, { server: value, pid: value.process().pid }, report), controller.signal));
      ownership = { server: browserServer, pid: browserServer.process().pid };
      browser = await preflight(report, 'browser-connect', () => acquireOwned(() => chromium.connect(browserServer.wsEndpoint(), { timeout: commandTimeout(deadline) }), value => value.close(), controller.signal));
      const browserCDP = await preflight(report, 'browser-cdp', () => browser.newBrowserCDPSession());
      const args = (await preflight(report, 'browser-commandline', () => browserCDP.send('Browser.getBrowserCommandLine'))).arguments;
      preflight(report, 'browser-args', () => check(!args.some(arg => /no-sandbox|disable-setuid-sandbox|single-process/.test(arg))));
      preflight(report, 'browser-binary', () => check(/chromium(?:_headless_shell)?-1148\//.test(chromium.executablePath()) && args[0] === chromium.executablePath()));
      preflight(report, 'browser-version', () => check(/^131\./.test(browser.version())));
      const sandboxPage = await preflight(report, 'browser-sandbox-page', () => browser.newPage()); await sandboxPage.goto('chrome://sandbox');
      const sandbox = await preflight(report, 'browser-sandbox-query', () => sandboxPage.locator('body').innerText());
      preflight(report, 'browser-sandbox-check', () => check(/Seccomp-BPF sandbox\s+Yes/.test(sandbox) && /PID namespaces\s+Yes/.test(sandbox))); await sandboxPage.close();
      report.browser = preflight(report, 'browser-evidence', () => ({ version: browser.version(), args, sandbox, binary: hash(readFileSync(chromium.executablePath())) }));
      const width = Number(env.QA_WIDTH), height = width === 1280 ? 720 : 900;
      page = await acquireOwned(() => browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }), value => value.close(), controller.signal);
      page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000); report.viewport = { width, height };
      page.on('console', message => { if (message.type() === 'error') report.errors.push('CONSOLE_ERROR'); });
      page.on('pageerror', () => report.errors.push('PAGE_ERROR')); page.on('requestfailed', () => report.errors.push('REQUEST_FAILED'));
      page.on('response', response => { if (response.status() >= 400) report.errors.push('HTTP_ERROR'); });
      const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Performance.enable');
      capture = createFrameCapture(verifier);
      const receive = action => event => { try { action(event); } catch { report.errors.push('CAPTURE_REJECTED'); } };
      cdp.on('Network.webSocketCreated', receive(event => capture.created(event)));
      cdp.on('Network.webSocketFrameSent', receive(event => capture.frame('sent', event)));
      cdp.on('Network.webSocketFrameReceived', receive(event => capture.frame('received', event)));
      cdp.on('Network.webSocketClosed', () => { if (!closing) report.errors.push('SOCKET_CLOSED_EARLY'); });
      cdp.on('Network.webSocketFrameError', () => report.errors.push('SOCKET_ERROR'));
      const clock = async () => { const result = await cdp.send('Performance.getMetrics'); const value = result.metrics.find(m => m.name === 'Timestamp')?.value; check(Number.isFinite(value)); return value; };
      report.phase = 'natural-startup'; await page.goto('http://127.0.0.1:5173');
      await page.locator('.server-list li[data-server-id="1"]').click();
      const action = name => page.locator(`[data-action="${name}"]`);
      await preflight(report, 'startup-enter', () => action('enter-game').click()); await preflight(report, 'startup-mail', () => action('toggle-mail').waitFor()); await preflight(report, 'startup-settle', settle);
      const identity = preflight(report, 'startup-identity', () => verifier.identity()), initial = snapshot('before-fixtures'); preflight(report, 'fixtures-begin', () => verifier.beginFixtures(initial));
      report.phase = 'gm-fixtures'; const receipts = []; report.gm = [];
      for (const fixture of fixtureSpec) {
        healthy(); const before = await clock();
        const raw = command(env.QA_GM, mailCommandArgs(fixture.label, identity.player_id));
        const after = await clock(), receipt = parseGmOutput(raw); verifier.acceptFixture(receipt, before, after); receipts.push(receipt);
        report.gm.push({ label: fixture.label, sent: before, received: after, receipt }); save();
      }
      await settle(); const fixtureState = verifier.finishFixtures(snapshot('after-fixtures'));
      const fixtures = fixtureSpec.map(spec => ({ ...spec, id: Number(receipts.find(r => r.mail.Title === spec.title).mail.MailID) }));
      check(fixtures.every(row => Number.isSafeInteger(row.id) && row.id > 0));
      report.fixtureCount = fixtureState.after.length;
      const screenshot = async label => {
        check(/^[a-z0-9-]+$/.test(label)); healthy();
        check(await page.locator('input[type=password]').evaluateAll(elements => elements.every(element => element.value === '')));
        await page.screenshot({ path: path.join(out, `${label}.png`), timeout: 5000 }); report.screenshots.push(label); save();
      };
      const step = async (expectedReadId, actionFn) => {
        await settle(); capture.valid(); verifier.beginStep({ expectedReadId: expectedReadId === null ? null : String(expectedReadId) }); await actionFn(); await settle();
        const result = verifier.endStep(snapshot(`step-${report.snapshots.length}`)); save(); return result;
      };
      report.phase = 'native-scenario';
      await scenario({ page, action, fixtures, step, screenshot, report, product: env.QA_PRODUCT });
      verifyScenario(report.scenario, env.QA_PRODUCT, report.viewport, report.screenshots);
      await settle(); capture.valid(); closing = true;
      await stopBrowser(browserServer, browser, ownership, report); browserStopped = true;
      check(report.errors.length === 0 && verifier.pendingCount === 0); capture.close();
      report.trace = verifier.finish(snapshot('final-after-browser-close'));
      for (const { child } of children) check(child.exitCode === null && child.signalCode === null);
      healthy(); report.phase = 'postconditions-complete';
    }, deadline - Date.now(), controller);
  } catch (error) {
    report.errors.push(safeError(error, 'message', ['MAIL_RUNTIME_COMMAND_ENOENT', 'MAIL_RUNTIME_COMMAND_ETIMEDOUT', 'MAIL_RUNTIME_COMMAND_FAILED'], 'RUNTIME_FAILED')); process.exitCode = 1;
    if (page && canSave) try {
      if (await page.locator('input[type=password]').evaluateAll(elements => elements.every(element => element.value === '')))
        await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 5000 });
    } catch {}
  }
  finally {
    closing = true; controller.abort(new Error('MAIL_RUNTIME_CLOSED')); capture?.close();
    process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt);
    if (browserServer && !browserStopped) await stopBrowser(browserServer, browser, ownership, report).catch(() => report.errors.push('BROWSER_CLEANUP_FAILED'));
    for (const { child, name } of children.reverse()) await stop(child, name).catch(() => report.errors.push('SERVICE_CLEANUP_FAILED'));
    report.resultKind = report.errors.length ? 'failed' : env.QA_PRODUCT === 'baseline' ? 'baseline-defect-control' : 'native-candidate';
    if (report.errors.length) process.exitCode = 1;
    if (verifier) report.verifier = verifier.evidence(); save();
  }
  return report;
}
