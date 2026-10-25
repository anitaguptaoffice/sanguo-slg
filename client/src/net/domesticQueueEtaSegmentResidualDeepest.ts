import { formatUpgradeRemainingAbbrev } from "@/net/mainCitySlotUpgrade";
import { formatDomesticQueueEtaSegmentLabel } from "@/net/domesticQueueEtaSegment";
import {
  formatDomesticQueueEtaSegmentResidualDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeeper";

/** CLIENT-292：CLIENT-276 巩固再加深行下的 **巩固再加深一层** 分段阈值只读行。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deepest-label";

/** CLIENT-292：完成倒计时只读第四行（CLIENT-212/276 **不退化**）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deepest-finish";

const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;
const SEC_PER_MIN = 60;

function formatSecDuration(sec: number): string {
  const safe = Math.max(0, Math.trunc(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (m > 0) {
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${s}s`;
}

export type DomesticQueueEtaSegmentResidualDeepestLabel = {
  consolidate: string;
  finishCountdown: string;
};

/**
 * CLIENT-276 更深巩固之上：巩固再加深一层分段相位 + 完成倒计时第四行；已完成时 null。
 */
export function formatDomesticQueueEtaSegmentResidualDeepestLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): DomesticQueueEtaSegmentResidualDeepestLabel | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const deeper = formatDomesticQueueEtaSegmentResidualDeeperLabel(finish, nowMs);
  if (!deeper) return null;
  const segment = formatDomesticQueueEtaSegmentLabel(finish, nowMs);
  if (!segment) return null;

  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  let phaseHint: string;
  if (sec >= SEC_PER_DAY) {
    const days = Math.floor(sec / SEC_PER_DAY);
    const rem = sec % SEC_PER_DAY;
    const hours = Math.floor(rem / SEC_PER_HOUR);
    phaseHint = `分段相位 ${days}d ${hours}h · 阈内 ${formatSecDuration(rem)}`;
  } else if (sec >= SEC_PER_HOUR) {
    const hours = Math.floor(sec / SEC_PER_HOUR);
    const rem = sec % SEC_PER_HOUR;
    const mins = Math.floor(rem / SEC_PER_MIN);
    phaseHint = `分段相位 ${hours}h ${mins}m · 阈内 ${formatSecDuration(rem)}`;
  } else {
    const mins = Math.floor(sec / SEC_PER_MIN);
    const rem = sec % SEC_PER_MIN;
    phaseHint = `分段相位 ${mins}m ${rem}s · 阈内 ${formatSecDuration(sec)}`;
  }

  const abbrev = formatUpgradeRemainingAbbrev(finish, nowMs);
  const finishCountdown = abbrev
    ? `第四行 · 完成倒计时（只读）· 剩 ${abbrev} · 相位阈 ${formatSecDuration(sec)}`
    : null;
  if (!finishCountdown) return null;

  return {
    consolidate: `巩固再加深一层 · ${segment} · ${phaseHint}`,
    finishCountdown,
  };
}
