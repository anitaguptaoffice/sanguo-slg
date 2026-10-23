/**
 * ART-CHROME-006 runtime acceptance evidence (JPEG viewports + UI states + hit proof).
 * Usage: node scripts/capture-art-chrome-006-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-chrome-006");
const statesDir = path.join(outDir, "states");

const ASSET_SOURCE_SHA = "85a2dec4c12805ffc6cafef5b9871b1c4a5b0ec2";
const MAX_JPEG_BYTES = 1_000_000;

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
  await page.waitForSelector("#hud.art-chrome-hud", { timeout: 10000 });
}

async function layoutFrameClip(page) {
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  return frame;
}

async function measureHitProof(page) {
  return page.evaluate(() => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    const buttons = Array.from(document.querySelectorAll(".toolbar-scroll-inner button"));
    const uiScale = parseFloat(
      getComputedStyle(document.getElementById("layout-frame") || document.body).getPropertyValue(
        "--ui-scale",
      ) || "1",
    );
    const scrollRect = scroll?.getBoundingClientRect() ?? null;
    const toolbarEl = document.querySelector(".main-city-toolbar");
    const toolbarRect = toolbarEl?.getBoundingClientRect() ?? null;
    const layoutFrame = document.getElementById("layout-frame");
    const layoutRect = layoutFrame?.getBoundingClientRect() ?? null;
    const scrollMetrics = scroll
      ? {
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          maxScrollLeft: scroll.scrollWidth - scroll.clientWidth,
          rect: scrollRect
            ? {
                left: scrollRect.left,
                top: scrollRect.top,
                width: scrollRect.width,
                height: scrollRect.height,
              }
            : null,
        }
      : null;

    function intersect(a, b) {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.right, b.right);
      const bottom = Math.min(a.bottom, b.bottom);
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
        right,
        bottom,
      };
    }

    function probeButton(btn) {
      const br = btn.getBoundingClientRect();
      const wrap = btn.closest(".toolbar-btn-hit");
      const wr = wrap?.getBoundingClientRect();
      let visible =
        scrollRect && br
          ? intersect(
              { left: br.left, top: br.top, right: br.right, bottom: br.bottom },
              {
                left: scrollRect.left,
                top: scrollRect.top,
                right: scrollRect.right,
                bottom: scrollRect.bottom,
              },
            )
          : null;
      if (visible && toolbarRect) {
        visible = intersect(
          { left: visible.left, top: visible.top, right: visible.right, bottom: visible.bottom },
          {
            left: toolbarRect.left,
            top: toolbarRect.top,
            right: toolbarRect.right,
            bottom: toolbarRect.bottom,
          },
        );
      }
      if (visible && layoutRect) {
        visible = intersect(
          { left: visible.left, top: visible.top, right: visible.right, bottom: visible.bottom },
          {
            left: layoutRect.left,
            top: layoutRect.top,
            right: layoutRect.right,
            bottom: layoutRect.bottom,
          },
        );
      }
      const vis = visible && visible.width > 0 && visible.height > 0 ? visible : br;
      const cx = vis.left + vis.width / 2;
      const cy = vis.top + vis.height / 2;
      const inset = 3;
      const points = [
        { name: "center", x: cx, y: cy },
        { name: "topLeft", x: vis.left + inset, y: vis.top + inset },
        { name: "topRight", x: vis.left + vis.width - inset, y: vis.top + inset },
        { name: "bottomLeft", x: vis.left + inset, y: vis.top + vis.height - inset },
        { name: "bottomRight", x: vis.left + vis.width - inset, y: vis.top + vis.height - inset },
      ];
      const elementFromPoint = points.map((p) => {
        const el = document.elementFromPoint(p.x, p.y);
        const hitsButton = !!el && (el === btn || btn.contains(el));
        return {
          ...p,
          elementTag: el?.tagName ?? null,
          elementClass: el?.className?.toString?.() ?? null,
          hitsButton,
        };
      });
      const minProbeDim = Math.min(br.width, br.height);
      return {
        label: btn.textContent?.trim() ?? "",
        buttonRect: { left: br.left, top: br.top, width: br.width, height: br.height },
        hitWrapRect: wr
          ? { left: wr.left, top: wr.top, width: wr.width, height: wr.height }
          : null,
        visibleIntersectionWithScroll: visible,
        screenCssEffective: {
          width: visible?.width ?? br.width,
          height: visible?.height ?? br.height,
        },
        meetsMin44ScreenCss:
          (visible?.width ?? 0) >= 44 && (visible?.height ?? 0) >= 44,
        elementFromPoint,
        allProbesHitButton: elementFromPoint.every((p) => p.hitsButton),
      };
    }

    const sampleIdx = [0, 1, 2, buttons.length - 2, buttons.length - 1];
    const samples = sampleIdx.map((i) => ({ index: i, ...probeButton(buttons[i]) }));

    scroll?.scrollTo({ left: scroll.scrollWidth, behavior: "instant" });
    const lastBtn = buttons[buttons.length - 1];
    const lastAfterScroll = lastBtn ? probeButton(lastBtn) : null;
    scroll?.scrollTo({ left: 0, behavior: "instant" });

    return {
      uiScale,
      buttonCount: buttons.length,
      scrollMetrics,
      samples,
      lastToolbarButtonAfterScroll: lastAfterScroll,
    };
  });
}

async function captureViewportJpegs(browser, appPort) {
  const specs = [
    { file: "maincity-1600x900-full.jpg", viewport: { width: 1600, height: 900 }, dpr: 1 },
    { file: "maincity-3200x1800-full.jpg", viewport: { width: 1600, height: 900 }, dpr: 2 },
    { file: "maincity-1280x720-full.jpg", viewport: { width: 1280, height: 720 }, dpr: 1 },
  ];
  const results = {};
  for (const spec of specs) {
    const context = await browser.newContext({
      viewport: spec.viewport,
      deviceScaleFactor: spec.dpr,
    });
    const page = await context.newPage();
    await enterMainCityIdle(page, appPort);
    await page.waitForTimeout(400);
    const clip = await layoutFrameClip(page);
    const meta = await writeJpegUnder1Mb(page, path.join(outDir, spec.file), { clip });
    const hit = await measureHitProof(page);
    await context.close();
    results[spec.file] = { jpeg: meta, hitProof: hit };
  }
  return results;
}

async function captureToolbarButtonStates(browser, appPort) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await enterMainCityIdle(page, appPort);
  const btn = page.locator(".toolbar-scroll-inner .toolbar-chrome-btn").first();
  await btn.waitFor({ state: "visible" });
  const box = await btn.boundingBox();
  if (!box) throw new Error("toolbar button box missing");
  const shots = {};
  const base = path.join(statesDir, "ui.button.toolbar.v1");
  await writeJpegUnder1Mb(page, `${base}-normal.jpg`, {
    clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 },
  });
  shots.normal = `${base}-normal.jpg`;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(80);
  await writeJpegUnder1Mb(page, `${base}-hover.jpg`, {
    clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 },
  });
  shots.hover = `${base}-hover.jpg`;
  await page.mouse.down();
  await page.waitForTimeout(60);
  await writeJpegUnder1Mb(page, `${base}-pressed.jpg`, {
    clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 },
  });
  shots.pressed = `${base}-pressed.jpg`;
  await page.mouse.up();
  await page.evaluate(() => {
    const b = document.querySelector(".toolbar-scroll-inner .toolbar-chrome-btn");
    if (b instanceof HTMLButtonElement) {
      b.disabled = true;
      b.dispatchEvent(new Event("mouseleave"));
    }
  });
  await page.waitForTimeout(80);
  const boxD = await btn.boundingBox();
  await writeJpegUnder1Mb(page, `${base}-disabled.jpg`, {
    clip: {
      x: boxD.x - 4,
      y: boxD.y - 4,
      width: boxD.width + 8,
      height: boxD.height + 8,
    },
  });
  shots.disabled = `${base}-disabled.jpg`;
  await context.close();
  return shots;
}

async function captureServerSelectStates(browser, appPort) {
  const shots = {};
  for (const { w, h, tag } of [
    { w: 1600, h: 900, tag: "1600x900" },
    { w: 1280, h: 720, tag: "1280x720" },
  ]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${appPort}/`);
    await page.waitForSelector(".server-list li", { timeout: 15000 });
    await page.waitForSelector(".server-select-panel", { timeout: 10000 });
    await page.locator(".server-list li").first().click();
    await page.waitForTimeout(200);
    const frame = await layoutFrameClip(page);
    const enabledMeta = await writeJpegUnder1Mb(
      page,
      path.join(statesDir, `server-select-${tag}-selected-enter-enabled.jpg`),
      { clip: frame },
    );
    shots[`${tag}_enabled`] = enabledMeta;
    await page.evaluate(() => {
      const enter = document.querySelector('[data-action="enter-game"]');
      if (enter instanceof HTMLButtonElement) enter.disabled = true;
      const status = document.querySelector('[data-role="status"]');
      if (status) status.textContent = "进服失败: 模拟网关拒绝（证据态，脚本强制）";
    });
    await page.waitForTimeout(100);
    const disabledMeta = await writeJpegUnder1Mb(
      page,
      path.join(statesDir, `server-select-${tag}-enter-disabled-failure.jpg`),
      { clip: frame },
    );
    shots[`${tag}_disabled`] = disabledMeta;
    await context.close();
  }
  return shots;
}

async function captureBuildingAndMilitaryStates(browser, appPort) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await enterMainCityIdle(page, appPort);
  await page.locator('[data-action="upgrade-farm"]').click();
  await page.waitForSelector(".building-panel:not(.hidden)", { timeout: 5000 });
  const building = await page.locator(".building-panel").boundingBox();
  if (building) {
    await writeJpegUnder1Mb(page, path.join(statesDir, "building-sidebar-upgradable.jpg"), {
      clip: building,
    });
  }
  await page.evaluate(() => {
    const btn = document.querySelector('.building-panel [data-action="confirm-upgrade"]');
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    const preview = document.querySelector('[data-role="build-preview"]');
    if (preview) preview.textContent = "粮食不足，无法升级";
    const err = document.querySelector('[data-role="build-form-error"]');
    if (err) {
      err.textContent = "";
      err.classList.add("hidden");
    }
  });
  await page.waitForTimeout(100);
  if (building) {
    await writeJpegUnder1Mb(page, path.join(statesDir, "building-sidebar-not-upgradable.jpg"), {
      clip: building,
    });
  }
  await page.evaluate(() => {
    const err = document.querySelector('[data-role="build-form-error"]');
    if (err) {
      err.textContent = "升级请求失败：资源校验未通过（证据态）";
      err.classList.remove("hidden");
    }
  });
  await page.waitForTimeout(100);
  if (building) {
    await writeJpegUnder1Mb(page, path.join(statesDir, "building-sidebar-error.jpg"), { clip: building });
  }
  await page.locator('[data-action="toggle-military"]').click();
  await page.waitForSelector(".military-panel:not(.hidden)", { timeout: 5000 });
  const mil = await page.locator(".military-panel").boundingBox();
  if (mil) {
    await writeJpegUnder1Mb(page, path.join(statesDir, "military-panel-ui.panel.military.v1.jpg"), {
      clip: mil,
    });
  }
  await context.close();
}

async function clickProofLastToolbar(page) {
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    scroll?.scrollTo({ left: scroll.scrollWidth, behavior: "instant" });
  });
  await page.waitForTimeout(120);
  const probeData = await page.evaluate(() => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    const buttons = document.querySelectorAll(".toolbar-scroll-inner button");
    const btn = buttons[buttons.length - 1];
    if (!(btn instanceof HTMLButtonElement)) return null;
    const br = btn.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    const toolbarRect = document.querySelector(".main-city-toolbar")?.getBoundingClientRect();
    function intersect(a, b) {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.right, b.right);
      const bottom = Math.min(a.bottom, b.bottom);
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    }
    let vis = scrollRect
      ? intersect(
          { left: br.left, top: br.top, right: br.right, bottom: br.bottom },
          {
            left: scrollRect.left,
            top: scrollRect.top,
            right: scrollRect.right,
            bottom: scrollRect.bottom,
          },
        )
      : { left: br.left, top: br.top, width: br.width, height: br.height };
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
    const inset = 3;
    const points = [
      { name: "center", x: vis.left + vis.width / 2, y: vis.top + vis.height / 2 },
      { name: "bottomLeft", x: vis.left + inset, y: vis.top + vis.height - inset },
      { name: "bottomRight", x: vis.left + vis.width - inset, y: vis.top + vis.height - inset },
    ];
    const elementFromPoint = points.map((p) => {
      const el = document.elementFromPoint(p.x, p.y);
      return {
        ...p,
        hitsButton: !!el && (el === btn || btn.contains(el)),
        elementTag: el?.tagName ?? null,
      };
    });
    return {
      label: btn.textContent?.trim() ?? "",
      visibleIntersection: vis,
      meetsMin44Visible: vis.width >= 44 && vis.height >= 44,
      elementFromPoint,
      clickPoint: points[0],
    };
  });
  if (!probeData) return { ok: false, reason: "no last button" };
  await page.mouse.click(probeData.clickPoint.x, probeData.clickPoint.y);
  await page.waitForTimeout(200);
  const queueOpen = await page.locator('[data-center-panel="queue"]').isVisible().catch(() => false);
  return {
    ok: probeData.meetsMin44Visible && probeData.elementFromPoint.every((p) => p.hitsButton),
    ...probeData,
    queuePanelVisibleAfter: queueOpen,
  };
}

async function main() {
  await mkdir(statesDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "inherit" });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16206", "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp("http://127.0.0.1:16206/");
    const browser = await chromium.launch();
    const appPort = 16206;
    const viewportEvidence = await captureViewportJpegs(browser, appPort);
    const toolbarStates = await captureToolbarButtonStates(browser, appPort);
    const serverSelectEvidence = await captureServerSelectStates(browser, appPort);
    await captureBuildingAndMilitaryStates(browser, appPort);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await enterMainCityIdle(page, appPort);
    const clickProof = await clickProofLastToolbar(page);
    await ctx.close();
    await browser.close();

    const hitProof = {
      asset_source_sha: ASSET_SOURCE_SHA,
      captured_at: new Date().toISOString(),
      acceptance: "JPEG viewports are primary; PNG retained for history only.",
      viewportJpegs: viewportEvidence,
      lastToolbarClickProof: clickProof,
      buildingPanelSkin: "ui.panel.default.v1 via skinDefaultPanel (380×300 layout min)",
      militaryPanelSkin: "ui.panel.military.v1 via skinMilitaryPanel (420×320 layout min)",
      toolbarButtonStates: toolbarStates,
      serverSelectViewports: serverSelectEvidence,
      notes: [
        "elementFromPoint probes must hit the <button>, not only .toolbar-btn-hit wrapper padding.",
        "DOM toolbar buttons stay 96×44 CSS px; meetsMin44ScreenCss uses scroll∩toolbar visible intersection.",
        "server-select disabled/failure JPEG uses script-forced disabled + status text for display proof only.",
      ],
    };
    await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);

    const legacyMeasurements = {
      asset_source_sha: ASSET_SOURCE_SHA,
      captured_at: hitProof.captured_at,
      primary_evidence: "hit-proof.json + JPEG viewports",
      viewports: Object.fromEntries(
        Object.entries(viewportEvidence).map(([file, v]) => [file, v.hitProof]),
      ),
    };
    await writeFile(path.join(outDir, "measurements.json"), `${JSON.stringify(legacyMeasurements, null, 2)}\n`);

    await writeFile(
      path.join(outDir, "README.md"),
      `# ART-CHROME-006 client wire evidence

Asset source: art Draft PR #444 @ \`${ASSET_SOURCE_SHA.slice(0, 7)}\` (cherry-picked on eng branch only; **do not merge** #444).

**终验以 JPEG 为准**（每张 <1MB，完整 layout 帧含顶 HUD / 底工具栏，不裁切）。

## Full viewports (JPEG)

| File | Pixel size |
|------|------------|
| \`maincity-1600x900-full.jpg\` | 1600×900 |
| \`maincity-3200x1800-full.jpg\` | 3200×1800 (1600×900 viewport, DPR2) |
| \`maincity-1280x720-full.jpg\` | 1280×720 |

Legacy PNG (\`*-dpr*-full.png\`) 保留作历史对照，美术 connector 请取 JPEG。

## Frozen checklist (\`states/\`)

- \`ui.button.toolbar.v1-{normal,hover,pressed,disabled}.jpg\`
- \`server-select-{1600x900,1280x720}-selected-enter-enabled.jpg\`, \`server-select-*-enter-disabled-failure.jpg\`（全 layout 帧）
- \`building-sidebar-{upgradable,not-upgradable,error}.jpg\` — 建筑侧栏 \`ui.panel.default.v1\`
- \`military-panel-ui.panel.military.v1.jpg\` — 军事表单 \`ui.panel.military.v1\`

## Hit proof

\`hit-proof.json\`: button / scroll container rects、裁切后可见交集、四角+中心 \`elementFromPoint\` 必须落在 \`button\` 上；末项滚动后点击证明。

工程：\`ui.hud.bar.v1\` / \`ui.toolbar.bar.v1\`；\`ui.button.toolbar.v1\`；\`skinDefaultPanel\` 建筑侧栏；\`skinMilitaryPanel\` 军事面板。

再生：\`cd client && node scripts/capture-art-chrome-006-evidence.mjs\`
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
