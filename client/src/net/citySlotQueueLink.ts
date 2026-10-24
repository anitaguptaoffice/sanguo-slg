import type { CityBuilding } from "@/net/bootstrapSession";
import { queueBuildRowDomId } from "@/net/mainCitySlotUpgrade";
import { RECRUIT_QUEUE_MATRIX_SLOT_KEY } from "@/net/recruitQueueComplete";
import { queueRecruitRowDomId } from "@/net/recruitTroopSubmitFeedback";
import { isRecruitQueueActive, sortBuildQueueRows, type RecruitQueueEntry } from "@/net/queueState";

/** 七槽选中 → 队列建造/募兵行 2s 高亮（CLIENT-180）。 */
export const QUEUE_ROW_SLOT_HIGHLIGHT_CLASS = "queue-row-slot-highlight";
export const QUEUE_ROW_SLOT_HIGHLIGHT_MS = 2000;

/** 队列行点击 → 画布七槽 overlay 2s 脉冲（CLIENT-180）。 */
export const CITY_SLOT_PULSE_CLASS = "city-slot-pulse";
export const CITY_SLOT_PULSE_MS = 2000;

const CITY_SLOT_TAG_SELECTOR = ".main-city-slot-upgrade-tag";

export type QueueRowLinkSnapshot = {
  buildings: CityBuilding[] | undefined;
  recruits: RecruitQueueEntry[] | undefined;
  nowMs: number;
};

/** 根据只读快照解析槽位对应的队列行 DOM id（建造行或募兵行）。 */
export function resolveQueueRowDomIdForSlot(
  slotKey: string,
  snapshot: QueueRowLinkSnapshot,
): string | null {
  const key = slotKey.trim();
  if (!key) return null;
  const { buildings, recruits, nowMs } = snapshot;
  if (key === RECRUIT_QUEUE_MATRIX_SLOT_KEY) {
    const barracksUpgrading = (buildings ?? []).some(
      (b) =>
        b.slot_key === RECRUIT_QUEUE_MATRIX_SLOT_KEY &&
        (b.upgrade_finish_at_ms ?? 0) > nowMs,
    );
    if (!barracksUpgrading) {
      const active = (recruits ?? []).find((e) => isRecruitQueueActive(e, nowMs));
      if (active && (active.queue_id ?? 0) > 0) {
        return queueRecruitRowDomId(active.queue_id);
      }
    }
  }
  const upgrading = sortBuildQueueRows(buildings ?? [], nowMs);
  if (upgrading.some((b) => (b.slot_key ?? "") === key)) {
    return queueBuildRowDomId(key);
  }
  return null;
}

let queueRowHighlightTimer: ReturnType<typeof setTimeout> | null = null;
let citySlotPulseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 七槽 overlay 选中时高亮队列面板对应建造/募兵行 2s（面板未打开时 no-op）。
 */
export function highlightQueueRowForSlot(
  queuePanelRoot: HTMLElement | null | undefined,
  slotKey: string,
  snapshot: QueueRowLinkSnapshot,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  if (!queuePanelRoot) return false;
  const rowId = resolveQueueRowDomIdForSlot(slotKey, snapshot);
  if (!rowId) return false;
  const row = queuePanelRoot.querySelector(`#${CSS.escape(rowId)}`);
  if (!(row instanceof HTMLElement)) return false;
  row.classList.remove(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS);
  if (typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  if (queueRowHighlightTimer != null) {
    clearTimeout(queueRowHighlightTimer);
  }
  queueRowHighlightTimer = windowObj.setTimeout(() => {
    row.classList.remove(QUEUE_ROW_SLOT_HIGHLIGHT_CLASS);
    queueRowHighlightTimer = null;
  }, QUEUE_ROW_SLOT_HIGHLIGHT_MS);
  return true;
}

/** 在七槽 overlay 层查找槽位标签节点。 */
export function findCitySlotOverlayTag(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
): HTMLElement | null {
  const key = slotKey.trim();
  if (!overlayLayer || !key) return null;
  const tags = overlayLayer.querySelectorAll(CITY_SLOT_TAG_SELECTOR);
  for (const node of tags) {
    if (node instanceof HTMLElement && (node.dataset.slotKey ?? "").trim() === key) {
      return node;
    }
  }
  return null;
}

/**
 * 队列行定位槽位：滚动 overlay 标签入视口并附加 2s `city-slot-pulse`。
 */
export function scrollCitySlotIntoView(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  if (typeof tag.scrollIntoView === "function") {
    tag.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  tag.classList.remove(CITY_SLOT_PULSE_CLASS);
  void tag.offsetWidth;
  tag.classList.add(CITY_SLOT_PULSE_CLASS);
  if (citySlotPulseTimer != null) {
    clearTimeout(citySlotPulseTimer);
  }
  citySlotPulseTimer = windowObj.setTimeout(() => {
    tag.classList.remove(CITY_SLOT_PULSE_CLASS);
    citySlotPulseTimer = null;
  }, CITY_SLOT_PULSE_MS);
  return true;
}

/** @internal vitest：清理挂起定时器。 */
export function resetCitySlotQueueLinkTimersForTests(): void {
  if (queueRowHighlightTimer != null) {
    clearTimeout(queueRowHighlightTimer);
    queueRowHighlightTimer = null;
  }
  if (citySlotPulseTimer != null) {
    clearTimeout(citySlotPulseTimer);
    citySlotPulseTimer = null;
  }
}
