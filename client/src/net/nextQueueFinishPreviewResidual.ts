import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import {
  BUILDING_CFG_TO_SLOT_KEY,
  pickNearestActiveQueueEntry,
  resolveBuildingCfgId,
} from "@/net/dailyQuestQueueMatch";
import { formatDomesticQueueCompleteSlotMarginLabel } from "@/net/domesticQueueCompleteSlotMargin";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { unitLabel } from "@/net/militaryFormat";
import { RECRUIT_QUEUE_MATRIX_SLOT_KEY } from "@/net/recruitQueueComplete";
import type { RecruitQueueEntry } from "@/net/queueState";
import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-245：队列顶栏下一完成预览只读残余次行（CLIENT-218 主预览 **不退化**）。 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_CLASS = "queue-next-finish-preview-residual-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_ROLE = "queue-next-finish-preview-residual-line";
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_ACTION =
  "domestic-slot-complete-margin-residual-ring";

/** 七槽 overlay 与预览残余互链 1.5s 脉冲（CLIENT-212 余量 **不退化**）。 */
export const DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS =
  "domestic-slot-complete-margin-residual-ring";
export const DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_MS = 1500;

export type NextQueueFinishPreviewResidual = {
  line: string;
  slotKey: string;
};

let marginResidualRingTimer: ReturnType<typeof setTimeout> | null = null;

function resolveSlotKeyForNearest(
  snapshot: ReturnType<typeof pickNearestActiveQueueEntry>,
): string | null {
  if (!snapshot) return null;
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

function formatSlotCfgSummary(
  snapshot: NonNullable<ReturnType<typeof pickNearestActiveQueueEntry>>,
  slotLabels: Record<string, string>,
  buildings: CityBuilding[] | undefined,
  nowMs: number,
): string {
  if (snapshot.kind === "build") {
    const building = snapshot.building;
    const cfgId = resolveBuildingCfgId(building);
    const key =
      building.slot_key?.trim() ||
      BUILDING_CFG_TO_SLOT_KEY[cfgId] ||
      "?";
    const name = slotLabels[key] ?? key;
    const margin = formatDomesticQueueCompleteSlotMarginLabel(building, nowMs);
    return `cfg#${cfgId} ${name} · 余量 ${margin}`;
  }
  const r = snapshot.recruit;
  const unit = unitLabel(r.unit_cfg_id);
  const barracks = buildings?.find((b) => b.slot_key === RECRUIT_QUEUE_MATRIX_SLOT_KEY);
  const margin = formatDomesticQueueCompleteSlotMarginLabel(barracks, nowMs);
  return `募兵 ${unit}×${r.count} · 兵营余量 ${margin}`;
}

/**
 * 下一完成项 ETA + 槽位 cfg 只读残余摘要（**非** `formatNextQueueFinishPreviewLine` 主叙事重复）。
 */
export function formatNextQueueFinishPreviewResidualLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  _dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreviewResidual | null {
  const nearest = pickNearestActiveQueueEntry(buildings, recruits, nowMs);
  if (!nearest) return null;
  const slotKey = resolveSlotKeyForNearest(nearest);
  if (!slotKey) return null;
  const rem =
    nearest.kind === "build"
      ? formatUpgradeRemaining(nearest.building.upgrade_finish_at_ms, nowMs)
      : formatUpgradeRemaining(nearest.recruit.finish_at_ms, nowMs);
  const cfgSummary = formatSlotCfgSummary(nearest, slotLabels, buildings, nowMs);
  const line = `残余扫读 ${cfgSummary} · ETA 剩余 ${rem ?? "—"} · 点击定位七槽`;
  return { line, slotKey };
}

/** 预览残余行点击 → 七槽 overlay `domestic-slot-complete-margin-residual-ring` 1.5s。 */
export function pulseDomesticSlotCompleteMarginResidualRing(
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
  tag.classList.remove(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS);
  if (marginResidualRingTimer != null) {
    clearTimeout(marginResidualRingTimer);
  }
  marginResidualRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS);
    marginResidualRingTimer = null;
  }, DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticSlotCompleteMarginResidualRingTimersForTests(): void {
  if (marginResidualRingTimer != null) {
    clearTimeout(marginResidualRingTimer);
    marginResidualRingTimer = null;
  }
}
