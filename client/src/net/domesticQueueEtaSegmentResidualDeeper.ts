import { formatUpgradeRemainingAbbrev } from "@/net/mainCitySlotUpgrade";
import { formatDomesticQueueEtaSegmentLabel } from "@/net/domesticQueueEtaSegment";
import {
  formatDomesticQueueEtaSegmentResidualDeepLabel,
} from "@/net/domesticQueueEtaSegmentResidualDeep";

/** CLIENT-276：CLIENT-260 深巩固行下的 **巩固再加深** 分段阈值只读行。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deeper-label";

/** CLIENT-276：完成倒计时只读第四行（CLIENT-212/260 不退化）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deeper-finish";

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

export type DomesticQueueEtaSegmentResidualDeeperLabel = {
  consolidate: string;
  finishCountdown: string;
};

/**
 * CLIENT-260 深巩固之上：巩固再加深分段阈值 + 完成倒计时第四行；已完成时 null。
 */
export function formatDomesticQueueEtaSegmentResidualDeeperLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): DomesticQueueEtaSegmentResidualDeeperLabel | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const deep = formatDomesticQueueEtaSegmentResidualDeepLabel(finish, nowMs);
  if (!deep) return null;
  const segment = formatDomesticQueueEtaSegmentLabel(finish, nowMs);
  if (!segment) return null;

  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  let deeperThresholdHint: string;
  if (sec >= SEC_PER_DAY) {
    const days = Math.floor(sec / SEC_PER_DAY);
    const rem = sec % SEC_PER_DAY;
    deeperThresholdHint = `天级阈剩 ${days}d ${formatSecDuration(rem)}`;
  } else if (sec >= SEC_PER_HOUR) {
    const hours = Math.floor(sec / SEC_PER_HOUR);
    const rem = sec % SEC_PER_HOUR;
    deeperThresholdHint = `小时级阈剩 ${hours}h ${formatSecDuration(rem)}`;
  } else {
    deeperThresholdHint = `秒级阈剩 ${formatSecDuration(sec)}`;
  }

  const abbrev = formatUpgradeRemainingAbbrev(finish, nowMs);
  const finishCountdown = abbrev
    ? `第四行 · 完成倒计时（只读）· 剩 ${abbrev} · 阈内 ${formatSecDuration(sec)}`
    : null;
  if (!finishCountdown) return null;

  return {
    consolidate: `巩固再加深 · ${segment} · ${deeperThresholdHint}`,
    finishCountdown,
  };
}
