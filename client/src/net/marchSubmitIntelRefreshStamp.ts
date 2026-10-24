import { INTEL_ROW_PHASE_SUBLINE_CLASS } from "@/net/marchIntelPhaseEtaStrip";
import { formatPanelRefreshRelative } from "@/net/panelRefreshStamp";

/** 出征成功 ListMarches 刷新戳记（CLIENT-238；与 CLIENT-222 军情交接条并存）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE = "march-submit-intel-refresh-stamp";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS = "march-submit-intel-refresh-stamp";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS = 2000;

/** CLIENT-253：`MarchAttack` 成功后加深戳记展示（与 CLIENT-238 类并存）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS = "march-submit-intel-refresh-stamp-deep";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS = 2500;

/** 刷新戳记触发时军情列表新行军行 2s 脉冲（与 `intel-new-march-highlight` 并存）。 */
export const INTEL_LIST_REFRESH_MARCH_PULSE_CLASS = "intel-list-refresh-march-pulse";
export const INTEL_LIST_REFRESH_MARCH_PULSE_MS = MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS;

/** CLIENT-253：刷新戳记加深时新行军行 `intel-row-phase-subline` 次行脉冲。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS =
  "intel-list-refresh-march-subline-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_MS = MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS;

/** CLIENT-269：在 CLIENT-253 戳记加深上延长展示与残余巩固类。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS =
  "march-submit-intel-refresh-stamp-residual-deep";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS = 3000;

/** CLIENT-269：首条新行军 phase 次行残余加深脉冲（与 CLIENT-253 次行脉冲并存）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deep-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS;

let refreshStampHideTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublinePulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeepPulseTimer: ReturnType<typeof setTimeout> | null = null;

export function formatMarchSubmitIntelRefreshStampLine(
  marchId: number,
  refreshedAtMs: number,
  nowMs = Date.now(),
): string {
  const id = Math.trunc(marchId);
  if (!Number.isFinite(id) || id <= 0) return "";
  const rel = formatPanelRefreshRelative(refreshedAtMs, nowMs) ?? "刚刚";
  return `军情 ListMarches 已刷新（${rel}） · 新行军 #${id}`;
}

export function syncMarchSubmitIntelRefreshStamp(
  intelRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(`[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`);
  if (!el) return;
  if (!line?.trim()) {
    el.classList.add("hidden");
    el.textContent = "";
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS);
}

export function clearIntelListRefreshMarchPulse(intelRoot: ParentNode | null | undefined): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_LIST_REFRESH_MARCH_PULSE_CLASS}`)
    .forEach((row) => row.classList.remove(INTEL_LIST_REFRESH_MARCH_PULSE_CLASS));
}

export function pulseIntelListRefreshMarchRow(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  if (!row) return;

  if (refreshMarchPulseTimer != null) {
    clearTimeout(refreshMarchPulseTimer);
    refreshMarchPulseTimer = null;
  }
  clearIntelListRefreshMarchPulse(intelRoot);
  row.classList.add(INTEL_LIST_REFRESH_MARCH_PULSE_CLASS);
  void row.offsetWidth;
  refreshMarchPulseTimer = windowObj.setTimeout(() => {
    row.classList.remove(INTEL_LIST_REFRESH_MARCH_PULSE_CLASS);
    refreshMarchPulseTimer = null;
  }, durationMs);
}

export function scheduleMarchSubmitIntelRefreshStampHide(
  intelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS,
): void {
  if (refreshStampHideTimer != null) {
    clearTimeout(refreshStampHideTimer);
    refreshStampHideTimer = null;
  }
  refreshStampHideTimer = windowObj.setTimeout(() => {
    syncMarchSubmitIntelRefreshStamp(intelRoot, null);
    refreshStampHideTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublinePulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS}`)
    .forEach((el) => el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS));
}

export function pulseIntelListRefreshMarchSubline(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublinePulseTimer != null) {
    clearTimeout(refreshMarchSublinePulseTimer);
    refreshMarchSublinePulseTimer = null;
  }
  clearIntelListRefreshMarchSublinePulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublinePulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_PULSE_CLASS);
    refreshMarchSublinePulseTimer = null;
  }, durationMs);
}

function syncMarchSubmitIntelRefreshStampDeepClass(
  intelRoot: ParentNode | null | undefined,
  deep: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS, deep);
}

function syncMarchSubmitIntelRefreshStampResidualDeepClass(
  intelRoot: ParentNode | null | undefined,
  residualDeep: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS, residualDeep);
}

export function clearIntelListRefreshMarchSublineResidualDeepPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS}`)
    .forEach((el) => el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS));
}

export function pulseIntelListRefreshMarchSublineResidualDeep(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepPulseTimer);
    refreshMarchSublineResidualDeepPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEP_PULSE_CLASS);
    refreshMarchSublineResidualDeepPulseTimer = null;
  }, durationMs);
}

/** 出征成功：军情顶栏 2s 刷新戳记 + 新行军行脉冲（CLIENT-238）。 */
export function applyMarchSubmitIntelRefreshStamp(
  intelRoot: ParentNode | null | undefined,
  marchId: number | null | undefined,
  refreshedAtMs: number,
  nowMs = Date.now(),
): void {
  if (marchId == null || marchId <= 0) return;
  const line = formatMarchSubmitIntelRefreshStampLine(marchId, refreshedAtMs, nowMs);
  syncMarchSubmitIntelRefreshStamp(intelRoot, line);
  syncMarchSubmitIntelRefreshStampDeepClass(intelRoot, false);
  scheduleMarchSubmitIntelRefreshStampHide(intelRoot);
  pulseIntelListRefreshMarchRow(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-238 戳记加深 **2.5s** + 新行军行与 phase 次行脉冲（CLIENT-253；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampDeep(
  intelRoot: ParentNode | null | undefined,
  marchId: number | null | undefined,
  refreshedAtMs: number,
  nowMs = Date.now(),
): void {
  if (marchId == null || marchId <= 0) return;
  const line = formatMarchSubmitIntelRefreshStampLine(marchId, refreshedAtMs, nowMs);
  syncMarchSubmitIntelRefreshStamp(intelRoot, line);
  syncMarchSubmitIntelRefreshStampDeepClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-253 戳记加深 **3s** + 新行军 phase 次行残余加深脉冲（CLIENT-269；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeep(
  intelRoot: ParentNode | null | undefined,
  marchId: number | null | undefined,
  refreshedAtMs: number,
  nowMs = Date.now(),
): void {
  if (marchId == null || marchId <= 0) return;
  const line = formatMarchSubmitIntelRefreshStampLine(marchId, refreshedAtMs, nowMs);
  syncMarchSubmitIntelRefreshStamp(intelRoot, line);
  syncMarchSubmitIntelRefreshStampDeepClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
}
