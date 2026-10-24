import type { BattleReportViewSnapshot } from "@/net/battleReportSideLink";
import { formatBattleReportSideSummary } from "@/net/battleReportSideLink";
import type { BattleReportDetailView, BattleReportSummary } from "@/net/militaryFormat";
import { formatCasualtyMap } from "@/net/militaryFormat";
import { parseBattleReportLocation } from "@/net/battleReportMinimapFocus";
import type { BattleReportLocation } from "@/net/battleReportMinimapFocus";

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

export const BATTLE_REPORT_COORD_COPY_SELECT_MS = 1500;

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
  coordCopySelectTimer = setTimeout(() => {
    coordCopySelectTimer = null;
    textEl.classList.remove(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS);
    selection?.removeAllRanges();
  }, durationMs);
}
