import type { CityBuilding } from "@/net/bootstrapSession";
import { buildingCfgIdForSlot } from "@/net/dailyQuestQueueMatch";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { computeUpgradeCostAtLevel } from "@/net/previewUpgradeCost";
import { previewRecruitCost } from "@/net/previewRecruitCost";
import { formatBuildQueueCountdown, type RecruitQueueEntry } from "@/net/queueState";

export type QueueRemainingProgress = {
  /** 行内剩余文案（`剩 m:ss`）；已完成或无效时为 null。 */
  remainingText: string | null;
  /** 与顶栏 `formatBuildQueueCountdown` 同源的「最近 剩 …」摘要；单行展示用。 */
  overviewCountdown: string | null;
  /** 0–100；无 started_at 或无效区间时为 null（仅展示倒计时）。 */
  progressPercent: number | null;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

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
  let progressPercent: number | null = null;
  const started = startedAtMs ?? 0;
  if (started > 0 && started < finish) {
    const total = finish - started;
    const elapsed = nowMs - started;
    progressPercent = clampPercent((elapsed / total) * 100);
  }
  return { remainingText, overviewCountdown, progressPercent };
}

/** 队列行次行 HTML：倒计时 + 可选细进度条。 */
export function renderQueueRemainingProgressMarkup(
  progress: QueueRemainingProgress,
): string | null {
  if (!progress.remainingText) return null;
  const parts = [`<span class="queue-row-countdown">${escapeHtml(progress.remainingText)}</span>`];
  if (progress.progressPercent != null) {
    parts.push(
      `<span class="queue-row-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.progressPercent}">` +
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
  const markup = renderQueueRemainingProgressMarkup(progress);
  if (!markup) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = markup;
  const secondary = wrap.firstElementChild;
  if (secondary) li.appendChild(secondary);
}
