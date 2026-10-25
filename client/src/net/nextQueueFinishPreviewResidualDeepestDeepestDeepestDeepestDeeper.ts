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
  resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing,
} from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing";
import {
  formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeeperLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepestDeeper";

export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
} from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing";

/** CLIENT-373：CLIENT-357 下的 wave:58 巩固再加深五层次行。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS =
  "queue-next-finish-preview-residual-deepest-deepest-deepest-deepest-deeper-line";
/** Narrow manifest / filterList 再导出用（与 CLIENT-363 `*_DEEPEST_LINE_CLASS` 口径一致）。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_ROLE =
  "queue-next-finish-preview-residual-deepest-deepest-deepest-deepest-deeper-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_ACTION =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deepest-deeper-ring";

export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deepest-deeper-ring";
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 3000;

export type NextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeper = {
  line: string;
  slotKey: string;
};

let previewDeepestDeepestDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null =
  null;

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
 * CLIENT-357 巩固再加深五层行之上：双队列类型 + 下一完成 ETA 只读 **wave:58 巩固再加深五层** 摘要。
 */
export function formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeper | null {
  const deepestDeepestDeepestDeeper = formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeeperLine(
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deepestDeepestDeepestDeeper) return null;

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
  const line = `巩固再加深五层 ${dual} · 槽位(${slotName}) · 下一完成(${kindLabel}) ETA ${rem ?? "—"} · 点击最深六层链七槽`;
  return { line, slotKey };
}

function clearPreviewCrossLinkDeepestDeepestDeepestDeepestDeeperRing(tag: HTMLElement): void {
  tag.classList.remove(
    DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
}

/** 预览 wave:58 最深六层链：叠 CLIENT-357 最深五层环 + 3s 更深环；CLIENT-372 完成焦点环不退化。 */
export function pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const key = slotKey.trim();
  if (!key) return false;
  if (
    !pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRing(
      overlayLayer,
      key,
      windowObj,
    )
  ) {
    return false;
  }
  scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing(
    overlayLayer,
    key,
    windowObj,
  );

  const tag = findCitySlotOverlayTag(overlayLayer, key);
  if (!tag) return false;

  clearPreviewCrossLinkDeepestDeepestDeepestDeepestDeeperRing(tag);
  void tag.offsetWidth;
  tag.classList.add(
    DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );

  if (previewDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(previewDeepestDeepestDeepestDeepestDeeperRingTimer);
  }

  previewDeepestDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    clearPreviewCrossLinkDeepestDeepestDeepestDeepestDeeperRing(tag);
    previewDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }, DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS);

  return true;
}

/** @internal vitest */
export function resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests(): void {
  resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeeperRingTimersForTests();
  resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests();
  if (previewDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(previewDeepestDeepestDeepestDeepestDeeperRingTimer);
    previewDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }
}
