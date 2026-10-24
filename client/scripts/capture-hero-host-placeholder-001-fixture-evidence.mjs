/**
 * Fixture-based runtime evidence when full main-city Playwright entry is flaky in CI.
 * Loads real placeholder PNGs from /assets/art/v1/ and measures CSS boxes.
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
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16221);

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

function probeFixture() {
  const layoutFrame = document.getElementById("layout-frame");
  const uiScale = parseFloat(
    getComputedStyle(layoutFrame || document.body).getPropertyValue("--ui-scale") || "1",
  );
  const avatar = document.querySelector('[data-role="hero-list-avatar"]');
  const bust = document.querySelector('[data-role="hero-detail-bust"]');
  const head = document.querySelector(".hero-detail-head");
  const dpr = window.devicePixelRatio;
  const avatarSrc = avatar instanceof HTMLImageElement ? avatar.currentSrc || avatar.src : "";
  const bustSrc = bust instanceof HTMLImageElement ? bust.currentSrc || bust.src : "";
  const uses2x = avatarSrc.includes("/2x/") && bustSrc.includes("/2x/");
  const uses1x = avatarSrc.includes("/1x/") && bustSrc.includes("/1x/");
  const ar = avatar?.getBoundingClientRect();
  const br = bust?.getBoundingClientRect();
  const hr = head?.getBoundingClientRect();
  const scroll = document.querySelector(".panel-scroll-body");
  let scrollReachOk = true;
  if (scroll instanceof HTMLElement) {
    scroll.scrollTop = scroll.scrollHeight;
    const hint = document.querySelector(".hero-detail-hint");
    const sb = scroll.getBoundingClientRect().bottom;
    if (hint instanceof HTMLElement) {
      scrollReachOk = hint.getBoundingClientRect().bottom <= sb + 2;
    }
  }
  return {
    ok: !!avatar && !!bust && (dpr >= 1.75 ? uses2x : uses1x),
    dpr,
    uiScale,
    avatar: ar
      ? {
          width: ar.width,
          height: ar.height,
          borderRadius: getComputedStyle(avatar).borderRadius,
          artTextureScale: avatar instanceof HTMLImageElement ? avatar.dataset.artTextureScale : null,
        }
      : null,
    bust: br
      ? {
          width: br.width,
          height: br.height,
          float: getComputedStyle(bust).float,
          artTextureScale: bust instanceof HTMLImageElement ? bust.dataset.artTextureScale : null,
        }
      : null,
    layout: {
      nameBesideBust: !!(hr && br && hr.left < br.right - 2),
      headLeft: hr?.left,
      bustRight: br?.right,
    },
    scrollReachOk,
    uses1x,
    uses2x,
  };
}

async function mountFixture(page, dpr) {
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 90000,
  });
  await page.evaluate(async (deviceDpr) => {
    const { AssetLoader } = await import("/src/engine/AssetLoader.ts");
    const { mountHeroDetailBust, mountHeroListAvatar } = await import(
      "/src/engine/heroPortraitFrameSkin.ts"
    );
    const assets = new AssetLoader();
    await assets.loadAll(deviceDpr);
    document.body.innerHTML = "";
    const frame = document.createElement("div");
    frame.id = "layout-frame";
    frame.style.cssText = "width:1600px;height:900px;margin:0;padding:16px;box-sizing:border-box;background:#2a2218;";
    document.body.appendChild(frame);
    const panel = document.createElement("div");
    panel.className = "content-panel";
    panel.dataset.centerPanel = "hero";
    panel.innerHTML = `
      <div class="panel-scroll-body" style="max-height:520px;overflow-y:auto;">
        <ul class="hero-list">
          <li data-hero-id="8001" data-template-cfg-id="1001">
            <div class="hero-list-row-body">
              <span class="hero-list-row-primary">Lv12 · 忠诚 88 · 刘备</span>
              <span class="hero-list-row-secondary">详情查看养成</span>
            </div>
          </li>
        </ul>
        <div class="hero-detail" data-role="hero-detail">
          <header class="hero-detail-head">
            <span class="hero-detail-name">刘备</span>
            <span class="hero-detail-level">Lv12</span>
            <span class="hero-detail-meta">稀有5 · 忠诚 88</span>
          </header>
          <table class="hero-attr-table"><tbody>
            <tr><th>武力</th><td>74</td><td class="hero-attr-bar"><span class="hero-attr-bar-fill" style="width:74%"></span></td></tr>
            <tr><th>智力</th><td>64</td><td class="hero-attr-bar"><span class="hero-attr-bar-fill" style="width:64%"></span></td></tr>
            <tr><th>政治</th><td>59</td><td class="hero-attr-bar"><span class="hero-attr-bar-fill" style="width:59%"></span></td></tr>
            <tr><th>统率</th><td>66</td><td class="hero-attr-bar"><span class="hero-attr-bar-fill" style="width:66%"></span></td></tr>
          </tbody></table>
          <p class="hero-detail-hint">养成道具、招募与背包互链见 CLIENT 卡；本页为工程占位框验收。</p>
        </div>
      </div>`;
    frame.appendChild(panel);
    const li = panel.querySelector("li");
    const detail = panel.querySelector('[data-role="hero-detail"]');
    if (!li || !detail) return;
    mountHeroListAvatar(li, 1001, "刘备", assets, panel);
    mountHeroDetailBust(detail, 1001, "刘备", assets, panel);
    const av = assets.getImageForAsset("hero.avatar.1001.v1");
    const bu = assets.getImageForAsset("hero.bust.1001.v1");
    const avatarEl = li.querySelector("img");
    const bustEl = detail.querySelector("img");
    if (avatarEl instanceof HTMLImageElement && av) avatarEl.dataset.artTextureScale = String(av.scale);
    if (bustEl instanceof HTMLImageElement && bu) bustEl.dataset.artTextureScale = String(bu.scale);
  }, dpr);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const preview = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"], {
    cwd: clientRoot,
    stdio: "inherit",
  });
  try {
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    const browser = await chromium.launch();
    const tipSha = gitTipSha();
    const probes = {};
    const shots = {};
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
      });
      const page = await context.newPage();
      await mountFixture(page, vp.dpr);
      if (vp.tag === "1280x720-dpr1") {
        await page.evaluate(() => {
          const scroll = document.querySelector(".panel-scroll-body");
          if (scroll instanceof HTMLElement) scroll.scrollTop = scroll.scrollHeight;
        });
        await page.waitForTimeout(150);
      }
      const filePath = path.join(outDir, vp.file);
      const buffer = await page.screenshot({ type: "jpeg", quality: 84, fullPage: false });
      await writeFile(filePath, buffer);
      probes[vp.tag] = await page.evaluate(probeFixture);
      shots[vp.file] = { bytes: buffer.length, viewport: vp };
      await context.close();
    }
    await browser.close();
    await writeFile(
      path.join(outDir, "probe-log.json"),
      JSON.stringify({ task: "HERO-HOST-PLACEHOLDER-001", mode: "fixture", git_tip_sha: tipSha, probes, shots }, null, 2),
    );
    const lines = ["# HERO-HOST-PLACEHOLDER-001 runtime inventory", "", `Git tip SHA: \`${tipSha}\``, "", "Mode: Vite fixture mount (real AssetLoader + placeholder PNGs).", ""];
    for (const vp of VIEWPORTS) {
      const rel = `runtime/${vp.file}`;
      const abs = path.join(outDir, vp.file);
      lines.push(`- \`${rel}\` — ${vp.width}×${vp.height} @ DPR ${vp.dpr}, ${(await readFile(abs)).length} bytes, sha256 \`${await sha256File(abs)}\``);
    }
    lines.push("", "## Textures (engineering placeholders)", "");
    for (const rel of [
      "client/public/assets/art/v1/textures/1x/hero/avatar/1001.png",
      "client/public/assets/art/v1/textures/2x/hero/avatar/1001.png",
      "client/public/assets/art/v1/textures/1x/hero/bust/1001.png",
      "client/public/assets/art/v1/textures/2x/hero/bust/1001.png",
    ]) {
      const abs = path.join(repoRoot, rel);
      lines.push(`- \`${rel}\` — ${(await readFile(abs)).length} bytes, sha256 \`${await sha256File(abs)}\``);
    }
    lines.push("", "## Probe", "", "```json", JSON.stringify(probes, null, 2), "```");
    await writeFile(path.join(outDir, "INVENTORY.md"), lines.join("\n"));
    if (!Object.values(probes).every((p) => p?.ok)) {
      console.error(probes);
      process.exitCode = 1;
    }
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
