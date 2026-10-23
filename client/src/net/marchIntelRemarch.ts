import { formatTroopStacks, type MarchSummary } from "@/net/militaryFormat";
import {
  applyMarchTargetAndRemember,
  type MarchTargetSource,
} from "@/net/marchTargetMemory";

export const MARCH_INTEL_REMARCH_SOURCE: MarchTargetSource = "march_intel";

export type MarchIntelRemarchPrefill = {
  toX: number;
  toY: number;
  lastTroopsSummary: string | null;
};

/** ListMarches 快照中的编制 → 只读「上次兵力」文案。 */
export function formatMarchIntelLastTroopsSummary(march: MarchSummary): string | null {
  const stacks = march.troops;
  if (!stacks?.length) return null;
  const body = formatTroopStacks(stacks);
  if (!body || body === "无") return null;
  return `上次兵力：${body}`;
}

/** 军情行 → 军事面板预填快照（纯函数，不发 RPC）。 */
export function buildMarchIntelRemarchPrefill(march: MarchSummary): MarchIntelRemarchPrefill | null {
  const toX = march.to_x;
  const toY = march.to_y;
  if (!Number.isFinite(toX) || !Number.isFinite(toY)) return null;
  return {
    toX: Math.trunc(toX),
    toY: Math.trunc(toY),
    lastTroopsSummary: formatMarchIntelLastTroopsSummary(march),
  };
}

/** 写入出征 to_x/to_y 并同步 CLIENT-043 session。 */
export function applyMarchIntelRemarchPrefill(
  formRoot: ParentNode | null | undefined,
  prefill: MarchIntelRemarchPrefill,
  storage?: Pick<Storage, "setItem"> | null,
): boolean {
  return applyMarchTargetAndRemember(formRoot, prefill.toX, prefill.toY, {
    source: MARCH_INTEL_REMARCH_SOURCE,
    storage,
  });
}
