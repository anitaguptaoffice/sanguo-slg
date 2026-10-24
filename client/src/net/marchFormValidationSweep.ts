import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import {
  type MarchFormValidationResult,
  WORLD_MAP_COORD_MAX,
} from "@/net/marchFormValidation";

/** 军事出征面板底栏校验汇总（CLIENT-238；与 CLIENT-048/206 内联区并存）。 */
export const MARCH_FORM_VALIDATION_SWEEP_LINE_ROLE = "march-form-validation-sweep-line";
export const MARCH_FORM_VALIDATION_SWEEP_CLASS = "march-form-validation-sweep-line";
export const MARCH_FORM_VALIDATION_SWEEP_WARN_CLASS = "march-form-validation-sweep-warn";

export type MarchFormValidationSweepResult = {
  line: string;
  hasWarn: boolean;
};

function parseCoordDisplay(raw: string): string {
  const t = raw.trim();
  if (t === "") return "待填";
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return "无效";
  if (n < 0 || n > WORLD_MAP_COORD_MAX) return "越界";
  return String(n);
}

function coordSegment(
  validation: MarchFormValidationResult,
  toXRaw: string,
  toYRaw: string,
): { text: string; ok: boolean } {
  const msg = validation.ok ? "" : validation.message;
  const coordIssue =
    msg.includes("目标 X") || msg.includes("目标 Y") || msg.includes("坐标");
  if (validation.ok) {
    return { text: `坐标 (${validation.toX},${validation.toY}) ✓`, ok: true };
  }
  if (coordIssue) {
    const x = parseCoordDisplay(toXRaw);
    const y = parseCoordDisplay(toYRaw);
    return { text: `坐标 (${x},${y}) 待修正`, ok: false };
  }
  const x = parseCoordDisplay(toXRaw);
  const y = parseCoordDisplay(toYRaw);
  if (x !== "待填" && x !== "无效" && x !== "越界" && y !== "待填" && y !== "无效" && y !== "越界") {
    return { text: `坐标 (${x},${y}) ✓`, ok: true };
  }
  return { text: `坐标 (${x},${y}) 待修正`, ok: false };
}

function troopSegment(
  validation: MarchFormValidationResult,
  reserve: MarchFormTroopReserveLineResult | null,
): { text: string; ok: boolean } {
  if (reserve?.insufficient) {
    return { text: "兵力 超出城内可用", ok: false };
  }
  const msg = validation.ok ? "" : validation.message;
  const troopIssue =
    msg.includes("出征步兵") || msg.includes("兵力") || msg.includes("城内可用");
  if (validation.ok && reserve?.selected != null) {
    return {
      text: `兵力 已选 ${reserve.selected}/可用 ${reserve.available} ✓`,
      ok: true,
    };
  }
  if (validation.ok) {
    return { text: "兵力 已填 ✓", ok: true };
  }
  if (troopIssue) {
    return { text: "兵力 待修正", ok: false };
  }
  if (reserve?.selected != null) {
    return {
      text: `兵力 已选 ${reserve.selected}/可用 ${reserve.available} ✓`,
      ok: true,
    };
  }
  return { text: "兵力 待填", ok: false };
}

function targetSegment(validation: MarchFormValidationResult): { text: string; ok: boolean } {
  const msg = validation.ok ? "" : validation.message;
  if (msg.includes("不能与己方城池同格")) {
    return { text: "目标 不能与己方城池同格", ok: false };
  }
  if (validation.ok) {
    return { text: "目标 格点有效 ✓", ok: true };
  }
  if (msg.includes("目标 X") || msg.includes("目标 Y")) {
    return { text: "目标 待有效格点", ok: false };
  }
  return { text: "目标 待有效格点", ok: !msg.includes("不能与己方城池同格") };
}

/**
 * 出征表单底栏只读校验汇总：坐标 / 兵力 / 目标三段（不发 RPC）。
 */
export function formatMarchFormValidationSweepLine(
  validation: MarchFormValidationResult,
  reserve: MarchFormTroopReserveLineResult | null,
  coords: { toXRaw: string; toYRaw: string },
): MarchFormValidationSweepResult {
  const parts = [
    coordSegment(validation, coords.toXRaw, coords.toYRaw),
    troopSegment(validation, reserve),
    targetSegment(validation),
  ];
  const hasWarn = parts.some((p) => !p.ok);
  return {
    line: parts.map((p) => p.text).join(" · "),
    hasWarn,
  };
}

export function syncMarchFormValidationSweepLine(
  formRoot: ParentNode | null | undefined,
  result: MarchFormValidationSweepResult,
): void {
  const el = formRoot?.querySelector<HTMLElement>(`[data-role="${MARCH_FORM_VALIDATION_SWEEP_LINE_ROLE}"]`);
  if (!el) return;
  el.textContent = result.line;
  el.classList.add(MARCH_FORM_VALIDATION_SWEEP_CLASS);
  el.classList.toggle(MARCH_FORM_VALIDATION_SWEEP_WARN_CLASS, result.hasWarn);
}
