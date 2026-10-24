import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount } from "@/net/hudFormat";
import {
  MARCH_FORM_INFANTRY_UNIT_CFG_ID,
  setMarchFormErrorDisplay,
  validateMarchForm,
} from "@/net/marchFormValidation";
import type { CityTroopStack } from "@/net/militaryFormat";
import { formatMarchRemainingMs, unitLabel } from "@/net/militaryFormat";

/** 与 spec/data/source/params/march.yml `sec_per_cell_at_speed_50` 及 internal/military/march/duration.go 一致。 */
export const MARCH_SEC_PER_CELL_AT_SPEED_50 = 72;

/** 与 spec/rules/params.yml combat.troops 及 cfg_unit.stats 对齐（出征预览用）。 */
const UNIT_MARCH_STATS: Record<number, { speed: number; foodUpkeep: number }> = {
  1: { speed: 50, foodUpkeep: 1 },
  2: { speed: 100, foodUpkeep: 2 },
  3: { speed: 60, foodUpkeep: 1 },
  4: { speed: 30, foodUpkeep: 3 },
};

export const MARCH_FORM_SUMMARY_CLASS = "march-form-summary";
export const MARCH_FORM_SUMMARY_RESOURCE_WARN_CLASS = "resource-warn";

export type MarchFormSnapshot = {
  toXRaw: string;
  toYRaw: string;
  marchCountRaw: string;
  unitCfgId: number;
  cityX?: number;
  cityY?: number;
  wallet?: ResourceWallet;
};

export type MarchFormSummaryResult = {
  summaryLine: string;
  resourceWarn: boolean;
  resourceWarnLine: string | null;
};

export function chebyshevGridDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dx = Math.abs(fromX - toX);
  const dy = Math.abs(fromY - toY);
  return Math.max(dx, dy);
}

export function marchDurationSecFromDistance(distance: number, speed: number): number {
  if (distance <= 0) return 0;
  const s = speed > 0 ? speed : 1;
  const sec = (distance * MARCH_SEC_PER_CELL_AT_SPEED_50 * 50) / s;
  if (sec < 1) return 1;
  return Math.ceil(sec);
}

export function unitMarchSpeed(unitCfgId: number): number {
  return UNIT_MARCH_STATS[unitCfgId]?.speed ?? 50;
}

export function unitFoodUpkeep(unitCfgId: number): number {
  return UNIT_MARCH_STATS[unitCfgId]?.foodUpkeep ?? 1;
}

/** 行军途中粮消耗估算：food_upkeep × 兵力 × 单程耗时（小时，向上取整）。 */
export function estimateMarchFoodCost(
  unitCfgId: number,
  troopCount: number,
  durationSec: number,
): number {
  if (troopCount <= 0 || durationSec <= 0) return 0;
  const upkeep = unitFoodUpkeep(unitCfgId);
  const hours = Math.ceil(durationSec / 3600);
  return upkeep * troopCount * Math.max(1, hours);
}

function parseCoordForSummary(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function parseMarchCountForSummary(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function formatTargetCoordDisplay(toXRaw: string, toYRaw: string, toX: number | null, toY: number | null): string {
  if (toX != null && toY != null) return `(${toX},${toY})`;
  const x = toXRaw.trim() || "?";
  const y = toYRaw.trim() || "?";
  return `(${x},${y})`;
}

function formatMarchResourceWarnLine(
  wallet: ResourceWallet | undefined,
  foodNeed: number,
): string | null {
  if (foodNeed <= 0) return null;
  const have = wallet?.food ?? 0;
  if (have >= foodNeed) return null;
  return `粮余量不足（途耗约 ${formatResourceAmount(foodNeed)}，持 ${formatResourceAmount(have)}）`;
}

/**
 * 出征表单只读汇总（CLIENT-089）：目标格点、兵力合计、CLIENT-047 同源 ETA（表单快照推算 arrive_at，不发 StartMarch）。
 */
export function formatMarchFormSummary(
  snapshot: MarchFormSnapshot,
  nowMs: number,
): MarchFormSummaryResult {
  const unitCfgId = snapshot.unitCfgId > 0 ? snapshot.unitCfgId : MARCH_FORM_INFANTRY_UNIT_CFG_ID;
  const unitName = unitLabel(unitCfgId);
  const toX = parseCoordForSummary(snapshot.toXRaw);
  const toY = parseCoordForSummary(snapshot.toYRaw);
  const marchCount = parseMarchCountForSummary(snapshot.marchCountRaw);
  const target = formatTargetCoordDisplay(snapshot.toXRaw, snapshot.toYRaw, toX, toY);
  const troopPart = marchCount != null ? `${unitName}×${marchCount}` : `${unitName}×—`;

  let etaPart = "ETA —";
  let foodNeed = 0;

  const cityX = snapshot.cityX;
  const cityY = snapshot.cityY;
  if (
    toX != null &&
    toY != null &&
    cityX != null &&
    cityY != null &&
    Number.isInteger(cityX) &&
    Number.isInteger(cityY)
  ) {
    const distance = chebyshevGridDistance(cityX, cityY, toX, toY);
    const speed = unitMarchSpeed(unitCfgId);
    const durationSec = marchDurationSecFromDistance(distance, speed);
    const arriveAtMs = nowMs + durationSec * 1000;
    etaPart = formatMarchRemainingMs(nowMs, arriveAtMs);
    if (marchCount != null) {
      foodNeed = estimateMarchFoodCost(unitCfgId, marchCount, durationSec);
    }
  }

  const resourceWarnLine = formatMarchResourceWarnLine(snapshot.wallet, foodNeed);
  const foodHint =
    foodNeed > 0 ? ` · 途粮约 ${formatResourceAmount(foodNeed)}` : "";
  const summaryLine = `出征汇总：目标 ${target} · ${troopPart} · ${etaPart}${foodHint}`;

  return {
    summaryLine,
    resourceWarn: resourceWarnLine != null,
    resourceWarnLine,
  };
}

export function readMarchFormSnapshot(
  formRoot: ParentNode | null | undefined,
  opts?: { cityX?: number; cityY?: number; wallet?: ResourceWallet },
): MarchFormSnapshot {
  const toXRaw =
    (formRoot?.querySelector('[data-field="to-x"]') as HTMLInputElement | null)?.value ?? "";
  const toYRaw =
    (formRoot?.querySelector('[data-field="to-y"]') as HTMLInputElement | null)?.value ?? "";
  const marchCountRaw =
    (formRoot?.querySelector('[data-field="march-count"]') as HTMLInputElement | null)?.value ??
    "";
  return {
    toXRaw,
    toYRaw,
    marchCountRaw,
    unitCfgId: MARCH_FORM_INFANTRY_UNIT_CFG_ID,
    cityX: opts?.cityX,
    cityY: opts?.cityY,
    wallet: opts?.wallet,
  };
}

/** 军事面板 `data-role="march-form-summary"` / `march-form-summary-warn` 渲染。 */
export function setMarchFormSummaryDisplay(
  formRoot: ParentNode | null | undefined,
  result: MarchFormSummaryResult,
): void {
  const summaryEl = formRoot?.querySelector('[data-role="march-form-summary"]');
  const warnEl = formRoot?.querySelector('[data-role="march-form-summary-warn"]');
  if (summaryEl) {
    summaryEl.textContent = result.summaryLine;
    summaryEl.classList.toggle(MARCH_FORM_SUMMARY_RESOURCE_WARN_CLASS, result.resourceWarn);
  }
  if (warnEl) {
    if (result.resourceWarnLine) {
      warnEl.textContent = result.resourceWarnLine;
      warnEl.classList.remove("hidden");
    } else {
      warnEl.textContent = "";
      warnEl.classList.add("hidden");
    }
  }
}

export type MarchFormInlineFeedbackContext = {
  cityX?: number;
  cityY?: number;
  cityTroops: CityTroopStack[];
  wallet?: ResourceWallet;
  clockMs: number;
};

/** CLIENT-048 + CLIENT-089：预填或输入变更时同步 summary 与内联校验。 */
export function syncMarchFormInlineFeedback(
  formRoot: ParentNode | null | undefined,
  ctx: MarchFormInlineFeedbackContext,
): void {
  const snap = readMarchFormSnapshot(formRoot, {
    cityX: ctx.cityX,
    cityY: ctx.cityY,
    wallet: ctx.wallet,
  });
  setMarchFormSummaryDisplay(formRoot, formatMarchFormSummary(snap, ctx.clockMs));
  const validated = validateMarchForm({
    toXRaw: snap.toXRaw,
    toYRaw: snap.toYRaw,
    marchCountRaw: snap.marchCountRaw,
    cityX: ctx.cityX,
    cityY: ctx.cityY,
    cityTroops: ctx.cityTroops,
  });
  setMarchFormErrorDisplay(formRoot, validated.ok ? null : validated.message);
}
