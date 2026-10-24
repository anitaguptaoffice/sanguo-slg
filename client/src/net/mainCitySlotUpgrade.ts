import type { CityBuilding } from "@/net/bootstrapSession";
import { formatUpgradeRemaining } from "@/net/hudFormat";

export const QUEUE_BUILD_ROW_ID_PREFIX = "queue-build-row-";

/** 画布槽位 overlay 文案输入（`GetCityState.buildings[]` 子集字段）。 */
export type SlotOverlayLabelInput = Pick<CityBuilding, "level" | "upgrade_finish_at_ms">;

/**
 * 七槽扫读标签：`Lv.N`，升级进行中追加 ETA（与 {@link formatUpgradeRemainingAbbrev} 同口径）。
 * 空闲槽位与 `upgrade_finish_at_ms` 缺省或 ≤ now 一致，仅展示等级。
 */
export function formatSlotOverlayLabel(
  slot: SlotOverlayLabelInput | undefined,
  nowMs = Date.now(),
): string {
  const lv = Math.max(0, slot?.level ?? 0);
  const finish = slot?.upgrade_finish_at_ms ?? 0;
  if (finish > nowMs) {
    const eta = formatUpgradeRemainingAbbrev(finish, nowMs);
    if (eta) return `Lv${lv} · ${eta}`;
  }
  return `Lv${lv}`;
}

/** 队列建造行 DOM id，与槽位 `slot_key` 一一对应（深链高亮）。 */
export function queueBuildRowDomId(slotKey: string): string {
  const key = slotKey.trim();
  return `${QUEUE_BUILD_ROW_ID_PREFIX}${key || "?"}`;
}

/** 与 {@link formatUpgradeRemaining} 同口径的剩余时间，去掉「剩 」前缀供画布标签缩写。 */
export function formatUpgradeRemainingAbbrev(
  finishAtMs: number | undefined,
  nowMs = Date.now(),
): string | null {
  const full = formatUpgradeRemaining(finishAtMs, nowMs);
  if (!full) return null;
  return full.startsWith("剩 ") ? full.slice(2) : full;
}

export type UpgradeProgressAnchor = {
  finishAtMs: number;
  startedAtMs: number;
};

/** 首次观测到进行中的升级时，用「剩余时间 = 已用时间」假设 50% 进度（无服务端 start 字段）。 */
export function initialUpgradeProgressAnchor(finishAtMs: number, nowMs: number): UpgradeProgressAnchor {
  const remaining = Math.max(1, finishAtMs - nowMs);
  return { finishAtMs, startedAtMs: nowMs - remaining };
}

/** 在 finish 变化时更新锚点：加速保留 startedAt；新排队则重算。 */
export function syncUpgradeProgressAnchor(
  prev: UpgradeProgressAnchor | undefined,
  finishAtMs: number,
  nowMs: number,
): UpgradeProgressAnchor | undefined {
  if (finishAtMs <= nowMs) return undefined;
  if (!prev || prev.finishAtMs !== finishAtMs) {
    if (prev && finishAtMs < prev.finishAtMs) {
      return { finishAtMs, startedAtMs: prev.startedAtMs };
    }
    return initialUpgradeProgressAnchor(finishAtMs, nowMs);
  }
  return prev;
}

/** 建造进度 0～1（纯函数）。 */
export function upgradeProgressRatio(anchor: UpgradeProgressAnchor, nowMs: number): number {
  const { startedAtMs, finishAtMs } = anchor;
  if (finishAtMs <= nowMs) return 1;
  const total = finishAtMs - startedAtMs;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (nowMs - startedAtMs) / total));
}
