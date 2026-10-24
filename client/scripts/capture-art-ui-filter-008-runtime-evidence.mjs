/**
 * ART-UI-FILTER-008 runtime evidence (CLIENT-136): full-viewport JPEG + layout probes.
 * Usage: cd client && npm install && npx playwright install chromium && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const FILTER_CHIP_HIT_MIN = 44;
const FILTER_CHIP_DISPLAY_W = 72;
const FILTER_CHIP_DISPLAY_H = 32;
const MAX_JPEG_BYTES = 1_000_000;

const VIEWPORTS = [
  { tag: "1600x900", width: 1600, height: 900, dpr: 1 },
  { tag: "3200x1800", width: 1600, height: 900, dpr: 2 },
  { tag: "1280x720", width: 1280, height: 720, dpr: 1 },
];

const CHIP_STATES = ["normal", "hover", "pressed", "selected"];
const ROW_STATES = ["default", "hover", "selected"];

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
  await page.waitForTimeout(500);
}

async function openDailyPanel(page) {
  await page.locator('[data-action="toggle-daily"]').click();
  await page.waitForSelector('[data-center-panel="daily"]:not(.hidden)', { timeout: 8000 });
  await page.locator('[data-action="refresh-daily"]').click();
  await page.waitForTimeout(500);
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

async function shotFullViewport(page, filePath) {
  return writeJpegUnder1Mb(page, filePath, { fullPage: false });
}

function readJpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marker = buffer[i + 1];
    if (marker === 0xc0 || marker === 0xc2 || marker === 0xc1) {
      return {
        height: buffer.readUInt16BE(i + 5),
        width: buffer.readUInt16BE(i + 7),
      };
    }
    const len = buffer.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

async function verifyExportedJpegs(files, expectedByTag) {
  const report = [];
  for (const rel of files) {
    const abs = path.join(outDir, rel);
    const buf = await readFile(abs);
    const size = readJpegSize(buf);
    const expected = expectedByTag[rel];
    const ok =
      buf.length > 0 &&
      buf.length < MAX_JPEG_BYTES &&
      size &&
      (!expected || (size.width === expected.width && size.height === expected.height));
    report.push({
      file: rel,
      bytes: buf.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      under1mb: buf.length < MAX_JPEG_BYTES,
      dimensionsOk: ok,
    });
    if (!ok) {
      throw new Error(`JPEG verify failed for ${rel}: ${JSON.stringify(report.at(-1))}`);
    }
  }
  return report;
}

/** Mirrors artFilterChipRuntime probes (sprite fit, overlap, elementFromPoint). */
async function probeFilterChipsInPanel(page, panelSelector) {
  return page.evaluate(
    ({ panelSelector, min, displayW, displayH }) => {
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
      function probeSprite(btn) {
        const sprite = btn.querySelector(".art-filter-chip-sprite");
        if (!sprite) return null;
        const btnRect = btn.getBoundingClientRect();
        const spriteRect = sprite.getBoundingClientRect();
        const spriteArea = spriteRect.width * spriteRect.height;
        const visibleIntersectionArea = (() => {
          const w = Math.max(0, Math.min(btnRect.right, spriteRect.right) - Math.max(btnRect.left, spriteRect.left));
          const h = Math.max(0, Math.min(btnRect.bottom, spriteRect.bottom) - Math.max(btnRect.top, spriteRect.top));
          return w * h;
        })();
        return {
          spriteRect: {
            width: spriteRect.width,
            height: spriteRect.height,
            left: spriteRect.left,
            top: spriteRect.top,
          },
          btnRect: { width: btnRect.width, height: btnRect.height },
          spriteFitsButton:
            spriteRect.width <= btnRect.width + 0.5 && spriteRect.height <= btnRect.height + 0.5,
          spriteFullyInsideButton:
            spriteRect.left >= btnRect.left - 0.5 &&
            spriteRect.right <= btnRect.right + 0.5 &&
            spriteRect.top >= btnRect.top - 0.5 &&
            spriteRect.bottom <= btnRect.bottom + 0.5,
          expectedDisplay: { w: displayW, h: displayH },
          visibleIntersectionArea,
          spriteArea,
          intersectionCoversSprite:
            spriteArea > 0 ? visibleIntersectionArea / spriteArea >= 0.98 : false,
        };
      }
      function probeFromPoint(btn) {
        const rect = btn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const top = document.elementFromPoint(x, y);
        return {
          centerHitsChip: top === btn || (top != null && btn.contains(top)),
          topTag: top?.tagName ?? null,
        };
      }
      function probe(btn, index) {
        const rect = btn.getBoundingClientRect();
        const css = readCssMin(btn);
        const meets =
          rect.width > 0 && rect.height > 0
            ? rect.width >= min && rect.height >= min
            : css.minWidth >= min && css.minHeight >= min;
        const labelStyle = btn.querySelector(".art-filter-chip-label")
          ? getComputedStyle(btn.querySelector(".art-filter-chip-label"))
          : getComputedStyle(btn);
        return {
          index,
          action: btn.getAttribute("data-action") ?? btn.dataset.filter ?? "",
          label: btn.querySelector(".art-filter-chip-label")?.textContent?.trim() ?? btn.textContent?.trim() ?? "",
          skinned: btn.classList.contains("art-filter-chip--skinned"),
          rect: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
          cssMin: css,
          labelColor: labelStyle.color,
          probeMethod: rect.width > 0 && rect.height > 0 ? "getBoundingClientRect" : "getComputedStyle(minWidth/minHeight)",
          meetsMin44: meets,
          sprite: probeSprite(btn),
          elementFromPoint: probeFromPoint(btn),
          filterChipState: btn.dataset.filterChipState ?? null,
        };
      }
      const probed = chips.map(probe);
      const overlaps = [];
      for (let i = 0; i < chips.length; i++) {
        for (let j = i + 1; j < chips.length; j++) {
          const a = chips[i].getBoundingClientRect();
          const b = chips[j].getBoundingClientRect();
          const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const area = w * h;
          if (area > 1) overlaps.push({ indexA: i, indexB: j, overlapArea: area });
        }
      }
      return { chipCount: chips.length, chips: probed, adjacentHitOverlaps: overlaps };
    },
    {
      panelSelector,
      min: FILTER_CHIP_HIT_MIN,
      displayW: FILTER_CHIP_DISPLAY_W,
      displayH: FILTER_CHIP_DISPLAY_H,
    },
  );
}

async function probeRowsInPanel(page, panelSelector) {
  return page.evaluate((panelSelector) => {
    const rows = Array.from(document.querySelectorAll(`${panelSelector} [data-ui-filter-row]`));
    return rows.slice(0, 6).map((row, index) => {
      const rect = row.getBoundingClientRect();
      const style = getComputedStyle(row);
      return {
        index,
        skinned: row.classList.contains("art-filter-row--skinned"),
        rowState: row.dataset.filterRowState ?? (row.classList.contains("selected") ? "selected" : "default"),
        height: rect.height,
        color: style.color,
        minHeightCss: style.minHeight,
      };
    });
  }, panelSelector);
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
        const label = el.querySelector(".art-filter-badge-count-label, .art-badge-count-label");
        return {
          role: el.getAttribute("data-role") ?? null,
          filterBadgeCount: count,
          labelText: label?.textContent?.trim() ?? el.textContent?.trim() ?? "",
          hiddenAttr: el.hidden,
          hasHiddenClass: el.classList.contains("hidden"),
          display: style.display,
          rect: { width: rect.width, height: rect.height },
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
    const meta = await shotFullViewport(page, path.join(outDir, file));
    const chipProbe = await probeFilterChipsInPanel(page, panelSelector);
    const badgeProbe = await probeCountBadgesInPanel(page, panelSelector);
    const rowProbe = await probeRowsInPanel(page, panelSelector);
    shots[vp.tag] = { file, ...meta, viewport: vp };
    probes[vp.tag] = { chips: chipProbe, badges: badgeProbe, rows: rowProbe };
    await context.close();
  }
  return { panel, preset, shots, probes };
}

async function captureChipStateSheet(browser) {
  await setEvidencePreset("mail-empty");
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  await openMailPanel(page);
  const states = await page.evaluate(({ chipStates }) => {
    const chips = Array.from(
      document.querySelectorAll('.mail-inbox-panel button[data-ui-filter-chip]'),
    ).slice(0, chipStates.length);
    return chipStates.map((state, i) => {
      const btn = chips[i];
      if (!btn) return { state, missing: true };
      btn.setAttribute("aria-pressed", state === "selected" ? "true" : "false");
      btn.classList.toggle("selected", state === "selected");
      btn.classList.toggle("active", state === "selected");
      const sprite = btn.querySelector(".art-filter-chip-sprite");
      if (sprite) sprite.dataset.filterChipState = state;
      btn.dataset.filterChipState = state;
      return {
        state,
        action: btn.getAttribute("data-action"),
        filterChipState: btn.dataset.filterChipState,
      };
    });
  }, { chipStates: CHIP_STATES });
  const file = "mail-chips-four-states-1600x900.jpg";
  const meta = await shotFullViewport(page, path.join(outDir, file));
  await context.close();
  return { file, ...meta, states };
}

async function captureRowStateSheet(browser) {
  await setEvidencePreset("mail-unread-multi");
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  await openMailPanel(page);
  const rows = await page.evaluate(({ rowStates }) => {
    const list = Array.from(document.querySelectorAll(".mail-inbox-panel .mail-list [data-ui-filter-row]"));
    return rowStates.map((state, i) => {
      const row = list[i];
      if (!row) return { state, missing: true };
      row.classList.remove("selected");
      delete row.dataset.filterRowState;
      if (state === "selected") row.classList.add("selected");
      if (state === "hover") row.dataset.filterRowState = "hover";
      return {
        state,
        height: row.getBoundingClientRect().height,
        skinned: row.classList.contains("art-filter-row--skinned"),
      };
    });
  }, { rowStates: ROW_STATES });
  const file = "mail-rows-three-states-1600x900.jpg";
  const meta = await shotFullViewport(page, path.join(outDir, file));
  await context.close();
  return { file, ...meta, rows };
}

async function captureBadgeNine(browser) {
  await setEvidencePreset("mail-filter-badge-nine");
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await enterMainCity(page);
  await openMailPanel(page);
  const badges = await probeCountBadgesInPanel(page, ".mail-inbox-panel");
  const file = "mail-badge-count-nine-1600x900.jpg";
  const meta = await shotFullViewport(page, path.join(outDir, file));
  await context.close();
  return { file, ...meta, badges };
}

function summarizePassFail(evidence) {
  const chipRows = [];
  const badgeRows = [];
  let spritePass = true;
  let overlapPass = true;
  let fromPointPass = true;
  let labelColorPass = true;
  let rowHeightPass = true;

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
          spriteInside: chip.sprite?.spriteFullyInsideButton ?? null,
          overlapFree: (probe.chips.adjacentHitOverlaps ?? []).length === 0,
          centerHits: chip.elementFromPoint?.centerHitsChip ?? null,
        });
        if (chip.skinned && chip.sprite && !chip.sprite.spriteFullyInsideButton) spritePass = false;
        if (chip.skinned && chip.sprite && !chip.sprite.intersectionCoversSprite) spritePass = false;
        if (chip.elementFromPoint && !chip.elementFromPoint.centerHitsChip) fromPointPass = false;
        if (chip.skinned && chip.labelColor && chip.labelColor !== "rgb(61, 46, 31)") {
          labelColorPass = false;
        }
      }
      if ((probe.chips.adjacentHitOverlaps ?? []).length > 0) overlapPass = false;
      for (const b of probe.badges.badges ?? []) {
        badgeRows.push({
          panel: panelKey,
          viewport: vp,
          role: b.role,
          count: b.filterBadgeCount,
          label: b.labelText,
        });
      }
      for (const row of probe.rows ?? []) {
        if (row.skinned && row.height > 0 && row.height < 38) rowHeightPass = false;
      }
    }
  }

  const chipsMinPass = chipRows.every((r) => r.meetsMin44);
  const nineBadge = evidence.badgeNine?.badges?.badges?.find(
    (b) => b.role === "mail-filter-unread-count",
  );
  const badgeNinePass = nineBadge && nineBadge.filterBadgeCount >= 9 && nineBadge.labelText.includes("9");
  const overall =
    chipsMinPass &&
    spritePass &&
    overlapPass &&
    fromPointPass &&
    labelColorPass &&
    rowHeightPass &&
    badgeNinePass;

  return {
    chipRows,
    badgeRows,
    chipsMinPass,
    spritePass,
    overlapPass,
    fromPointPass,
    labelColorPass,
    rowHeightPass,
    badgeNinePass,
    overall,
  };
}

async function writeIntegrationQa(evidence, summary, tipSha) {
  const lines = [
    "# ART-UI-FILTER-008 运行时工程验收（CLIENT-136 补证）",
    "",
    "| 项 | 值 |",
    "|---|---|",
    `| tip SHA | \`${tipSha}\` |`,
    `| 范围 | 邮件 + 日常；全视口 JPEG（非面板 crop） |`,
    `| 采集 | Playwright Chromium + mock 网关 + vite dev |`,
    `| 再生 | \`cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs\` |`,
    "",
    "## 结论（探针 + 目视 JPEG；非美术静态 PASS）",
    "",
    "| 检查项 | 结果 |",
    "|---|---|",
    `| chip DOM ≥44×44（仅进展指标，不单独等同完整命中 PASS） | **${summary.chipsMinPass ? "PASS" : "FAIL"}** |`,
    `| 72×32 精灵完全落在按钮可视槽内（可见交集） | **${summary.spritePass ? "PASS" : "FAIL"}** |`,
    `| 相邻 chip 命中盒无重叠 | **${summary.overlapPass ? "PASS" : "FAIL"}** |`,
    `| elementFromPoint 中心落点命中 chip | **${summary.fromPointPass ? "PASS" : "FAIL"}** |`,
    `| 纸底 chip 标签色 #3d2e1f | **${summary.labelColorPass ? "PASS" : "FAIL"}** |`,
    `| 九宫行高约 ≥40px | **${summary.rowHeightPass ? "PASS" : "FAIL"}** |`,
    `| count 9 / 9+ 角标（跳过 count=0 重拍） | **${summary.badgeNinePass ? "PASS" : "FAIL"}** |`,
    `| 综合工程补证 | **${summary.overall ? "PASS" : "FAIL"}** |`,
    "",
    "## 全视口 JPEG",
    "",
    "| 文件 | 视口 | 面板 |",
    "|---|---|---|",
  ];
  for (const [panel, block] of Object.entries(evidence.panels)) {
    for (const [vp, shot] of Object.entries(block.shots)) {
      lines.push(`| \`runtime/${shot.file}\` | ${vp} | ${panel} |`);
    }
  }
  lines.push(`| \`runtime/${evidence.chipStates.file}\` | 1600×900 | mail chip 四态 staging |`);
  lines.push(`| \`runtime/${evidence.rowStates.file}\` | 1600×900 | mail row 三态 staging |`);
  lines.push(`| \`runtime/${evidence.badgeNine.file}\` | 1600×900 | mail count 9+ |`);
  lines.push("");
  lines.push("详细 JSON：`probe-log.json`。");
  lines.push("");
  lines.push(
    "> **说明**：008 仍为「联调修正/补证中」，待美术在 #108 目视复签；Draft #506 / art hold **未合并**。",
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
  let tipSha = "pending";
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
    const chipStates = await captureChipStateSheet(browser);
    const rowStates = await captureRowStateSheet(browser);
    const badgeNine = await captureBadgeNine(browser);
    await browser.close();

    try {
      tipSha = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
    } catch {
      tipSha = "unknown";
    }

    const evidence = {
      task: "ART-UI-FILTER-008",
      client_task: "CLIENT-136",
      tip_sha: tipSha,
      captured_at: new Date().toISOString(),
      note: "Full-viewport runtime evidence; chip sprite/click probes; not art-board static PASS.",
      panels: { mail, daily },
      chipStates,
      rowStates,
      badgeNine,
    };
    const summary = summarizePassFail(evidence);
    evidence.summary = summary;

    const jpegFiles = [
      ...Object.values(mail.shots).map((s) => s.file),
      ...Object.values(daily.shots).map((s) => s.file),
      chipStates.file,
      rowStates.file,
      badgeNine.file,
    ];
    const expectedDims = {};
    for (const f of jpegFiles) {
      if (f.includes("3200x1800")) expectedDims[f] = { width: 3200, height: 1800 };
      else if (f.includes("1280x720")) expectedDims[f] = { width: 1280, height: 720 };
      else expectedDims[f] = { width: 1600, height: 900 };
    }
    evidence.jpegVerify = await verifyExportedJpegs(jpegFiles, expectedDims);

    await writeFile(path.join(outDir, "probe-log.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await writeIntegrationQa(evidence, summary, tipSha);

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
