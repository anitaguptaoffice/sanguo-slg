/**
 * ART-CENTER-PANEL-012 runtime evidence: hero center panel skin + contrast + scroll.
 * Usage: cd client && npm install && npx playwright install chromium && node scripts/capture-art-center-panel-012-evidence.mjs
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
const outDir = path.resolve(repoRoot, "docs/art/samples/art-center-panel-012/runtime");

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19093);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16212);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster";

const VIEWPORTS = [
  { tag: "1600x900", file: "hero-center-panel-1600x900.jpg", width: 1600, height: 900, dpr: 1 },
  {
    tag: "3200x1800",
    file: "hero-center-panel-3200x1800.jpg",
    width: 1600,
    height: 900,
    dpr: 2,
  },
  { tag: "1280x720", file: "hero-center-panel-1280x720.jpg", width: 1280, height: 720, dpr: 1 },
];

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
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.waitForSelector(".server-list li", { timeout: 25000 });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 25000 },
  );
  await page.waitForSelector(".main-city-toolbar.art-chrome-toolbar", { timeout: 15000 });
}

async function openHeroPanelWithDetail(page) {
  await page.locator('[data-action="toggle-hero"]').click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR}:not(.hidden)`, { timeout: 10000 });
  await page.locator('[data-action="refresh-heroes"]').click();
  await page.waitForTimeout(400);
  const firstHero = page.locator(`${HERO_PANEL_SELECTOR} .hero-list li[data-hero-id]`).first();
  await firstHero.waitFor({ state: "visible", timeout: 8000 });
  await firstHero.click();
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-detail-name`, { timeout: 12000 });
  await page.waitForSelector(`${HERO_PANEL_SELECTOR} .hero-attr-table`, { timeout: 12000 });
  await page.waitForTimeout(300);
}

function probeHeroPanelInPage() {
  const panel = document.querySelector('.content-panel[data-center-panel="hero"]');
  if (!(panel instanceof HTMLElement)) {
    return { ok: false, reason: "hero panel missing" };
  }
  const pr = panel.getBoundingClientRect();
  const borderSrc = panel.style.borderImageSource || getComputedStyle(panel).borderImageSource;
  const scroll = panel.querySelector(".panel-scroll-body");
  const detail = panel.querySelector(".hero-detail");
  const hint = panel.querySelector('[data-role="hero-hint"]');
  const detailBody = detail?.querySelector(".hero-detail-body") || detail;
  const detailName = detail?.querySelector(".hero-detail-name");
  const attrTable = detail?.querySelector(".hero-attr-table");
  const detailError = detail?.querySelector(".panel-state-chrome.is-error");
  const detailText = detail?.textContent ?? "";
  const heroDetailLoaded =
    !!detailName &&
    !!attrTable &&
    !detailError &&
    !/hero not found|将领不存在/i.test(detailText);

  const scrollMetrics = scroll
    ? {
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        scrollTop: scroll.scrollTop,
        scrollable: scroll.scrollHeight > scroll.clientHeight + 2,
      }
    : null;

  const detailRect = detail?.getBoundingClientRect();
  const scrollRect = scroll?.getBoundingClientRect();

  const paperColor = hint ? getComputedStyle(hint).color : null;
  const inkBody =
    detailBody instanceof HTMLElement ? getComputedStyle(detailBody).color : null;

  const padding = getComputedStyle(panel).padding;
  const hasTopColorBar =
    panel.querySelector("[data-hero-top-bar]") ||
    Array.from(panel.children).some((ch) => {
      if (!(ch instanceof HTMLElement)) return false;
      const bg = getComputedStyle(ch).backgroundColor;
      const h = ch.getBoundingClientRect().height;
      return h > 0 && h < 8 && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
    });

  const dpr = window.devicePixelRatio;
  const uses1x = borderSrc.includes("/textures/1x/ui/panel_hero.png");
  const uses2x = borderSrc.includes("/textures/2x/ui/panel_hero.png");
  const skinPathOk = dpr >= 1.75 ? uses2x : uses1x;

  const detailFooter = detail?.querySelector(".hero-detail-hint");
  const detailLinks = detail?.querySelector(".hero-detail-links");
  const deficitGap = detail?.querySelector(
    '[data-role="hero-upgrade-item-gap"].hero-upgrade-item-gap-warn, .hero-cultivation-disabled-reason',
  );

  let scrollReachOk = true;
  let detailEndReachOk = true;
  if (scroll instanceof HTMLElement) {
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollTop = maxTop;
    const scrollBox = scroll.getBoundingClientRect();
    const scrollBottom = scrollBox.bottom;
    const scrollTopEdge = scrollBox.top;
    const detailBottom = detail?.getBoundingClientRect().bottom ?? 0;
    scrollReachOk = maxTop <= 2 || detailBottom <= scrollBottom + 2;
    if (detailFooter instanceof HTMLElement) {
      const fr = detailFooter.getBoundingClientRect();
      detailEndReachOk =
        fr.height > 0 && fr.bottom <= scrollBottom + 2 && fr.top >= scrollTopEdge - 2;
    } else if (detailLinks instanceof HTMLElement) {
      const lr = detailLinks.getBoundingClientRect();
      detailEndReachOk = lr.bottom <= scrollBottom + 2;
    }
  }

  const detailNotClamped = (detailRect?.height ?? 0) > 200;
  const deficitHintColor =
    deficitGap instanceof HTMLElement ? getComputedStyle(deficitGap).color : null;

  return {
    ok: skinPathOk && !hasTopColorBar && scrollReachOk && detailEndReachOk && heroDetailLoaded,
    heroDetailLoaded,
    detailName: detailName?.textContent?.trim() ?? null,
    dpr,
    borderImageSource: borderSrc,
    skinPathOk,
    uses1x,
    uses2x,
    panelRect: { width: pr.width, height: pr.height, top: pr.top, left: pr.left },
    padding,
    paperMutedColor: paperColor,
    inkBodyColor: inkBody,
    scrollMetrics,
    scrollReachOk,
    detailEndReachOk,
    detailNotClamped,
    deficitHintColor,
    hasTopColorBar: !!hasTopColorBar,
    detailInScroll: !!(scroll && detail && scroll.contains(detail)),
    detailRect: detailRect
      ? { width: detailRect.width, height: detailRect.height, bottom: detailRect.bottom }
      : null,
    scrollRect: scrollRect
      ? { width: scrollRect.width, height: scrollRect.height, bottom: scrollRect.bottom }
      : null,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await setEvidencePreset(PRESET).catch(() => {});

  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      MOCK_GATEWAY_PORT: String(MOCK_PORT),
      MOCK_EVIDENCE_PRESET: PRESET,
    },
  });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws`,
      },
    },
  );

  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${MOCK_PORT}/`);
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await setEvidencePreset(PRESET);

    const browser = await chromium.launch();
    const tipSha = gitTipSha();
    const shots = {};
    const probes = {};

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page);
      await openHeroPanelWithDetail(page);
      const filePath = path.join(outDir, vp.file);
      const jpeg = await writeJpegUnder1Mb(page, filePath, { fullPage: false });
      probes[vp.tag] = await page.evaluate(probeHeroPanelInPage);
      shots[vp.file] = { ...jpeg, viewport: vp };
      await context.close();
    }

    const context1280 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page1280 = await context1280.newPage();
    await enterMainCity(page1280);
    await openHeroPanelWithDetail(page1280);
    await page1280.evaluate(() => {
      const scroll = document.querySelector(
        '.content-panel[data-center-panel="hero"] .panel-scroll-body',
      );
      if (scroll instanceof HTMLElement) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    });
    await page1280.waitForTimeout(200);
    const scrollFile = "hero-center-panel-1280x720-detail-scroll.jpg";
    const scrollJpeg = await writeJpegUnder1Mb(
      page1280,
      path.join(outDir, scrollFile),
      { fullPage: false },
    );
    probes["1280x720-scroll"] = await page1280.evaluate(probeHeroPanelInPage);
    shots[scrollFile] = { ...scrollJpeg, viewport: { tag: "1280x720-scroll", width: 1280, height: 720, dpr: 1 } };
    await context1280.close();

    const contextDpr2Scroll = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 2,
    });
    const pageDpr2 = await contextDpr2Scroll.newPage();
    await enterMainCity(pageDpr2);
    await openHeroPanelWithDetail(pageDpr2);
    await pageDpr2.evaluate(() => {
      const scroll = document.querySelector(
        '.content-panel[data-center-panel="hero"] .panel-scroll-body',
      );
      if (scroll instanceof HTMLElement) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    });
    await pageDpr2.waitForTimeout(200);
    const dpr2ScrollFile = "hero-center-panel-3200x1800-detail-scroll.jpg";
    const dpr2ScrollJpeg = await writeJpegUnder1Mb(
      pageDpr2,
      path.join(outDir, dpr2ScrollFile),
      { fullPage: false },
    );
    probes["3200x1800-scroll"] = await pageDpr2.evaluate(probeHeroPanelInPage);
    shots[dpr2ScrollFile] = {
      ...dpr2ScrollJpeg,
      viewport: { tag: "3200x1800-scroll", width: 1600, height: 900, dpr: 2 },
    };
    await contextDpr2Scroll.close();
    await browser.close();

    const tex1 = path.join(
      repoRoot,
      "client/public/assets/art/v1/textures/1x/ui/panel_hero.png",
    );
    const tex2 = path.join(
      repoRoot,
      "client/public/assets/art/v1/textures/2x/ui/panel_hero.png",
    );

    const evidence = {
      task: "ART-CENTER-PANEL-012",
      runtime_code_sha: tipSha,
      screenshot_artifacts_commit_sha: tipSha,
      tip_sha: tipSha,
      art_asset_source_commit: "bcf05c7365f92f17142f4ce25a3ba1bdd2b80247",
      captured_at: new Date().toISOString(),
      asset_id: "ui.panel.hero.v1",
      texture_paths: {
        scale_1: "textures/1x/ui/panel_hero.png",
        scale_2: "textures/2x/ui/panel_hero.png",
      },
      sha256: {
        "textures/1x/ui/panel_hero.png": await sha256File(tex1),
        "textures/2x/ui/panel_hero.png": await sha256File(tex2),
      },
      mock_preset: PRESET,
      shots,
      probes,
    };

    await writeFile(path.join(outDir, "probe-log.json"), `${JSON.stringify(evidence, null, 2)}\n`);

    const inkDeficitRgb = "rgb(240, 168, 160)";
    const checklist = [
      ["panel_hero 1×/2× by DPR", probes["1600x900"]?.skinPathOk && probes["3200x1800"]?.skinPathOk],
      ["nine-slice border-image mounted", probes["1600x900"]?.borderImageSource?.includes("panel_hero")],
      ["no top color bar", !probes["1600x900"]?.hasTopColorBar],
      ["detail inside scroll body", probes["1280x720"]?.detailInScroll],
      ["1280 scroll reaches detail bottom", probes["1280x720-scroll"]?.scrollReachOk],
      ["1280 scroll detail footer reachable", probes["1280x720-scroll"]?.detailEndReachOk],
      ["paper muted readable", probes["1600x900"]?.paperMutedColor === "rgb(74, 56, 40)"],
      ["ink body readable", probes["1600x900"]?.inkBodyColor === "rgb(232, 220, 200)"],
      ["hero detail loaded (attrs table)", probes["1600x900"]?.heroDetailLoaded],
      [
        "1280 scroll shows real detail (not error)",
        probes["1280x720-scroll"]?.heroDetailLoaded && (probes["1280x720-scroll"]?.detailRect?.height ?? 0) > 120,
      ],
      [
        "1600 detail not max-height clamped",
        probes["1600x900"]?.detailNotClamped && probes["3200x1800"]?.detailNotClamped,
      ],
      [
        "1600/DPR2 scroll body scrollable when detail overflows",
        (probes["1600x900"]?.scrollMetrics?.scrollable ||
          (probes["1600x900"]?.scrollMetrics?.scrollHeight ?? 0) >
            (probes["1600x900"]?.scrollMetrics?.clientHeight ?? 0) + 2) &&
          (probes["3200x1800"]?.scrollMetrics?.scrollable ||
            (probes["3200x1800"]?.scrollMetrics?.scrollHeight ?? 0) >
              (probes["3200x1800"]?.scrollMetrics?.clientHeight ?? 0) + 2),
      ],
      [
        "1600/DPR2 scroll reaches detail footer",
        probes["3200x1800-scroll"]?.detailEndReachOk &&
          probes["1600x900"]?.detailEndReachOk &&
          probes["3200x1800"]?.detailEndReachOk,
      ],
      [
        "1280 scroll-bottom deficit hint readable on ink",
        probes["1280x720-scroll"]?.deficitHintColor === inkDeficitRgb,
      ],
    ];
    const failed = checklist.filter(([, pass]) => !pass);
    if (failed.length) {
      throw new Error(`probe checklist failed: ${JSON.stringify(failed)}`);
    }

    const invLines = [
      "# INVENTORY — ART-CENTER-PANEL-012 runtime",
      "",
      `Runtime code at capture: \`${tipSha}\` (mock + client; must resolve on GitHub).`,
      `Screenshot JPEGs / probe-log land in a follow-up git commit — after push, set \`screenshot_artifacts_commit_sha\` in \`probe-log.json\` to that commit (often same as runtime when captured on a clean checkout).`,
      `Art PNGs from Draft #697 @ \`bcf05c7365f92f17142f4ce25a3ba1bdd2b80247\` (**not merged**).`,
      "",
      "## Asset contract",
      "",
      "| asset_id | 1× path | 2× path | display | nine_slice |",
      "|---|---|---|---|---|",
      "| `ui.panel.hero.v1` | `textures/1x/ui/panel_hero.png` | `textures/2x/ui/panel_hero.png` | 320×200 | 24 L/T/R/B |",
      "",
      "## Runtime JPEG (<1MB each)",
      "",
      "| File | Viewport | Notes |",
      "|---|---|---|",
      "| `hero-center-panel-1600x900.jpg` | 1600×900 DPR1 | 将领中心面板（列表+详情） |",
      "| `hero-center-panel-3200x1800.jpg` | 1600×900 DPR2 | 2× 纹理路径 `textures/2x/ui/panel_hero.png` |",
      "| `hero-center-panel-1280x720.jpg` | 1280×720 DPR1 | 窄布局 `layout-narrow` |",
      "| `hero-center-panel-1280x720-detail-scroll.jpg` | 1280×720 | `.panel-scroll-body` 滚至底部 |",
      "| `hero-center-panel-3200x1800-detail-scroll.jpg` | 1600×900 DPR2 | 宽屏滚至详情末尾 |",
      "",
      "## Checklist",
      "",
      ...checklist.map(([label, pass]) => `- [${pass ? "x" : " "}] ${label}`),
      "",
      "Regenerate: `cd client && node scripts/capture-art-center-panel-012-evidence.mjs`",
      "",
      "Probes: `probe-log.json`.",
      "",
    ];
    await writeFile(path.join(outDir, "INVENTORY.md"), `${invLines.join("\n")}\n`);

    console.log("ART-CENTER-PANEL-012 evidence OK", tipSha);
  } finally {
    for (const child of [preview, mock]) {
      if (child?.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
