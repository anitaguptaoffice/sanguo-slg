import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import {
  BUILDING_CFG_TO_SLOT_KEY,
  pickNearestActiveQueueEntry,
  resolveBuildingCfgId,
} from "@/net/dailyQuestQueueMatch";
import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { RECRUIT_QUEUE_MATRIX_SLOT_KEY } from "@/net/recruitQueueComplete";
import type { RecruitQueueEntry } from "@/net/queueState";
import {
  activeBuildingUpgrades,
  isRecruitQueueActive,
} from "@/net/queueState";
import {
  resetDomesticQueueCompleteFocusResidualDeeperRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeeperRing,
} from "@/net/domesticQueueCompleteFocusResidualDeeperRing";
import {
  formatNextQueueFinishPreviewResidualDeepLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeep";

export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_MS,
} from "@/net/domesticQueueCompleteFocusResidualDeeperRing";

/** CLIENT-277：CLIENT-261 下的巩固再加深次行。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_CLASS =
  "queue-next-finish-preview-residual-deeper-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_ROLE =
  "queue-next-finish-preview-residual-deeper-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_ACTION =
  "domestic-slot-preview-cross-link-residual-deeper-ring";

export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deeper-ring";
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_MS = 2500;

export type NextQueueFinishPreviewResidualDeeper = {
  line: string;
  slotKey: string;
};

let previewDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

function resolveSlotKeyForNearest(
  snapshot: NonNullable<ReturnType<typeof pickNearestActiveQueueEntry>>,
): string | null {
  if (snapshot.kind === "build") {
    const building = snapshot.building;
    const key =
      building.slot_key?.trim() ||
      BUILDING_CFG_TO_SLOT_KEY[resolveBuildingCfgId(building)] ||
      "";
    return key || null;
  }
  return RECRUIT_QUEUE_MATRIX_SLOT_KEY;
}

function formatDualQueueTypeConsolidatedSummary(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  nowMs: number,
): string {
  const buildCount = activeBuildingUpgrades(buildings, nowMs).length;
  const recruitCount = (recruits ?? []).filter((e) => isRecruitQueueActive(e, nowMs)).length;
  return `内政×${buildCount} · 募兵×${recruitCount}`;
}

/**
 * CLIENT-261 深巩固行之上：双队列类型 + 下一完成 ETA 只读 **巩固再加深** 摘要。
 */
export function formatNextQueueFinishPreviewResidualDeeperLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreviewResidualDeeper | null {
  const deep = formatNextQueueFinishPreviewResidualDeepLine(
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deep) return null;

  const nearest = pickNearestActiveQueueEntry(buildings, recruits, nowMs);
  if (!nearest) return null;
  const slotKey = resolveSlotKeyForNearest(nearest);
  if (!slotKey) return null;

  const dual = formatDualQueueTypeConsolidatedSummary(buildings, recruits, nowMs);
  const rem =
    nearest.kind === "build"
      ? formatUpgradeRemaining(nearest.building.upgrade_finish_at_ms, nowMs)
      : formatUpgradeRemaining(nearest.recruit.finish_at_ms, nowMs);
  const kindLabel = nearest.kind === "build" ? "内政" : "募兵";
  const slotName = slotLabels[slotKey] ?? slotKey;
  const line = `巩固再加深 ${dual} · 槽位(${slotName}) · 下一完成(${kindLabel}) ETA ${rem ?? "—"} · 点击更深链七槽`;
  return { line, slotKey };
}

function clearPreviewCrossLinkDeeperRing(tag: HTMLElement): void {
  tag.classList.remove(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS);
}

/** 预览更深链：叠 CLIENT-261 深环 + 2.5s 更深环；CLIENT-276 完成焦点更深环不退化。 */
export function pulseDomesticSlotPreviewCrossLinkResidualDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const key = slotKey.trim();
  if (!key) return false;
  if (!pulseDomesticSlotPreviewCrossLinkResidualDeepRing(overlayLayer, key, windowObj)) {
    return false;
  }
  scheduleDomesticQueueCompleteFocusResidualDeeperRing(overlayLayer, key, windowObj);

  const tag = findCitySlotOverlayTag(overlayLayer, key);
  if (!tag) return false;

  clearPreviewCrossLinkDeeperRing(tag);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS);

  if (previewDeeperRingTimer != null) {
    clearTimeout(previewDeeperRingTimer);
  }

  previewDeeperRingTimer = windowObj.setTimeout(() => {
    clearPreviewCrossLinkDeeperRing(tag);
    previewDeeperRingTimer = null;
  }, DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_MS);

  return true;
}

/** @internal vitest */
export function resetDomesticSlotPreviewCrossLinkResidualDeeperRingTimersForTests(): void {
  resetDomesticSlotPreviewCrossLinkResidualDeepRingTimersForTests();
  resetDomesticQueueCompleteFocusResidualDeeperRingTimersForTests();
  if (previewDeeperRingTimer != null) {
    clearTimeout(previewDeeperRingTimer);
    previewDeeperRingTimer = null;
  }
}
