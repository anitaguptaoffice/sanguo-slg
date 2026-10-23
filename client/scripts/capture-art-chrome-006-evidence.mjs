/**
 * ART-CHROME-006 client wire evidence: viewport shots + scroll/hit measurements.
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

async function measureToolbar(page) {
  return page.evaluate(() => {
    const scroll = document.querySelector('[data-role="toolbar-scroll"]');
    const buttons = Array.from(document.querySelectorAll(".toolbar-scroll-inner button"));
    const uiScale = parseFloat(
      getComputedStyle(document.getElementById("layout-frame") || document.body).getPropertyValue(
        "--ui-scale",
      ) || "1",
    );
    const scrollMetrics = scroll
      ? {
          scrollWidth: scroll.scrollWidth,
          clientWidth: scroll.clientWidth,
          maxScrollLeft: scroll.scrollWidth - scroll.clientWidth,
        }
      : null;
    scroll?.scrollTo({ left: scroll.scrollWidth, behavior: "instant" });
    const hitRects = buttons.slice(0, 3).concat(buttons.slice(-2)).map((btn, i) => {
      const r = btn.getBoundingClientRect();
      const wrap = btn.closest(".toolbar-btn-hit");
      const wr = wrap?.getBoundingClientRect();
      return {
        index: i < 3 ? i : buttons.length - (5 - i),
        label: btn.textContent?.trim() ?? "",
        buttonCss: { w: r.width, h: r.height },
        hitWrapCss: wr ? { w: wr.width, h: wr.height } : null,
      };
    });
    const lastBtn = buttons[buttons.length - 1];
    const lastVisibleAfterScroll =
      lastBtn && scroll
        ? (() => {
            const br = lastBtn.getBoundingClientRect();
            const sr = scroll.getBoundingClientRect();
            return br.right <= sr.right + 2 && br.left >= sr.left - 2;
          })()
        : false;
    scroll?.scrollTo({ left: 0, behavior: "instant" });
    return {
      uiScale,
      buttonCount: buttons.length,
      scrollMetrics,
      scrolledToEnd: scrollMetrics && scrollMetrics.maxScrollLeft > 0,
      lastEntryReachableAfterScroll: lastVisibleAfterScroll,
      hitRects,
      minHitHeightCss: hitRects.reduce(
        (m, row) => Math.min(m, row.hitWrapCss?.h ?? row.buttonCss.h),
        Infinity,
      ),
    };
  });
}

async function captureViewport(browser, viewport, dpr, namePrefix, appPort) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  await enterMainCityIdle(page, appPort);
  await page.waitForTimeout(500);
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  await page.screenshot({
    path: path.join(outDir, `${namePrefix}-full.png`),
    clip: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
    type: "png",
  });
  const metrics = await measureToolbar(page);
  await context.close();
  return metrics;
}

async function main() {
  await mkdir(outDir, { recursive: true });
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
    await new Promise((r) => setTimeout(r, 2000));
    await waitForHttp("http://127.0.0.1:16206/");
    const browser = await chromium.launch();
    const appPort = 16206;
    const m1600d1 = await captureViewport(
      browser,
      { width: 1600, height: 900 },
      1,
      "maincity-1600x900-dpr1",
      appPort,
    );
    const m1600d2 = await captureViewport(
      browser,
      { width: 1600, height: 900 },
      2,
      "maincity-1600x900-dpr2",
      appPort,
    );
    const m1280 = await captureViewport(
      browser,
      { width: 1280, height: 720 },
      1,
      "maincity-1280x720-dpr1",
      appPort,
    );
    await browser.close();

    const report = {
      asset_source_sha: "85a2dec4c12805ffc6cafef5b9871b1c4a5b0ec2",
      captured_at: new Date().toISOString(),
      viewports: {
        "1600x900_dpr1": m1600d1,
        "1600x900_dpr2": m1600d2,
        "1280x720_dpr1": m1280,
      },
      notes: [
        "Bottom toolbar uses horizontal scroll; scrollMetrics.maxScrollLeft > 0 at 1280 when buttons overflow.",
        "Hit wrap min-height uses calc(44px / var(--ui-scale)); expect minHitHeightCss >= 44 at 1280.",
      ],
    };
    await writeFile(path.join(outDir, "measurements.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(
      path.join(outDir, "README.md"),
      `# ART-CHROME-006 client wire evidence

Asset source: art Draft PR #444 @ \`85a2dec\` (cherry-picked on eng branch only).

## Screenshots

| File | Viewport |
|------|----------|
| \`maincity-1600x900-dpr1-full.png\` | 1600×900 DPR1 idle main city |
| \`maincity-1600x900-dpr2-full.png\` | 1600×900 DPR2 idle main city |
| \`maincity-1280x720-dpr1-full.png\` | 1280×720 DPR1 idle main city |

## Scroll / hit

See \`measurements.json\` for \`scrollMetrics\`, \`lastEntryReachableAfterScroll\`, and per-button CSS hit rects.

Engineering: \`ui.hud.bar.v1\` / \`ui.toolbar.bar.v1\` DOM skins; \`ui.button.toolbar.v1\` on toolbar buttons; \`.toolbar-scroll\` horizontal overflow; \`.toolbar-btn-hit\` expands screen CSS hit to ≥44px at 1280×720.
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
