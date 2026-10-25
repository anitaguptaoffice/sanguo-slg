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
  resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRing,
} from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestRing";
import {
  formatNextQueueFinishPreviewResidualDeepestDeepestDeeperLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeeper";

export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS,
} from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestRing";

/** CLIENT-341：CLIENT-325 下的巩固再加深四层次行。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS =
  "queue-next-finish-preview-residual-deepest-deepest-deepest-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_ROLE =
  "queue-next-finish-preview-residual-deepest-deepest-deepest-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_ACTION =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring";

export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring";
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS = 3000;

export type NextQueueFinishPreviewResidualDeepestDeepestDeepest = {
  line: string;
  slotKey: string;
};

let previewDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

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
 * CLIENT-325 巩固再加深三层行之上：双队列类型 + 下一完成 ETA 只读 **巩固再加深四层** 摘要。
 */
export function formatNextQueueFinishPreviewResidualDeepestDeepestDeepestLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreviewResidualDeepestDeepestDeepest | null {
  const deepestDeepestDeeper = formatNextQueueFinishPreviewResidualDeepestDeepestDeeperLine(
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deepestDeepestDeeper) return null;

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
  const line = `巩固再加深四层 ${dual} · 槽位(${slotName}) · 下一完成(${kindLabel}) ETA ${rem ?? "—"} · 点击最深四层链七槽`;
  return { line, slotKey };
}

function clearPreviewCrossLinkDeepestDeepestDeepestRing(tag: HTMLElement): void {
  tag.classList.remove(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
}

/** 预览最深四层链：叠 CLIENT-325 最深三层环 + 3s 更深环；CLIENT-340 完成焦点最深四层环不退化。 */
export function pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const key = slotKey.trim();
  if (!key) return false;
  if (!pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRing(overlayLayer, key, windowObj)) {
    return false;
  }
  scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRing(overlayLayer, key, windowObj);

  const tag = findCitySlotOverlayTag(overlayLayer, key);
  if (!tag) return false;

  clearPreviewCrossLinkDeepestDeepestDeepestRing(tag);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);

  if (previewDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(previewDeepestDeepestDeepestRingTimer);
  }

  previewDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    clearPreviewCrossLinkDeepestDeepestDeepestRing(tag);
    previewDeepestDeepestDeepestRingTimer = null;
  }, DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS);

  return true;
}

/** @internal vitest */
export function resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestRingTimersForTests(): void {
  resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeeperRingTimersForTests();
  resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRingTimersForTests();
  if (previewDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(previewDeepestDeepestDeepestRingTimer);
    previewDeepestDeepestDeepestRingTimer = null;
  }
}
