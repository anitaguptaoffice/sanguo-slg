import { formatUpgradeRemainingAbbrev } from "@/net/mainCitySlotUpgrade";

/** CLIENT-244：队列行 ETA 分段旁只读残余次行（下一档阈值；与 CLIENT-212 并列）。 */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-label";

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

/**
 * 在 CLIENT-212 分段标签旁展示「下一档」阈值提示；已完成时 null。
 * >1d → 距进入「今日内」；今日内 → 距进入「<1h」；<1h → 距完成。
 */
export function formatDomesticQueueEtaSegmentResidualLabel(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): string | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const sec = Math.max(1, Math.ceil((finish - nowMs) / 1000));
  if (sec >= SEC_PER_DAY) {
    const until = sec - (SEC_PER_DAY - 1);
    return `下一档 今日内 · 剩 ${formatSecDuration(until)}`;
  }
  if (sec >= SEC_PER_HOUR) {
    const until = sec - (SEC_PER_HOUR - 1);
    return `下一档 <1h · 剩 ${formatSecDuration(until)}`;
  }
  const abbrev = formatUpgradeRemainingAbbrev(finish, nowMs);
  return abbrev ? `下一档 完成 · 剩 ${abbrev}` : null;
}
