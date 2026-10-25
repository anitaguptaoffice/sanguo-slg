import type { CityBuilding } from "@/net/bootstrapSession";
import { buildingCfgIdForSlot } from "@/net/dailyQuestQueueMatch";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { computeUpgradeCostAtLevel } from "@/net/previewUpgradeCost";
import { previewRecruitCost } from "@/net/previewRecruitCost";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  formatDomesticQueueEtaSegmentLabel,
} from "@/net/domesticQueueEtaSegment";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualLabel,
} from "@/net/domesticQueueEtaSegmentResidual";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeep";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeeper";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeeper";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestDeepestDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeepestDeeper";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS,
  formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeepestDeepest";
import {
  computeQueueRowProgressBarWidthPercent,
  formatQueueRemainingEtaLine,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
} from "@/net/queueRemainingEtaLine";
import { formatBuildQueueCountdown, type RecruitQueueEntry } from "@/net/queueState";

export type QueueRemainingProgress = {
  /** 行内剩余文案（`剩 m:ss`）；已完成或无效时为 null。 */
  remainingText: string | null;
  /** 与顶栏 `formatBuildQueueCountdown` 同源的「最近 剩 …」摘要；单行展示用。 */
  overviewCountdown: string | null;
  /** 0–100；无 started_at 或无效区间时为 null（仅展示倒计时）。 */
  progressPercent: number | null;
};

/**
 * 队列行剩余时间与细进度条（finish_at_ms + 可选 started_at_ms；无起点则仅倒计时）。
 */
export function formatQueueRemainingProgress(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
  startedAtMs?: number | null,
): QueueRemainingProgress {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) {
    return { remainingText: null, overviewCountdown: null, progressPercent: null };
  }
  const remainingText = formatUpgradeRemaining(finish, nowMs);
  const overviewCountdown = formatBuildQueueCountdown(finish, nowMs);
  const progressPercent = computeQueueRowProgressBarWidthPercent(finish, nowMs, startedAtMs);
  return { remainingText, overviewCountdown, progressPercent };
}

/** 队列行次行 HTML：ETA 扫读 + CLIENT-164 倒计时 + 可选细进度条。 */
export function renderQueueRemainingProgressMarkup(
  progress: QueueRemainingProgress,
  finishAtMs?: number,
  nowMs = Date.now(),
): string | null {
  if (!progress.remainingText) return null;
  const parts: string[] = [];
  const etaLine =
    finishAtMs != null && finishAtMs > 0
      ? formatQueueRemainingEtaLine(finishAtMs, nowMs)
      : null;
  if (etaLine) {
    parts.push(
      `<span class="${QUEUE_ROW_ETA_LINE_CLASS}">${escapeHtml(etaLine)}</span>`,
    );
  }
  const etaSegment =
    finishAtMs != null && finishAtMs > 0
      ? formatDomesticQueueEtaSegmentLabel(finishAtMs, nowMs)
      : null;
  if (etaSegment) {
    parts.push(
      `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS}">${escapeHtml(etaSegment)}</span>`,
    );
    const etaResidual =
      finishAtMs != null && finishAtMs > 0
        ? formatDomesticQueueEtaSegmentResidualLabel(finishAtMs, nowMs)
        : null;
    if (etaResidual) {
      parts.push(
        `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS}">${escapeHtml(etaResidual)}</span>`,
      );
      const etaDeep =
        finishAtMs != null && finishAtMs > 0
          ? formatDomesticQueueEtaSegmentResidualDeepLabel(finishAtMs, nowMs)
          : null;
      if (etaDeep) {
        parts.push(
          `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS}">${escapeHtml(etaDeep.consolidate)}</span>`,
          `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS}">${escapeHtml(etaDeep.finishCountdown)}</span>`,
        );
        const etaDeeper =
          finishAtMs != null && finishAtMs > 0
            ? formatDomesticQueueEtaSegmentResidualDeeperLabel(finishAtMs, nowMs)
            : null;
        if (etaDeeper) {
          parts.push(
            `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS}">${escapeHtml(etaDeeper.consolidate)}</span>`,
            `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS}">${escapeHtml(etaDeeper.finishCountdown)}</span>`,
          );
          const etaDeepest =
            finishAtMs != null && finishAtMs > 0
              ? formatDomesticQueueEtaSegmentResidualDeepestLabel(finishAtMs, nowMs)
              : null;
          if (etaDeepest) {
            parts.push(
              `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS}">${escapeHtml(etaDeepest.consolidate)}</span>`,
              `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS}">${escapeHtml(etaDeepest.finishCountdown)}</span>`,
            );
            const etaDeepestDeeper =
              finishAtMs != null && finishAtMs > 0
                ? formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel(finishAtMs, nowMs)
                : null;
            if (etaDeepestDeeper) {
              parts.push(
                `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS}">${escapeHtml(etaDeepestDeeper.consolidate)}</span>`,
                `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS}">${escapeHtml(etaDeepestDeeper.finishCountdown)}</span>`,
              );
              const etaDeepestDeepestDeeper =
                finishAtMs != null && finishAtMs > 0
                  ? formatDomesticQueueEtaSegmentResidualDeepestDeepestDeeperLabel(finishAtMs, nowMs)
                  : null;
              if (etaDeepestDeepestDeeper) {
                parts.push(
                  `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LABEL_CLASS}">${escapeHtml(etaDeepestDeepestDeeper.consolidate)}</span>`,
                  `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_FINISH_CLASS}">${escapeHtml(etaDeepestDeepestDeeper.finishCountdown)}</span>`,
                );
                const etaDeepestDeepestDeepest =
                  finishAtMs != null && finishAtMs > 0
                    ? formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestLabel(finishAtMs, nowMs)
                    : null;
                if (etaDeepestDeepestDeepest) {
                  parts.push(
                    `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS}">${escapeHtml(etaDeepestDeepestDeepest.consolidate)}</span>`,
                    `<span class="${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS}">${escapeHtml(etaDeepestDeepestDeepest.finishCountdown)}</span>`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }
  parts.push(
    `<span class="queue-row-countdown">${escapeHtml(progress.remainingText)}</span>`,
  );
  if (progress.progressPercent != null) {
    parts.push(
      `<span class="queue-row-progress ${QUEUE_ROW_PROGRESS_BAR_CLASS}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.progressPercent}">` +
        `<span class="queue-row-progress-fill" style="width:${progress.progressPercent}%"></span></span>`,
    );
  }
  return `<span class="queue-row-secondary">${parts.join("")}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 由 finish_at 与 cfg 升级耗时反推起点（无服务端 started_at 时）。 */
export function inferBuildUpgradeStartedAtMs(building: CityBuilding): number | null {
  const finish = building.upgrade_finish_at_ms ?? 0;
  if (finish <= 0) return null;
  const level = building.level ?? 0;
  const targetLevel = level + 1;
  const cfgId =
    building.building_cfg_id ?? buildingCfgIdForSlot(building.slot_key ?? "");
  if (cfgId <= 0) return null;
  const computed = computeUpgradeCostAtLevel(cfgId, targetLevel);
  if (!computed || computed.timeSec <= 0) return null;
  return finish - computed.timeSec * 1000;
}

export function inferRecruitQueueStartedAtMs(entry: RecruitQueueEntry): number | null {
  const finish = entry.finish_at_ms ?? 0;
  if (finish <= 0) return null;
  const preview = previewRecruitCost(entry.unit_cfg_id, entry.count, undefined);
  if (!preview || preview.timeSec <= 0) return null;
  return finish - preview.timeSec * 1000;
}

export function appendQueueRemainingProgressRow(
  li: HTMLElement,
  finishAtMs: number,
  nowMs: number,
  startedAtMs?: number | null,
): void {
  const progress = formatQueueRemainingProgress(finishAtMs, nowMs, startedAtMs);
  const markup = renderQueueRemainingProgressMarkup(progress, finishAtMs, nowMs);
  if (!markup) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = markup;
  const secondary = wrap.firstElementChild;
  if (secondary) li.appendChild(secondary);
}
