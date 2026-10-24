import {
  buildQueueMatrixIndexForSlot,
  MAIN_CITY_BUILD_QUEUE_SLOT_KEYS,
  type MainCityBuildQueueSlotKey,
} from "@/net/buildQueueMatrix";
import { findCitySlotOverlayTag, scrollCitySlotIntoView } from "@/net/citySlotQueueLink";

/** sessionStorage：队列面板关闭后恢复主城七槽滚动与 ring（CLIENT-229）。 */
export const DOMESTIC_SLOT_SCROLL_SESSION_KEY = "domestic-slot-scroll-v1";

export const DOMESTIC_SLOT_RETURN_RING_CLASS = "domestic-slot-return-ring";
export const DOMESTIC_SLOT_RETURN_RING_MS = 1200;

export const DOMESTIC_SLOT_STRIP_SELECTOR = ".main-city-slot-overlay";
export const DOMESTIC_SLOT_STRIP_CELL_CLASS = "main-city-slot-overlay-cell";

export type DomesticSlotScrollPayload = {
  slotIndex: number;
  scrollLeft: number;
};

export function serializeDomesticSlotScrollAnchor(payload: DomesticSlotScrollPayload): string {
  return JSON.stringify({
    slotIndex: Math.trunc(payload.slotIndex),
    scrollLeft: Math.trunc(payload.scrollLeft),
  });
}

export function parseDomesticSlotScrollAnchor(
  raw: string | null | undefined,
): DomesticSlotScrollPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { slotIndex?: unknown; scrollLeft?: unknown };
    const slotIndex = Number(parsed.slotIndex);
    const scrollLeft = Number(parsed.scrollLeft);
    if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= MAIN_CITY_BUILD_QUEUE_SLOT_KEYS.length) {
      return null;
    }
    if (!Number.isFinite(scrollLeft) || scrollLeft < 0) return null;
    return { slotIndex: Math.trunc(slotIndex), scrollLeft: Math.trunc(scrollLeft) };
  } catch {
    return null;
  }
}

export function readDomesticSlotScrollAnchor(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): DomesticSlotScrollPayload | null {
  try {
    return parseDomesticSlotScrollAnchor(
      storage?.getItem(DOMESTIC_SLOT_SCROLL_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeDomesticSlotScrollAnchor(
  payload: DomesticSlotScrollPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseDomesticSlotScrollAnchor(serializeDomesticSlotScrollAnchor(payload));
  if (!parsed) return;
  try {
    storage?.setItem(DOMESTIC_SLOT_SCROLL_SESSION_KEY, serializeDomesticSlotScrollAnchor(parsed));
  } catch {
    /* quota / private mode */
  }
}

export function clearDomesticSlotScrollAnchor(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(DOMESTIC_SLOT_SCROLL_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function slotKeyForDomesticSlotIndex(index: number): MainCityBuildQueueSlotKey | null {
  const i = Math.trunc(index);
  if (i < 0 || i >= MAIN_CITY_BUILD_QUEUE_SLOT_KEYS.length) return null;
  return MAIN_CITY_BUILD_QUEUE_SLOT_KEYS[i];
}

export function domesticSlotStripScrollEl(root: ParentNode | null | undefined): HTMLElement | null {
  return root?.querySelector<HTMLElement>(DOMESTIC_SLOT_STRIP_SELECTOR) ?? null;
}

export function readDomesticSlotStripScrollLeft(root: ParentNode | null | undefined): number {
  return domesticSlotStripScrollEl(root)?.scrollLeft ?? 0;
}

export function applyDomesticSlotStripScrollLeft(
  root: ParentNode | null | undefined,
  scrollLeft: number,
): void {
  const el = domesticSlotStripScrollEl(root);
  if (!el || !Number.isFinite(scrollLeft) || scrollLeft < 0) return;
  el.scrollLeft = Math.trunc(scrollLeft);
}

/** 打开队列前或队列内高亮变化时写入槽位 index + 条带 scrollLeft。 */
export function captureDomesticSlotScrollAnchor(
  stripRoot: ParentNode | null | undefined,
  slotKey: string | null | undefined,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const key = slotKey?.trim();
  if (!key) return;
  const slotIndex = buildQueueMatrixIndexForSlot(key);
  if (slotIndex == null) return;
  writeDomesticSlotScrollAnchor(
    {
      slotIndex,
      scrollLeft: readDomesticSlotStripScrollLeft(stripRoot),
    },
    storage,
  );
}

let domesticSlotReturnRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticSlotReturnRing(
  targets: readonly (HTMLElement | null | undefined)[],
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  const nodes = targets.filter((n): n is HTMLElement => n instanceof HTMLElement);
  if (!nodes.length) return;
  for (const node of nodes) {
    node.classList.remove(DOMESTIC_SLOT_RETURN_RING_CLASS);
    void node.offsetWidth;
    node.classList.add(DOMESTIC_SLOT_RETURN_RING_CLASS);
  }
  if (domesticSlotReturnRingTimer != null) {
    windowObj.clearTimeout(domesticSlotReturnRingTimer);
  }
  domesticSlotReturnRingTimer = windowObj.setTimeout(() => {
    for (const node of nodes) {
      node.classList.remove(DOMESTIC_SLOT_RETURN_RING_CLASS);
    }
    domesticSlotReturnRingTimer = null;
  }, DOMESTIC_SLOT_RETURN_RING_MS);
}

/**
 * 队列面板关闭后：恢复七槽条带滚动、画布标签入视口，并附加 1.2s return ring。
 */
export function restoreDomesticSlotScrollAnchor(
  stripRoot: ParentNode | null | undefined,
  overlayLayer: ParentNode | null | undefined,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const payload = readDomesticSlotScrollAnchor(storage);
  if (!payload) return false;
  const slotKey = slotKeyForDomesticSlotIndex(payload.slotIndex);
  if (!slotKey) return false;

  applyDomesticSlotStripScrollLeft(stripRoot, payload.scrollLeft);
  const cell = stripRoot?.querySelector<HTMLElement>(
    `.${DOMESTIC_SLOT_STRIP_CELL_CLASS}[data-slot-index="${payload.slotIndex}"]`,
  );
  if (cell && typeof cell.scrollIntoView === "function") {
    cell.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  }

  scrollCitySlotIntoView(overlayLayer, slotKey, windowObj);

  const overlayTag = findCitySlotOverlayTag(overlayLayer, slotKey);
  scheduleDomesticSlotReturnRing([cell, overlayTag], windowObj);
  return true;
}

/** @internal vitest */
export function resetDomesticSlotReturnRingTimerForTests(): void {
  if (domesticSlotReturnRingTimer != null) {
    clearTimeout(domesticSlotReturnRingTimer);
    domesticSlotReturnRingTimer = null;
  }
}
