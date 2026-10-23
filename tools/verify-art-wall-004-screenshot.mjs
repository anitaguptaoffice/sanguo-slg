/**
 * One-off VERIFY capture for ART-WALL-004. Requires: mock gateway, vite dev, playwright chromium.
 * Usage: node tools/verify-art-wall-004-screenshot.mjs
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs/verify/art-wall-004");
const MOCK_PORT = 19091;
const VITE_PORT = 5174;

function waitForUrl(url, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) reject(new Error(`timeout waiting for ${url}`));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

function spawnProc(cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  return child;
}

async function enterMainCity(page) {
  await page.goto(`http://127.0.0.1:${VITE_PORT}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#hud")?.textContent?.includes("加载资源") === false, {
    timeout: 30_000,
  });
  const serverLi = page.locator(".server-list li").first();
  await serverLi.waitFor({ timeout: 15_000 });
  await serverLi.click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.querySelector("#hud")?.textContent?.includes("主城") || document.querySelector("#hud")?.textContent?.includes("粮"),
    { timeout: 30_000 },
  );
  await page.waitForTimeout(800);
}

async function capture(dpr, name) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  const hud = await page.locator("#hud").innerText();
  if (!hud.includes(`art ${dpr}×`)) {
    console.warn(`HUD tag mismatch at DPR ${dpr}: ${hud}`);
  }
  await page.screenshot({
    path: path.join(outDir, name),
    clip: { x: 400, y: 40, width: 800, height: 320 },
    type: "png",
  });
  await browser.close();
}

async function captureHallClick() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  const scaleX = box.width / 1600;
  const scaleY = box.height / 900;
  const hx = box.x + 800 * scaleX;
  const hy = box.y + 220 * scaleY;
  await page.mouse.click(hx, hy);
  await page.waitForTimeout(300);
  const hud = await page.locator("#hud").innerText();
  if (!hud.includes("城主府") && !hud.includes("选中")) {
    console.warn(`unexpected HUD after hall click: ${hud}`);
  }
  await page.screenshot({
    path: path.join(outDir, "z-hit-hall.png"),
    clip: { x: 400, y: 40, width: 800, height: 320 },
    type: "png",
  });
  await browser.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawnProc("node", ["client/mock-server/server.mjs"], { MOCK_GATEWAY_PORT: String(MOCK_PORT) });
  const vite = spawn("npm", ["run", "dev", "--", "--port", String(VITE_PORT), "--host", "127.0.0.1"], {
    cwd: path.join(root, "client"),
    env: { ...process.env, VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws` },
    stdio: "ignore",
  });
  try {
    await waitForUrl(`http://127.0.0.1:${VITE_PORT}/`);
    await capture(1, "dpr1-wall.png");
    await capture(2, "dpr2-wall.png");
    await captureHallClick();
    console.log("screenshots written to", outDir);
  } finally {
    mock.kill();
    vite.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
