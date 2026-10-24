/**
 * Supplement only: 1280×720 viewport with hero detail head (bust + right name same frame).
 * Does not re-run the full evidence matrix. See docs/art/samples/hero-host-1001-slice0/.
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/hero-host-1001-slice0/runtime");
const OUT_FILE = "hero-host-1280x720-dpr1-bust-name-sameframe.jpg";
const PROBE_FILE = "probe-log-supplement-bust-name-sameframe.json";

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19097);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16217);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const ART_HEAD_SHA = process.env.ART_HEAD_SHA || "eef9514b507c3b21921987ab94232021422bdc2f";
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster";
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

function gitTipSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function sha256File(absPath) {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
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

async function openHeroDetailHeadAtScrollTop(page) {
  await page.locator('[data-action="toggle-hero"]').click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR}:not(.hidden)`, { timeout: 10000 });
  await page.locator('[data-action="refresh-heroes"]').click();
  await page.waitForTimeout(400);
  const hero1001 = page.locator(
    `${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id][data-template-cfg-id="1001"]`,
  ).first();
  const fallback = page.locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id]`).first();
  const row = (await hero1001.count()) > 0 ? hero1001 : fallback;
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-detail-name`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-detail-bust"]`, { timeout: 12000 });
  await page.evaluate(() => {
    const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
    const scroll = panel?.querySelector(".panel-scroll-body");
    const detail = panel?.querySelector(".hero-detail");
    const bust = panel?.querySelector('[data-role="hero-detail-bust"]');
    if (!(scroll instanceof HTMLElement) || !(detail instanceof HTMLElement)) return;
    scroll.scrollTop = 0;
    const scrollTop =
      detail.offsetTop -
      (scroll.firstElementChild instanceof HTMLElement ? scroll.firstElementChild.offsetTop : 0);
    scroll.scrollTop = Math.max(0, scrollTop - 2);
    bust?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const head = detail.querySelector(".hero-detail-head");
    head?.scrollIntoView({ block: "nearest", inline: "nearest" });
    scroll.scrollTop = Math.max(0, scrollTop - 2);
  });
  await page.waitForTimeout(350);
}

function probeBustNameSameFrame() {
  const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
  const bust = panel?.querySelector('[data-role="hero-detail-bust"]');
  const name = panel?.querySelector(".hero-detail-name");
  const head = panel?.querySelector(".hero-detail-head");
  const br = bust?.getBoundingClientRect();
  const nr = name?.getBoundingClientRect();
  const hr = head?.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const bustInViewport =
    !!br &&
    br.width >= 120 &&
    br.height >= 150 &&
    br.top >= 0 &&
    br.left >= 0 &&
    br.bottom <= vh + 1 &&
    br.right <= vw + 1;

  const nameInViewport =
    !!nr && nr.width > 0 && nr.height > 0 && nr.top >= 0 && nr.bottom <= vh + 1 && nr.right <= vw + 1;

  const nameRightOfBust = !!(br && nr && nr.left >= br.right - 24);
  const verticalBandOverlap =
    !!(br && nr && nr.bottom > br.top + 8 && nr.top < br.bottom - 8);
  const gapPx = br && nr ? Math.round(nr.left - br.right) : null;

  const unionTop = Math.min(br?.top ?? 0, nr?.top ?? 0);
  const unionBottom = Math.max(br?.bottom ?? 0, nr?.bottom ?? 0);
  const unionLeft = Math.min(br?.left ?? 0, nr?.left ?? 0);
  const unionRight = Math.max(br?.right ?? 0, nr?.right ?? 0);
  const unionInViewport =
    unionTop >= 0 &&
    unionLeft >= 0 &&
    unionBottom <= vh + 2 &&
    unionRight <= vw + 2;

  const listRowAvatar = panel?.querySelector(".hero-list [data-role='hero-list-avatar']");
  const listAvatarRect = listRowAvatar?.getBoundingClientRect();
  const listAvatarDominatesViewport =
    !!listAvatarRect &&
    listAvatarRect.height >= 40 &&
    listAvatarRect.top < vh * 0.35 &&
    listAvatarRect.bottom > unionBottom;

  return {
    ok:
      bustInViewport &&
      nameInViewport &&
      nameRightOfBust &&
      verticalBandOverlap &&
      unionInViewport &&
      !listAvatarDominatesViewport,
    bustInViewport,
    nameInViewport,
    nameRightOfBust,
    verticalBandOverlap,
    unionInViewport,
    gapPx,
    listAvatarDominatesViewport,
    bust: br
      ? {
          cssWidth: br.width,
          cssHeight: br.height,
          top: br.top,
          right: br.right,
        }
      : null,
    name: nr
      ? {
          text: name?.textContent?.trim(),
          left: nr.left,
          top: nr.top,
          right: nr.right,
          bottom: nr.bottom,
        }
      : null,
    head: hr ? { left: hr.left, right: hr.right, top: hr.top, bottom: hr.bottom } : null,
    viewport: { w: vw, h: vh, dpr: window.devicePixelRatio },
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
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
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    await enterMainCity(page);
    await openHeroDetailHeadAtScrollTop(page);
    const probe = await page.evaluate(probeBustNameSameFrame);
    const filePath = path.join(outDir, OUT_FILE);
    const jpeg = await writeJpegUnder1Mb(page, filePath, { fullPage: false });
    const tipSha = gitTipSha();
    const sha256 = await sha256File(filePath);

    await browser.close();

    const probeLog = {
      task: "HERO-HOST-1001-SLICE0-SUPPLEMENT-BUST-NAME-SAMEFRAME",
      purpose: "1280 viewport: full bust box + hero name on the right in one frame (detail head, not list/footer).",
      mock_preset: PRESET,
      supplement_runtime_code_sha: tipSha,
      art_head_sha: ART_HEAD_SHA,
      prior_matrix_runtime_code_sha: "d078ca9d42e4256b0533b03f707b77e389db4ea3",
      art_reviewed_pr_head_sha: "70d90432db231b20a20f47cf0c6d49f833a1399e",
      shot: OUT_FILE,
      jpeg,
      sha256,
      probe,
      captured_at: new Date().toISOString(),
      notes: [
        "Does not replace hero-host-1280x720-dpr1.jpg (detail footer scroll evidence).",
        "Does not re-capture 1600 matrix or dpr2 shots from prior capture d078ca9d.",
      ],
    };
    await writeFile(path.join(outDir, PROBE_FILE), JSON.stringify(probeLog, null, 2));

    if (!probe.ok) {
      console.error("supplement probe failed", probe);
      process.exitCode = 1;
    }
  } finally {
    preview.kill("SIGTERM");
    mock.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
