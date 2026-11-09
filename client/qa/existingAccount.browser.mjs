import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Real-browser scenario only. The caller owns disposable RPC fixtures, services and Chromium.
// Never record raw frames, credentials, tokens or Playwright traces with filled password fields.
export async function runExistingAccountScenario({ page, baseUrl, gatewayUrl, protoRoot, accounts, artifactDir }) {
  const decode = (name, bytes) => {
    const type = protoRoot.lookupType(`sanguo.${name}`);
    return type.toObject(type.decode(bytes), { longs: String, defaults: true });
  };
  const rows = [], failures = [], outcomes = [];
  let expected = null, label = 'opening', offline = false, favicon404 = false;
  const onError = () => failures.push('browser-error');
  const onConsole = msg => {
    if (msg.type() !== 'error') return;
    if (offline && msg.text().includes('net::ERR_INTERNET_DISCONNECTED')) return;
    if (favicon404 && msg.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)' && new URL(msg.location().url).pathname === '/favicon.ico') return;
    onError();
  };
  const onResponse = res => {
    if (res.status() === 404 && new URL(res.url()).pathname === '/favicon.ico') favicon404 = true;
    else if (res.status() >= 400) onError();
  };
  const onSocket = socket => {
    if (socket.url() !== gatewayUrl) { failures.push('unexpected-websocket'); return; }
    const pending = new Map();
    let token = '';
    socket.on('framesent', ({ payload }) => {
      try {
        const packet = decode('common.v1.ClientPacket', payload), route = packet.route;
        const row = { label, route, serverId: packet.server_id, code: null };
        rows.push(row); pending.set(packet.trace_id, row);
        if (route === 'account.v1.Login') {
          const input = decode(`${route}Request`, packet.payload);
          row.matchesInput = !!expected && input.login_name === expected.login && input.password === expected.password && input.server_id === expected.serverId;
        }
        if (['account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState'].includes(route)) row.sameSession = !!token && packet.session_id === token;
        if (route === 'domestic.v1.GetCityState') row.cityId = decode(`${route}Request`, packet.payload).city_id;
      } catch { failures.push('request-decode'); }
    });
    socket.on('framereceived', ({ payload }) => {
      try {
        const packet = decode('common.v1.ServerPacket', payload), row = pending.get(packet.trace_id);
        if (!row) return;
        row.code = packet.code; pending.delete(packet.trace_id);
        if (packet.code) return;
        if (['account.v1.Login', 'account.v1.EnterGameServer'].includes(row.route)) {
          const response = decode(`${row.route}Response`, packet.data);
          token = response.session_id;
          row.playerId = response.player?.player_id;
          row.playerServerId = response.player?.server_id;
          if (row.route === 'account.v1.EnterGameServer') row.accountId = response.account_id;
        }
        if (row.route === 'world.v1.ListPlayerCities') row.cityIds = decode(`${row.route}Response`, packet.data).cities.map(city => city.city_id);
      } catch { failures.push('response-decode'); }
    });
  };
  page.on('websocket', onSocket); page.on('pageerror', onError);
  page.on('console', onConsole); page.on('response', onResponse);
  const form = page.locator('form[data-role="existing-account"]');
  const password = form.locator('input[name="password"]');
  const open = async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator(`li[data-server-id="${accounts.a.serverId}"]:not(.disabled)`).waitFor();
    assert.ok((await password.inputValue()) === '', 'password was not cleared after reload');
  };
  const capture = async name => {
    assert.ok(!(await password.count()) || !(await password.inputValue()), 'refuse secret-bearing screenshot');
    await page.screenshot({ path: join(artifactDir, `${name}.png`) });
  };
  const enter = async (name, account, expectedOutcome, keyboard = false, demo = false) => {
    label = name; expected = account; const start = rows.length;
    await page.locator(`li[data-server-id="${account.serverId}"]`).click();
    if (!demo) {
      await form.locator('input[name="login"]').fill(account.login);
      await page.keyboard.press('Tab');
      assert.equal(await password.evaluate(el => el === document.activeElement), true, 'Tab must reach password');
      await password.fill(account.password);
    }
    const button = page.locator(`[data-action="${demo ? 'enter-game' : 'login-existing'}"]`);
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox(), viewport = page.viewportSize();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'login button clipped');
    if (keyboard) await password.press('Enter');
    else await button.dblclick();
    if (expectedOutcome === 'city') {
      await page.locator('[data-action="toggle-military"]:visible').waitFor();
      await page.waitForFunction(city => document.getElementById('hud')?.textContent.includes(city), account.cityName);
    } else {
      await page.waitForFunction(text => document.querySelector('.server-select-panel [data-role="status"]')?.textContent.includes(text), expectedOutcome === 'empty' ? '首次建城流程尚未开放' : '登录未完成');
      assert.ok((await password.inputValue()) === '', 'password was not cleared after failure');
      assert.equal(await page.locator('[data-action="toggle-military"]').count(), 0, 'unexpected gameplay entry');
    }
    const observed = rows.slice(start), logins = observed.filter(row => row.route === 'account.v1.Login');
    const entryOrder = observed.filter(row => ['account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState'].includes(row.route)).map(row => row.route);
    assert.deepEqual(entryOrder.slice(0, expectedOutcome === 'bad' ? 1 : expectedOutcome === 'empty' ? 3 : 4), ['account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState'].slice(0, expectedOutcome === 'bad' ? 1 : expectedOutcome === 'empty' ? 3 : 4), 'wrong entry RPC order');
    assert.equal(logins.length, 1, 'repeated submit created extra Login');
    assert.ok(logins[0].matchesInput, 'wrong credentials/server or demo fallback');
    assert.equal(logins[0].code, expectedOutcome === 'bad' ? 20001 : 0);
    const entered = observed.find(row => row.route === 'account.v1.EnterGameServer');
    const listed = observed.find(row => row.route === 'world.v1.ListPlayerCities');
    if (expectedOutcome !== 'bad') {
      assert.ok(entered?.code === 0 && entered.accountId === String(account.accountId) && entered.playerId === String(account.playerId) && entered.playerServerId === account.serverId, 'wrong authenticated actor');
      assert.deepEqual(listed?.cityIds, expectedOutcome === 'empty' ? [] : [String(account.cityId)]);
      assert.ok(observed.filter(row => row.sameSession !== undefined).every(row => row.sameSession && row.serverId === account.serverId), 'stale actor/session request');
    } else assert.ok(!entered && !listed, 'continued after failed login');
    const state = observed.find(row => row.route === 'domestic.v1.GetCityState');
    if (expectedOutcome === 'city') assert.ok(state?.code === 0 && state.cityId === String(account.cityId), 'wrong city state');
    else assert.ok(!state, 'loaded state without an owned city');
    assert.equal(await page.evaluate(secrets => [localStorage, sessionStorage].some(store => Object.values(store).some(value => secrets.some(secret => value.includes(secret)))), [account.password, account.login]), false, 'credentials saved in web storage');
    outcomes.push({ name, outcome: expectedOutcome, accountId: account.accountId, playerId: account.playerId, cityId: account.cityId ?? null });
    await capture(name);
  };
  await mkdir(artifactDir, { recursive: true });
  try {
    assert.ok(accounts.a.accountId !== accounts.b.accountId && accounts.a.playerId !== accounts.b.playerId && accounts.a.cityId !== accounts.b.cityId, 'fixtures must be distinct');
    await open(); await capture('form');
    await password.fill(accounts.a.password); await page.keyboard.press('Escape');
    assert.ok((await password.inputValue()) === '', 'password was not cleared on dismissal');
    assert.equal(await page.locator('[data-role="server-select-trigger"]').evaluate(el => el === document.activeElement), true);
    await page.locator('[data-role="server-select-trigger"]').click();
    await enter('account-a', accounts.a, 'city');
    await open(); await enter('wrong-password', { ...accounts.a, password: `${accounts.a.password}-wrong` }, 'bad', true);
    await enter('no-city', accounts.empty, 'empty', true);
    await enter('account-b', accounts.b, 'city');
    offline = true;
    await page.context().setOffline(true);
    try { await assert.rejects(page.goto(baseUrl), /ERR_INTERNET_DISCONNECTED/); }
    finally { await page.context().setOffline(false); offline = false; }
    await open(); await enter('network-recovered', accounts.a, 'city', true);
    await open(); await enter('legacy-demo', accounts.demo, 'city', false, true);
    assert.ok(!rows.some(row => ['account.v1.Register', 'world.v1.CreateCity'].includes(row.route)), 'browser attempted provisioning');
    assert.deepEqual(failures, [], 'browser or decode error');
    return { viewport: page.viewportSize(), outcomes, requests: rows };
  } catch (error) {
    let message = String(error?.message ?? error);
    for (const account of Object.values(accounts)) {
      for (const secret of [account.password, account.login]) if (secret) message = message.split(secret).join('[redacted]');
    }
    throw new Error(message);
  } finally {
    if (offline) await page.context().setOffline(false);
    page.off('websocket', onSocket); page.off('pageerror', onError);
    page.off('console', onConsole); page.off('response', onResponse);
    await writeFile(join(artifactDir, 'existing-account.json'), JSON.stringify({ viewport: page.viewportSize(), outcomes, requests: rows, failures }, null, 2));
  }
}
