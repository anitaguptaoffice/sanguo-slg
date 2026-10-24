/**
 * ART-ACTION-ICONS-011 runtime evidence: upgrade-farm action icon + hit proof.
 * Usage: node scripts/capture-art-action-icons-011-evidence.mjs [--only-1280]
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(clientRoot, "../docs/art/samples/art-action-icons-011/runtime");

const ART_ASSET_SHA = "258c89a15c3876eb291b3d9c449034e9484cab31";
const UPGRADE_ACTION = "upgrade-farm";
const EXPECTED_ARIA_TITLE = "升级农田";
const DEV_PORT = 16211;
const MAX_JPEG_BYTES = 1_000_000;
const MIN_VISIBLE_HIT_CSS = 44;

const ONLY_1280 = process.argv.includes("--only-1280");

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
    `button[data-action="${UPGRADE_ACTION}"].toolbar-chrome-btn--with-icon .toolbar-btn-icon`,
    { timeout: 10000 },
  );
}

async function layoutFrameClip(page) {
  const frame = await page.locator("#layout-frame").boundingBox();
  if (!frame) throw new Error("layout-frame missing");
  return frame;
}

/** Browser-side mount + visible-hit proof (serialized into page.evaluate). */
function measureIconMountInPage({ actionList, minVisibleHitCss, expectedAriaTitle }) {
  const scroll = document.querySelector('[data-role="toolbar-scroll"]');
  const layoutFrame = document.getElementById("layout-frame");
  const uiScale = parseFloat(
    getComputedStyle(layoutFrame || document.body).getPropertyValue("--ui-scale") || "1",
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

  function rectToObj(r) {
    return { left: r.left, top: r.top, width: r.width, height: r.height };
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

  function visibleIntersection(domRect, clips) {
    let box = {
      left: domRect.left,
      top: domRect.top,
      right: domRect.right,
      bottom: domRect.bottom,
    };
    let out = intersect(box, box);
    for (const clip of clips) {
      if (!clip) continue;
      out = intersect(
        { left: out.left, top: out.top, right: out.right, bottom: out.bottom },
        clip,
      );
    }
    return out;
  }

  function probeVisibleHits(btn, wrap, vis) {
    const visW = vis.width;
    const visH = vis.height;
    if (visW < 1 || visH < 1) {
      return { elementFromPoint: [], allProbesHitTarget: false, centerHitsButton: false };
    }
    const inset = Math.min(3, visW / 4, visH / 4);
    const cx = vis.left + visW / 2;
    const cy = vis.top + visH / 2;
    const points = [
      { name: "center", x: cx, y: cy },
      { name: "left", x: vis.left + inset, y: cy },
      { name: "right", x: vis.left + visW - inset, y: cy },
      { name: "top", x: cx, y: vis.top + inset },
      { name: "bottom", x: cx, y: vis.top + visH - inset },
    ];
    function hitsTarget(el) {
      if (!el) return false;
      if (el === btn || btn.contains(el)) return true;
      if (wrap && (el === wrap || wrap.contains(el))) return true;
      return false;
    }
    const elementFromPoint = points.map((p) => {
      const el = document.elementFromPoint(p.x, p.y);
      return {
        ...p,
        elementTag: el?.tagName ?? null,
        hitsButton: !!(el && (el === btn || btn.contains(el))),
        hitsTarget: hitsTarget(el),
      };
    });
    return {
      elementFromPoint,
      allProbesHitTarget: elementFromPoint.every((p) => p.hitsTarget),
      centerHitsButton: elementFromPoint.find((p) => p.name === "center")?.hitsButton ?? false,
    };
  }

  const scrollRect = scroll?.getBoundingClientRect();
  const toolbarRect = document.querySelector(".main-city-toolbar")?.getBoundingClientRect();
  const layoutRect = layoutFrame?.getBoundingClientRect();
  const clipBoxes = [
    scrollRect
      ? {
          left: scrollRect.left,
          top: scrollRect.top,
          right: scrollRect.right,
          bottom: scrollRect.bottom,
        }
      : null,
    toolbarRect
      ? {
          left: toolbarRect.left,
          top: toolbarRect.top,
          right: toolbarRect.right,
          bottom: toolbarRect.bottom,
        }
      : null,
    layoutRect
      ? {
          left: layoutRect.left,
          top: layoutRect.top,
          right: layoutRect.right,
          bottom: layoutRect.bottom,
        }
      : null,
  ];

  const iconButtons = actionList.map((action) => {
    const btn = document.querySelector(`button[data-action="${action}"]`);
    if (!(btn instanceof HTMLButtonElement)) return { action, ok: false, reason: "missing button" };
    const icon = btn.querySelector(".toolbar-btn-icon");
    const label = btn.querySelector(".toolbar-btn-label");
    const br = btn.getBoundingClientRect();
    const wrap = btn.closest(".toolbar-btn-hit");
    const wr = wrap?.getBoundingClientRect();

    const buttonVis = visibleIntersection(br, clipBoxes);
    const hitWrapVis = wr ? visibleIntersection(wr, clipBoxes) : null;

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
      left: buttonVis.left,
      top: buttonVis.top,
      right: buttonVis.right,
      bottom: buttonVis.bottom,
    };
    const iconInsideButton = iconRect ? rectFullyInside(iconRect, btnBox) : false;
    const labelInsideButton = labelRect ? rectFullyInside(labelRect, btnBox) : false;
    const iconInsideVisible =
      iconRect && buttonVis.width > 0 && buttonVis.height > 0
        ? rectFullyInside(iconRect, visBox)
        : !iconRect;
    const labelInsideVisible =
      labelRect && buttonVis.width > 0 && buttonVis.height > 0
        ? rectFullyInside(labelRect, visBox)
        : !labelRect;

    const onScreen = buttonVis.width >= 8 && buttonVis.height >= 8;
    const buttonFullyVisible =
      buttonVis.width >= br.width - 0.5 && buttonVis.height >= br.height - 0.5;

    const probes = probeVisibleHits(btn, wrap, buttonVis);
    const wrapMinCss = wr ? Math.min(wr.width, wr.height) : 0;

    const meetsMinVisibleHit =
      buttonVis.width >= minVisibleHitCss - 0.5 && buttonVis.height >= minVisibleHitCss - 0.5;
    const hitWrapMeetsMinVisible =
      hitWrapVis &&
      hitWrapVis.width >= minVisibleHitCss - 0.5 &&
      hitWrapVis.height >= minVisibleHitCss - 0.5;

    const layoutOk =
      iconInsideButton &&
      labelInsideButton &&
      (!buttonFullyVisible || (iconInsideVisible && labelInsideVisible)) &&
      overlap === false;

    const structuralOk =
      !!icon?.src &&
      !icon.src.includes("data:image/gif") &&
      (label?.textContent?.trim()?.length ?? 0) === 2 &&
      btn.getAttribute("aria-label") === expectedAriaTitle &&
      btn.getAttribute("title") === expectedAriaTitle &&
      br.width >= minVisibleHitCss * uiScale - 0.5 &&
      br.height >= minVisibleHitCss * uiScale - 0.5 &&
      wrapMinCss >= minVisibleHitCss - 0.5 &&
      layoutOk;

    const visibilityOk = buttonFullyVisible || meetsMinVisibleHit;
    const hitTargetOk =
      onScreen && probes.allProbesHitTarget && (buttonFullyVisible || meetsMinVisibleHit);

    const ok = structuralOk && visibilityOk && hitTargetOk;
    if (ok && !buttonFullyVisible && !meetsMinVisibleHit) {
      return { action, ok: false, reason: "ok contradicts visibility" };
    }

    return {
      action,
      onScreen,
      ok,
      structuralOk,
      visibilityOk,
      hitTargetOk,
      meetsMinVisibleHit,
      hitWrapMeetsMinVisible: !!hitWrapMeetsMinVisible,
      minVisibleHitCss,
      label: label?.textContent?.trim() ?? "",
      ariaLabel: btn.getAttribute("aria-label"),
      title: btn.getAttribute("title"),
      iconSrc: icon?.src ?? null,
      buttonRect: rectToObj(br),
      hitWrapRect: wr ? rectToObj(wr) : null,
      visibleIntersectionButton: rectToObj(buttonVis),
      visibleIntersectionHitWrap: hitWrapVis ? rectToObj(hitWrapVis) : null,
      buttonCss: { w: br.width, h: br.height },
      hitWrapCss: wr ? { w: wr.width, h: wr.height } : null,
      buttonFullyVisible,
      iconOverlapsLabel: overlap,
      iconInsideButton,
      labelInsideButton,
      iconInsideVisibleRegion: iconInsideVisible,
      labelInsideVisibleRegion: labelInsideVisible,
      edgeHitProof: probes,
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
}

async function measureIconMount(page, actions) {
  return page.evaluate(measureIconMountInPage, {
    actionList: actions,
    minVisibleHitCss: MIN_VISIBLE_HIT_CSS,
    expectedAriaTitle: EXPECTED_ARIA_TITLE,
  });
}

async function captureViewports(browser, appPort) {
  const allSpecs = [
    {
      file: "maincity-1600x900-full.jpg",
      viewport: { width: 1600, height: 900 },
      dpr: 1,
      fullViewport: false,
    },
    {
      file: "maincity-3200x1800-full.jpg",
      viewport: { width: 1600, height: 900 },
      dpr: 2,
      fullViewport: false,
    },
    {
      file: "maincity-1280x720-full.jpg",
      viewport: { width: 1280, height: 720 },
      dpr: 1,
      fullViewport: true,
    },
  ];
  const specs = ONLY_1280
    ? allSpecs.filter((s) => s.file === "maincity-1280x720-full.jpg")
    : allSpecs;
  const results = {};
  for (const spec of specs) {
    const context = await browser.newContext({
      viewport: spec.viewport,
      deviceScaleFactor: spec.dpr,
    });
    const page = await context.newPage();
    await enterMainCityIdle(page, appPort);
    await page.waitForTimeout(300);
    const screenshotOpts = spec.fullViewport ? {} : { clip: await layoutFrameClip(page) };
    const meta = await writeJpegUnder1Mb(page, path.join(outDir, spec.file), screenshotOpts);
    const mount = await measureIconMount(page, [UPGRADE_ACTION]);
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
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(DEV_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: { ...process.env, VITE_GATEWAY_WS_URL: "ws://127.0.0.1:19090/ws" },
    },
  );
  try {
    await new Promise((r) => setTimeout(r, 2500));
    await waitForHttp(`http://127.0.0.1:${DEV_PORT}/`);
    const browser = await chromium.launch();
    const viewports = await captureViewports(browser, DEV_PORT);
    await browser.close();

    let priorViewports = {};
    if (ONLY_1280) {
      try {
        const prior = JSON.parse(await readFile(path.join(outDir, "hit-proof.json"), "utf8"));
        priorViewports = prior.viewports ?? {};
      } catch {
        /* fresh run */
      }
    }

    const upgrade1280 = viewports["maincity-1280x720-full.jpg"]?.mount?.iconButtons?.[0];
    if (upgrade1280 && !upgrade1280.ok) {
      console.error("1280 upgrade-farm hit-proof failed:", JSON.stringify(upgrade1280, null, 2));
      process.exit(1);
    }

    const hitProof = {
      art_asset_source_sha: ART_ASSET_SHA,
      art_draft_pr: "https://github.com/anitaguptaoffice/sanguo-slg/pull/674",
      coordination_board_pr: "https://github.com/anitaguptaoffice/sanguo-slg/pull/108",
      captured_at: new Date().toISOString(),
      asset_id: "ui.icon.action.upgrade.v1",
      label_mapping: { "upgrade-farm": "升级" },
      title_aria_mapping: { "upgrade-farm": EXPECTED_ARIA_TITLE },
      viewports: ONLY_1280 ? { ...priorViewports, ...viewports } : viewports,
      upgrade_farm_button_1280: upgrade1280 ?? null,
      layout_notes: [
        "96×44 toolbar chrome; 32px icon + 4px gap + two-character label inside button.",
        ".toolbar-btn-hit wrap keeps effective hit target ≥44×44 CSS px.",
        "hit-proof exports visibleIntersection w/h (scroll∩toolbar∩layout-frame) and edge elementFromPoint probes.",
        "ok requires consistency: when buttonFullyVisible is false, meetsMinVisibleHit must be true for ok:true.",
        "Disabled styling uses ui.button.toolbar.v1 chrome only — no per-icon four-state sprites.",
        "DPR2 shot: 1600×900 logical viewport, deviceScaleFactor=2 → 3200×1800 JPEG pixels.",
        "Click behavior unchanged: opens farm building panel via buildingPanel.selectSlot(\"farm\"), not upgrade RPC.",
      ],
      banned_unmerged: [
        "#674",
        "#108",
        "#77",
        "#82",
        "#100",
        "#126",
        "#444",
        "#481",
        "#506",
        "#637",
        "#649",
      ],
    };
    await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);

    await writeFile(
      path.join(outDir, "../README.md"),
      `# ART-ACTION-ICONS-011 client mount evidence

Art assets cherry-picked from Draft PR [#674](https://github.com/anitaguptaoffice/sanguo-slg/pull/674) @ \`${ART_ASSET_SHA.slice(0, 7)}\` (**not merged**).

Coordination board [#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) — **ask art for runtime visual sign-off** on the JPEGs below.

## Runtime JPEGs (each <1MB)

| File | Description |
|------|-------------|
| \`runtime/maincity-1600x900-full.jpg\` | 1600×900 DPR1 — layout-frame clip, upgrade-farm icon visible |
| \`runtime/maincity-3200x1800-full.jpg\` | DPR2 equivalent (1600×900 logical) |
| \`runtime/maincity-1280x720-full.jpg\` | 1280×720 full viewport |

## Hit / mount proof

\`runtime/hit-proof.json\` — upgrade-farm button: label 「升级」, title/aria 「升级农田」, visible intersection ≥44px, edge hit probes.

Regenerate all: \`cd client && node scripts/capture-art-action-icons-011-evidence.mjs\`

Upgrade 1280 only: \`cd client && node scripts/capture-art-action-icons-011-evidence.mjs --only-1280\`
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
