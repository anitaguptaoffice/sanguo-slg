import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// All packets go to the actual gateway. Only the designated real registration receipt is dropped.
export async function runExplicitRegistrationScenario({ page, baseUrl, gatewayUrl, protoRoot, accounts, fresh, freshInterrupted, checkpoint, artifactDir }) {
  const requests = [], outcomes = [], failures = [];
  let label = 'form', expected, dropReceipt = false, interruptedAccountId, offline = false, currentSocket;
  const decode = (type, bytes) => protoRoot.lookupType(`sanguo.${type}`).toObject(
    protoRoot.lookupType(`sanguo.${type}`).decode(bytes), { longs: String, defaults: true });
  const id = value => { const result = Number(value); assert.ok(Number.isSafeInteger(result) && result > 0, 'invalid identity'); return result; };
  const allowed = ['account.v1.Register', 'account.v1.Login', 'account.v1.EnterGameServer', 'shard.v1.ListGameServers',
    'account.v1.ListGameServers', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState',
    'content.v1.ListPlayerMail', 'quest.v1.ListPlayerQuests', 'military.v1.ListBattleReports',
    'chat.v1.ListChatMessages', 'military.v1.ListMarches', 'hero.v1.ListPlayerHeroes'];
  const pageError = () => failures.push({ label, category: 'pageerror' });
  const consoleError = msg => { if (msg.type() === 'error' && !offline) failures.push({ label, category: 'console' }); };
  const responseError = res => { if (res.status() >= 400) failures.push({ label, category: 'http', status: res.status() }); };
  page.on('pageerror', pageError); page.on('console', consoleError); page.on('response', responseError);
  const routeSocket = client => {
    const server = client.connectToServer(), pending = new Map();
    currentSocket = { client, server };
    client.onMessage(bytes => {
      try {
        const packet = decode('common.v1.ClientPacket', bytes);
        assert.ok(allowed.includes(packet.route), 'unexpected request route');
        const row = { label, route: packet.route, code: null };
        if (['account.v1.Register', 'account.v1.Login'].includes(row.route)) {
          const input = decode(`${row.route}Request`, packet.payload);
          row.matchesInput = !!expected && input.login_name === expected.login && input.password === expected.password;
          if (row.route.endsWith('Login')) row.matchesInput &&= input.server_id === 1;
        }
        requests.push(row); pending.set(packet.trace_id, row); server.send(bytes);
      } catch { failures.push({ label, category: 'request-decode' }); }
    });
    server.onMessage(bytes => {
      try {
        const packet = decode('common.v1.ServerPacket', bytes), row = pending.get(packet.trace_id);
        if (row) {
          row.code = packet.code; pending.delete(packet.trace_id);
          if (!packet.code) {
            const data = decode(`${row.route}Response`, packet.data);
            if (row.route.endsWith('.Register')) row.accountId = id(data.account_id);
            if (row.route.endsWith('.Login') || row.route.endsWith('.EnterGameServer')) row.playerId = id(data.player.player_id);
            if (row.route.endsWith('.ListPlayerCities')) row.cityIds = data.cities.map(c => id(c.city_id));
          }
          if (dropReceipt && row.route === 'account.v1.Register' && row.code === 0) {
            row.dropped = true; interruptedAccountId = row.accountId;
            dropReceipt = false;
            void client.close(); void server.close();
            return;
          }
        }
        client.send(bytes);
      } catch { failures.push({ label, category: 'response-decode' }); }
    });
  };
  const form = page.locator('form[data-role="existing-account"]');
  const password = form.locator('input[name="password"]');
  const button = action => page.locator(`[data-action="${action}"]`);
  const notice = page.locator('[data-role="registration-status"]');
  const textWait = async (locator, text) => {
    await locator.waitFor();
    await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
      { selector: locator === notice ? '[data-role="registration-status"]' : '.server-select-panel [data-role="status"]', text });
  };
  const capture = async name => {
    assert.ok(!(await password.count()) || !(await password.inputValue()), 'refuse password-bearing screenshot');
    await page.screenshot({ path: join(artifactDir, `${name}.png`) });
  };
  const pass = name => outcomes.push({ name, outcome: 'pass' });
  const open = async name => {
    label = name; expected = null;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('li[data-server-id="1"]:not(.disabled)').waitFor();
    assert.equal(await password.inputValue(), '');
  };
  const fill = async account => {
    expected = account;
    await form.locator('input[name="login"]').fill(account.login);
    await page.keyboard.press('Tab');
    assert.equal(await password.evaluate(el => el === document.activeElement), true, 'keyboard focus misses password');
    await password.fill(account.password);
  };
  const visibleControl = async action => {
    await button(action).scrollIntoViewIfNeeded();
    const box = await button(action).boundingBox(), viewport = page.viewportSize();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'control clipped');
  };
  const only = (start, routes) => assert.deepEqual(requests.slice(start).map(row => row.route), routes, 'unexpected RPC order or side effect');
  const noStorage = async () => {
    const secrets = [fresh, freshInterrupted, ...Object.values(accounts)].flatMap(a => [a.login, a.password]);
    assert.equal(await page.evaluate(values => [localStorage, sessionStorage].some(store => Object.values(store).some(v => values.some(s => v.includes(s)))), secrets), false, 'credentials persisted');
  };
  const login = async (name, account, city = false, bad = false) => {
    label = name; await fill(account); const start = requests.length;
    await visibleControl('login-existing'); await password.press('Enter');
    if (city) {
      await page.locator('[data-action="toggle-military"]:visible').waitFor();
      await page.waitForFunction(name => document.getElementById('hud')?.textContent.includes(name), account.cityName);
    } else await textWait(page.locator('.server-select-panel [data-role="status"]'), bad ? '登录未完成' : '首次建城流程尚未开放');
    const rows = requests.slice(start), auth = rows.filter(r => r.route === 'account.v1.Login');
    assert.equal(auth.length, 1); assert.equal(auth[0].matchesInput, true); assert.equal(auth[0].code, bad ? 20001 : 0);
    const entryRoutes = ['account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'domestic.v1.GetCityState'];
    const entry = rows.filter(r => entryRoutes.includes(r.route)).map(r => r.route);
    assert.deepEqual(entry.slice(0, bad ? 1 : city ? 4 : 3), entryRoutes.slice(0, bad ? 1 : city ? 4 : 3));
    if (city) assert.ok(entry.slice(4).every(route => route === 'domestic.v1.GetCityState'), 'repeated authentication');
    if (!city) only(start, entryRoutes.slice(0, bad ? 1 : 3));
    if (!bad) {
      const entered = rows.find(r => r.route === 'account.v1.EnterGameServer');
      assert.equal(entered.playerId, auth[0].playerId);
      if (account.playerId) assert.equal(entered.playerId, Number(account.playerId));
      assert.deepEqual(rows.find(r => r.route === 'world.v1.ListPlayerCities').cityIds, city ? [Number(account.cityId)] : []);
    }
    if (!city) { assert.equal(await password.inputValue(), ''); assert.equal(await page.locator('[data-action="toggle-military"]').count(), 0); }
    await noStorage(); await capture(name); pass(name); return auth[0].playerId;
  };
  await mkdir(artifactDir, { recursive: true });
  try {
    await page.routeWebSocket(gatewayUrl, routeSocket);
    await open('form'); await visibleControl('register-account'); await capture('form'); pass('form');
    label = 'close-before-submit'; const idle = requests.length;
    await fill(fresh); await page.keyboard.press('Escape'); assert.equal(await password.inputValue(), '');
    assert.equal(await page.locator('[data-role="server-select-trigger"]').evaluate(el => el === document.activeElement), true);
    await page.locator('[data-role="server-select-trigger"]').click(); only(idle, []); pass(label);
    label = 'offline-before-submit'; offline = true;
    await page.context().setOffline(true);
    try {
      await currentSocket.server.close(); await currentSocket.client.close();
      await textWait(page.locator('.server-select-panel [data-role="status"]'), '连接已中断');
      await fill(fresh); assert.equal(await button('register-account').isDisabled(), true);
      await visibleControl('register-account'); const box = await button('register-account').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      only(idle, []); await page.keyboard.press('Escape'); assert.equal(await password.inputValue(), '');
    } finally { await page.context().setOffline(false); offline = false; }
    pass(label);
    await open('registered'); await fill(fresh); const start = requests.length;
    await visibleControl('register-account'); await button('register-account').dblclick();
    await textWait(notice, '账号已注册'); only(start, ['account.v1.Register']);
    const receipt = requests[start]; assert.equal(receipt.matchesInput, true); assert.equal(receipt.code, 0);
    assert.equal(await password.inputValue(), ''); assert.equal(await button('register-account').isDisabled(), true);
    const actor = { accountId: receipt.accountId };
    await checkpoint('registered', actor); await noStorage(); await capture('registered'); pass('registered');
    actor.playerId = await login('logged-in', fresh);
    assert.ok((await notice.innerText()).includes('本次注册未登录或建城'));
    assert.ok(!(await notice.innerText()).includes('尚未登录'));
    await checkpoint('logged-in', actor);
    await open('duplicate-name'); await fill(fresh); const duplicateStart = requests.length;
    await button('register-account').click();
    await page.waitForFunction(() => !document.querySelector('input[name="login"]').disabled);
    await textWait(notice, '注册结果尚未确认'); only(duplicateStart, ['account.v1.Register']);
    assert.ok(requests[duplicateStart].code !== 0 && requests[duplicateStart].code !== null);
    assert.equal(await button('register-account').isDisabled(), true); await capture(label); pass(label);
    await login('wrong-password', { ...fresh, password: `${fresh.password}-wrong` }, false, true);
    await open('known-a'); await login('known-a', accounts.a, true);
    await open('known-b'); await login('known-b', accounts.b, true);
    await open('lost-reply'); await fill(freshInterrupted); const interruptedStart = requests.length; dropReceipt = true;
    await button('register-account').click();
    await textWait(page.locator('.server-select-panel [data-role="status"]'), '连接已中断');
    await textWait(notice, '注册结果尚未确认');
    only(interruptedStart, ['account.v1.Register']); assert.ok(interruptedAccountId);
    assert.equal(await password.inputValue(), ''); assert.equal(await button('register-account').isDisabled(), true);
    await capture(label); pass(label);
    label = 'refresh-no-retry'; await page.keyboard.press('Escape');
    await page.locator('[data-role="server-select-trigger"]').click(); await button('refresh-servers').click();
    await page.locator('li[data-server-id="1"]:not(.disabled)').waitFor();
    await fill(freshInterrupted); assert.equal(await button('register-account').isDisabled(), true);
    await page.keyboard.press('Escape'); await page.locator('[data-role="server-select-trigger"]').click();
    assert.equal(await password.inputValue(), ''); await textWait(notice, '注册结果尚未确认');
    assert.equal(requests.slice(interruptedStart).filter(r => r.route === 'account.v1.Register').length, 1);
    await noStorage(); await capture(label); pass(label);
    await checkpoint('finished', { ...actor, interruptedAccountId });
    assert.deepEqual(failures, []); return { viewport: page.viewportSize(), requests, outcomes, failures };
  } catch {
    // Never let Playwright's filled-field diagnostic, SQL text or raw gateway error escape.
    throw new Error(`Registration scenario failed at ${label}; inspect sanitized evidence.`);
  } finally {
    if (offline) await page.context().setOffline(false);
    page.off('pageerror', pageError); page.off('console', consoleError); page.off('response', responseError);
    await writeFile(join(artifactDir, 'explicit-registration.json'), JSON.stringify({ viewport: page.viewportSize(), requests, outcomes, failures }, null, 2));
  }
}
