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
import { scheduleDomesticQueueCompleteFocusResidualRing } from "@/net/domesticQueueCompleteFocusResidualRing";

/** CLIENT-261：CLIENT-245 下的巩固深链次行。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_CLASS =
  "queue-next-finish-preview-residual-deep-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_ROLE =
  "queue-next-finish-preview-residual-deep-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_ACTION =
  "domestic-slot-preview-cross-link-residual-deep-ring";

export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deep-ring";
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_MS = 2000;

/** CLIENT-260 软依赖 stub。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS =
  "domestic-queue-complete-focus-residual-deep-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_MS = 2500;

export type NextQueueFinishPreviewResidualDeep = {
  line: string;
  slotKey: string;
};

let previewDeepRingTimer: ReturnType<typeof setTimeout> | null = null;
let focusDeepRingTimer: ReturnType<typeof setTimeout> | null = null;

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

export function formatNextQueueFinishPreviewResidualDeepLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  _slotLabels: Record<string, string>,
  _dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreviewResidualDeep | null {
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
  const line = `巩固扫读 ${dual} · 下一完成(${kindLabel}) ETA ${rem ?? "—"} · 点击深链七槽`;
  return { line, slotKey };
}

function clearPreviewCrossLinkDeepRing(tag: HTMLElement): void {
  tag.classList.remove(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS);
}

function clearFocusResidualDeepRing(tag: HTMLElement): void {
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);
}

export function pulseDomesticSlotPreviewCrossLinkResidualDeepRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const key = slotKey.trim();
  if (!key) return false;
  const tag = findCitySlotOverlayTag(overlayLayer, key);
  if (!tag) return false;
  if (typeof tag.scrollIntoView === "function") {
    tag.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  scheduleDomesticQueueCompleteFocusResidualRing(overlayLayer, key, windowObj);

  clearPreviewCrossLinkDeepRing(tag);
  clearFocusResidualDeepRing(tag);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS);
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);

  if (previewDeepRingTimer != null) {
    clearTimeout(previewDeepRingTimer);
  }
  if (focusDeepRingTimer != null) {
    clearTimeout(focusDeepRingTimer);
  }

  previewDeepRingTimer = windowObj.setTimeout(() => {
    clearPreviewCrossLinkDeepRing(tag);
    previewDeepRingTimer = null;
  }, DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_MS);

  focusDeepRingTimer = windowObj.setTimeout(() => {
    clearFocusResidualDeepRing(tag);
    focusDeepRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_MS);

  return true;
}

/** @internal vitest */
export function resetDomesticSlotPreviewCrossLinkResidualDeepRingTimersForTests(): void {
  if (previewDeepRingTimer != null) {
    clearTimeout(previewDeepRingTimer);
    previewDeepRingTimer = null;
  }
  if (focusDeepRingTimer != null) {
    clearTimeout(focusDeepRingTimer);
    focusDeepRingTimer = null;
  }
}
