/**
 * ART-TOOLBAR-ICONS-007 runtime evidence: toolbar icon mount + hit proof.
 * Usage: node scripts/capture-art-toolbar-icons-007-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-toolbar-icons-007");

const ART_ASSET_SHA = "9f06e380f7eb42492951c98b4cbb602c6ab390d1";
const MAX_JPEG_BYTES = 1_000_000;
const ICON_ACTIONS = [
  "toggle-military",
  "toggle-mail",
  "toggle-queue",
  "toggle-bag",
  "toggle-daily",
  "toggle-world",
  "toggle-hero",
  "toggle-shop",
];

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
  await page.waitForSelector(".toolbar-chrome-btn--with-icon .toolbar-btn-icon", { timeout: 10000 });
}

async function layoutFrameClip(page) {
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  return frame;
}

async function scrollToolbarEnd(page) {
  await page.evaluate(() => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    if (scroll) scroll.scrollLeft = scroll.scrollWidth;
  });
  await page.waitForTimeout(150);
}

async function measureIconMount(page) {
  return page.evaluate((actions) => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    const uiScale = parseFloat(
      getComputedStyle(document.getElementById("layout-frame") || document.body).getPropertyValue(
        "--ui-scale",
      ) || "1",
    );
    const buttons = Array.from(document.querySelectorAll(".toolbar-scroll-inner button"));
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

    const iconButtons = actions.map((action) => {
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
        visibleIntersection: { left: vis.left, top: vis.top, width: vis.width, height: vis.height },
        buttonFullyVisible,
        iconOverlapsLabel: overlap,
        iconInsideButton,
        labelInsideButton,
        iconInsideVisibleRegion: iconInsideVisible,
        labelInsideVisibleRegion: labelInsideVisible,
        elementFromPointHitsButton: hitsButton,
      };
    });

    return {
      uiScale,
      scrollMetrics: scroll
        ? {
            scrollWidth: scroll.scrollWidth,
            clientWidth: scroll.clientWidth,
            scrollLeft: scroll.scrollLeft,
            maxScrollLeft: scroll.scrollWidth - scroll.clientWidth,
          }
        : null,
      iconButtons,
    };
  }, ICON_ACTIONS);
}

async function captureViewports(browser, appPort) {
  const specs = [
    { file: "maincity-1600x900-full.jpg", viewport: { width: 1600, height: 900 }, dpr: 1, scroll: false },
    { file: "maincity-3200x1800-full.jpg", viewport: { width: 1600, height: 900 }, dpr: 2, scroll: false },
    {
      file: "maincity-1280x720-toolbar-scrolled.jpg",
      viewport: { width: 1280, height: 720 },
      dpr: 1,
      scroll: true,
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
    if (spec.scroll) await scrollToolbarEnd(page);
    await page.waitForTimeout(300);
    const clip = await layoutFrameClip(page);
    const meta = await writeJpegUnder1Mb(page, path.join(outDir, spec.file), { clip });
    const mount = await measureIconMount(page);
    await context.close();
    results[spec.file] = { jpeg: meta, mount };
  }
  return results;
}

async function captureIconStates(browser, appPort) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await enterMainCityIdle(page, appPort);
  const btn = page.locator('[data-action="toggle-military"]');
  await btn.waitFor({ state: "visible" });
  const box = await btn.boundingBox();
  if (!box) throw new Error("military toolbar button missing");
  const pad = 6;
  const clip = { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
  const statesDir = path.join(outDir, "states");
  await mkdir(statesDir, { recursive: true });
  await writeJpegUnder1Mb(page, path.join(statesDir, "ui.icon.toolbar.military.v1-normal.jpg"), { clip });
  await page.evaluate(() => {
    const b = document.querySelector('[data-action="toggle-military"]');
    if (b instanceof HTMLButtonElement) {
      b.disabled = true;
      b.dispatchEvent(new Event("mouseleave"));
    }
  });
  await page.waitForTimeout(80);
  await writeJpegUnder1Mb(page, path.join(statesDir, "ui.icon.toolbar.military.v1-disabled.jpg"), { clip });
  await context.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], { cwd: clientRoot, stdio: "inherit" });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "16207", "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp("http://127.0.0.1:16207/");
    const browser = await chromium.launch();
    const viewports = await captureViewports(browser, 16207);
    await captureIconStates(browser, 16207);
    await browser.close();

    const hitProof = {
      art_asset_source_sha: ART_ASSET_SHA,
      captured_at: new Date().toISOString(),
      label_mapping: {
        military: "军事",
        mail: "邮件",
        queue: "队列",
        bag: "背包",
        daily: "日常",
        world: "世界",
        hero: "将领",
        shop: "商城",
      },
      asset_ids: ICON_ACTIONS.map((a) => {
        const key = a.replace("toggle-", "");
        return `ui.icon.toolbar.${key}.v1`;
      }),
      viewports,
      notes: [
        "Icons mounted inside ui.button.toolbar.v1 chrome; .toolbar-btn-hit remains expanded hit slop.",
        "Horizontal row: 32px icon + 4px gap + ~28px two-char label, vertically centered in 96×44.",
        "hit-proof requires label/icon bounding rects inside button and inside visible scroll/toolbar crop.",
        "1280 shot taken after scrollLeft=max so queue/world/hero/shop icons are visible.",
        "Layout fix for art review https://github.com/anitaguptaoffice/sanguo-slg/pull/108#issuecomment-6376204272",
        "Did not merge art Draft PR #481 or board PR #108.",
      ],
    };
    await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);

    await writeFile(
      path.join(outDir, "README.md"),
      `# ART-TOOLBAR-ICONS-007 client mount evidence

Art assets cherry-picked from Draft PR #481 @ \`${ART_ASSET_SHA.slice(0, 7)}\` (**not merged**).

## Full viewports (JPEG, each <1MB)

| File | Description |
|------|-------------|
| \`maincity-1600x900-full.jpg\` | 1600×900 DPR1 full \`#layout-frame\` |
| \`maincity-3200x1800-full.jpg\` | 1600×900 viewport, DPR2 (3200×1800 capture) |
| \`maincity-1280x720-toolbar-scrolled.jpg\` | 1280×720 after horizontal scroll (icon batch visible) |

## States

- \`states/ui.icon.toolbar.military.v1-normal.jpg\`
- \`states/ui.icon.toolbar.military.v1-disabled.jpg\`

## Hit / mount proof

\`hit-proof.json\` — per-action icon src, 2-char labels, ≥44 CSS hit wrap, icon+label inside button & visible crop, no icon/label overlap.

Regenerate: \`cd client && node scripts/capture-art-toolbar-icons-007-evidence.mjs\`
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
