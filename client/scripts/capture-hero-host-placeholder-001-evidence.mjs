/**
 * HERO-HOST-PLACEHOLDER-001 runtime evidence: list avatar + detail bust frames (template 1001 placeholders).
 * Usage: cd client && npx playwright install chromium && node scripts/capture-hero-host-placeholder-001-evidence.mjs
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
const outDir = path.resolve(repoRoot, "docs/art/samples/hero-host-placeholder-001/runtime");

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19094);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16213);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const MAX_JPEG_BYTES = 1_000_000;
const HERO_PANEL_SELECTOR = '.content-panel[data-center-panel="hero"]';
const PRESET = "hero-panel-roster";

const VIEWPORTS = [
  { tag: "1600x900-dpr1", file: "hero-host-1600x900-dpr1.jpg", width: 1600, height: 900, dpr: 1 },
  { tag: "1600x900-dpr2", file: "hero-host-1600x900-dpr2.jpg", width: 1600, height: 900, dpr: 2 },
  { tag: "1280x720-dpr1", file: "hero-host-1280x720-dpr1.jpg", width: 1280, height: 720, dpr: 1 },
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
  page.setDefaultTimeout(90000);
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.waitForSelector(".server-list li", { timeout: 25000 });
  await page.locator(".server-list li").first().click();
  await page.waitForTimeout(250);
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-action="toggle-hero"]') != null,
    { timeout: 60000 },
  );
}

async function openHeroPanelWithDetail(page) {
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

  const nameOverlapBust =
    !!(headRect && bustRect) &&
    headRect.left < bustRect.right - 2 &&
    headRect.top < bustRect.bottom - 2;

  return {
    ok: heroDetailLoaded && !!avatar && !!bust && texturePickOk,
    heroDetailLoaded,
    detailName: detailName?.textContent?.trim() ?? null,
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
        }
      : null,
    layout: {
      nameBesideBust: nameOverlapBust,
      headLeft: headRect?.left,
      bustRight: bustRect?.right,
    },
    texturePickOk,
    usesAvatar1x,
    usesAvatar2x,
    usesBust1x,
    usesBust2x,
    scrollReachOk,
    detailFooterVisible,
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
    const tipSha = gitTipSha();
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
      await openHeroPanelWithDetail(page);
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
      probes[vp.tag] = await page.evaluate(probeHeroPortraitFrames);
      shots[vp.file] = { ...jpeg, viewport: vp };
      await context.close();
    }

    await browser.close();

    const probeLog = {
      task: "HERO-HOST-PLACEHOLDER-001",
      mock_preset: PRESET,
      git_tip_sha: tipSha,
      probes,
      shots,
      notes: [
        "List avatar: engineering circle mask (border-radius 50%), manifest display_size 56×56.",
        "Detail bust: float-left 128×160 logical box; name header flows beside/overlap per flex+float.",
        "Placeholders only (magenta checker PNG) for template_cfg_id 1001.",
      ],
    };
    await writeFile(path.join(outDir, "probe-log.json"), JSON.stringify(probeLog, null, 2));

    const inventoryLines = [
      "# HERO-HOST-PLACEHOLDER-001 runtime inventory",
      "",
      `Git tip SHA: \`${tipSha}\``,
      "",
      "## Viewport captures",
      "",
    ];
    for (const vp of VIEWPORTS) {
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

    const allOk = Object.values(probes).every((p) => p?.ok);
    if (!allOk) {
      console.error("probe checks failed", probes);
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
