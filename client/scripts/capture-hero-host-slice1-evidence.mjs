/**
 * HERO Slice1 (1002–1004) main-city runtime evidence — production hero panel path only.
 *
 * Usage:
 *   cd client && npx playwright install chromium
 *   ART_HEAD_SHA=d9d04ac15ded6e31c49139cb43afc28abe5a35b0 \
 *     node scripts/capture-hero-host-slice1-evidence.mjs
 *
 * Optional: HERO_TEMPLATE_CFG_ID=1002 to capture a single hero.
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
const SAMPLE_ROOT = path.resolve(repoRoot, "docs/art/samples/hero-host-slice1");
const ART_HEAD_SHA = process.env.ART_HEAD_SHA || "d9d04ac15ded6e31c49139cb43afc28abe5a35b0";
const SLICE1_IDS = [1002, 1003, 1004];
const HERO_IDS = process.env.HERO_TEMPLATE_CFG_ID
  ? [Number(process.env.HERO_TEMPLATE_CFG_ID)]
  : SLICE1_IDS;

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19098);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16218);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster";

const VIEWPORTS = [
  { tag: "1600x900-dpr1", file: "hero-host-1600x900-dpr1.jpg", width: 1600, height: 900, dpr: 1 },
  { tag: "1600x900-dpr2", file: "hero-host-1600x900-dpr2.jpg", width: 1600, height: 900, dpr: 2 },
  { tag: "1280x720-dpr1", file: "hero-host-1280x720-dpr1.jpg", width: 1280, height: 720, dpr: 1 },
];
const SAMEFRAME_FILE = "hero-host-1280x720-dpr1-bust-name-sameframe.jpg";

function heroAssetIds(templateCfgId) {
  return [`hero.avatar.${templateCfgId}.v1`, `hero.bust.${templateCfgId}.v1`];
}

function outDirForHero(templateCfgId) {
  return path.resolve(SAMPLE_ROOT, "runtime", String(templateCfgId));
}

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
  const heroRow = page.locator(
    `${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id][data-template-cfg-id="${templateCfgId}"]`,
  ).first();
  const fallback = page.locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id]`).first();
  const row = (await heroRow.count()) > 0 ? heroRow : fallback;
  await row.waitFor({ state: "visible", timeout: 8000 });
  await row.click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-detail-name`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-attr-table`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-list-avatar"]`, { timeout: 8000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} [data-role="hero-detail-bust"]`, { timeout: 8000 });
  await page.waitForTimeout(300);
}

async function scrollDetailHeadForSameFrame(page) {
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

function probeHeroPortraitFrames(templateCfgId) {
  const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
  const layoutFrame = document.getElementById("layout-frame");
  const uiScale = parseFloat(
    getComputedStyle(layoutFrame || document.body).getPropertyValue("--ui-scale") || "1",
  );
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

  const selectedRow = panel?.querySelector(
    `.hero-list li[data-template-cfg-id="${templateCfgId}"].selected, .hero-list li[data-template-cfg-id="${templateCfgId}"][aria-selected="true"]`,
  );
  const listRow =
    selectedRow ||
    panel?.querySelector(`.hero-list li[data-template-cfg-id="${templateCfgId}"]`) ||
    panel?.querySelector(".hero-list li.selected");
  const avatar = listRow?.querySelector('[data-role="hero-list-avatar"]');
  const bust = detail?.querySelector('[data-role="hero-detail-bust"]');
  const head = detail?.querySelector(".hero-detail-head");
  const name = detail?.querySelector(".hero-detail-name");

  const avatarRect = avatar?.getBoundingClientRect();
  const bustRect = bust?.getBoundingClientRect();
  const headRect = head?.getBoundingClientRect();
  const nameRect = name?.getBoundingClientRect();

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
  const avatarPathOk = avatarSrc.includes(`/hero/avatar/${templateCfgId}.png`);
  const bustPathOk = bustSrc.includes(`/hero/bust/${templateCfgId}.png`);

  const scroll = panel?.querySelector(".panel-scroll-body");
  let scrollReachOk = true;
  let detailFooterVisible = true;
  if (scroll instanceof HTMLElement) {
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollTop = maxTop;
    const scrollBottom = scroll.getBoundingClientRect().bottom;
    const hint = detail?.querySelector(".hero-detail-hint");
    if (hint instanceof HTMLElement) {
      const fr = hint.getBoundingClientRect();
      detailFooterVisible = fr.height > 0 && fr.bottom <= scrollBottom + 2;
    }
    scrollReachOk = maxTop <= 2 || detailFooterVisible;
  }

  const nameReadable =
    !!detailName?.textContent?.trim() && (detailName.textContent?.trim()?.length ?? 0) >= 2;
  const listAvatarVisible = !!(avatarRect && avatarRect.width >= 48 && avatarRect.height >= 48);
  const gapPx = bustRect && nameRect ? Math.round(nameRect.left - bustRect.right) : null;
  const nameBesideBustGapOk = gapPx != null && gapPx >= 4 && gapPx <= 18;
  const nameOverlapBust =
    !!(headRect && bustRect) &&
    headRect.left < bustRect.right - 2 &&
    headRect.top < bustRect.bottom - 2;

  return {
    ok:
      heroDetailLoaded &&
      listAvatarVisible &&
      nameReadable &&
      !!bust &&
      texturePickOk &&
      avatarPathOk &&
      bustPathOk &&
      scrollReachOk,
    template_cfg_id: templateCfgId,
    heroDetailLoaded,
    nameReadable,
    detailName: detailName?.textContent?.trim() ?? null,
    listAvatarVisible,
    dpr,
    uiScale,
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
          float: getComputedStyle(bust).float,
          marginRight: getComputedStyle(bust).marginRight,
        }
      : null,
    layout: {
      nameBesideBust: nameOverlapBust,
      gapPx,
      nameBesideBustGapOk,
      headLeft: headRect?.left,
      bustRight: bustRect?.right,
    },
    texturePickOk,
    usesAvatar1x,
    usesAvatar2x,
    usesBust1x,
    usesBust2x,
    avatarPathOk,
    bustPathOk,
    scrollReachOk,
    detailFooterVisible,
  };
}

function probeBustNameSameFrame() {
  const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
  const bust = panel?.querySelector('[data-role="hero-detail-bust"]');
  const name = panel?.querySelector(".hero-detail-name");
  const br = bust?.getBoundingClientRect();
  const nr = name?.getBoundingClientRect();
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
  const gapNear10px = gapPx != null && gapPx >= 4 && gapPx <= 18;
  return {
    ok: bustInViewport && nameInViewport && nameRightOfBust && verticalBandOverlap && gapNear10px,
    bustInViewport,
    nameInViewport,
    nameRightOfBust,
    verticalBandOverlap,
    gapPx,
    gapNear10px,
    name: { text: name?.textContent?.trim() },
    viewport: { w: vw, h: vh, dpr: window.devicePixelRatio },
  };
}

async function captureHero(browser, templateCfgId, tipSha) {
  const outDir = outDirForHero(templateCfgId);
  await mkdir(outDir, { recursive: true });
  const shots = {};
  const probes = {};

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    await enterMainCity(page);
    await openHeroPanelWithDetail(page, templateCfgId);
    if (vp.tag === "1280x720-dpr1") {
      await page.evaluate(() => {
        const scroll = document.querySelector(
          '.content-panel[data-center-panel="hero"] .panel-scroll-body',
        );
        if (scroll instanceof HTMLElement) scroll.scrollTop = scroll.scrollHeight;
      });
      await page.waitForTimeout(200);
    }
    const filePath = path.join(outDir, vp.file);
    const jpeg = await writeJpegUnder1Mb(page, filePath, { fullPage: false });
    probes[vp.tag] = await page.evaluate(probeHeroPortraitFrames, templateCfgId);
    shots[vp.file] = { ...jpeg, viewport: vp };
    await context.close();
  }

  const sameContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const samePage = await sameContext.newPage();
  samePage.setDefaultTimeout(90000);
  await enterMainCity(samePage);
  await openHeroPanelWithDetail(samePage, templateCfgId);
  await scrollDetailHeadForSameFrame(samePage);
  const sameProbe = await samePage.evaluate(probeBustNameSameFrame);
  const samePath = path.join(outDir, SAMEFRAME_FILE);
  const sameJpeg = await writeJpegUnder1Mb(samePage, samePath, { fullPage: false });
  await sameContext.close();

  const probeLog = {
    task: "HERO-HOST-SLICE1",
    template_cfg_id: templateCfgId,
    mock_preset: PRESET,
    tip_sha: tipSha,
    runtime_code_sha: tipSha,
    art_head_sha: ART_HEAD_SHA,
    art_asset_ids: heroAssetIds(templateCfgId),
    static_face_percent_min_required: 60,
    probes,
    sameframe: { shot: SAMEFRAME_FILE, jpeg: sameJpeg, probe: sameProbe },
    shots,
    notes: [
      "Production main-city hero panel (HeroMailPanels); mock preset hero-panel-roster only seeds roster.",
      "Art path-copied from Draft #1017; Draft remains unmerged.",
      "Bust margin-right 10px per production CSS; gapPx probed on detail head same-frame shot.",
    ],
    captured_at: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, "probe-log.json"), JSON.stringify(probeLog, null, 2));

  const inventoryLines = [
    `# HERO-HOST-SLICE1 runtime inventory — template ${templateCfgId}`,
    "",
    `tip_sha / runtime_code_sha: \`${tipSha}\``,
    `art_head_sha (Draft #1017): \`${ART_HEAD_SHA}\``,
    "",
    "## Viewport captures",
    "",
  ];
  for (const vp of VIEWPORTS) {
    const rel = `runtime/${templateCfgId}/${vp.file}`;
    const abs = path.join(outDir, vp.file);
    const bytes = (await readFile(abs)).length;
    const sha = await sha256File(abs);
    inventoryLines.push(
      `- \`${rel}\` — ${vp.width}×${vp.height} @ DPR ${vp.dpr}, ${bytes} bytes, sha256 \`${sha}\``,
    );
  }
  const sameRel = `runtime/${templateCfgId}/${SAMEFRAME_FILE}`;
  inventoryLines.push(
    `- \`${sameRel}\` — 1280×720 bust+name same frame, sha256 \`${await sha256File(samePath)}\``,
    "",
    `## Textures (${heroAssetIds(templateCfgId).join(" / ")})`,
    "",
  );
  for (const kind of ["avatar", "bust"]) {
    for (const scale of ["1x", "2x"]) {
      const rel = `client/public/assets/art/v1/textures/${scale}/hero/${kind}/${templateCfgId}.png`;
      const abs = path.join(repoRoot, rel);
      const bytes = (await readFile(abs)).length;
      const sha = await sha256File(abs);
      inventoryLines.push(`- \`${rel}\` — ${bytes} bytes, sha256 \`${sha}\``);
    }
  }
  inventoryLines.push("", "## Probe summary", "", "```json", JSON.stringify({ probes, sameframe: sameProbe }, null, 2), "```");
  await writeFile(path.join(outDir, "INVENTORY.md"), inventoryLines.join("\n"));

  const matrixOk = Object.values(probes).every((p) => p?.ok);
  const sameOk = sameProbe?.ok;
  if (!matrixOk || !sameOk) {
    console.error(`probe failed for ${templateCfgId}`, { probes, sameProbe });
    return false;
  }
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
    let allOk = true;
    for (const id of HERO_IDS) {
      const ok = await captureHero(browser, id, tipSha);
      allOk = allOk && ok;
    }
    await browser.close();
    if (!allOk) process.exitCode = 1;
  } finally {
    preview.kill("SIGTERM");
    mock.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
