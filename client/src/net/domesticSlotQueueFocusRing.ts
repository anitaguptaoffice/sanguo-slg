import type { CityBuilding } from "@/net/bootstrapSession";
import {
  BUILDING_CFG_TO_SLOT_KEY,
  buildingCfgIdForSlot,
  resolveBuildingCfgId,
} from "@/net/dailyQuestQueueMatch";
import {
  findCitySlotOverlayTag,
  resolveQueueRowDomIdForSlot,
  type QueueRowLinkSnapshot,
} from "@/net/citySlotQueueLink";

/** CLIENT-228：七槽↔队列双向焦点环（1.5s；与 CLIENT-180/197 脉冲 class 可叠加）。 */
export const DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS = "domestic-slot-queue-focus-ring";
export const DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS = 1500;

const QUEUE_ROW_BUILDING_CFG_ATTR = "data-building-cfg-id";

let queueRowFocusRingTimer: ReturnType<typeof setTimeout> | null = null;
let slotFocusRingTimer: ReturnType<typeof setTimeout> | null = null;

function resolveSlotKeyForBuildingCfg(
  slotKey: string,
  building: CityBuilding | null | undefined,
): string {
  const trimmed = slotKey.trim();
  if (trimmed) return trimmed;
  const cfgId = building ? resolveBuildingCfgId(building) : 0;
  if (cfgId > 0 && BUILDING_CFG_TO_SLOT_KEY[cfgId]) {
    return BUILDING_CFG_TO_SLOT_KEY[cfgId];
  }
  return "";
}

/** 队列面板内按槽位 / 同源 `building_cfg_id` 解析建造或募兵行节点。 */
export function findQueueRowForDomesticFocus(
  queuePanelRoot: ParentNode,
  slotKey: string,
  snapshot: QueueRowLinkSnapshot,
  building?: CityBuilding | null,
): HTMLElement | null {
  const key = resolveSlotKeyForBuildingCfg(slotKey, building);
  const rowId = key ? resolveQueueRowDomIdForSlot(key, snapshot) : null;
  if (rowId) {
    const byId = queuePanelRoot.querySelector(`#${CSS.escape(rowId)}`);
    if (byId instanceof HTMLElement) return byId;
  }
  const cfgId =
    (building ? resolveBuildingCfgId(building) : 0) ||
    (key ? buildingCfgIdForSlot(key) : 0);
  if (cfgId <= 0) return null;
  const byCfg = queuePanelRoot.querySelector(
    `li.queue-list-row[${QUEUE_ROW_BUILDING_CFG_ATTR}="${cfgId}"]`,
  );
  return byCfg instanceof HTMLElement ? byCfg : null;
}

/**
 * 七槽选中 → 队列行 `domestic-slot-queue-focus-ring` 1.5s（CLIENT-180 高亮不退化）。
 */
export function highlightDomesticQueueRowFocusRing(
  queuePanelRoot: HTMLElement | null | undefined,
  slotKey: string,
  snapshot: QueueRowLinkSnapshot,
  building?: CityBuilding | null,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  if (!queuePanelRoot) return false;
  const row = findQueueRowForDomesticFocus(queuePanelRoot, slotKey, snapshot, building);
  if (!row) return false;
  row.classList.remove(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
  if (typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  if (queueRowFocusRingTimer != null) {
    clearTimeout(queueRowFocusRingTimer);
  }
  queueRowFocusRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
    queueRowFocusRingTimer = null;
  }, DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS);
  return true;
}

/**
 * 队列行点击 → 七槽 overlay 反向 `domestic-slot-queue-focus-ring` 1.5s（CLIENT-180 pulse 不退化）。
 */
export function highlightDomesticSlotForQueueRow(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  building?: CityBuilding | null,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const key = resolveSlotKeyForBuildingCfg(slotKey, building);
  if (!key) return false;
  const tag = findCitySlotOverlayTag(overlayLayer, key);
  if (!tag) return false;
  if (typeof tag.scrollIntoView === "function") {
    tag.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  tag.classList.remove(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
  if (slotFocusRingTimer != null) {
    clearTimeout(slotFocusRingTimer);
  }
  slotFocusRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
    slotFocusRingTimer = null;
  }, DOMESTIC_SLOT_QUEUE_FOCUS_RING_MS);
  return true;
}

/** @internal vitest：清理挂起定时器。 */
export function resetDomesticSlotQueueFocusRingTimersForTests(): void {
  if (queueRowFocusRingTimer != null) {
    clearTimeout(queueRowFocusRingTimer);
    queueRowFocusRingTimer = null;
  }
  if (slotFocusRingTimer != null) {
    clearTimeout(slotFocusRingTimer);
    slotFocusRingTimer = null;
  }
}

/** 建造队列行 dataset：与 `resolveBuildingCfgId` 同源。 */
export function applyQueueRowBuildingCfgIdDataset(
  row: HTMLElement,
  building: CityBuilding,
): void {
  const cfgId = resolveBuildingCfgId(building);
  if (cfgId > 0) {
    row.setAttribute(QUEUE_ROW_BUILDING_CFG_ATTR, String(cfgId));
  } else {
    row.removeAttribute(QUEUE_ROW_BUILDING_CFG_ATTR);
  }
}
