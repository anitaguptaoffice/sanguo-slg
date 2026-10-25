/**
 * HERO-HOST-REAL-001: live main-city hero center panel capture (not body-cleared fixture).
 * Usage: cd client && npx playwright install chromium && node scripts/capture-hero-host-real-001-evidence.mjs
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
const outDir = path.resolve(repoRoot, "docs/art/samples/hero-host-real-001/runtime");

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19095);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16214);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster-long";
const CAPTURE_MODE = "live-main-city-hero-panel";

const VIEWPORTS = [
  { tag: "1600x900-dpr1", file: "hero-host-1600x900-dpr1.jpg", width: 1600, height: 900, dpr: 1 },
  { tag: "1600x900-dpr2", file: "hero-host-1600x900-dpr2.jpg", width: 1600, height: 900, dpr: 2 },
  { tag: "1280x720-dpr1", file: "hero-host-1280x720-dpr1.jpg", width: 1280, height: 720, dpr: 1 },
];

const SCROLL_SHOT = {
  tag: "1280x720-dpr1-scroll-bottom",
  file: "hero-host-1280x720-dpr1-detail-scroll-bottom.jpg",
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

async function sha256File(absPath) {
  const buf = await readFile(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

async function enterMainCity(page, attempt = 1) {
  page.setDefaultTimeout(120000);
  await page.goto(`http://127.0.0.1:${APP_PORT}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 60000,
  });
  await page.waitForSelector(".server-list li[data-server-id]", { timeout: 60000 });
  await page.locator(".server-list li[data-server-id]").first().click();
  await page.locator('[data-action="enter-game"]:not([disabled])').click();
  try {
    await page.waitForSelector(".main-city-toolbar.art-chrome-toolbar", { timeout: 120000 });
    await page.waitForSelector('[data-action="toggle-hero"]', { timeout: 30000 });
  } catch (err) {
    const hud = await page.locator("#hud").textContent().catch(() => "");
    const status = await page.locator(".server-select-panel [data-role='status']").textContent().catch(() => "");
    if (attempt < 3) {
      console.warn(`enterMainCity retry ${attempt}: ${status || hud?.slice(0, 80) || String(err)}`);
      return enterMainCity(page, attempt + 1);
    }
    throw err;
  }
}

async function openHeroPanelWithDetail(page) {
  const panel = page.locator(HERO_PANEL_SELECTOR);
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('[data-action="toggle-hero"]').click();
  }
  await page.waitForSelector(`${HERO_PANEL_SELECTOR}:not(.hidden)`, { timeout: 10000 });
  await page.locator('[data-action="refresh-heroes"]').click();
  await page.waitForTimeout(500);
  const hero1001 = page
    .locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id][data-template-cfg-id="1001"]`)
    .first();
  const fallback = page.locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id]`).first();
  const row = (await hero1001.count()) > 0 ? hero1001 : fallback;
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.scrollIntoViewIfNeeded();
  await row.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-detail-name`, { timeout: 20000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-attr-table`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-list-avatar"]`, { timeout: 8000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-detail-bust"]`, { timeout: 8000 });
  await page.waitForTimeout(300);
}

function probeHeroPortraitFrames() {
  const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
  const layoutFrame = document.getElementById("layout-frame");
  const uiScale = parseFloat(
    getComputedStyle(layoutFrame || document.body).getPropertyValue("--ui-scale") || "1",
  );
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const serverSelectOpen = !!document.querySelector(".server-select-panel:not(.hidden)");
  const serverSelectHint = /选服|请选择游戏服|选择游戏服/.test(document.body.textContent ?? "");
  const mainCityToolbar = document.querySelector(".main-city-toolbar.art-chrome-toolbar");
  const onMainCityHost = !!mainCityToolbar && !serverSelectOpen;

  const detail = panel?.querySelector(".hero-detail");
  const detailName = detail?.querySelector(".hero-detail-name");
  const attrTable = detail?.querySelector(".hero-attr-table");
  const detailError = detail?.querySelector(".panel-state-chrome.is-error");
  const detailText = detail?.textContent ?? "";
  const heroDetailLoaded =
    !!detailName &&
    !!attrTable &&
    !detailError &&
    !/hero not found|将领不存在/i.test(detailText);

  const avatar = panel?.querySelector('[data-role="hero-list-avatar"]');
  const bust = detail?.querySelector('[data-role="hero-detail-bust"]');
  const head = detail?.querySelector(".hero-detail-head");
  const listPrimary = panel?.querySelector(".hero-list-row-primary");

  const panelRect = panel?.getBoundingClientRect();
  const panelFullyOnScreen =
    !!panelRect &&
    panelRect.top >= -2 &&
    panelRect.left >= -2 &&
    panelRect.bottom <= viewport.height + 2 &&
    panelRect.right <= viewport.width + 2;

  const panelBorderImage =
    panel instanceof HTMLElement
      ? panel.style.borderImageSource || getComputedStyle(panel).borderImageSource
      : "";
  const heroPanelPaperSkin =
    !!panel &&
    ((panelBorderImage !== "none" && panelBorderImage.includes("center-panel")) ||
      (panel instanceof HTMLElement && panel.dataset.artCenterPanelSkin === "012"));

  const avatarRect = avatar?.getBoundingClientRect();
  const bustRect = bust?.getBoundingClientRect();
  const headRect = head?.getBoundingClientRect();

  const avatarSrc = avatar instanceof HTMLImageElement ? avatar.currentSrc || avatar.src : "";
  const bustSrc = bust instanceof HTMLImageElement ? bust.currentSrc || bust.src : "";
  const dpr = window.devicePixelRatio;
  const avatarScale = avatar instanceof HTMLImageElement ? avatar.dataset.artTextureScale : null;
  const bustScale = bust instanceof HTMLImageElement ? bust.dataset.artTextureScale : null;
  const usesAvatar2x = avatarSrc.includes("/textures/2x/hero/avatar/");
  const usesAvatar1x = avatarSrc.includes("/textures/1x/hero/avatar/");
  const usesBust2x = bustSrc.includes("/textures/2x/hero/bust/");
  const usesBust1x = bustSrc.includes("/textures/1x/hero/bust/");
  const texturePickOk = dpr >= 1.75 ? usesAvatar2x && usesBust2x : usesAvatar1x && usesBust1x;

  const gapPx = headRect && bustRect ? headRect.left - bustRect.right : null;
  const nameToRightOfBust = gapPx != null && gapPx >= 6;
  const nameOverlapsBust =
    !!(headRect && bustRect) &&
    headRect.left < bustRect.right - 1 &&
    headRect.top < bustRect.bottom - 1 &&
    headRect.bottom > bustRect.top + 1;

  const scroll = panel?.querySelector(".panel-scroll-body");
  let scrollReachOk = false;
  let detailFooterVisible = false;
  let scrollMaxTop = 0;
  if (scroll instanceof HTMLElement) {
    scrollMaxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollTop = scrollMaxTop;
    const scrollBottom = scroll.getBoundingClientRect().bottom;
    const hint = detail?.querySelector(".hero-detail-hint");
    if (hint instanceof HTMLElement) {
      const fr = hint.getBoundingClientRect();
      detailFooterVisible = fr.height > 0 && fr.top >= scroll.getBoundingClientRect().top && fr.bottom <= scrollBottom + 2;
    }
    scrollReachOk = scrollMaxTop > 8 && detailFooterVisible;
  }

  const listPrimaryColor = listPrimary ? getComputedStyle(listPrimary).color : null;

  const portraitFramesOk =
    heroDetailLoaded &&
    !!avatar &&
    !!bust &&
    texturePickOk &&
    nameToRightOfBust &&
    !nameOverlapsBust;

  return {
    captureSurface: "live-main-city-hero-panel",
    jointFreezeClaimed: false,
    onMainCityHost,
    serverSelectVisible: serverSelectOpen || serverSelectHint,
    heroPanelPaperSkin,
    ok: portraitFramesOk && panelFullyOnScreen && onMainCityHost && !serverSelectOpen,
    portraitFramesOk,
    heroDetailLoaded,
    panelFullyOnScreen,
    detailName: detailName?.textContent?.trim() ?? null,
    dpr,
    uiScale,
    viewport,
    avatar: avatar
      ? {
          cssWidth: avatarRect?.width,
          cssHeight: avatarRect?.height,
          borderRadius: getComputedStyle(avatar).borderRadius,
          artTextureScale: avatarScale,
          srcTail: avatarSrc.split("/").slice(-4).join("/"),
        }
      : null,
    bust: bust
      ? {
          cssWidth: bustRect?.width,
          cssHeight: bustRect?.height,
          artTextureScale: bustScale,
          srcTail: bustSrc.split("/").slice(-4).join("/"),
        }
      : null,
    layout: {
      nameToRightOfBust,
      nameOverlapsBust,
      gapPx,
      headLeft: headRect?.left,
      bustRight: bustRect?.right,
    },
    listPrimaryColor,
    texturePickOk,
    usesAvatar1x,
    usesAvatar2x,
    usesBust1x,
    usesBust2x,
    scrollMaxTop,
    scrollReachOk,
    detailFooterVisible,
  };
}

async function scrollDetailToBottom(page) {
  await page.evaluate(() => {
    const scroll = document.querySelector(
      '.content-panel[data-center-panel="hero"] .panel-scroll-body',
    );
    if (scroll instanceof HTMLElement) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  });
  await page.waitForTimeout(250);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await setEvidencePreset(PRESET).catch(() => {});

  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT), MOCK_EVIDENCE_PRESET: PRESET },
  });
  const viteEnv = { ...process.env, VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws` };
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: viteEnv,
    },
  );

  try {
    await new Promise((r) => setTimeout(r, 8000));
    await waitForHttp(`http://127.0.0.1:${MOCK_PORT}/`);
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await setEvidencePreset(PRESET);

    const browser = await chromium.launch();
    const tipSha = gitTipSha();
    const shots = {};
    const probes = {};

    async function captureViewport(page, vp) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);
      await openHeroPanelWithDetail(page);
      const filePath = path.join(outDir, vp.file);
      const jpeg = await writeJpegUnder1Mb(page, filePath, { fullPage: false });
      probes[vp.tag] = await page.evaluate(probeHeroPortraitFrames);
      shots[vp.file] = { ...jpeg, viewport: vp };
      if (vp.tag === "1280x720-dpr1") {
        await scrollDetailToBottom(page);
        const scrollPath = path.join(outDir, SCROLL_SHOT.file);
        const scrollJpeg = await writeJpegUnder1Mb(page, scrollPath, { fullPage: false });
        probes[SCROLL_SHOT.tag] = await page.evaluate(probeHeroPortraitFrames);
        shots[SCROLL_SHOT.file] = { ...scrollJpeg, viewport: SCROLL_SHOT };
      }
    }

    const dpr1Context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const dpr1Page = await dpr1Context.newPage();
    await enterMainCity(dpr1Page);
    await captureViewport(dpr1Page, VIEWPORTS[0]);
    await captureViewport(dpr1Page, VIEWPORTS[2]);
    await dpr1Context.close();

    const dpr2Context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 2,
    });
    const dpr2Page = await dpr2Context.newPage();
    await enterMainCity(dpr2Page);
    await captureViewport(dpr2Page, VIEWPORTS[1]);
    await dpr2Context.close();

    await browser.close();

    const probeLog = {
      task: "HERO-HOST-REAL-001",
      capture_mode: CAPTURE_MODE,
      mock_preset: PRESET,
      git_tip_sha: tipSha,
      joint_freeze_claimed: false,
      honesty:
        "probe.ok is engineering portrait/layout/scroll + main-city host checks only — not art+engineering joint freeze (Slice 0 / 1001 still blocked until art sign-off).",
      probes,
      shots,
      notes: [
        "Production path: mock gateway → Vite client → enter main city → HeroMailPanels refresh list + select template 1001.",
        "List avatar: circle mask 56×56; detail bust 128×160; name column right of bust (~10px gap).",
        "Placeholders only (template_cfg_id 1001 engineering PNGs).",
      ],
    };
    await writeFile(path.join(outDir, "probe-log.json"), JSON.stringify(probeLog, null, 2));

    const inventoryLines = [
      "# HERO-HOST-REAL-001 runtime inventory",
      "",
      `Git tip SHA: \`${tipSha}\``,
      "",
      "Capture: **live** main-city hero center panel (`capture-hero-host-real-001-evidence.mjs`).",
      "",
      "## Viewport captures",
      "",
    ];
    const allVp = [...VIEWPORTS, SCROLL_SHOT];
    for (const vp of allVp) {
      const rel = `runtime/${vp.file}`;
      const abs = path.join(outDir, vp.file);
      const bytes = (await readFile(abs)).length;
      const sha = await sha256File(abs);
      inventoryLines.push(
        `- \`${rel}\` — ${vp.width}×${vp.height} @ DPR ${vp.dpr}, ${bytes} bytes, sha256 \`${sha}\``,
      );
    }
    inventoryLines.push("", "## Placeholder textures (engineering only)", "");
    for (const rel of [
      "client/public/assets/art/v1/textures/1x/hero/avatar/1001.png",
      "client/public/assets/art/v1/textures/2x/hero/avatar/1001.png",
      "client/public/assets/art/v1/textures/1x/hero/bust/1001.png",
      "client/public/assets/art/v1/textures/2x/hero/bust/1001.png",
    ]) {
      const abs = path.join(repoRoot, rel);
      const bytes = (await readFile(abs)).length;
      const sha = await sha256File(abs);
      inventoryLines.push(`- \`${rel}\` — ${bytes} bytes, sha256 \`${sha}\``);
    }
    inventoryLines.push("", "## Probe summary", "", "```json", JSON.stringify(probes, null, 2), "```");
    await writeFile(path.join(outDir, "INVENTORY.md"), inventoryLines.join("\n"));

    const requiredTags = [...VIEWPORTS.map((v) => v.tag), SCROLL_SHOT.tag];
    const failed = requiredTags.filter((tag) => {
      const p = probes[tag];
      if (!p) return true;
      if (!p.onMainCityHost || p.serverSelectVisible) return true;
      if (tag === SCROLL_SHOT.tag) return !p.scrollReachOk;
      if (tag === "1280x720-dpr1") {
        return !p.portraitFramesOk || Math.abs(p.uiScale - 0.8) > 0.05 || !p.panelFullyOnScreen;
      }
      return !p.portraitFramesOk;
    });
    if (failed.length) {
      console.error("probe checks failed for", failed, probes);
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
