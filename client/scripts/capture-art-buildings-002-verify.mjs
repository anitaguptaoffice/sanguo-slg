/**
 * ART-BUILDINGS-002 engineering verification screenshots.
 * Usage: node scripts/capture-art-buildings-002-verify.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const sampleRoot = path.resolve(clientRoot, "../docs/art/samples/art-buildings-002");
const outDir = path.resolve(sampleRoot, "screenshots");

/** Layout-frame coords (1600×900); same CSS-equivalent crop at DPR1/DPR2 when frame is 1:1. */
const FOUR_BUILDINGS_CROP_LAYOUT = {
  x: 240,
  y: 300,
  width: 1200,
  height: 420,
};

const LAYOUT_W = 1600;
const LAYOUT_H = 900;

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
      layoutFrameCss: frameRect
        ? { width: frameRect.width, height: frameRect.height, left: frameRect.left, top: frameRect.top }
        : null,
      canvasBacking: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasCss: frameRect ? { width: frameRect.width, height: frameRect.height } : null,
    };
  });
}

/** Document-space clip for a layout-frame crop rect. */
async function layoutCropToDocumentClip(page, cropLayout) {
  const frame = page.locator("#layout-frame");
  const box = await frame.boundingBox();
  if (!box) throw new Error("missing #layout-frame bounding box");
  const sx = box.width / LAYOUT_W;
  const sy = box.height / LAYOUT_H;
  return {
    x: box.x + cropLayout.x * sx,
    y: box.y + cropLayout.y * sy,
    width: cropLayout.width * sx,
    height: cropLayout.height * sy,
  };
}

async function screenshotLossyClip(page, clip, { jpegPath, webpPath, quality = 82 }) {
  await page.screenshot({ path: jpegPath, type: "jpeg", quality, clip });
  try {
    await page.screenshot({ path: webpPath, type: "webp", quality });
  } catch {
    /* playwright webp optional */
  }
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
  const viewportMeta = {};
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    const browser = await chromium.launch();
    for (const { key, name, width, height, dpr } of [
      { key: "dpr1", name: "maincity-four-slots-1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
      { key: "dpr2", name: "maincity-four-slots-1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
      { key: "dpr1-1280", name: "maincity-four-slots-1280x720-dpr1", width: 1280, height: 720, dpr: 1 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await page.waitForTimeout(800);
      const hud = await page.locator("#hud").textContent();
      if (key !== "dpr1-1280") {
        const scaleTag = dpr >= 2 ? "2×" : "1×";
        if (!hud?.includes(`${scaleTag} @${dpr.toFixed(1)}dpr`)) {
          console.warn(`HUD DPR tag mismatch for ${name}: ${hud}`);
        }
      }
      const pngPath = path.join(outDir, `${name}.png`);
      await page.locator("#layout-frame").screenshot({ path: pngPath });
      if (key === "dpr1" || key === "dpr2") {
        const jpgFull = path.join(outDir, `${name}-full.jpg`);
        const webpFull = path.join(outDir, `${name}-full.webp`);
        await page.locator("#layout-frame").screenshot({
          path: jpgFull,
          type: "jpeg",
          quality: 82,
        });
        try {
          await page.locator("#layout-frame").screenshot({ path: webpFull, type: "webp", quality: 82 });
        } catch {
          /* optional */
        }
        const cropClip = await layoutCropToDocumentClip(page, FOUR_BUILDINGS_CROP_LAYOUT);
        const cropBase = `${name}-four-buildings-crop`;
        await screenshotLossyClip(page, cropClip, {
          jpegPath: path.join(outDir, `${cropBase}.jpg`),
          webpPath: path.join(outDir, `${cropBase}.webp`),
        });
        const meta = await readViewportMetadata(page);
        viewportMeta[key] = {
          ...meta,
          playwrightDeviceScaleFactor: dpr,
          fourBuildingsCropLayout: FOUR_BUILDINGS_CROP_LAYOUT,
          fourBuildingsCropCss: cropClip,
        };
      }
      await context.close();
    }

    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await enterMainCity(page, appPort);
    const canvas = page.locator("#game");
    const box = await canvas.boundingBox();
    if (box) {
      const layoutX = 480;
      const layoutY = 400;
      const cssX = (layoutX / LAYOUT_W) * box.width;
      const cssY = (layoutY / LAYOUT_H) * box.height;
      await page.mouse.click(box.x + cssX, box.y + cssY);
      await page.waitForTimeout(400);
      await page.locator("#layout-frame").screenshot({
        path: path.join(outDir, "hit-test-lumber-selected.png"),
      });
    }
    await context.close();
    await browser.close();

    const metaPath = path.resolve(sampleRoot, "viewport-metadata.json");
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          fourBuildingsCropLayout: FOUR_BUILDINGS_CROP_LAYOUT,
          note: "fourBuildingsCropCss is document viewport coords; identical layout crop at DPR1/DPR2 on 1600×900 CSS viewport",
          ...viewportMeta,
        },
        null,
        2,
      ),
    );
    console.log(`Screenshots written to ${outDir}`);
    console.log(`viewport-metadata.json written to ${metaPath}`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
