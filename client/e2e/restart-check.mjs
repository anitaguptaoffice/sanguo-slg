/**
 * Local R0-3 acceptance: a durable troop recruit survives a real server restart.
 * Usage: APP_URL=... CHROMIUM_PATH=... RESTART_SH=/tmp/opencode/restart-server.sh node /tmp/opencode/restart-check.mjs
 */
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:4173";
const HEALTH_URL = process.env.HEALTH_URL ?? "http://127.0.0.1:8080/healthz";
const RESTART_SH = process.env.RESTART_SH;
if (!RESTART_SH) throw new Error("RESTART_SH required");

const log = (msg) => console.log(`[restart-check] ${msg}`);

async function enterCity(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#hud", { timeout: 30000 });
  await page.waitForSelector(".server-list li", { timeout: 30000 });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForSelector('[data-action="toggle-military"]', { timeout: 45000 });
}

async function openQueue(page) {
  await page.locator('[data-action="toggle-queue"]').click();
  await page.waitForSelector('[data-center-panel="queue"]:not(.hidden)', { timeout: 15000 });
  await page.waitForTimeout(1200);
  return page.locator('[data-role="queue-recruit-list"]').innerText();
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

try {
  await enterCity(page);
  log("entered main city");

  await page.locator('[data-action="toggle-military"]').click();
  await page.waitForSelector('[data-center-panel="military"]:not(.hidden)', { timeout: 15000 });
  await page.locator('[data-field="recruit-count"]').fill("7");
  await page.locator('[data-action="recruit"]').click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-role="prepared-recruit-status"]');
      return el && /募兵|招募|队列|完成/.test(el.textContent ?? "") && !/失败/.test(el.textContent ?? "");
    },
    { timeout: 30000 },
  );
  const statusBefore = (await page.locator('[data-role="prepared-recruit-status"]').innerText()).trim();
  log(`recruit accepted: ${statusBefore}`);

  const queueBefore = await openQueue(page);
  if (!/\d/.test(queueBefore)) throw new Error(`no recruit queue row before restart: ${JSON.stringify(queueBefore)}`);
  log(`queue before restart: ${queueBefore.replace(/\s+/g, " ")}`);

  execFileSync("bash", [RESTART_SH], { stdio: "inherit" });
  log("server restarted");

  await enterCity(page);
  const queueAfter = await openQueue(page);
  log(`queue after restart: ${queueAfter.replace(/\s+/g, " ")}`);

  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  if (normalize(queueAfter) !== normalize(queueBefore)) {
    throw new Error(`recruit queue changed across restart:\n before=${normalize(queueBefore)}\n after =${normalize(queueAfter)}`);
  }
  const health = await (await fetch(HEALTH_URL)).json();
  if (health.march_restore !== "ready") throw new Error(`restore not ready after restart: ${JSON.stringify(health)}`);

  await page.screenshot({ path: "/tmp/opencode/restart-check-after.png" });
  log("PASS — durable recruit survived a real gateway restart");
} finally {
  await browser.close();
  if (errors.length) console.log(`[restart-check] page errors: ${errors.join(" | ")}`);
}
