/**
 * One-off VERIFY capture for ART-WALL-004. Requires: mock gateway, vite dev, playwright chromium.
 * Usage: node tools/verify-art-wall-004-screenshot.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs/verify/art-wall-004");
const MOCK_PORT = 19091;
const VITE_PORT = 5174;

/** Same CSS crop for DPR1 and DPR2 wall evidence (viewport-relative). */
const WALL_CROP = { x: 400, y: 40, width: 800, height: 320 };

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

async function readViewportMetadata(page, dpr) {
  return page.evaluate(
    ({ dpr, wallCrop }) => {
      const root = document.getElementById("game-viewport");
      const frame = document.getElementById("layout-frame");
      const canvas = document.getElementById("game");
      const rootRect = root?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      return {
        devicePixelRatio: window.devicePixelRatio,
        playwrightDeviceScaleFactor: dpr,
        cssViewport: rootRect ? { width: rootRect.width, height: rootRect.height } : null,
        layoutFrameCss: frameRect
          ? { width: frameRect.width, height: frameRect.height, left: frameRect.left, top: frameRect.top }
          : null,
        canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
        wallCropCss: wallCrop,
      };
    },
    { dpr, wallCrop: WALL_CROP },
  );
}

async function capture(dpr, name, metadataAcc) {
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
  const meta = await readViewportMetadata(page, dpr);
  metadataAcc[`dpr${dpr}`] = meta;
  await page.screenshot({
    path: path.join(outDir, name),
    clip: WALL_CROP,
    type: "png",
  });
  await browser.close();
}

async function captureFullStage() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  const frame = page.locator("#layout-frame");
  const box = await frame.boundingBox();
  if (!box) throw new Error("missing #layout-frame");
  await page.screenshot({
    path: path.join(outDir, "full-stage-dpr1.jpg"),
    type: "jpeg",
    quality: 78,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
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
    clip: WALL_CROP,
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
  const metadata = { wallCropCss: WALL_CROP, capturedAt: new Date().toISOString() };
  try {
    await waitForUrl(`http://127.0.0.1:${VITE_PORT}/`);
    await capture(1, "dpr1-wall.png", metadata);
    await capture(2, "dpr2-wall.png", metadata);
    await captureFullStage();
    await captureHallClick();
    await writeFile(path.join(outDir, "viewport-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
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
