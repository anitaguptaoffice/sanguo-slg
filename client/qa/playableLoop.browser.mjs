#!/usr/bin/env node
// Real-browser acceptance for the playable loop (see PLAYABLE-LOOP.md): real Vite
// frontend, real Go gateway, real Chromium. No mocks, no fixtures, no data reset.
// Exit: 0 pass/exploratory done, 1 failed/blocked, 2 usage/config, 3 internal.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const FAVICON_CONSOLE = 'Failed to load resource: the server responded with a status of 404 (Not Found)';
const HELP = `Usage: node client/qa/playableLoop.browser.mjs [options]
Acceptance (default) fails any failed step, including the known G3 "in-flight
recruit/march lost on gateway restart" gap; --exploratory never claims acceptance.
  --base-url URL       Vite dev server (default http://127.0.0.1:5273)
  --health-url URL     Gateway probe (default http://127.0.0.1:8080/healthz)
  --out DIR            Evidence dir (default /tmp/opencode/playable-loop)
  --restart-cmd CMD    Shell command restarting the gateway (required in acceptance)
  --max-wait SEC       Longest ETA to wait for (default 300)
  --city-x N --city-y N  Pre-create the city at N,N (e.g. 6 6), one cell from the
                       seeded (5,5) garrison; the fixed (60,60) spawn would block
  --help               Print this help and exit without launching a browser
Set CHROMIUM_PATH for the browser. Disposable freshly initialized DB only; never reset or point it at the shared QA demo DB.`;
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(HELP); process.exit(0); }
class UsageError extends Error {}
class Skip extends Error {}
const FLAGS = { '--base-url': 'baseUrl', '--health-url': 'healthUrl', '--out': 'out',
  '--restart-cmd': 'restartCmd', '--max-wait': 'maxWaitSec', '--city-x': 'cityX', '--city-y': 'cityY' };
const NUMERIC = new Set(['maxWaitSec', 'cityX', 'cityY']);
function parseArgs(args) {
  const cfg = { baseUrl: 'http://127.0.0.1:5273', healthUrl: 'http://127.0.0.1:8080/healthz',
    out: '/tmp/opencode/playable-loop', restartCmd: null, restartWaitSec: 900, maxWaitSec: 300,
    settleSec: 15, cityX: null, cityY: null, chromium: process.env.CHROMIUM_PATH || null,
    exploratory: false, login: 'demo', password: 'demo123', serverId: 1 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--exploratory') { cfg.exploratory = true; continue; }
    const key = FLAGS[flag];
    if (!key) throw new UsageError(`unknown argument: ${flag} (see --help)`);
    const raw = args[++i];
    if (raw == null || raw.startsWith('--')) throw new UsageError(`${flag} requires a value`);
    const numeric = NUMERIC.has(key);
    const value = numeric ? Number(raw) : raw;
    if (numeric && (!Number.isFinite(value) || value <= 0)) throw new UsageError(`${flag} expects a positive number`);
    cfg[key] = key === 'baseUrl' ? String(value).replace(/\/$/, '') : value;
  }
  if ((cfg.cityX == null) !== (cfg.cityY == null)) throw new UsageError('--city-x and --city-y must be passed together');
  if (!cfg.exploratory && !cfg.restartCmd) throw new UsageError('acceptance mode requires --restart-cmd');
  return cfg;
}
let CFG; try { CFG = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`config error: ${e.message}`); process.exit(2); }
const OUT = resolve(CFG.out); mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const nowIso = () => new Date().toISOString(); const logLines = [], networkLines = [];
const log = (...p) => { const line = `${nowIso()} ${p.join(' ')}`; logLines.push(line); console.log(line); };
const gitRev = () => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: import.meta.dirname, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };
const report = { card: 'CLIENT-PLAYABLE-E2E-001', harness: 'client/qa/playableLoop.browser.mjs', mode: CFG.exploratory ? 'exploratory' : 'acceptance', source: gitRev(), started_at: nowIso(),
  config: { base_url: CFG.baseUrl, health_url: CFG.healthUrl, out: OUT, gateway_ws: null,
    restart_cmd_configured: Boolean(CFG.restartCmd), restart_wait_sec: CFG.restartWaitSec, max_wait_sec: CFG.maxWaitSec, settle_sec: CFG.settleSec,
    city_placement: CFG.cityX == null ? 'ui-default' : { x: CFG.cityX, y: CFG.cityY } },
  account: null, city: null, hall: null, recruit: null, hero: null, battle_report: null,
  reload_persistence: null, g3: {}, steps: [], errors: [], restart_induced: [], restart_events: [], websockets: [], passed: false, exit_code: null };
let browser = null, page = null, gatewayWs = null, observedWs = null, favicon404 = false;
let cityId = 0, heroId = 0, restartWindow = false;
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const ui = (sel) => page.locator(`${sel}:visible`).first();
const text = async (sel) => (await ui(sel).innerText()).trim();
const click = (action) => page.locator(`[data-action="${action}"]:visible`).first().click();
const fill = (field, value) => ui(`[data-field="${field}"]`).fill(String(value));
const hallOf = (s) => (s.buildings ?? []).find((b) => b.slot_key === 'hall'); const troopsOf = (s) => (s?.garrison?.troops ?? []).find((t) => t.unit_cfg_id === 1)?.count ?? 0;
const walletOf = (s) => s?.wallet ?? {}; const etaBudget = (finishAtMs) => Math.max(30000, finishAtMs + CFG.settleSec * 1000 - Date.now() + 30000);
function recordIssue(entry) {
  // Only whitelist: the dev server ships no favicon, so Chromium's probe 404s.
  if (entry.kind === 'http' && entry.status === 404 && /\/favicon\.ico(?:[?#]|$)/.test(entry.url)) return;
  if (entry.kind === 'console' && entry.text === FAVICON_CONSOLE && favicon404) return;
  const rec = { ...entry, at: nowIso(), during_restart: restartWindow };
  (restartWindow ? report.restart_induced : report.errors).push(rec); log('browser', JSON.stringify(rec));
}
// Chromium's generic 404 console line can arrive before the response event that reveals
// the URL; once the favicon 404 is known, drop exactly that line (real asset 404s still fail).
const unexpectedErrors = () => report.errors.filter((e) => !(favicon404 && e.kind === 'console' && e.text === FAVICON_CONSOLE));
async function openPanel(action, marker) {
  if (!(await page.locator(`${marker}:visible`).count())) await click(action);
  await page.locator(`${marker}:visible`).first().waitFor();
}
async function pollUntil(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs; let last = null;
  while (Date.now() < deadline) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(2000);
  }
  if (last) log('poll last error', String(last.message ?? last));
  return null;
}
async function waitHealthy(timeoutMs = CFG.restartWaitSec * 1000) {
  const deadline = Date.now() + timeoutMs; let last = 'no attempt';
  while (Date.now() < deadline) {
    try { const res = await fetch(CFG.healthUrl, { signal: AbortSignal.timeout(3000) }); if (res.ok) return; last = `HTTP ${res.status}`; }
    catch (e) { last = e.message; }
    await sleep(1000);
  }
  throw new Error(`gateway health timeout at ${CFG.healthUrl} (${last})`);
}
async function connectRpc() {
  if (!gatewayWs) throw new UsageError('gateway WebSocket URL not observed; check VITE_GATEWAY_WS_URL');
  await page.evaluate(async (url) => {
    window.__qaRpc?.close();
    const { GatewayClient } = await import('/src/net/GatewayClient.ts');
    const client = new GatewayClient(url); await client.connect(); window.__qaRpc = client;
  }, gatewayWs);
}
const rpc = (method, ...args) => page.evaluate(([m, a]) => window.__qaRpc[m](...a), [method, args]);
async function loginRpc() {
  await connectRpc();
  const session = await rpc('login', CFG.login, CFG.password, CFG.serverId);
  ok(session.player?.player_id, 'RPC login returned no player'); return session;
}
async function cityState() {
  const state = await rpc('getCityState', cityId);
  ok(state?.wallet, 'GetCityState returned no wallet'); return state;
}
async function enterGame() {
  await page.goto(CFG.baseUrl, { waitUntil: 'domcontentloaded' });
  const row = page.locator(`li[data-server-id="${CFG.serverId}"]`);
  await row.waitFor(); await row.click(); await click('enter-game');
  await page.locator('[data-action="toggle-military"]:visible').waitFor();
  await page.waitForFunction(() => /Lv\d/.test(document.getElementById('hud')?.textContent ?? ''), null, { timeout: 60000 });
}
async function reenter() {
  await enterGame(); await loginRpc();
  ok(((await rpc('listPlayerCities')).cities ?? []).some((c) => c.city_id === cityId), `city ${cityId} missing after reload`);
}
async function clickHall() {
  const p = await page.evaluate(async () => {
    const { computeLayoutViewport, layoutToCanvas } = await import('/src/engine/layoutViewport.ts');
    const r = document.getElementById('game').getBoundingClientRect();
    const pt = layoutToCanvas(800, 240, computeLayoutViewport(r.width, r.height));
    return { x: r.left + pt.x, y: r.top + pt.y };
  });
  await page.mouse.click(p.x, p.y); await page.locator('[data-role="build-title"]:visible').waitFor();
}
function parseEta(line, base = Date.now()) {
  const m = /剩\s*(\d+:)?(\d+):(\d\d)/.exec(line); if (!m) return null;
  return base + ((m[1] ? Number(m[1].slice(0, -1)) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3])) * 1000;
}
async function recruit(count) {
  await openPanel('toggle-military', '[data-action="recruit"]');
  await ui('[data-field="unit"]').selectOption('1'); await fill('recruit-count', count); await click('recruit');
  const row = page.locator('[data-role="military-recruit-queue-list"]:visible li').last(); await row.waitFor();
  const line = (await row.innerText()).trim(), finishAt = parseEta(line);
  ok(line.includes(`步兵×${count}`) && finishAt, `unexpected recruit queue row: "${line}"`);
  return { count, queue_line: line, finish_at_ms: finishAt, wallet_after_submit: walletOf(await cityState()) };
}
async function ensureTroops(minimum) {
  const have = troopsOf(await cityState()); if (have >= minimum) return have;
  const started = await recruit(minimum - have);
  const landed = await pollUntil(async () => { const s = await cityState(); return troopsOf(s) >= minimum ? s : null; }, etaBudget(started.finish_at_ms));
  if (!landed) throw new Skip(`troop recruit did not land within the ETA budget (have ${have}, need ${minimum})`);
  return troopsOf(landed);
}
async function ensureUiGarrison() {
  await openPanel('toggle-military', '[data-action="march"]');
  const line = await pollUntil(async () => {
    await click('refresh');
    const t = await page.evaluate(() => document.querySelector('[data-role="troops"]')?.textContent ?? '');
    return /步兵×\d+/.test(t) ? t : null;
  }, 36000);
  if (!line) throw new Error(`UI garrison never became ready: "${await text('[data-role="troops"]')}"`);
}
async function marchTo(toX, toY, count) {
  await ensureUiGarrison();
  await page.waitForFunction(() => { const s = document.querySelector('[data-field="march-hero"]'); return Boolean(s && [...s.options].some((o) => o.value && !o.disabled)); }, null, { timeout: 60000 });
  await ui('[data-field="march-hero"]').selectOption(String(heroId));
  await fill('to-x', toX); await fill('to-y', toY); await fill('march-count', count);
  const before = new Set(((await rpc('listMarches', cityId)).marches ?? []).map((m) => m.march_id));
  await click('march');
  if (await page.locator('[data-role="march-form-error"]:visible').count()) throw new Error(`march rejected: ${await text('[data-role="march-form-error"]')}`);
  const march = await pollUntil(async () => {
    const rows = (await rpc('listMarches', cityId)).marches ?? [];
    return rows.find((m) => !before.has(m.march_id)) ?? null;
  }, 30000);
  ok(march, 'march submitted but ListMarches never listed a new order'); return march;
}
async function restartAndReenter(label) {
  if (!CFG.restartCmd) throw new Skip('--restart-cmd not configured; cannot exercise the gateway restart');
  const event = { label, started_at: nowIso(), command: CFG.restartCmd };
  report.restart_events.push(event); restartWindow = true; log('restart', label);
  try {
    const proc = spawnSync(CFG.restartCmd, { shell: true, encoding: 'utf8', timeout: CFG.restartWaitSec * 1000 + 60000 });
    event.exit_code = proc.status; event.stdout_tail = (proc.stdout ?? '').slice(-2000); event.stderr_tail = (proc.stderr ?? '').slice(-2000);
    if (proc.status !== 0) throw new Error(`restart command failed (exit ${proc.status}): ${event.stderr_tail.trim()}`);
    await waitHealthy(); event.healthy_at = nowIso(); await reenter(); await sleep(2000);
  } finally { restartWindow = false; }
}
const steps = [];
function need(id) {
  const dep = steps.find((s) => s.id === id);
  if (!dep || dep.status !== 'passed') throw new Skip(`depends on "${id}" (${dep?.status ?? 'not run'})`);
}
async function step(id, title, fn) {
  const rec = { id, title, status: 'running', started_at: nowIso() };
  steps.push(rec); log('step', id, 'start');
  try { rec.detail = (await fn()) ?? null; rec.status = 'passed'; }
  catch (e) {
    rec.status = e instanceof Skip || CFG.exploratory ? 'blocked' : 'failed';
    rec.error = e instanceof Skip ? e.message : String(e.stack ?? e);
    log('step', id, rec.status, rec.error);
  } finally {
    rec.finished_at = nowIso(); await page?.screenshot({ path: `${OUT}/${String(steps.length).padStart(2, '0')}-${id}.png` }).catch(() => {});
  }
  return rec.status === 'passed';
}
async function main() {
  await waitHealthy(20000).catch((e) => { throw new UsageError(`gateway not ready at ${CFG.healthUrl}: ${e.message}`); });
  const { chromium } = await import('playwright');
  try { browser = await chromium.launch({ executablePath: CFG.chromium ?? undefined }); }
  catch (e) { throw new UsageError(`cannot launch Chromium (${e.message}); set CHROMIUM_PATH to an installed binary`); }
  page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.type() === 'error') recordIssue({ kind: 'console', text: m.text() }); });
  page.on('pageerror', (e) => recordIssue({ kind: 'pageerror', text: e.message }));
  page.on('response', (r) => { networkLines.push(`${nowIso()} ${r.status()} ${r.url()}`); if (r.status() >= 400) recordIssue({ kind: 'http', status: r.status(), url: r.url() }); });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable');
  // Chromium fetches /favicon.ico outside page response events; CDP is the only place to see it.
  cdp.on('Network.responseReceived', (e) => { if (e.response.status === 404 && /\/favicon\.ico(?:[?#]|$)/.test(e.response.url)) favicon404 = true; });
  page.on('websocket', (s) => {
    try { report.websockets.push({ at: nowIso(), url: s.url() }); if (new URL(s.url()).pathname === '/ws' && !observedWs) observedWs = s.url(); }
    catch { /* ignore malformed URLs */ }
  });
  try { await page.goto(CFG.baseUrl, { waitUntil: 'domcontentloaded' }); }
  catch (e) { throw new UsageError(`frontend not reachable at ${CFG.baseUrl}: ${e.message}`); }
  await page.locator(`li[data-server-id="${CFG.serverId}"]`).waitFor({ timeout: 60000 });
  gatewayWs = observedWs;
  if (!gatewayWs) throw new UsageError('could not observe the gateway WebSocket URL');
  report.config.gateway_ws = gatewayWs;
  await step('fresh-account', 'register a fresh account (stack must be pristine)', async () => {
    await connectRpc(); let registered;
    try { registered = await rpc('register', CFG.login, CFG.password); }
    catch (e) {
      if (/taken|exists|20002/i.test(String(e.message))) throw new Error(`stack is not fresh: account "${CFG.login}" already exists. Use a disposable freshly initialized database; never reset the shared QA demo DB.`);
      throw e;
    }
    ok(registered?.account_id, 'Register returned no account_id'); const session = await loginRpc();
    report.account = { login: CFG.login, account_id: registered.account_id, player_id: session.player.player_id, server_id: CFG.serverId };
    return report.account;
  });
  await step('enter-city', 'enter the city through the UI and record authoritative IDs', async () => {
    need('fresh-account');
    if (CFG.cityX != null && !((await rpc('listPlayerCities')).cities ?? []).length) await rpc('createCity', CFG.serverId, '主城', CFG.cityX, CFG.cityY);
    await enterGame(); await loginRpc();
    const cities = (await rpc('listPlayerCities')).cities ?? [];
    ok(cities.length === 1, `expected exactly one fresh city, found ${cities.length}`);
    const city = cities[0]; cityId = city.city_id; const wallet = walletOf(await cityState());
    ok(wallet.food > 0 && wallet.wood > 0 && wallet.stone > 0 && wallet.iron > 0, `initial wallet is not positive: ${JSON.stringify(wallet)}`);
    ok(CFG.cityX == null || (city.x === CFG.cityX && city.y === CFG.cityY), `city is at (${city.x},${city.y}) but --city-x/--city-y requested (${CFG.cityX},${CFG.cityY})`);
    report.city = { city_id: city.city_id, x: city.x, y: city.y, name: city.name, wallet,
      placement: CFG.cityX != null ? 'world.v1.CreateCity via --city-x/--city-y' : 'UI bootstrap default (fixed spawn)' };
    return report.city;
  });
  await step('hall-upgrade', 'upgrade the hall through the canvas/build panel', async () => {
    need('enter-city'); await clickHall(); const preview = await text('[data-role="build-preview"]');
    ok((await text('[data-role="build-title"]')) === '城主府', 'canvas hit did not open the hall panel');
    await page.waitForFunction(() => { const b = document.querySelector('[data-action="confirm-upgrade"]'); return b instanceof HTMLButtonElement && !b.disabled; });
    await click('confirm-upgrade');
    await page.waitForFunction(() => document.querySelector('[data-role="build-preview"]')?.textContent?.includes('升级进行中'));
    const hall = hallOf(await cityState());
    ok(hall?.upgrade_finish_at_ms > Date.now(), `hall upgrade did not start: ${JSON.stringify(hall)}`);
    const etaSec = Math.ceil((hall.upgrade_finish_at_ms - Date.now()) / 1000);
    if (etaSec > CFG.maxWaitSec) throw new Skip(`hall L2 ETA ${etaSec}s exceeds --max-wait ${CFG.maxWaitSec}s`);
    report.hall = { target_level: 2, preview, upgrade_finish_at_ms: hall.upgrade_finish_at_ms, eta_sec: etaSec }; return report.hall;
  });
  await step('recruit-troops', 'recruit 4 infantry; hall reaches Lv2 by its ETA', async () => {
    need('enter-city');
    const started = await recruit(4); report.recruit = started;
    const landed = await pollUntil(async () => { const s = await cityState(); return troopsOf(s) >= 4 ? s : null; }, etaBudget(started.finish_at_ms));
    if (!landed) {
      const s = await cityState();
      throw new Error(`recruited 4 infantry (queue "${started.queue_line}") but the garrison never reached 4; infantry=${troopsOf(s)}, garrison=${JSON.stringify(s.garrison ?? null)}, wallet=${JSON.stringify(walletOf(s))}`);
    }
    const hall = hallOf(landed);
    ok(hall?.level === 2, `hall level is ${hall?.level ?? 'missing'} after the upgrade ETA, expected 2`);
    report.hall.completed_level = hall.level; report.recruit.landed_troops = troopsOf(landed); report.recruit.wallet_after_grant = walletOf(landed);
    return { queue_line: started.queue_line, troops: troopsOf(landed), hall_level: hall.level };
  });
  await step('recruit-hero', 'recruit an owned hero through the hero panel', async () => {
    need('enter-city'); const heroWalletBefore = walletOf(await cityState()); await openPanel('toggle-hero', '[data-field="template-select"]');
    await page.waitForFunction(() => document.querySelectorAll('[data-field="template-select"] option').length > 1);
    const select = ui('[data-field="template-select"]');
    const values = await select.locator('option').evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
    await select.selectOption(values.includes('1001') ? '1001' : values[0]); await click('recruit-hero');
    const heroes = await pollUntil(async () => {
      const rows = (await rpc('listPlayerHeroes', CFG.serverId)).heroes ?? [];
      return rows.length ? rows : null;
    }, 60000);
    ok(heroes, 'hero recruit returned no owned hero within 60s');
    heroId = heroes[0].hero_id;
    report.hero = { hero_id: heroId, template_cfg_id: heroes[0].template_cfg_id, status: heroes[0].status, owned: heroes.length, wallet_before: heroWalletBefore, wallet_after: walletOf(await cityState()) }; return report.hero;
  });
  await step('battle', 'march to the seeded (5,5) garrison and open the battle report', async () => {
    need('recruit-troops'); need('recruit-hero');
    const distance = Math.max(Math.abs(5 - report.city.x), Math.abs(5 - report.city.y));
    if (distance * 72 > CFG.maxWaitSec) throw new Skip(`target (5,5) is ${distance} cells away (${distance * 72}s one-way) > --max-wait ${CFG.maxWaitSec}s; re-run with --city-x 6 --city-y 6 near the seeded garrison`);
    const startedMs = Date.now(); await ensureTroops(2);
    const march = await marchTo(5, 5, 2);
    const row = await pollUntil(async () => {
      const rows = (await rpc('listBattleReports', 20, 0)).reports ?? [];
      return rows.find((r) => r.location_x === 5 && r.location_y === 5 && r.created_at_ms >= startedMs) ?? null;
    }, march.arrive_at_ms - Date.now() + CFG.settleSec * 1000 + 60000);
    ok(row, `no battle report at (5,5) after march #${march.march_id} (arrive_at_ms=${march.arrive_at_ms})`);
    report.battle_report = row; await openPanel('toggle-reports', '[data-role="report-list"]');
    const li = page.locator(`li[data-report-id="${row.report_id}"]`);
    if (!(await li.count())) await click('refresh-reports'); await li.waitFor(); await li.click({ position: { x: 4, y: 4 } });
    await page.locator('[data-role="report-detail"] pre').waitFor();
    const detail = await text('[data-role="report-detail"]');
    ok(/第 \d+ 回合/.test(detail) && /攻方伤亡/.test(detail), `battle report detail lacks rounds/casualties: ${detail.slice(0, 200)}`);
    return { march_id: march.march_id, arrive_at_ms: march.arrive_at_ms, report: row, detail_chars: detail.length, detail_round_line: /第 [\d–]+ 回合[^\n]*/.exec(detail)?.[0] ?? null };
  });
  await step('reload-persistence', 'reload the page and re-read persisted city/hero/report state', async () => {
    need('battle'); await reenter();
    const state = await cityState(); const hall = hallOf(state);
    ok(hall?.level === 2, `hall level after reload is ${hall?.level ?? 'missing'}, expected 2`);
    const heroes = (await rpc('listPlayerHeroes', CFG.serverId)).heroes ?? [];
    ok(heroes.some((h) => h.hero_id === heroId), `hero ${heroId} missing after reload`);
    const reports = (await rpc('listBattleReports', 20, 0)).reports ?? [];
    ok(reports.some((r) => r.report_id === report.battle_report?.report_id), 'battle report missing after reload');
    await clickHall(); const levelText = await text('[data-role="build-level"]');
    ok(/Lv2/.test(levelText), `build panel shows "${levelText}" after reload, expected Lv2`);
    report.reload_persistence = { hall_level: hall.level, build_panel: levelText, hero_id: heroId, report_id: report.battle_report?.report_id, wallet: walletOf(state) }; return report.reload_persistence;
  });
  await step('g3-recruit-restart', 'G3: an in-flight recruit must still grant troops after a gateway restart', async () => {
    need('enter-city');
    const stateBefore = await cityState(); const before = troopsOf(stateBefore); const started = await recruit(4);
    report.g3.recruit = { ...started, troops_before: before, expected_after: before + 4, wallet_before: walletOf(stateBefore) };
    await restartAndReenter('mid-flight recruit');
    const landed = await pollUntil(async () => { const s = await cityState(); return troopsOf(s) >= before + 4 ? s : null; }, etaBudget(started.finish_at_ms));
    if (!landed) {
      const s = await cityState();
      throw new Error(`G3 recruit gap: recruit of 4 infantry (queue "${started.queue_line}", finish_at_ms=${started.finish_at_ms}) did not grant troops after the gateway restart. infantry before=${before}, after=${troopsOf(s)}, garrison=${JSON.stringify(s.garrison ?? null)}, wallet_before=${JSON.stringify(walletOf(stateBefore))}, wallet_after_restart=${JSON.stringify(walletOf(s))}. Recruit queues live only in memory (internal/military/march/hub.go); the resource debit is persisted.`);
    }
    report.g3.recruit.landed_troops = troopsOf(landed); return { troops: troopsOf(landed) };
  });
  await step('g3-march-restart', 'G3: an in-flight march must keep its order and ETA after a gateway restart', async () => {
    need('recruit-hero'); await ensureTroops(2);
    const march = await marchTo(report.city.x + 2, report.city.y + 2, 2);
    report.g3.march = { march_id: march.march_id, arrive_at_ms: march.arrive_at_ms, to: [march.to_x, march.to_y] }; await restartAndReenter('mid-flight march');
    const rows = (await rpc('listMarches', cityId)).marches ?? [];
    const kept = rows.find((m) => m.march_id === march.march_id);
    report.g3.march.after_restart = kept ?? null; report.g3.march.listed_after_restart = rows.length;
    if (!kept) throw new Error(`G3 march gap: march #${march.march_id} to (${march.to_x},${march.to_y}) with arrive_at_ms=${march.arrive_at_ms} is gone after the gateway restart (ListMarches returned ${rows.length} rows). March orders live only in memory (internal/military/march/hub.go).`);
    ok(kept.arrive_at_ms === march.arrive_at_ms, `G3 march ETA drift: #${march.march_id} arrive_at_ms ${march.arrive_at_ms} -> ${kept.arrive_at_ms} after restart`);
    return { march_id: kept.march_id, arrive_at_ms: kept.arrive_at_ms };
  });
  await step('runtime-errors', 'no unexpected console, page or HTTP errors', async () => {
    const errors = unexpectedErrors();
    if (errors.length) throw new Error(`${errors.length} unexpected browser/network error(s); see result.json .errors and browser.log: ${JSON.stringify(errors.slice(0, 3))}`);
    return { unexpected: 0, restart_induced: report.restart_induced.length, whitelisted: ['/favicon.ico 404'] };
  });
  const failed = steps.some((s) => s.status === 'failed'), blocked = steps.some((s) => s.status === 'blocked');
  report.passed = !failed && !blocked;
  report.exit_code = failed || (blocked && !CFG.exploratory) ? 1 : 0;
}
try { await main(); }
catch (e) { report.failure = String(e.stack ?? e); report.exit_code = e instanceof UsageError ? 2 : 3; log('fatal', report.failure); }
finally {
  report.finished_at = nowIso(); report.errors = unexpectedErrors(); report.steps = steps;
  await browser?.close().catch(() => {});
  writeFileSync(`${OUT}/result.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${OUT}/browser.log`, `${logLines.join('\n')}\n`); writeFileSync(`${OUT}/network.log`, `${networkLines.join('\n')}\n`);
  console.log(JSON.stringify({ passed: report.passed, exit_code: report.exit_code, steps: steps.map((s) => `${s.id}:${s.status}`), out: OUT }));
  process.exitCode = report.exit_code ?? 1;
}
