/**
 * Shared helpers for queue representative full-viewport evidence (CLIENT-064).
 */

export const QUEUE_PANEL_SELECTOR = '[data-center-panel="queue"]';

/** Reset window and panel scroll before viewport capture. */
export async function resetEvidenceScroll(page, panelSelector = QUEUE_PANEL_SELECTOR) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.documentElement.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
    const vp = document.getElementById("game-viewport");
    if (vp) {
      vp.scrollTop = 0;
      vp.scrollLeft = 0;
    }
  });
  const panel = page.locator(panelSelector);
  await panel.waitFor({ state: "visible" });
  await panel.evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await page.waitForTimeout(120);
}

/**
 * Read scroll + panel geometry for INVENTORY (CSS pixels in layout viewport).
 * @returns {Promise<{ scrollX: number, scrollY: number, viewportW: number, viewportH: number, dpr: number, panelRect: Record<string, number>, titleRect: Record<string, number> | null }>}
 */
export async function readQueueEvidenceGeometry(page, panelSelector = QUEUE_PANEL_SELECTOR) {
  return page.evaluate((sel) => {
    const panel = document.querySelector(sel);
    const title = panel?.querySelector("h3");
    const panelRect = panel?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const round = (n) => Math.round(n * 100) / 100;
    const rect = (r) =>
      r
        ? {
            x: round(r.x),
            y: round(r.y),
            width: round(r.width),
            height: round(r.height),
            top: round(r.top),
            right: round(r.right),
            bottom: round(r.bottom),
            left: round(r.left),
          }
        : null;
    return {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      dpr: window.devicePixelRatio,
      panelRect: rect(panelRect),
      titleRect: rect(titleRect),
    };
  }, panelSelector);
}

/** Ensure queue title and panel top are inside the browser viewport. */
export function assertQueueTopEdgeInViewport(geo) {
  if (!geo.panelRect || !geo.titleRect) {
    throw new Error("queue panel or h3 title missing for evidence geometry");
  }
  const { titleRect, panelRect, viewportW, viewportH } = geo;
  if (geo.scrollX !== 0 || geo.scrollY !== 0) {
    throw new Error(`expected scroll 0,0 got ${geo.scrollX},${geo.scrollY}`);
  }
  const margin = 1;
  if (titleRect.top < -margin || titleRect.left < -margin) {
    throw new Error(`queue title outside viewport top/left: ${JSON.stringify(titleRect)}`);
  }
  if (titleRect.bottom > viewportH + margin || titleRect.right > viewportW + margin) {
    throw new Error(`queue title outside viewport bottom/right: ${JSON.stringify(titleRect)}`);
  }
  if (panelRect.top > titleRect.top + 2) {
    throw new Error(`panel top below title: panel=${panelRect.top} title=${titleRect.top}`);
  }
}

/**
 * Full browser viewport JPEG (not element shot, not bbox clip).
 * @returns {Promise<{ bytes: number, geometry: object }>}
 */
export async function shotFullViewportQueueEvidence(page, filePath, quality = 86, statFn) {
  await resetEvidenceScroll(page);
  const geometry = await readQueueEvidenceGeometry(page);
  assertQueueTopEdgeInViewport(geometry);
  await page.screenshot({ path: filePath, fullPage: false, type: "jpeg", quality });
  const { size } = await statFn(filePath);
  if (size >= 1_000_000) {
    throw new Error(`${filePath} is ${size} bytes (must be <1MB)`);
  }
  return { bytes: size, geometry };
}

export function formatGeometryForInventory(geo) {
  const pr = geo.panelRect;
  const tr = geo.titleRect;
  return `scroll (${geo.scrollX}, ${geo.scrollY}); viewport ${geo.viewportW}×${geo.viewportH} @DPR${geo.dpr}; panel [${pr?.left},${pr?.top} ${pr?.width}×${pr?.height}]; title [${tr?.left},${tr?.top} ${tr?.width}×${tr?.height}]`;
}
