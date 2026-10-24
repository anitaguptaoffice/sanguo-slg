/**
 * ART-UI-FILTER-008 runtime engineering acceptance (mail + daily filter panels).
 * Usage: cd client && npm install && npx playwright install chromium && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/art-ui-filter-008/runtime");

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19092);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16207);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const TIP_SHA = "8c45fa1ac3429cec3811211d34cc3c7a7d158f50";
const FILTER_CHIP_HIT_MIN = 44;
const MAX_JPEG_BYTES = 1_000_000;

const VIEWPORTS = [
  { tag: "1600x900-dpr1", width: 1600, height: 900, dpr: 1 },
  { tag: "1600x900-dpr2", width: 1600, height: 900, dpr: 2 },
  { tag: "1280x720", width: 1280, height: 720, dpr: 1 },
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

async function enterMainCity(page) {
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 25000 },
  );
  await page.waitForSelector(".main-city-toolbar.art-chrome-toolbar", { timeout: 15000 });
}

async function openMailPanel(page) {
  await page.locator('[data-action="toggle-mail"]').click();
  await page.waitForSelector('.mail-inbox-panel:not(.hidden)', { timeout: 8000 });
  await page.locator('[data-action="refresh-mail"]').click();
  await page.waitForTimeout(450);
}

async function openDailyPanel(page) {
  await page.locator('[data-action="toggle-daily"]').click();
  await page.waitForSelector('[data-center-panel="daily"]:not(.hidden)', { timeout: 8000 });
  await page.locator('[data-action="refresh-daily"]').click();
  await page.waitForTimeout(450);
}

async function writeJpegUnder1Mb(page, filePath, screenshotOpts) {
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

async function shotFilterPanel(page, panelSelector, filePath) {
  const panel = page.locator(panelSelector);
  await panel.waitFor({ state: "visible" });
  const box = await panel.boundingBox();
  if (!box) throw new Error(`panel box missing: ${panelSelector}`);
  const pad = 8;
  return writeJpegUnder1Mb(page, filePath, {
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
}

/** Mirrors `probeFilterChipHitMeetsMin` in artFilterChipRuntime.ts (DOM layout + CSS min fallback). */
async function probeFilterChipsInPanel(page, panelSelector) {
  return page.evaluate(
    ({ panelSelector, min }) => {
      const panel = document.querySelector(panelSelector);
      if (!panel) return { error: "panel missing", chips: [] };
      const chips = Array.from(panel.querySelectorAll("button[data-ui-filter-chip]"));
      function readCssMin(btn) {
        const style = getComputedStyle(btn);
        return {
          minWidth: Number.parseFloat(style.minWidth) || 0,
          minHeight: Number.parseFloat(style.minHeight) || 0,
        };
      }
      function probe(btn) {
        const rect = btn.getBoundingClientRect();
        const css = readCssMin(btn);
        const meets =
          rect.width > 0 && rect.height > 0
            ? rect.width >= min && rect.height >= min
            : css.minWidth >= min && css.minHeight >= min;
        return {
          action: btn.getAttribute("data-action") ?? btn.dataset.filter ?? "",
          label: btn.querySelector(".art-filter-chip-label")?.textContent?.trim() ?? btn.textContent?.trim() ?? "",
          skinned: btn.classList.contains("art-filter-chip"),
          rect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
          cssMin: css,
          probeMethod: rect.width > 0 && rect.height > 0 ? "getBoundingClientRect" : "getComputedStyle(minWidth/minHeight)",
          meetsMin44: meets,
        };
      }
      return { chipCount: chips.length, chips: chips.map(probe) };
    },
    { panelSelector, min: FILTER_CHIP_HIT_MIN },
  );
}

async function probeCountBadgesInPanel(page, panelSelector) {
  return page.evaluate((panelSelector) => {
    const panel = document.querySelector(panelSelector);
    if (!panel) return { error: "panel missing", badges: [] };
    const badges = Array.from(panel.querySelectorAll("[data-ui-filter-badge='count']"));
    return {
      badgeCount: badges.length,
      badges: badges.map((el) => {
        const rect = el.getBoundingClientRect();
        const count = Number(el.dataset.filterBadgeCount ?? "0");
        const style = getComputedStyle(el);
        return {
          role: el.getAttribute("data-role") ?? null,
          filterBadgeCount: count,
          hiddenAttr: el.hidden,
          hasHiddenClass: el.classList.contains("hidden"),
          display: style.display,
          visibility: style.visibility,
          rect: { width: rect.width, height: rect.height },
          entireNodeHiddenWhenZero: count === 0 ? el.hidden && el.classList.contains("hidden") : null,
          visibleWhenPositive: count > 0 ? !el.hidden && !el.classList.contains("hidden") : null,
        };
      }),
    };
  }, panelSelector);
}

async function captureScenario(browser, { preset, panel, openFn, panelSelector, filePrefix }) {
  await setEvidencePreset(preset);
  const shots = {};
  const probes = {};
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
    });
    const page = await context.newPage();
    await enterMainCity(page);
    await openFn(page);
    const file = `${filePrefix}-${vp.tag}.jpg`;
    const meta = await shotFilterPanel(page, panelSelector, path.join(outDir, file));
    const chipProbe = await probeFilterChipsInPanel(page, panelSelector);
    const badgeProbe = await probeCountBadgesInPanel(page, panelSelector);
    shots[vp.tag] = { file, ...meta };
    probes[vp.tag] = { chips: chipProbe, badges: badgeProbe };
    await context.close();
  }
  return { panel, preset, shots, probes };
}

async function captureMailBadgeZero(browser) {
  await setEvidencePreset("mail-empty");
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  await openMailPanel(page);
  const file = "mail-filters-badge-zero-1600x900-dpr1.jpg";
  const meta = await shotFilterPanel(page, ".mail-inbox-panel", path.join(outDir, file));
  const badges = await probeCountBadgesInPanel(page, ".mail-inbox-panel");
  await context.close();
  return { file, ...meta, badges };
}

function summarizePassFail(evidence) {
  const chipRows = [];
  const badgeRows = [];
  for (const [panelKey, block] of Object.entries(evidence.panels)) {
    for (const [vp, probe] of Object.entries(block.probes)) {
      for (const chip of probe.chips.chips ?? []) {
        chipRows.push({
          panel: panelKey,
          viewport: vp,
          chip: chip.action || chip.label,
          meetsMin44: chip.meetsMin44,
          w: chip.rect.width,
          h: chip.rect.height,
        });
      }
      for (const b of probe.badges.badges ?? []) {
        badgeRows.push({
          panel: panelKey,
          viewport: vp,
          role: b.role,
          count: b.filterBadgeCount,
          zeroHiddenOk:
            b.filterBadgeCount === 0
              ? b.entireNodeHiddenWhenZero
              : b.visibleWhenPositive,
        });
      }
    }
  }
  const chipsPass = chipRows.every((r) => r.meetsMin44);
  const badgesPass = badgeRows.every((r) => r.zeroHiddenOk === true || r.zeroHiddenOk === null);
  const zeroProbe = evidence.mailBadgeZero.badges.badges ?? [];
  const zeroPass = zeroProbe.every(
    (b) => b.filterBadgeCount === 0 && b.hiddenAttr && b.hasHiddenClass && b.entireNodeHiddenWhenZero,
  );
  return { chipRows, badgeRows, chipsPass, badgesPass, zeroPass, overall: chipsPass && badgesPass && zeroPass };
}

async function writeIntegrationQa(evidence, summary) {
  const lines = [
    "# ART-UI-FILTER-008 运行时工程验收（非美术静态 PASS）",
    "",
    `| 项 | 值 |`,
    `|---|---|`,
    `| tip SHA | \`${TIP_SHA}\` |`,
    `| 范围 | 邮件 + 日常筛选面板（wave:27 CLIENT-121～127 + #509 mount） |`,
    `| 采集 | Playwright Chromium + mock 网关 + vite dev |`,
    `| 再生 | \`cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs\` |`,
    "",
    "## 结论（工程探针 + JPEG）",
    "",
    `| 检查项 | 结果 |`,
    `|---|---|`,
    `| 筛选 chip DOM ≥44×44（\`getBoundingClientRect\` / CSS min 回退，对齐 \`probeFilterChipHitMeetsMin\`） | **${summary.chipsPass ? "PASS" : "FAIL"}** |`,
    `| count>0 角标节点可见 | **${summary.badgesPass ? "PASS" : "FAIL"}** |`,
    `| count=0 整块角标节点 \`hidden\` + \`.hidden\`（非仅空文案） | **${summary.zeroPass ? "PASS" : "FAIL"}** |`,
    `| 综合（本包工程终验证据，仍非美术签字） | **${summary.overall ? "PASS" : "FAIL"}** |`,
    "",
    "## 视口 JPEG",
    "",
    "| 文件 | 视口 | 面板 |",
    "|---|---|---|",
  ];
  for (const [panel, block] of Object.entries(evidence.panels)) {
    for (const [vp, shot] of Object.entries(block.shots)) {
      lines.push(`| \`runtime/${shot.file}\` | ${vp} | ${panel} |`);
    }
  }
  lines.push(`| \`runtime/${evidence.mailBadgeZero.file}\` | 1600×900 DPR1 | mail（空收件箱，角标归零） |`);
  lines.push("");
  lines.push("## Chip 探针明细（px）");
  lines.push("");
  lines.push("| 面板 | 视口 | chip | width | height | ≥44 |");
  lines.push("|---|---|---|---:|---:|---|");
  for (const r of summary.chipRows) {
    lines.push(
      `| ${r.panel} | ${r.viewport} | ${r.chip} | ${r.w.toFixed(1)} | ${r.h.toFixed(1)} | ${r.meetsMin44 ? "Y" : "N"} |`,
    );
  }
  lines.push("");
  lines.push("## 角标探针");
  lines.push("");
  lines.push("| 面板 | 视口 | role | count | 归零隐藏 OK |");
  lines.push("|---|---|---|---:|---|");
  for (const r of summary.badgeRows) {
    lines.push(`| ${r.panel} | ${r.viewport} | ${r.role ?? "—"} | ${r.count} | ${r.zeroHiddenOk ? "Y" : "N"} |`);
  }
  lines.push("");
  lines.push("详细 JSON：`probe-log.json`。");
  lines.push("");
  lines.push(
    "> **说明**：`docs/art/samples/art-ui-filter-008/hit-proof.json` 为静态挂载契约；本目录为 tip 上 **运行时** 接线证据，供 PR #108 工程终验引用。Draft #506 / art hold #108 **未合并**；本结论 **不是** 美术静态 PASS。",
  );
  await writeFile(path.join(outDir, "..", "INTEGRATION-QA.md"), `${lines.join("\n")}\n`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT) },
  });
  const dev = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws` },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await waitForHttp(`${MOCK_HTTP}/`);

    const browser = await chromium.launch();
    const mail = await captureScenario(browser, {
      preset: "mail-unread-multi",
      panel: "mail",
      openFn: openMailPanel,
      panelSelector: ".mail-inbox-panel",
      filePrefix: "mail-filters",
    });
    const daily = await captureScenario(browser, {
      preset: "daily-claimable",
      panel: "daily",
      openFn: openDailyPanel,
      panelSelector: '[data-center-panel="daily"]',
      filePrefix: "daily-filters",
    });
    const mailBadgeZero = await captureMailBadgeZero(browser);
    await browser.close();

    const evidence = {
      task: "ART-UI-FILTER-008",
      tip_sha: TIP_SHA,
      captured_at: new Date().toISOString(),
      note: "Runtime JPEG + DOM probes for engineering acceptance; not art-board static PASS.",
      panels: { mail, daily },
      mailBadgeZero,
    };
    const summary = summarizePassFail(evidence);
    evidence.summary = {
      chipsPass: summary.chipsPass,
      badgesPass: summary.badgesPass,
      zeroPass: summary.zeroPass,
      overall: summary.overall,
    };
    await writeFile(path.join(outDir, "probe-log.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await writeIntegrationQa(evidence, summary);

    let gitTip = TIP_SHA;
    try {
      gitTip = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
    } catch {
      /* use pinned */
    }
    if (gitTip !== TIP_SHA) {
      console.warn(`HEAD ${gitTip} differs from pinned evidence tip ${TIP_SHA}`);
    }
    console.log(`Runtime evidence written to ${outDir} (overall ${summary.overall ? "PASS" : "FAIL"})`);
    if (!summary.overall) process.exit(2);
  } finally {
    mock.kill("SIGTERM");
    dev.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
