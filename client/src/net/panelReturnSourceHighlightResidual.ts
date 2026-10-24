import type { BagClientCategory } from "@/net/bagCategory";
import type { ShopOfferClientCategory } from "@/net/shopOfferCategory";

/** CLIENT-256：自排行/军情返回背包或商城时分类 tab/chip 残余高亮（CLIENT-211 行返回不退化）。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS = "panel-return-source-highlight-residual";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS = 2000;
export const PANEL_RETURN_SOURCE_SESSION_KEY = "panel-return-source-v1";

export type PanelReturnSourceKind = "rank" | "intel";
export type PanelReturnTargetPanel = "bag" | "shop";

export type PanelReturnSourcePayload = {
  targetPanel: PanelReturnTargetPanel;
  categoryId: BagClientCategory | ShopOfferClientCategory | string;
  sourceKind: PanelReturnSourceKind;
};

let returnSourceHighlightTimer: ReturnType<typeof setTimeout> | null = null;

export function serializePanelReturnSourcePayload(payload: PanelReturnSourcePayload): string {
  return JSON.stringify({
    targetPanel: payload.targetPanel,
    categoryId: payload.categoryId,
    sourceKind: payload.sourceKind,
  });
}

export function parsePanelReturnSourcePayload(
  raw: string | null | undefined,
): PanelReturnSourcePayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as {
      targetPanel?: unknown;
      categoryId?: unknown;
      sourceKind?: unknown;
    };
    const targetPanel = parsed.targetPanel;
    if (targetPanel !== "bag" && targetPanel !== "shop") return null;
    const sourceKind = parsed.sourceKind;
    if (sourceKind !== "rank" && sourceKind !== "intel") return null;
    const categoryId = String(parsed.categoryId ?? "").trim();
    if (!categoryId) return null;
    return { targetPanel, categoryId, sourceKind };
  } catch {
    return null;
  }
}

export function writePanelReturnSourceSession(
  payload: PanelReturnSourcePayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const validated = parsePanelReturnSourcePayload(serializePanelReturnSourcePayload(payload));
  if (!validated) return;
  try {
    storage?.setItem(PANEL_RETURN_SOURCE_SESSION_KEY, serializePanelReturnSourcePayload(validated));
  } catch {
    /* quota / private mode */
  }
}

export function readPanelReturnSourceSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): PanelReturnSourcePayload | null {
  try {
    return parsePanelReturnSourcePayload(storage?.getItem(PANEL_RETURN_SOURCE_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function clearPanelReturnSourceSession(
  storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(PANEL_RETURN_SOURCE_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

/** 打开背包/商城时读取并清除待高亮分类（单次消费）。 */
export function consumePanelReturnSourceSession(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): PanelReturnSourcePayload | null {
  const payload = readPanelReturnSourceSession(storage);
  if (payload) clearPanelReturnSourceSession(storage);
  return payload;
}

export function bagCategoryTabSelector(categoryId: string): string {
  return `[data-bag-category="${categoryId}"]`;
}

export function shopCategoryTabSelector(categoryId: string): string {
  return `[data-shop-category="${categoryId}"]`;
}

export function findPanelReturnSourceCategoryTab(
  panelRoot: ParentNode | null | undefined,
  targetPanel: PanelReturnTargetPanel,
  categoryId: string,
): HTMLElement | null {
  if (!panelRoot) return null;
  const selector =
    targetPanel === "bag" ? bagCategoryTabSelector(categoryId) : shopCategoryTabSelector(categoryId);
  const tab = panelRoot.querySelector<HTMLElement>(selector);
  return tab ?? null;
}

export function clearPanelReturnSourceHighlightResidual(panelRoot: ParentNode | null | undefined): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(`.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS}`)
    .forEach((el) => el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS));
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual` 2s。 */
export function highlightPanelReturnSourceCategoryResidual(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidual(panelRoot);
  if (returnSourceHighlightTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightTimer);
    returnSourceHighlightTimer = null;
  }
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS);
  void tab.offsetWidth;
  returnSourceHighlightTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS);
    returnSourceHighlightTimer = null;
  }, durationMs);
  return true;
}
