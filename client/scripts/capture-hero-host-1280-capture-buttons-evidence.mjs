/**
 * Post-fix regression evidence: 1280×720 DPR1 captive/persuade/coming action buttons in clip (#1237).
 *
 * Usage:
 *   cd client && npx playwright install chromium
 *   node scripts/capture-hero-host-1280-capture-buttons-evidence.mjs
 *
 * Optional: HERO_TEMPLATE_CFG_ID=1001
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  installHeroHostCaptureProbes,
  prepareHeroHostEvidenceChromeInPage,
  probeHeroPortraitFramesInPage,
  scrollHeroDetailHeadInPage,
} from "./lib/hero-host-capture-probes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const SAMPLE_ROOT = path.resolve(repoRoot, "docs/art/samples/hero-host-1280-capture-buttons");
const FIX_MERGE_SHA =
  process.env.FIX_MERGE_SHA || "12f06e78230fce6cf017f399fbcbb26d10778f98";
const TEMPLATE_CFG_ID = Number(process.env.HERO_TEMPLATE_CFG_ID || 1001);

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19128);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16248);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster";

const VIEWPORT = {
  tag: "1280x720-dpr1",
  file: "hero-host-1280x720-dpr1.jpg",
  sectionsFile: "hero-host-1280x720-dpr1-capture-sections.jpg",
  width: 1280,
  height: 720,
  dpr: 1,
};

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

async function writeJpegUnder1Mb(page, filePath, screenshotOpts = {}) {
  for (const quality of [88, 84, 80, 76, 72, 68, 64, 60, 56, 52]) {
    const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality });
    if (buffer.length <= MAX_JPEG_BYTES) {
      await writeFile(filePath, buffer);
      return { quality, bytes: buffer.length };
    }
  }
  const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality: 48 });
  await writeFile(filePath, buffer);
  return { quality: 48, bytes: buffer.length };
}

function gitTipSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function gitBlobSha(relPath) {
  try {
    return execSync(`git hash-object ${relPath}`, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function sha256File(absPath) {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

async function enterMainCity(page) {
  page.setDefaultTimeout(90000);
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.waitForSelector(".server-list li", { timeout: 25000 });
  await page.waitForFunction(
    () => document.querySelector('[data-role="status"]')?.textContent?.includes("共"),
    { timeout: 25000 },
  );
  await page.locator(".server-list li").first().click();
  await page.waitForSelector('[data-action="enter-game"]:not([disabled])');
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-action="toggle-hero"]') != null &&
      document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 90000 },
  );
  await page.waitForSelector(".main-city-toolbar.art-chrome-toolbar", { timeout: 15000 });
}

async function openHeroPanelWithDetail(page, templateCfgId) {
  await page.locator('[data-action="toggle-hero"]').click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR}:not(.hidden)`, { timeout: 10000 });
  await page.locator('[data-action="refresh-heroes"]').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const host = document.querySelector('[data-role="hero-recruit-host"]');
    if (host instanceof HTMLDetailsElement) host.open = false;
  });
  const heroRow = page
    .locator(
      `${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id][data-template-cfg-id="${templateCfgId}"]`,
    )
    .first();
  const fallback = page.locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id]`).first();
  const row = (await heroRow.count()) > 0 ? heroRow : fallback;
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-detail-name`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-attr-table`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-capture-sections-row"]`, {
    timeout: 8000,
  });
  await prepareHeroHostEvidenceChromeInPage(page);
  await scrollHeroDetailHeadInPage(page);
  await page.waitForTimeout(350);
}

async function captureEvidence(browser, tipSha) {
  const outDir = path.resolve(SAMPLE_ROOT, "runtime");
  await mkdir(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
    deviceScaleFactor: VIEWPORT.dpr,
  });
  const page = await context.newPage();
  await installHeroHostCaptureProbes(page);
  await enterMainCity(page);
  await openHeroPanelWithDetail(page, TEMPLATE_CFG_ID);

  const fullPath = path.join(outDir, VIEWPORT.file);
  const sectionsPath = path.join(outDir, VIEWPORT.sectionsFile);
  const sectionsLocator = page.locator('[data-role="hero-capture-sections-row"]');

  const fullJpeg = await writeJpegUnder1Mb(page, fullPath, { fullPage: false });
  const sectionsShotOpts = { fullPage: false };
  if ((await sectionsLocator.count()) > 0) {
    const box = await sectionsLocator.first().boundingBox();
    if (box) sectionsShotOpts.clip = box;
  }
  const sectionsJpeg = await writeJpegUnder1Mb(page, sectionsPath, sectionsShotOpts);

  const probe = await probeHeroPortraitFramesInPage(page, TEMPLATE_CFG_ID, {});
  await context.close();

  const heroMailPanelsBlob = gitBlobSha("client/src/ui/HeroMailPanels.ts");
  const indexHtmlBlob = gitBlobSha("client/index.html");
  const probeLog = {
    task: "HERO-HOST-1280-CAPTURE-BUTTONS",
    template_cfg_id: TEMPLATE_CFG_ID,
    mock_preset: PRESET,
    fix_merge_sha: FIX_MERGE_SHA,
    evidence_head_sha: tipSha,
    tip_sha: tipSha,
    runtime_code_sha: tipSha,
    hero_mail_panels_blob_sha: heroMailPanelsBlob,
    index_html_blob_sha: indexHtmlBlob,
    probes: {
      [VIEWPORT.tag]: probe,
    },
    shots: {
      [VIEWPORT.file]: { ...fullJpeg, viewport: VIEWPORT },
      [VIEWPORT.sectionsFile]: { ...sectionsJpeg, viewport: VIEWPORT, crop: "hero-capture-sections-row" },
    },
    notes: [
      "Post-fix regression for #1237: 1280 narrow captive/persuade/coming action buttons fully in visible clip.",
      "Not Slice10 character-batch captures; do not conflate with hero-host-slice10/runtime/* @ pre-fix tips.",
      "#108 handoff: probes['1280x720-dpr1'].captureSectionButtonsInClip.ok must be true.",
    ],
    captured_at: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, "probe-log.json"), JSON.stringify(probeLog, null, 2));

  const buttonsOk = probe?.captureSectionButtonsInClip?.ok === true;
  if (!buttonsOk) {
    console.error("captureSectionButtonsInClip probe failed", probe?.captureSectionButtonsInClip);
    return false;
  }

  const inventory = [
    "# HERO-HOST 1280 capture-section buttons evidence",
    "",
    `fix_merge_sha (#1237): \`${FIX_MERGE_SHA}\``,
    `evidence_head_sha / tip_sha / runtime_code_sha: \`${tipSha}\``,
    `template_cfg_id: ${TEMPLATE_CFG_ID}`,
    "",
    "## Files",
    "",
    `- \`runtime/${VIEWPORT.file}\` — sha256 \`${await sha256File(fullPath)}\`, ${fullJpeg.bytes} bytes`,
    `- \`runtime/${VIEWPORT.sectionsFile}\` — sha256 \`${await sha256File(sectionsPath)}\`, ${sectionsJpeg.bytes} bytes`,
    `- \`runtime/probe-log.json\``,
    "",
    "## Probe (capture buttons)",
    "",
    "```json",
    JSON.stringify(probe.captureSectionButtonsInClip, null, 2),
    "```",
  ].join("\n");
  await writeFile(path.join(SAMPLE_ROOT, "INVENTORY.md"), inventory);

  return true;
}

async function main() {
  await setEvidencePreset(PRESET).catch(() => {});

  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT), MOCK_EVIDENCE_PRESET: PRESET },
  });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws` },
    },
  );

  try {
    await new Promise((r) => setTimeout(r, 4500));
    await waitForHttp(`http://127.0.0.1:${MOCK_PORT}/`);
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await setEvidencePreset(PRESET);

    const browser = await chromium.launch();
    const tipSha = gitTipSha();
    const ok = await captureEvidence(browser, tipSha);
    await browser.close();
    if (!ok) process.exitCode = 1;
  } finally {
    preview.kill("SIGTERM");
    mock.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
