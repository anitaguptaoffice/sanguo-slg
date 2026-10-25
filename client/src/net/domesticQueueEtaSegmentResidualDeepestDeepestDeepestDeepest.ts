import { formatUpgradeRemainingAbbrev } from "@/net/mainCitySlotUpgrade";
import { formatDomesticQueueEtaSegmentLabel } from "@/net/domesticQueueEtaSegment";
import {
  formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeper";

/** CLIENT-372：CLIENT-356 最深再加深五层行下的 **巩固再加深五层** 分段阈值只读行。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-label";

/** CLIENT-372：完成倒计时只读第九行（CLIENT-212/356 **不退化**）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-finish";

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

export type DomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeepestLabel = {
  consolidate: string;
  finishCountdown: string;
};

/**
 * CLIENT-356 最深再加深五层之上：巩固再加深五层分段相位 + 完成倒计时第九行；已完成时 null。
 */
export function formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeepestLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): DomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeepestLabel | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const deepestDeepestDeepestDeeper = formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestDeeperLabel(
    finish,
    nowMs,
  );
  if (!deepestDeepestDeepestDeeper) return null;
  const segment = formatDomesticQueueEtaSegmentLabel(finish, nowMs);
  if (!segment) return null;

  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  let phaseHint: string;
  if (sec >= SEC_PER_DAY) {
    const days = Math.floor(sec / SEC_PER_DAY);
    const rem = sec % SEC_PER_DAY;
    const hours = Math.floor(rem / SEC_PER_HOUR);
    phaseHint = `五层分段阈 ${days}d ${hours}h · 阈内 ${formatSecDuration(rem)}`;
  } else if (sec >= SEC_PER_HOUR) {
    const hours = Math.floor(sec / SEC_PER_HOUR);
    const rem = sec % SEC_PER_HOUR;
    const mins = Math.floor(rem / SEC_PER_MIN);
    phaseHint = `五层分段阈 ${hours}h ${mins}m · 阈内 ${formatSecDuration(rem)}`;
  } else {
    const mins = Math.floor(sec / SEC_PER_MIN);
    const rem = sec % SEC_PER_MIN;
    phaseHint = `五层分段阈 ${mins}m ${rem}s · 阈内 ${formatSecDuration(sec)}`;
  }

  const abbrev = formatUpgradeRemainingAbbrev(finish, nowMs);
  const finishCountdown = abbrev
    ? `第九行 · 完成倒计时（只读）· 剩 ${abbrev} · 五层相位阈 ${formatSecDuration(sec)}`
    : null;
  if (!finishCountdown) return null;

  return {
    consolidate: `巩固再加深五层 · ${segment} · ${phaseHint}`,
    finishCountdown,
  };
}
