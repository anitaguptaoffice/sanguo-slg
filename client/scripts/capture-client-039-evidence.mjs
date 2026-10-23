/**
 * CLIENT-039 evidence: 1280×720 military open — full layout + top HUD crop (no canvas/DOM overlap).
 * Usage: node scripts/capture-client-039-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/client-039");

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
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 20000 },
  );
  await page.locator('[data-action="toggle-military"]').click();
  await page.waitForSelector(".military-panel:not(.hidden)", { timeout: 5000 });
  await page.waitForSelector('[data-role="hud-resources"]', { timeout: 5000 });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "inherit" });
  const appPort = 16202;
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 1500));
    await waitForHttp(`http://127.0.0.1:${appPort}/`);
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await enterMainCity(page, appPort);
    await page.waitForTimeout(600);

    const frame = await page.locator("#layout-frame").boundingBox();
    if (!frame) throw new Error("layout-frame box missing");
    await page.screenshot({
      path: path.join(outDir, "military-1280x720-dpr1-full.png"),
      clip: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      type: "png",
    });

    const hud = await page.locator("#hud").boundingBox();
    if (!hud) throw new Error("hud box missing");
    await page.screenshot({
      path: path.join(outDir, "military-1280x720-dpr1-top-hud.png"),
      clip: { x: hud.x, y: hud.y, width: hud.width, height: Math.min(hud.height + 8, 96) },
      type: "png",
    });

    await context.close();
    await browser.close();
    console.log(`Evidence written to ${outDir}`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
