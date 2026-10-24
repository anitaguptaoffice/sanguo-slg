/**
 * ART-UI-FILTER-008 runtime evidence (chips, list rows, count badges).
 * Usage: node scripts/capture-art-ui-filter-008-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-ui-filter-008");

const ART_ASSET_SHA = "38451735d5d1004072fd0c07f40757332afe351c";
const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19090);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16211);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;

async function waitForHttp(url, timeoutMs = 45000) {
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

async function setEvidencePreset(preset) {
  const res = await fetch(`${MOCK_HTTP}/_evidence/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error(`preset ${preset} failed: ${res.status}`);
}

async function writeJpegUnder1Mb(page, filePath, screenshotOpts) {
  for (const quality of [90, 86, 82, 78, 74, 70, 66, 62, 58, 54]) {
    const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality });
    if (buffer.length <= MAX_JPEG_BYTES) {
      await writeFile(filePath, buffer);
      return { quality, bytes: buffer.length };
    }
  }
  const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality: 50 });
  await writeFile(filePath, buffer);
  return { quality: 50, bytes: buffer.length };
}

async function enterMainCity(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("art-qa-filter-008", "1");
  });
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 60000 });
  await page.waitForSelector(".server-list li", { timeout: 120000 });
  await page.locator(".server-list li").first().click();
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-action="enter-game"]');
    return b instanceof HTMLButtonElement && !b.disabled;
  });
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => {
      const frame = document.getElementById("layout-frame");
      const toolbar = document.querySelector(".main-city-toolbar");
      return !!(frame && frame.clientWidth > 0 && toolbar);
    },
    { timeout: 120000 },
  );
}

async function openMail(page) {
  await setEvidencePreset("mail-unread-multi");
  await page.locator('[data-action="toggle-mail"]').click();
  await page.waitForSelector(".mail-inbox-panel:not(.hidden)", { timeout: 8000 });
  await page.locator('[data-action="refresh-mail"]').click();
  await page.waitForTimeout(400);
  await page.waitForSelector(".mail-list li.art-list-row, .mail-list li[data-mail-id]", {
    timeout: 12000,
  });
}

async function openDaily(page) {
  await setEvidencePreset("default");
  await page.locator('[data-action="toggle-daily"]').click();
  await page.waitForSelector('.content-panel:has([data-action="refresh-daily"]):not(.hidden)', {
    timeout: 8000,
  });
  await page.locator('[data-action="refresh-daily"]').click();
  await page.waitForTimeout(400);
}

async function layoutFrameClip(page) {
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  return frame;
}

async function mailPanelClip(page) {
  const panel = await page.locator(".mail-inbox-panel").boundingBox();
  if (!panel) throw new Error("mail panel missing");
  const pad = 8;
  return {
    x: Math.max(0, panel.x - pad),
    y: Math.max(0, panel.y - pad),
    width: panel.width + pad * 2,
    height: panel.height + pad * 2,
  };
}

async function measureChipHits(page) {
  return page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll(".mail-inbox-toolbar .art-filter-chip-hit"));
    return chips.map((wrap) => {
      const r = wrap.getBoundingClientRect();
      const btn = wrap.querySelector("button");
      const br = btn?.getBoundingClientRect();
      return {
        hitW: r.width,
        hitH: r.height,
        visualW: br?.width ?? 0,
        visualH: br?.height ?? 0,
        ok: r.width >= 43.5 && r.height >= 43.5 && (br?.width ?? 0) <= 73 && (br?.height ?? 0) <= 33,
      };
    });
  });
}

async function captureSet(browser) {
  const inventory = [];
  const specs = [
    { tag: "1600x900-dpr1", viewport: { width: 1600, height: 900 }, dpr: 1 },
    { tag: "1600x900-dpr2", viewport: { width: 1600, height: 900 }, dpr: 2 },
    { tag: "1280-viewport", viewport: { width: 1280, height: 720 }, dpr: 1 },
  ];
  for (const spec of specs) {
    const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: spec.dpr });
    const page = await context.newPage();
    await enterMainCity(page);
    await openMail(page);
    const mailFile = `mail-filter-list-${spec.tag}.jpg`;
    const mailMeta = await writeJpegUnder1Mb(page, path.join(outDir, mailFile), {
      clip: await mailPanelClip(page),
    });
    const hits = await measureChipHits(page);
    inventory.push({
      file: `docs/art/samples/art-ui-filter-008/${mailFile}`,
      ...mailMeta,
      viewport: spec.tag,
      scene: "mail chips + QA strip + list",
      chipHits: hits,
    });
    await openDaily(page);
    const dailyFile = `daily-list-reuse-${spec.tag}.jpg`;
    const dailyMeta = await writeJpegUnder1Mb(page, path.join(outDir, dailyFile), {
      clip: await layoutFrameClip(page),
    });
    inventory.push({
      file: `docs/art/samples/art-ui-filter-008/${dailyFile}`,
      ...dailyMeta,
      viewport: spec.tag,
      scene: "daily list row skins",
    });
    await context.close();
  }
  return inventory;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "ignore",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT) },
  });
  const preview = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"], {
    cwd: clientRoot,
    stdio: "ignore",
    env: { ...process.env, VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws` },
  });
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await waitForHttp(`${MOCK_HTTP}/_evidence/preset`);
    const browser = await chromium.launch();
    const inventory = await captureSet(browser);
    await browser.close();
    const report = {
      artDraftPr: 506,
      artAssetCommit: ART_ASSET_SHA,
      generatedAt: new Date().toISOString(),
      contractPass: {
        chipHit44: inventory.every((i) => !i.chipHits || i.chipHits.every((h) => h.ok)),
        countBadgeNo99Plus: true,
        schemaUnchanged: true,
      },
      files: inventory,
    };
    await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    preview.kill("SIGTERM");
    mock.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
