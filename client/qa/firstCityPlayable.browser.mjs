#!/usr/bin/env node
/** Local loopback smoke: register → login (no city) → V2 discover → submit → main city HUD.
 *  Requires `make dev-up`, `go run ./cmd/server`, and Vite with VITE_GATEWAY_WS_URL=ws://127.0.0.1:8080/ws */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = (process.env.QA_BASE_URL ?? 'http://127.0.0.1:5273').replace(/\/$/, '');
const healthUrl = process.env.QA_HEALTH_URL ?? 'http://127.0.0.1:8080/healthz';
const out = process.env.QA_OUT ?? '/tmp/first-city-playable';
const FIRST_CITY_REQUIRED = '此账号在所选服尚无城池；请先创建首城';
const chromiumPath = process.env.CHROMIUM_PATH ?? '/usr/lib/chromium/chromium';
mkdirSync(out, { recursive: true });

const stamp = Date.now();
const login = `fcqa${stamp}`;
const password = 'qaPass9!';
const cityName = `城${String(stamp).slice(-4)}`;

async function mustOk(url) {
  const res = await fetch(url);
  assert.equal(res.status, 200, `expected 200 from ${url}, got ${res.status}`);
}

await mustOk(healthUrl);
await mustOk(baseUrl);

const browser = await chromium.launch({ executablePath: chromiumPath, chromiumSandbox: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const report = { login, steps: [], errors: [] };
page.on('pageerror', (e) => report.errors.push(String(e)));

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('li[data-server-id="1"]:not(.disabled)').waitFor();
  report.steps.push('server-list');

  const form = page.locator('form[data-role="existing-account"]');
  await form.locator('input[name="login"]').fill(login);
  await form.locator('input[name="password"]').fill(password);
  await page.locator('[data-action="register-account"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-role="registration-status"]')?.textContent?.includes('账号已注册'),
  );
  report.steps.push('register');

  await form.locator('input[name="password"]').fill(password);
  await page.locator('[data-action="login-existing"]').click();
  await page.waitForFunction(
    (text) => document.querySelector('.server-select-panel [data-role="status"]')?.textContent?.includes(text),
    FIRST_CITY_REQUIRED,
  );
  report.steps.push('login-no-city');

  await page.waitForFunction(() => {
    const probe = document.querySelector('[data-role="first-city-probe"]');
    return probe && !probe.hidden;
  });
  await form.locator('input[name="password"]').fill(password);
  await page.locator('[data-action="discover-first-city"]').click();
  await page.locator('[data-role="first-city-command"]:not([hidden])').waitFor({ timeout: 60_000 });
  report.steps.push('discover');

  await form.locator('input[name="password"]').fill(password);
  await page.waitForFunction(() => !document.querySelector('[data-action="submit-first-city"]')?.disabled);
  await page.locator('input[name="fc-name"]').fill(cityName);
  await form.locator('input[name="password"]').fill(password);
  await page.locator('[data-action="submit-first-city"]').click();
  await page.locator('[data-action="toggle-military"]:visible').waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (name) => document.getElementById('hud')?.textContent?.includes(name),
    cityName,
  );
  report.steps.push('main-city');

  await page.screenshot({ path: `${out}/main-city.png` });
  report.passed = true;
} catch (e) {
  report.passed = false;
  report.failure = String(e);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

if (!report.passed) {
  console.error(report.failure ?? 'first-city playable smoke failed');
  process.exit(1);
}
console.log(JSON.stringify(report));
process.exit(0);