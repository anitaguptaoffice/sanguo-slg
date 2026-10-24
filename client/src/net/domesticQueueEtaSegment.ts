/** CLIENT-212：队列行次行 ETA 分段只读标签（与 CLIENT-196 进度条并列）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS = "domestic-queue-eta-segment-label";

const SEC_PER_HOUR = 3600;
const SEC_PER_DAY = 86400;

/**
 * 按剩余秒数分段：<1h / 今日内（≥1h 且 <24h）/>1d（≥24h）。
 * 已完成或无效 finish 时返回 null。
 */
export function formatDomesticQueueEtaSegmentLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): string | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  if (sec < SEC_PER_HOUR) return "<1h";
  if (sec >= SEC_PER_DAY) return ">1d";
  return "今日内";
}
