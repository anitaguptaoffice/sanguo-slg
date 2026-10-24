import { formatUpgradeRemaining } from "@/net/hudFormat";
import { formatTimeMs } from "@/net/militaryFormat";

/** CLIENT-196：队列行次行 ETA 扫读（剩余秒数 + finish_at_ms 只读摘要）。 */
export const QUEUE_ROW_ETA_LINE_CLASS = "queue-row-eta-line";

/** CLIENT-196：队列行细进度条容器（与 CLIENT-164 `queue-row-progress` 并存，不退化）。 */
export const QUEUE_ROW_PROGRESS_BAR_CLASS = "queue-row-progress-bar";

/**
 * 建造/募兵队列行次行 ETA：`剩 Ns` + `formatUpgradeRemaining` + `upgrade_finish_at_ms` 完成时刻。
 */
export function formatQueueRemainingEtaLine(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): string | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const sec = Math.max(0, Math.ceil((finish - nowMs) / 1000));
  const rem = formatUpgradeRemaining(finish, nowMs);
  const parts = [`剩 ${sec}s`];
  if (rem) parts.push(rem);
  parts.push(`完成 ${formatTimeMs(finish)}`);
  return parts.join(" · ");
}

/** 0–100；无有效 started/finish 区间时为 null（仅倒计时，无进度条宽度）。 */
export function computeQueueRowProgressBarWidthPercent(
  finishAtMs: number,
  nowMs: number,
  startedAtMs?: number | null,
): number | null {
  const finish = finishAtMs;
  if (finish <= nowMs) return null;
  const started = startedAtMs ?? 0;
  if (started <= 0 || started >= finish) return null;
  const total = finish - started;
  const elapsed = nowMs - started;
  if (!Number.isFinite(total) || total <= 0) return null;
  const raw = (elapsed / total) * 100;
  if (!Number.isFinite(raw)) return null;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
