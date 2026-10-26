import {
  formatMarchPhase,
  formatMarchEta,
  marchEtaDeadline,
  formatTimeMs,
  type MarchSummary,
} from "@/net/militaryFormat";

/** CLIENT-205：军情信息卡顶栏 phase/ETA 阶段条。 */
export const MARCH_INTEL_PHASE_ETA_STRIP_CLASS = "march-intel-phase-eta-strip";

/** CLIENT-205：军情列表行次行 phase/ETA 扫读（与信息卡阶段条同源文案）。 */
export const INTEL_ROW_PHASE_SUBLINE_CLASS = "intel-row-phase-subline";

/** 信息卡阶段条与选中列表次行同步高亮。 */
export const MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS =
  "march-intel-phase-eta-mutual-highlight";

export const MARCH_INTEL_PHASE_ETA_STRIP_ROLE = "march-info-card-phase-eta-strip";

/**
 * 军情信息卡顶栏 / 列表次行：phase 只读标签 + 剩余 ETA 秒数与到达时刻摘要
 *（当前行程权威截止时刻 / `formatMarchEta` 口径）。
 */
export function formatMarchIntelPhaseEtaStrip(m: MarchSummary, nowMs: number): string {
  const phase = m.phase ?? 0;
  const phaseLabel = formatMarchPhase(phase);
  if (phase !== 2 && phase !== 4) return phaseLabel;

  const arrive = marchEtaDeadline(m) ?? 0;
  const parts: string[] = [phaseLabel];
  if (arrive > nowMs) {
    const sec = Math.max(0, Math.ceil((arrive - nowMs) / 1000));
    parts.push(`剩 ${sec}s`);
  }
  const rem = formatMarchEta(m, nowMs);
  if (rem) parts.push(rem);
  if (arrive > 0) parts.push(`${phase === 4 ? "回城" : "到达"} ${formatTimeMs(arrive)}`);
  return parts.join(" · ");
}

/** 选中行军时同步高亮信息卡阶段条与对应列表次行。 */
export function syncMarchIntelPhaseEtaMutualHighlight(
  root: ParentNode,
  marchId: number | null | undefined,
): void {
  root
    .querySelectorAll<HTMLElement>(`.${MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS}`)
    .forEach((node) => node.classList.remove(MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS));

  if (marchId == null || !Number.isFinite(marchId)) return;
  const id = Math.trunc(marchId);

  root
    .querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"].${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}`,
    )
    ?.classList.add(MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS);

  root
    .querySelector<HTMLElement>(
      `.march-list li[data-march-id="${id}"] .${INTEL_ROW_PHASE_SUBLINE_CLASS}`,
    )
    ?.classList.add(MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS);
}
