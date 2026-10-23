/**
 * VERIFY ART-ICONS-003: HUD resource icons at DPR1/DPR2.
 * Usage: node scripts/capture-art-icons-003-verify.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-icons-003/verify-screenshots");

const HUD_CROP_W = 520;
const HUD_CROP_H = 56;

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function enterMainCity(page, appPort) {
  await page.goto(`http://127.0.0.1:${appPort}/`);
  await page.waitForSelector("#hud", { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 20000,
  });
  const server = page.locator(".server-list li").first();
  await server.waitFor({ timeout: 10000 });
  await server.click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 20000 },
  );
}

async function probeTextureScales(page, appPort, dpr) {
  return page.evaluate(async ({ dpr, appPort: port }) => {
    const res = await fetch(`http://127.0.0.1:${port}/assets/art/v1/manifest.json`);
    const manifest = await res.json();
    const ids = ["res.icon.food.v1", "res.icon.wood.v1", "res.icon.iron.v1", "res.icon.stone.v1"];
    const want = dpr >= 1.5 ? 2 : 1;
    const out = {};
    for (const id of ids) {
      const asset = manifest.assets.find((a) => a.id === id);
      const variant = asset?.variants?.find((v) => v.scale === want);
      const url = `/assets/art/v1/${variant?.path ?? ""}`;
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      out[id] = {
        scale: want,
        path: variant?.path,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }
    return out;
  }, { dpr, appPort });
}

async function readViewportMetadata(page) {
  return page.evaluate(() => {
    const root = document.getElementById("game-viewport");
    const frame = document.getElementById("layout-frame");
    const canvas = document.getElementById("game");
    const rootRect = root?.getBoundingClientRect();
    const frameRect = frame?.getBoundingClientRect();
    return {
      devicePixelRatio: window.devicePixelRatio,
      cssViewport: rootRect ? { width: rootRect.width, height: rootRect.height } : null,
      layoutFrameCss: frameRect ? { width: frameRect.width, height: frameRect.height, left: frameRect.left, top: frameRect.top } : null,
      canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasCss: frameRect ? { width: frameRect.width, height: frameRect.height } : null,
    };
  });
}

async function screenshotHudCrop(page, jpegPath) {
  const frame = page.locator("#layout-frame");
  const box = await frame.boundingBox();
  if (!box) throw new Error("missing #layout-frame bounding box");
  await page.screenshot({
    path: jpegPath,
    type: "jpeg",
    quality: 82,
    clip: {
      x: box.x,
      y: box.y,
      width: Math.min(HUD_CROP_W, box.width),
      height: Math.min(HUD_CROP_H, box.height),
    },
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "pipe" });
  const appPort = 16201;
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "pipe",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  const dprProbe = {};
  const viewportMeta = {};
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    const browser = await chromium.launch();
    for (const { name, width, height, dpr } of [
      { name: "hud-resources-dpr1", width: 1600, height: 900, dpr: 1 },
      { name: "hud-resources-dpr2", width: 1600, height: 900, dpr: 2 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await page.waitForTimeout(800);
      const pngPath = path.join(outDir, `${name}.png`);
      await page.locator("#layout-frame").screenshot({ path: pngPath });
      await screenshotHudCrop(page, path.join(outDir, `${name}-hud-crop.jpg`));
      dprProbe[name] = await probeTextureScales(page, appPort, dpr);
      viewportMeta[name] = await readViewportMetadata(page);
      await context.close();
    }
    await browser.close();
    const probePath = path.join(outDir, "dpr-probe.json");
    await writeFile(probePath, JSON.stringify(dprProbe, null, 2));
    const metaPath = path.join(outDir, "viewport-metadata.json");
    await writeFile(metaPath, JSON.stringify(viewportMeta, null, 2));
    console.log(`Screenshots written to ${outDir}`);
    console.log(JSON.stringify({ dprProbe, viewportMeta }, null, 2));
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
