/**
 * Combined main-city full-scene VERIFY panoramas (14 asset IDs / 34 PNGs).
 * Usage: node scripts/capture-art-full-scene-combined-verify.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const sampleRoot = path.resolve(clientRoot, "../docs/art/samples/art-full-scene-combined");
const outDir = path.resolve(sampleRoot, "screenshots");

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
    };
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "pipe" });
  const appPort = 16202;
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
      { key: "dpr1", name: "maincity-full-scene-1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
      { key: "dpr2", name: "maincity-full-scene-1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page, appPort);
      await page.waitForTimeout(800);
      const hud = await page.locator("#hud").textContent();
      const scaleTag = dpr >= 2 ? "2×" : "1×";
      if (!hud?.includes(`${scaleTag} @${dpr.toFixed(1)}dpr`)) {
        console.warn(`HUD DPR tag mismatch for ${name}: ${hud}`);
      }
      const frame = page.locator("#layout-frame");
      await frame.screenshot({ path: path.join(outDir, `${name}.png`) });
      const jpegQuality = key === "dpr2" ? 72 : 82;
      await frame.screenshot({
        path: path.join(outDir, `${name}.jpg`),
        type: "jpeg",
        quality: jpegQuality,
      });
      try {
        await frame.screenshot({
          path: path.join(outDir, `${name}.webp`),
          type: "webp",
          quality: jpegQuality,
        });
      } catch {
        /* optional */
      }
      viewportMeta[key] = {
        ...(await readViewportMetadata(page)),
        playwrightDeviceScaleFactor: dpr,
        layoutFrame: { w: LAYOUT_W, h: LAYOUT_H },
        hudSnippet: hud?.slice(0, 200),
      };
      await context.close();
    }
    await browser.close();

    const metaPath = path.resolve(sampleRoot, "viewport-metadata.json");
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          purpose: "组合场景终验 — full layout-frame panorama; per-item VERIFY PASSes are not global PASS",
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
