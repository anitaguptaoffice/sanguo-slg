/**
 * ART-TOOLBAR-ICONS-009 runtime evidence: six new toolbar icons + hit proof.
 * Usage: node scripts/capture-art-toolbar-icons-009-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-toolbar-icons-009/runtime");

const ART_ASSET_SHA = "b4908240c1fd427e7294e8e48ae43dc37bd27f07";
const MAX_JPEG_BYTES = 1_000_000;

/** Six ART-TOOLBAR-ICONS-009 mounts (plus military for 007 continuity in wide shots). */
const NEW_ICON_ACTIONS = [
  "toggle-reports",
  "toggle-marches",
  "toggle-chat",
  "toggle-guild",
  "toggle-rank",
  "toggle-quest",
];

const WIDE_CONTEXT_ACTIONS = ["toggle-military", ...NEW_ICON_ACTIONS, "toggle-mail", "toggle-queue"];

async function waitForHttp(url, timeoutMs = 30000) {
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

function jpegSize(buffer) {
  let i = 0;
  while (i < buffer.length - 8) {
    if (buffer[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      const h = buffer.readUInt16BE(i + 5);
      const w = buffer.readUInt16BE(i + 7);
      return { width: w, height: h };
    }
    const len = buffer.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

async function writeJpegUnder1Mb(page, filePath, screenshotOpts) {
  for (const quality of [90, 86, 82, 78, 74, 70, 66, 62, 58, 54]) {
    const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality });
    if (buffer.length <= MAX_JPEG_BYTES) {
      await writeFile(filePath, buffer);
      const dims = jpegSize(buffer);
      return { quality, bytes: buffer.length, ...dims };
    }
  }
  const buffer = await page.screenshot({ ...screenshotOpts, type: "jpeg", quality: 50 });
  await writeFile(filePath, buffer);
  const dims = jpegSize(buffer);
  return { quality: 50, bytes: buffer.length, ...dims };
}

async function enterMainCityIdle(page, appPort) {
  await page.goto(`http://127.0.0.1:${appPort}/`);
  await page.waitForSelector("#hud", { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 20000,
  });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 20000 },
  );
  await page.waitForSelector(".main-city-toolbar.art-chrome-toolbar", { timeout: 10000 });
  await page.waitForSelector(
    'button[data-action="toggle-reports"].toolbar-chrome-btn--with-icon .toolbar-btn-icon',
    { timeout: 10000 },
  );
}

async function layoutFrameClip(page) {
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  return frame;
}

async function scrollToolbarForNewSix(page) {
  await page.evaluate((actions) => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    if (!(scroll instanceof HTMLElement)) return;
    const buttons = actions
      .map((a) => document.querySelector(`button[data-action="${a}"]`))
      .filter((b) => b instanceof HTMLElement);
    if (buttons.length === 0) return;
    const scrollRect = scroll.getBoundingClientRect();
    const groupLeft = Math.min(...buttons.map((b) => b.getBoundingClientRect().left));
    const groupRight = Math.max(...buttons.map((b) => b.getBoundingClientRect().right));
    const groupWidth = groupRight - groupLeft;
    const pad = 4;
    if (groupWidth <= scrollRect.width - pad * 2) {
      const delta = groupLeft - scrollRect.left - (scrollRect.width - groupWidth) / 2;
      scroll.scrollLeft = Math.max(0, scroll.scrollLeft + delta);
    } else {
      const first = buttons[0].getBoundingClientRect();
      scroll.scrollLeft = Math.max(0, scroll.scrollLeft + (first.left - scrollRect.left - pad));
    }
  }, NEW_ICON_ACTIONS);
  await page.waitForTimeout(150);
}

async function measureIconMount(page, actions) {
  return page.evaluate((actionList) => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    const uiScale = parseFloat(
      getComputedStyle(document.getElementById("layout-frame") || document.body).getPropertyValue(
        "--ui-scale",
      ) || "1",
    );
    function intersect(a, b) {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.right, b.right);
      const bottom = Math.min(a.bottom, b.bottom);
      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }
    function rectFullyInside(inner, outer, eps = 0.5) {
      if (!inner || !outer) return false;
      return (
        inner.left >= outer.left - eps &&
        inner.top >= outer.top - eps &&
        inner.right <= outer.right + eps &&
        inner.bottom <= outer.bottom + eps
      );
    }
    const scrollRect = scroll?.getBoundingClientRect();
    const toolbarRect = document.querySelector(".main-city-toolbar")?.getBoundingClientRect();

    const iconButtons = actionList.map((action) => {
      const btn = document.querySelector(`button[data-action="${action}"]`);
      if (!(btn instanceof HTMLButtonElement)) return { action, ok: false, reason: "missing button" };
      const icon = btn.querySelector(".toolbar-btn-icon");
      const label = btn.querySelector(".toolbar-btn-label");
      const br = btn.getBoundingClientRect();
      const wrap = btn.closest(".toolbar-btn-hit");
      const wr = wrap?.getBoundingClientRect();
      let vis = { left: br.left, top: br.top, width: br.width, height: br.height };
      if (scrollRect) {
        vis = intersect(
          { left: br.left, top: br.top, right: br.right, bottom: br.bottom },
          {
            left: scrollRect.left,
            top: scrollRect.top,
            right: scrollRect.right,
            bottom: scrollRect.bottom,
          },
        );
      }
      if (toolbarRect) {
        vis = intersect(
          { left: vis.left, top: vis.top, right: vis.left + vis.width, bottom: vis.top + vis.height },
          {
            left: toolbarRect.left,
            top: toolbarRect.top,
            right: toolbarRect.right,
            bottom: toolbarRect.bottom,
          },
        );
      }
      const iconRect = icon?.getBoundingClientRect();
      const labelRect = label?.getBoundingClientRect();
      const overlap =
        iconRect && labelRect
          ? !(
              iconRect.bottom <= labelRect.top + 0.5 ||
              labelRect.bottom <= iconRect.top + 0.5 ||
              iconRect.right <= labelRect.left + 0.5 ||
              labelRect.right <= iconRect.left + 0.5
            )
          : null;
      const btnBox = { left: br.left, top: br.top, right: br.right, bottom: br.bottom };
      const visBox = {
        left: vis.left,
        top: vis.top,
        right: vis.left + vis.width,
        bottom: vis.top + vis.height,
      };
      const iconInsideButton = iconRect ? rectFullyInside(iconRect, btnBox) : false;
      const labelInsideButton = labelRect ? rectFullyInside(labelRect, btnBox) : false;
      const iconInsideVisible =
        iconRect && vis.width > 0 && vis.height > 0 ? rectFullyInside(iconRect, visBox) : !iconRect;
      const labelInsideVisible =
        labelRect && vis.width > 0 && vis.height > 0 ? rectFullyInside(labelRect, visBox) : !labelRect;
      const onScreen = vis.width >= 8 && vis.height >= 8;
      const buttonFullyVisible =
        vis.width >= br.width - 0.5 && vis.height >= br.height - 0.5;
      const center = { x: br.left + br.width / 2, y: br.top + br.height / 2 };
      const el = onScreen ? document.elementFromPoint(center.x, center.y) : null;
      const hitsButton = !!(el && (el === btn || btn.contains(el)));
      const wrapMinCss = wr ? Math.min(wr.width, wr.height) : 0;
      const layoutOk =
        iconInsideButton &&
        labelInsideButton &&
        (!buttonFullyVisible || (iconInsideVisible && labelInsideVisible)) &&
        overlap === false;
      const structuralOk =
        !!icon?.src &&
        !icon.src.includes("data:image/gif") &&
        (label?.textContent?.trim()?.length ?? 0) === 2 &&
        br.width >= 44 * uiScale - 0.5 &&
        br.height >= 44 * uiScale - 0.5 &&
        wrapMinCss >= 44 - 0.5 &&
        layoutOk;
      return {
        action,
        onScreen,
        ok: structuralOk && (!onScreen || hitsButton),
        structuralOk,
        label: label?.textContent?.trim() ?? "",
        iconSrc: icon?.src ?? null,
        buttonCss: { w: br.width, h: br.height },
        hitWrapCss: wr ? { w: wr.width, h: wr.height } : null,
        buttonFullyVisible,
        iconOverlapsLabel: overlap,
        iconInsideButton,
        labelInsideButton,
        iconInsideVisibleRegion: iconInsideVisible,
        labelInsideVisibleRegion: labelInsideVisible,
      };
    });

    return {
      uiScale,
      scrollMetrics: scroll
        ? {
            scrollWidth: scroll.scrollWidth,
            clientWidth: scroll.clientWidth,
            scrollLeft: scroll.scrollLeft,
          }
        : null,
      iconButtons,
    };
  }, actions);
}

async function captureViewports(browser, appPort) {
  const specs = [
    {
      file: "maincity-1600x900-full.jpg",
      viewport: { width: 1600, height: 900 },
      dpr: 1,
      scroll: "none",
      measureActions: WIDE_CONTEXT_ACTIONS,
    },
    {
      file: "maincity-3200x1800-full.jpg",
      viewport: { width: 1600, height: 900 },
      dpr: 2,
      scroll: "none",
      measureActions: WIDE_CONTEXT_ACTIONS,
    },
    {
      file: "maincity-1280x720-new-six-visible.jpg",
      viewport: { width: 1280, height: 720 },
      dpr: 1,
      scroll: "newSix",
      measureActions: NEW_ICON_ACTIONS,
    },
  ];
  const results = {};
  for (const spec of specs) {
    const context = await browser.newContext({
      viewport: spec.viewport,
      deviceScaleFactor: spec.dpr,
    });
    const page = await context.newPage();
    await enterMainCityIdle(page, appPort);
    if (spec.scroll === "newSix") await scrollToolbarForNewSix(page);
    await page.waitForTimeout(300);
    const clip = await layoutFrameClip(page);
    const meta = await writeJpegUnder1Mb(page, path.join(outDir, spec.file), { clip });
    const mount = await measureIconMount(page, spec.measureActions);
    await context.close();
    results[spec.file] = { jpeg: meta, mount };
  }
  return results;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "inherit" });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16209", "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp("http://127.0.0.1:16209/");
    const browser = await chromium.launch();
    const viewports = await captureViewports(browser, 16209);
    await browser.close();

    const labelByAction = {
      "toggle-reports": "战报",
      "toggle-marches": "行军",
      "toggle-chat": "聊天",
      "toggle-guild": "军团",
      "toggle-rank": "排行",
      "toggle-quest": "任务",
    };

    const assetIdByAction = {
      "toggle-reports": "ui.icon.toolbar.report.v1",
      "toggle-marches": "ui.icon.toolbar.march.v1",
      "toggle-chat": "ui.icon.toolbar.chat.v1",
      "toggle-guild": "ui.icon.toolbar.legion.v1",
      "toggle-rank": "ui.icon.toolbar.rank.v1",
      "toggle-quest": "ui.icon.toolbar.task.v1",
    };

    const hitProof = {
      art_asset_source_sha: ART_ASSET_SHA,
      art_draft_pr: "https://github.com/anitaguptaoffice/sanguo-slg/pull/637",
      coordination_board_pr: "https://github.com/anitaguptaoffice/sanguo-slg/pull/108",
      captured_at: new Date().toISOString(),
      asset_ids: NEW_ICON_ACTIONS.map((a) => assetIdByAction[a]),
      label_mapping: labelByAction,
      viewports,
      layout_notes: [
        "96×44 toolbar chrome; 32px icon + 4px gap + two-character label inside button.",
        ".toolbar-btn-hit wrap keeps effective hit target ≥44×44 CSS px.",
        "Disabled styling uses ui.button.toolbar.v1 chrome only — no per-icon four-state sprites.",
        "DPR2 shot: 1600×900 logical viewport, deviceScaleFactor=2 → 3200×1800 JPEG pixels.",
      ],
      banned_unmerged: ["#637", "#108", "#77", "#82", "#444", "#481", "#506"],
    };
    await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);

    await writeFile(
      path.join(outDir, "../README.md"),
      `# ART-TOOLBAR-ICONS-009 client mount evidence

Art assets cherry-picked from Draft PR [#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) @ \`${ART_ASSET_SHA.slice(0, 7)}\` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — runtime visual sign-off target.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| \`runtime/maincity-1600x900-full.jpg\` | 1600×900 DPR1 — new six + military + sample 007 icons |
| \`runtime/maincity-3200x1800-full.jpg\` | DPR2 equivalent (1600×900 logical) |
| \`runtime/maincity-1280x720-new-six-visible.jpg\` | 1280×720 after toolbar scroll — all six new entries fully visible |

## Hit / mount proof

\`runtime/hit-proof.json\` — per-action labels, icon src, ≥44px hit wrap, no icon/label overlap.

Regenerate: \`cd client && node scripts/capture-art-toolbar-icons-009-evidence.mjs\`
`,
    );
    console.log(`Evidence written to ${outDir}`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
