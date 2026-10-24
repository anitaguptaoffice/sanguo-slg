import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceSweepLine } from "@/net/hudFormat";

/** sessionStorage 去重：同一队列完成事件只触发一次 HUD 资源脉冲（与 CLIENT-162 待办刷新并存）。 */
export const QUEUE_COMPLETE_PULSE_SESSION_KEY = "queue-complete-pulse-v1";

/** 主城产出槽 → HUD 资源键（与 DATA-002 building_cfg_id 2–5 对齐）。 */
export const BUILD_SLOT_TO_HUD_RESOURCE: Partial<Record<string, keyof ResourceWallet>> = {
  farm: "food",
  lumber: "wood",
  quarry: "stone",
  iron: "iron",
};

/** 募兵批次完成时顶栏脉冲资源（兵营队列，只读扫读粮余量/产出）。 */
export const RECRUIT_QUEUE_COMPLETE_HUD_RESOURCE: keyof ResourceWallet = "food";

export type QueueCompleteHudEvent =
  | { kind: "build"; slotKey: string }
  | { kind: "recruit"; queueId: number };

export function queueCompleteHudDedupeId(event: QueueCompleteHudEvent): string {
  return event.kind === "build" ? `build:${event.slotKey}` : `recruit:${event.queueId}`;
}

export function hudResourceKeysForQueueComplete(event: QueueCompleteHudEvent): (keyof ResourceWallet)[] {
  if (event.kind === "recruit") {
    return event.queueId > 0 ? [RECRUIT_QUEUE_COMPLETE_HUD_RESOURCE] : [];
  }
  const key = BUILD_SLOT_TO_HUD_RESOURCE[event.slotKey];
  return key ? [key] : [];
}

export function readQueueCompletePulseDedupeIds(storage: Pick<Storage, "getItem">): Set<string> {
  try {
    const raw = storage.getItem(QUEUE_COMPLETE_PULSE_SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function writeQueueCompletePulseDedupeIds(
  storage: Pick<Storage, "setItem">,
  ids: Set<string>,
): void {
  storage.setItem(QUEUE_COMPLETE_PULSE_SESSION_KEY, JSON.stringify([...ids].sort()));
}

/**
 * 队列完成是否应触发顶栏 `resource-pulse`（CLIENT-148 口径）；已记录则 false，避免重复反馈。
 */
export function shouldPulseHudOnQueueComplete(
  dedupeId: string,
  storage: Pick<Storage, "getItem" | "setItem">,
): boolean {
  if (!dedupeId) return false;
  const seen = readQueueCompletePulseDedupeIds(storage);
  if (seen.has(dedupeId)) return false;
  seen.add(dedupeId);
  writeQueueCompletePulseDedupeIds(storage, seen);
  return true;
}

/** HUD 资源展开次行：产出速率 + 仓库余量只读摘要（与 `formatResourceSweepLine` 同源）。 */
export function formatHudProductionWalletLine(
  rates: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
): string {
  return formatResourceSweepLine(rates, wallet);
}

/** 轮询/队列完成后刷新顶栏扫读次行（不重建整条资源 strip）。 */
export function refreshHudProductionWalletLine(
  hud: HTMLElement,
  rates: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
): void {
  const strip = hud.querySelector('[data-role="hud-resources"]');
  if (!(strip instanceof HTMLElement)) return;
  const line = formatHudProductionWalletLine(rates, wallet);
  const sweep = strip.querySelector('[data-role="hud-resource-sweep"]');
  if (sweep) sweep.textContent = line;
  strip.setAttribute("title", line);
  const aria = strip.getAttribute("aria-label") ?? "";
  const prefix = aria.includes("，") ? aria.split("，")[0]! : "主城资源";
  strip.setAttribute("aria-label", `${prefix}，${line}`);
}

export function collectHudPulseKeysForQueueCompletes(
  events: readonly QueueCompleteHudEvent[],
  storage: Pick<Storage, "getItem" | "setItem">,
): (keyof ResourceWallet)[] {
  const keys: (keyof ResourceWallet)[] = [];
  for (const event of events) {
    const dedupeId = queueCompleteHudDedupeId(event);
    if (!shouldPulseHudOnQueueComplete(dedupeId, storage)) continue;
    keys.push(...hudResourceKeysForQueueComplete(event));
  }
  return [...new Set(keys)];
}
