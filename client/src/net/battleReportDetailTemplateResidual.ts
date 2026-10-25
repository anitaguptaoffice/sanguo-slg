import type { BattleReportViewSnapshot } from "@/net/battleReportSideLink";
import { formatBattleReportSideSummary } from "@/net/battleReportSideLink";
import type { BattleReportDetailView, BattleReportSummary } from "@/net/militaryFormat";
import { formatCasualtyMap } from "@/net/militaryFormat";
import { parseBattleReportLocation } from "@/net/battleReportMinimapFocus";
import type { BattleReportLocation } from "@/net/battleReportMinimapFocus";
import {
  applyBattleReportCoordCopyBarResidualDeepSweep,
  formatBattleReportCoordCopyBarResidualDeepSweep,
} from "@/net/battleReportCoordCopyBarResidualDeepSweep";
import {
  applyBattleReportCoordCopyBarResidualDeeperSweep,
  formatBattleReportCoordCopyBarResidualDeeperSweep,
} from "@/net/battleReportCoordCopyBarResidualDeeperSweep";
import {
  applyBattleReportCoordCopyBarResidualDeepestSweep,
  formatBattleReportCoordCopyBarResidualDeepestSweep,
} from "@/net/battleReportCoordCopyBarResidualDeepestSweep";

export const BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_CLASS =
  "battle-report-side-template-residual";
export const BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS =
  "battle-report-side-template-residual-line";
export const BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_SUBLINE_CLASS =
  "battle-report-side-template-residual-subline";

export const COPY_REPORT_COORDS_READONLY_ACTION = "copy-report-coords-readonly";
export const BATTLE_REPORT_COORD_COPY_BAR_CLASS = "battle-report-coord-copy-bar";
export const BATTLE_REPORT_COORD_COPY_TEXT_ROLE = "battle-report-coord-copy-text";
export const BATTLE_REPORT_COORD_COPY_SELECTED_CLASS =
  "battle-report-coord-copy-selected";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-sweep";

export const BATTLE_REPORT_COORD_COPY_SELECT_MS = 1500;

/** CLIENT-254：复制条选中态扫读环时长（CLIENT-240 文本选中 1.5s **不退化**）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_MS = 2000;

export type BattleReportSideTemplateResidualParts = {
  templateLine: string;
  casualtySubline: string;
};

function extractTemplateFromSideLine(sideLine: string): string {
  const sep = " · ";
  const idx = sideLine.lastIndexOf(sep);
  if (idx === -1) {
    return sideLine.replace(/^攻：|^守：/u, "").trim();
  }
  return sideLine.slice(idx + sep.length).trim();
}

/** 战报详情顶栏：攻守主将模板只读摘要（CLIENT-240；CLIENT-100 侧栏 **不退化**）。 */
export function formatBattleReportSideTemplateResidualLine(
  report: BattleReportViewSnapshot | undefined,
): BattleReportSideTemplateResidualParts {
  const parts = formatBattleReportSideSummary(report);
  const attTpl = extractTemplateFromSideLine(parts.attackerLine);
  const defTpl = extractTemplateFromSideLine(parts.defenderLine);
  const templateLine = `攻：${attTpl} · 守：${defTpl}`;
  const casualtySubline = formatBattleReportSideTemplateCasualtySubline(report?.detail);
  return { templateLine, casualtySubline };
}

/** 兵力损耗次行（沿用 detail JSON 伤亡 map，与 CLIENT-208 同源字段）。 */
export function formatBattleReportSideTemplateCasualtySubline(
  detail: BattleReportDetailView | undefined,
): string {
  if (!detail) return "";
  const attLoss = formatCasualtyMap(detail.attacker_casualties);
  const defLoss = formatCasualtyMap(detail.defender_casualties);
  if (attLoss === "无" && defLoss === "无") return "";
  return `兵力损耗：攻 ${attLoss} · 守 ${defLoss}`;
}

/** 只读复制条展示文本：`x,y`（无剪贴板 API）。 */
export function formatBattleReportCoordsCopyText(
  loc: BattleReportLocation | null | undefined,
): string {
  if (!loc) return "";
  return `${loc.x},${loc.y}`;
}

export function shouldShowBattleReportCoordCopyBar(
  summary: BattleReportSummary | undefined,
): boolean {
  return parseBattleReportLocation(summary) != null;
}

let coordCopySelectTimer: ReturnType<typeof setTimeout> | null = null;
let coordCopyBarSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中扫读提示（只读；**无**剪贴板 API）。 */
export function formatBattleReportCoordCopyBarResidualSweep(copyText: string): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中扫读 2s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-sweep` 2s（与 CLIENT-240 选中态并存）。
 */
export function applyBattleReportCoordCopyBarResidualSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS);
  if (coordCopyBarSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarSweepTimer);
  }
  coordCopyBarSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS);
    coordCopyBarSweepTimer = null;
  }, durationMs);
}

/**
 * 坐标只读复制条：文本选中态 1.5s（Selection API；**无** navigator.clipboard）。
 */
export function applyBattleReportCoordsReadonlySelect(
  textEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_SELECT_MS,
): void {
  if (coordCopySelectTimer != null) {
    clearTimeout(coordCopySelectTimer);
    coordCopySelectTimer = null;
  }
  textEl.classList.remove(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS);
  const selection = textEl.ownerDocument.defaultView?.getSelection();
  selection?.removeAllRanges();
  const range = textEl.ownerDocument.createRange();
  range.selectNodeContents(textEl);
  selection?.addRange(range);
  textEl.classList.add(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS);
  const barEl = textEl.closest<HTMLElement>(`.${BATTLE_REPORT_COORD_COPY_BAR_CLASS}`);
  if (barEl) {
    const copyText = textEl.textContent ?? "";
    const deepestSweepHint = formatBattleReportCoordCopyBarResidualDeepestSweep(copyText);
    const deeperSweepHint = formatBattleReportCoordCopyBarResidualDeeperSweep(copyText);
    const deepSweepHint = formatBattleReportCoordCopyBarResidualDeepSweep(copyText);
    const sweepHint = formatBattleReportCoordCopyBarResidualSweep(copyText);
    if (deepestSweepHint) {
      barEl.setAttribute("aria-label", deepestSweepHint);
    } else if (deeperSweepHint) {
      barEl.setAttribute("aria-label", deepSweepHint);
    } else if (sweepHint) {
      barEl.setAttribute("aria-label", sweepHint);
    }
    applyBattleReportCoordCopyBarResidualSweep(barEl);
    applyBattleReportCoordCopyBarResidualDeepSweep(barEl);
    applyBattleReportCoordCopyBarResidualDeeperSweep(barEl);
    applyBattleReportCoordCopyBarResidualDeepestSweep(barEl);
  }
  coordCopySelectTimer = setTimeout(() => {
    coordCopySelectTimer = null;
    textEl.classList.remove(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS);
    selection?.removeAllRanges();
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualSweepTimersForTests(): void {
  if (coordCopyBarSweepTimer != null) {
    clearTimeout(coordCopyBarSweepTimer);
    coordCopyBarSweepTimer = null;
  }
  if (coordCopySelectTimer != null) {
    clearTimeout(coordCopySelectTimer);
    coordCopySelectTimer = null;
  }
}
