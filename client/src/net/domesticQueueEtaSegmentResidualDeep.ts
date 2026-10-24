import { formatUpgradeRemainingAbbrev } from "@/net/mainCitySlotUpgrade";
import { formatDomesticQueueEtaSegmentLabel } from "@/net/domesticQueueEtaSegment";
import { formatDomesticQueueEtaSegmentResidualLabel } from "@/net/domesticQueueEtaSegmentResidual";

/** CLIENT-260：CLIENT-244 残余次行下的巩固分段阈值只读行。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deep-label";

/** CLIENT-260：完成倒计时只读第三行（与 CLIENT-212 分段标签并列不退化）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deep-finish";

const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;

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

export type DomesticQueueEtaSegmentResidualDeepLabel = {
  consolidate: string;
  finishCountdown: string;
};

/**
 * CLIENT-244 残余次行之上：巩固分段阈值摘要 + 完成倒计时第三行；已完成时 null。
 */
export function formatDomesticQueueEtaSegmentResidualDeepLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): DomesticQueueEtaSegmentResidualDeepLabel | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const segment = formatDomesticQueueEtaSegmentLabel(finish, nowMs);
  const residual = formatDomesticQueueEtaSegmentResidualLabel(finish, nowMs);
  if (!segment || !residual) return null;

  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  let thresholdHint: string;
  if (sec >= SEC_PER_DAY) {
    const until = sec - (SEC_PER_DAY - 1);
    thresholdHint = `今日内阈剩 ${formatSecDuration(until)}`;
  } else if (sec >= SEC_PER_HOUR) {
    const until = sec - (SEC_PER_HOUR - 1);
    thresholdHint = `<1h阈剩 ${formatSecDuration(until)}`;
  } else {
    thresholdHint = "完成阈";
  }

  const abbrev = formatUpgradeRemainingAbbrev(finish, nowMs);
  const finishCountdown = abbrev ? `完成倒计时 · 剩 ${abbrev}` : null;
  if (!finishCountdown) return null;

  return {
    consolidate: `巩固分段 · ${segment} · ${thresholdHint}`,
    finishCountdown,
  };
}
