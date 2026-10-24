/** sessionStorage：自商城返回背包时高亮上次查看道具（CLIENT-210）。 */
export const BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY = "bag-shop-return-v1";

export const BAG_ROW_RETURN_HIGHLIGHT_CLASS = "bag-row-return-highlight";
export const BAG_ROW_RETURN_HIGHLIGHT_MS = 2000;

export function serializeBagShopReturnHighlight(itemCfgId: number): string {
  return JSON.stringify({ itemCfgId: Math.trunc(itemCfgId) });
}

export function parseBagShopReturnHighlight(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { itemCfgId?: unknown };
    const id = Number(parsed.itemCfgId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return Math.trunc(id);
  } catch {
    const legacy = Number(raw);
    if (Number.isFinite(legacy) && legacy > 0) return Math.trunc(legacy);
    return null;
  }
}

export function readBagShopReturnHighlight(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseBagShopReturnHighlight(storage?.getItem(BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeBagShopReturnHighlight(
  itemCfgId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const id = Math.trunc(Number(itemCfgId) || 0);
  if (id <= 0) return;
  const validated = parseBagShopReturnHighlight(serializeBagShopReturnHighlight(id));
  if (!validated) return;
  try {
    storage?.setItem(
      BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY,
      serializeBagShopReturnHighlight(validated),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearBagShopReturnHighlight(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(BAG_SHOP_RETURN_HIGHLIGHT_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

/** 打开商城前记录背包当前选中道具。 */
export function captureBagLastViewedForShopReturn(
  selectedItemCfgId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  writeBagShopReturnHighlight(selectedItemCfgId, storage);
}

/** 读取并清除待高亮道具 id（单次消费）。 */
export function consumeBagShopReturnHighlight(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  const id = readBagShopReturnHighlight(storage);
  if (id) clearBagShopReturnHighlight(storage);
  return id;
}

let bagRowReturnHighlightTimer: ReturnType<typeof setTimeout> | null = null;

/** 列表行 `bag-row-return-highlight` 扫读脉冲 2s（非购买提交脉冲）。 */
export function scheduleBagRowReturnHighlight(
  panel: ParentNode | null | undefined,
  itemCfgId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  if (!panel || itemCfgId <= 0) return false;
  const row = panel.querySelector<HTMLElement>(`li[data-item-cfg-id="${itemCfgId}"]`);
  if (!row) return false;
  row.classList.add(BAG_ROW_RETURN_HIGHLIGHT_CLASS);
  if (bagRowReturnHighlightTimer) windowObj.clearTimeout(bagRowReturnHighlightTimer);
  bagRowReturnHighlightTimer = windowObj.setTimeout(() => {
    row.classList.remove(BAG_ROW_RETURN_HIGHLIGHT_CLASS);
    bagRowReturnHighlightTimer = null;
  }, BAG_ROW_RETURN_HIGHLIGHT_MS);
  return true;
}
