import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import protobuf from 'protobufjs';
import { chromium } from 'playwright';

async function run() {
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Official runner only; no local browser retry');
const client = process.cwd(), repo = path.resolve(client, '..'), out = path.resolve(process.env.QA_OUT);
const width = Number(process.env.QA_WIDTH), height = width === 1280 ? 720 : 900;
assert.ok([1280, 1600].includes(width));
const dsn = new URL(process.env.DATABASE_URL);
assert.equal(dsn.hostname, '127.0.0.1'); assert.equal(dsn.pathname, '/live_quest');
assert.equal(process.env.PGHOST, '127.0.0.1'); assert.equal(process.env.PGDATABASE, 'live_quest');
assert.equal(process.env.REDIS_ADDR, '127.0.0.1:6379');
mkdirSync(out, { recursive: true });
const command = (cmd, args, cwd = repo) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();
const report = { boundary: 'Full production entry and real cmd/server/PG17/Redis7, existing DATA-002, sandboxed Chromium; no mocks or durable military activation',
  base: command('git', ['rev-parse', 'HEAD']), tree: command('git', ['write-tree']), width, height,
  node: process.version, go: command('go', ['version']), playwright: JSON.parse(readFileSync(path.join(client, 'node_modules/playwright/package.json'))).version,
  requests: [], cases: [], errors: [], cleanup: [], passed: false };
assert.equal(report.base, 'e2b60dda830d9b25f15fcfced4da4acc090a8f1c');
assert.equal(report.tree, '8d2bb9b655eaefa227a0af95f0cd32dc8aebee28');
const sql = text => command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-Atc', text]);
report.postgres = sql('SHOW server_version_num'); assert.equal(Math.floor(Number(report.postgres) / 10000), 17);
assert.equal(sql('SELECT count(*) FROM pg_tables WHERE schemaname=\'public\''), '0', 'Fresh database required');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const children = [], origin = 'http://127.0.0.1:5173', gateway = 'ws://127.0.0.1:8080/ws';
function start(cmd, args, name, cwd, env = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', error => report.errors.push(`${name}: ${error.message}`));
  for (const [stream, suffix] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    stream.on('data', data => appendFileSync(path.join(out, `${name}-${suffix}.log`), data.toString()
      .replaceAll(process.env.PGPASSWORD, '[test-db-user]').replaceAll('demo123', '[test-password]')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[trace-or-session]')));
  }
  children.push({ child, name }); return child;
}
async function stop(child, name) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  for (let i = 0; i < 100 && child.exitCode === null && child.signalCode === null; i++) await sleep(100);
  assert.ok(child.exitCode !== null || child.signalCode !== null, `${name} did not stop gracefully`);
  report.cleanup.push(name);
}
async function ready(url, child) {
  for (let i = 0; i < 600; i++) {
    assert.equal(child.exitCode, null, `Process exited before ${url}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error(`Readiness timed out: ${url}`);
}
const root = new protobuf.Root();
for (const file of ['common/v1/envelope.proto', 'common/v1/types.proto', 'quest/v1/quest.proto']) {
  protobuf.parse(readFileSync(path.join(repo, 'spec/proto/sanguo', file), 'utf8'), root, { keepCase: true });
}
root.resolveAll();
const clientPacket = root.lookupType('sanguo.common.v1.ClientPacket'), serverPacket = root.lookupType('sanguo.common.v1.ServerPacket');
const questMutations = ['AcceptQuest', 'ClaimQuestReward', 'ReportQuestProgress'].map(name => `quest.v1.${name}`);
const mutations = () => report.requests.filter(row => questMutations.includes(row.route));
let browser, page;
try {
  const boot = start(process.env.QA_SERVER, [], 'bootstrap', repo, { HTTP_ADDR: '127.0.0.1:8080', MIL_FRESH_PROFILE_FILE: '' });
  await ready('http://127.0.0.1:8080/healthz', boot); await stop(boot, 'bootstrap');
  for (const name of ['cfg_item', 'cfg_quest', 'cfg_shop', 'cfg_shop_shelf', 'cfg_shop_offer', 'cfg_hero_template', 'cfg_unit']) {
    command('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(repo, `spec/data/generated/${name}.sql`)]);
  }
  report.seedQuests = Number(sql('SELECT count(*) FROM cfg_quest')); assert.ok(report.seedQuests > 2);
  const server = start(process.env.QA_SERVER, [], 'server', repo, { HTTP_ADDR: '127.0.0.1:8080', MIL_FRESH_PROFILE_FILE: '' });
  await ready('http://127.0.0.1:8080/healthz', server);
  const preview = start(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'client', client);
  await ready(origin, preview);
  browser = await chromium.launch({ chromiumSandbox: true }); report.chromium = browser.version();
  page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);
  const pending = new Map();
  page.on('pageerror', error => report.errors.push(`page: ${error.message}`));
  page.on('requestfailed', req => report.errors.push(`request: ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`));
  page.on('websocket', socket => {
    if (socket.url() !== gateway) { report.errors.push('Unexpected WebSocket destination'); return; }
    socket.on('framesent', ({ payload }) => {
      try {
        const packet = clientPacket.decode(payload), row = { route: packet.route };
        if (questMutations.includes(packet.route)) {
          row.questId = root.lookupType(`sanguo.quest.v1.${packet.route.split('.').at(-1)}Request`).decode(packet.payload).quest_cfg_id;
        }
        report.requests.push(row); pending.set(packet.trace_id, row); // Never save tokens, auth payloads or trace IDs.
      } catch (error) { report.errors.push(`Sent-frame decode: ${error.message}`); }
    });
    socket.on('framereceived', ({ payload }) => {
      try {
        const packet = serverPacket.decode(payload), row = pending.get(packet.trace_id);
        if (!row) throw new Error('Response without observed request');
        row.code = packet.code; pending.delete(packet.trace_id);
        if (questMutations.includes(row.route)) row.message = packet.msg;
        if (row.route === 'quest.v1.ListPlayerQuests' && packet.code === 0) {
          row.questIds = root.lookupType('sanguo.quest.v1.ListPlayerQuestsResponse').decode(packet.data).quests.map(q => q.quest_cfg_id);
        }
      } catch (error) { report.errors.push(`Reply-frame decode: ${error.message}`); }
    });
  });
  async function eventually(check, message) {
    for (let i = 0; i < 150; i++) { if (await check()) return; await sleep(100); }
    assert.fail(message);
  }
  const completed = (route, since = 0) => report.requests.slice(since).find(row => row.route === route && row.code !== undefined);
  async function readAfter(action, route) {
    const before = report.requests.length; await action();
    await eventually(() => completed(route, before), `Missing actual response: ${route}`);
    assert.equal(completed(route, before).code, 0); return completed(route, before);
  }
  await page.goto(origin);
  await page.locator('.server-list li[data-server-id="1"]').click();
  await page.locator('[data-action="enter-game"]').click();
  await page.locator('[data-action="toggle-quest"]').waitFor();
  for (const route of ['account.v1.Register', 'account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.CreateCity', 'domestic.v1.GetCityState']) {
    assert.ok(report.requests.some(row => row.route === route && row.code === 0), `Real bootstrap missing ${route}`);
  }
  const panel = page.locator('.quest-panel'), select = id => panel.locator(`[data-action="select-quest"][data-quest-id="${id}"]`);
  const input = panel.locator('[data-field="quest-id"]'), action = name => panel.locator(`[data-action="${name}"]`);
  const listed = await readAfter(() => page.locator('[data-action="toggle-quest"]').click(), 'quest.v1.ListPlayerQuests');
  assert.ok([1001, 1002, 1003].every(id => listed.questIds.includes(id)));
  await select(1002).waitFor(); assert.equal(await input.inputValue(), '1001');
  const untouched = sql('SELECT coalesce(jsonb_agg(q ORDER BY quest_cfg_id)::text,\'[]\') FROM player_quest q');
  const originalBag = sql("SELECT coalesce(jsonb_agg(i ORDER BY item_cfg_id)::text,'[]') FROM player_item i");
  const noQuestReward = () => {
    assert.equal(sql("SELECT count(*) FROM reward_grant_queue WHERE idempotency_key LIKE 'quest:%'"), '0');
    assert.equal(sql("SELECT coalesce(jsonb_agg(i ORDER BY item_cfg_id)::text,'[]') FROM player_item i"), originalBag);
  };
  async function selected(id) {
    assert.equal(await input.inputValue(), String(id));
    assert.equal(await select(id).getAttribute('aria-pressed'), 'true');
    assert.equal(await panel.locator('[aria-pressed="true"]').count(), 1);
  }
  await input.focus();
  const tabBudget = await panel.locator('button, input, select, textarea, [tabindex]').count() + 1;
  report.tabStops = [];
  for (let i = 0; i < tabBudget && !(await select(1002).evaluate(el => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
    const stop = await panel.evaluate(el => ({ inside: el.contains(document.activeElement),
      action: document.activeElement?.getAttribute('data-action'), questId: document.activeElement?.getAttribute('data-quest-id') }));
    report.tabStops.push(stop); assert.equal(stop.inside, true, 'Native Tab stays inside the quest panel');
  }
  assert.ok(await select(1002).evaluate(el => el === document.activeElement), '1002 reachable with Tab');
  await page.keyboard.press('Enter'); await selected(1002);
  await page.keyboard.press('Space'); await selected(1002);
  assert.ok(await select(1002).evaluate(el => el === document.activeElement), 'Native activation retains focus');
  report.focus = await select(1002).evaluate(el => ({ outline: getComputedStyle(el).outline, focused: el.matches(':focus-visible') }));
  assert.equal(report.focus.focused, true); assert.notMatch(report.focus.outline, /\b0px\b|\bnone\b/);
  await page.screenshot({ path: path.join(out, 'keyboard-selection.png') });
  await select(1003).click(); await selected(1003);
  await input.fill('1001'); await page.keyboard.press('Tab'); await selected(1001);
  await readAfter(() => action('refresh-quests').click(), 'quest.v1.ListPlayerQuests'); await selected(1001);
  assert.ok(await action('refresh-quests').evaluate(el => el === document.activeElement), 'Refresh does not steal focus');
  await select(1002).click(); await selected(1002);
  await readAfter(() => action('refresh-quests').click(), 'quest.v1.ListPlayerQuests'); await selected(1002);
  await sleep(300); assert.equal(mutations().length, 0, 'Selection/manual entry/refresh must not submit');
  assert.equal(sql('SELECT coalesce(jsonb_agg(q ORDER BY quest_cfg_id)::text,\'[]\') FROM player_quest q'), untouched);
  async function explicit(name, route, id, code, message = '') {
    const before = mutations().length; await action(name).click();
    await eventually(() => mutations().length > before && mutations()[before].code !== undefined, 'Explicit quest response');
    assert.deepEqual(mutations().slice(before), [{ route, questId: id, code, message }]);
  }
  await explicit('accept-quest', 'quest.v1.AcceptQuest', 1002, 10001, 'prerequisite not met'); // Future node is not silently authorized.
  await eventually(() => page.locator('#hud').innerText().then(text => text.includes('prerequisite not met')), 'Visible prerequisite error');
  await explicit('claim-quest', 'quest.v1.ClaimQuestReward', 1002, 10001, 'quest: not claimable');
  assert.equal(sql('SELECT coalesce(jsonb_agg(q ORDER BY quest_cfg_id)::text,\'[]\') FROM player_quest q'), untouched);
  await select(1001).click(); await explicit('accept-quest', 'quest.v1.AcceptQuest', 1001, 0);
  await eventually(() => page.locator('#hud').innerText().then(text => text.includes('已接取 #1001')), 'Visible actual acceptance');
  assert.equal(sql('SELECT quest_cfg_id||\':\'||state FROM player_quest'), '1001:1');
  await explicit('claim-quest', 'quest.v1.ClaimQuestReward', 1001, 10001, 'quest: not claimable'); // No building completion or fabricated award.
  noQuestReward();
  const expectedMutations = mutations().length;
  for (const name of ['bag', 'shop']) {
    await page.keyboard.press('Escape');
    await page.locator(`[data-action="toggle-${name}"]`).click();
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator('[data-action="select-quest"]:visible').count(), 0);
    await page.keyboard.press('Escape');
    await readAfter(() => page.locator('[data-action="toggle-quest"]').click(), 'quest.v1.ListPlayerQuests'); await selected(1001);
  }
  await select(1003).scrollIntoViewIfNeeded(); await select(1003).click(); await selected(1003);
  const geometry = await select(1003).evaluate(el => {
    const b = el.getBoundingClientRect(), row = el.closest('li').getBoundingClientRect(), p = el.closest('.quest-panel').getBoundingClientRect();
    return { button: { x: b.x, y: b.y, width: b.width, height: b.height }, row: { x: row.x, right: row.right }, panel: { x: p.x, right: p.right }, color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor };
  });
  assert.ok(geometry.button.x >= 0 && geometry.button.x + geometry.button.width <= width && geometry.button.y >= 0 && geometry.button.y + geometry.button.height <= height);
  assert.ok(geometry.row.x >= geometry.panel.x && geometry.row.right <= geometry.panel.right + 1);
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(n => Number(n) / 255)
    .map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  report.buttonContrast = contrast(geometry.color, geometry.background); assert.ok(report.buttonContrast >= 4.5);
  report.geometry = geometry; await page.screenshot({ path: path.join(out, 'full-quest-panel.png') });
  const rowLengths = await panel.locator('.quest-list li').evaluateAll(rows => rows.map(row => row.textContent.length));
  const longest = panel.locator('.quest-list li').nth(rowLengths.indexOf(Math.max(...rowLengths)));
  await longest.scrollIntoViewIfNeeded();
  report.longRow = await longest.evaluate(el => ({ text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth,
    color: getComputedStyle(el).color, background: getComputedStyle(el.closest('.quest-panel')).backgroundColor }));
  assert.ok(report.longRow.scrollWidth <= report.longRow.width + 1, 'Longest actual seeded row wraps without horizontal overflow');
  report.textContrast = contrast(report.longRow.color, report.longRow.background); assert.ok(report.textContrast >= 4.5);
  await page.screenshot({ path: path.join(out, 'long-row.png') });
  await sleep(300); assert.equal(mutations().length, expectedMutations);
  assert.deepEqual(report.errors, []); assert.equal(server.exitCode, null);
  noQuestReward();
  report.cases = ['real fresh login/city/quest seed', 'Tab/Enter/Space and mouse', 'selection sends zero mutations and preserves PG rows', 'manual ID and refresh', 'explicit selected-ID accept/claim with real success and rejections', 'cross-panel dismissal/reopen', 'viewport geometry'];
  report.passed = true;
} catch (error) {
  report.failure = error.stack; if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close().catch(error => { report.errors.push(error.message); process.exitCode = 1; });
  for (const { child, name } of children.reverse()) {
    await stop(child, name).catch(error => { child.kill('SIGKILL'); report.errors.push(error.message); process.exitCode = 1; });
  }
  if (report.errors.length || process.exitCode) report.passed = false;
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, width, cases: report.cases, failure: report.failure, errors: report.errors }, null, 2));

}
run().catch(error => {
  if (process.env.GITHUB_ACTIONS !== 'true') throw error;
  const out = path.resolve(process.env.QA_OUT); mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'report.json'), JSON.stringify({ passed: false, phase: 'preflight', failure: error.stack }, null, 2));
  process.exitCode = 1;
});
