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

/** CLIENT-285：在 CLIENT-269 戳记加深上延长展示与 **巩固再加深** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS =
  "march-submit-intel-refresh-stamp-residual-deeper";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS = 3000;

/** CLIENT-285：首条新行军 phase 次行 **巩固再加深** 脉冲（与 CLIENT-269 残余加深脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deeper-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS;

/** CLIENT-301：在 CLIENT-285 戳记加深上延长展示与 **巩固再加深一层** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS = 3000;

/** CLIENT-301：首条新行军 phase 次行 **巩固再加深一层** 脉冲（与 CLIENT-285 再加深脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deepest-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS;

/** CLIENT-317：在 CLIENT-301 戳记加深上延长展示与 **巩固再加深二层** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest-deeper";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS = 3000;

/** CLIENT-317：首条新行军 phase 次行 **巩固再加深二层** 脉冲（与 CLIENT-301 最深脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deepest-deeper-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS;

/** CLIENT-333：在 CLIENT-317 戳记加深上延长展示与 **巩固再加深三层** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest-deepest-deeper";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS = 3000;

/** CLIENT-333：首条新行军 phase 次行 **巩固再加深三层** 脉冲（与 CLIENT-317 更深二层脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deepest-deepest-deeper-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS;

/** CLIENT-349：在 CLIENT-333 戳记加深上延长展示与 **巩固再加深四层** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest-deepest-deepest";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS = 3000;

/** CLIENT-349：首条新行军 phase 次行 **巩固再加深四层** 脉冲（与 CLIENT-333 更深三层脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deepest-deepest-deepest-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS;

/** CLIENT-365：在 CLIENT-349 戳记加深上延长展示与 **巩固再加深五层** 类（3s）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest-deepest-deepest-deeper";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS = 3000;

/** CLIENT-365：首条新行军 phase 次行 **巩固再加深五层** 脉冲（与 CLIENT-349 四层脉冲 **并存**）。 */
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-list-refresh-march-subline-residual-deepest-deepest-deepest-deeper-pulse";
export const INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS =
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS;

let refreshStampHideTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublinePulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeepPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeeperPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeepestPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null =
  null;
let refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer: ReturnType<typeof setTimeout> | null =
  null;
let refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer: ReturnType<
  typeof setTimeout
> | null = null;

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
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS);
    el.classList.remove(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS);
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

function syncMarchSubmitIntelRefreshStampResidualDeeperClass(
  intelRoot: ParentNode | null | undefined,
  residualDeeper: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_CLASS, residualDeeper);
}

function syncMarchSubmitIntelRefreshStampResidualDeepestClass(
  intelRoot: ParentNode | null | undefined,
  residualDeepest: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_CLASS, residualDeepest);
}

function syncMarchSubmitIntelRefreshStampResidualDeepestDeeperClass(
  intelRoot: ParentNode | null | undefined,
  residualDeepestDeeper: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_CLASS,
    residualDeepestDeeper,
  );
}

function syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeeperClass(
  intelRoot: ParentNode | null | undefined,
  residualDeepestDeepestDeeper: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
    residualDeepestDeepestDeeper,
  );
}

function syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestClass(
  intelRoot: ParentNode | null | undefined,
  residualDeepestDeepestDeepest: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS,
    residualDeepestDeepestDeepest,
  );
}

function syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestDeeperClass(
  intelRoot: ParentNode | null | undefined,
  residualDeepestDeepestDeepestDeeper: boolean,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE}"]`,
  );
  if (!el) return;
  el.classList.toggle(
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
    residualDeepestDeepestDeepestDeeper,
  );
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

export function clearIntelListRefreshMarchSublineResidualDeeperPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS}`)
    .forEach((el) => el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS));
}

export function pulseIntelListRefreshMarchSublineResidualDeeper(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeeperPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeeperPulseTimer);
    refreshMarchSublineResidualDeeperPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeeperPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeeperPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPER_PULSE_CLASS);
    refreshMarchSublineResidualDeeperPulseTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublineResidualDeepestPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS}`)
    .forEach((el) => el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS));
}

export function pulseIntelListRefreshMarchSublineResidualDeepest(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepestPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepestPulseTimer);
    refreshMarchSublineResidualDeepestPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepestPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepestPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_PULSE_CLASS);
    refreshMarchSublineResidualDeepestPulseTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublineResidualDeepestDeeperPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(
      `.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS),
    );
}

export function pulseIntelListRefreshMarchSublineResidualDeepestDeeper(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepestDeeperPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepestDeeperPulseTimer);
    refreshMarchSublineResidualDeepestDeeperPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepestDeeperPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepestDeeperPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
    refreshMarchSublineResidualDeepestDeeperPulseTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublineResidualDeepestDeepestDeeperPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(
      `.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    );
}

export function pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeeper(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer);
    refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepestDeepestDeeperPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(
      INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
    );
    refreshMarchSublineResidualDeepestDeepestDeeperPulseTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublineResidualDeepestDeepestDeepestPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(
      `.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS),
    );
}

export function pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeepest(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer);
    refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepestDeepestDeepestPulse(intelRoot);
  subline.classList.add(INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(
      INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
    );
    refreshMarchSublineResidualDeepestDeepestDeepestPulseTimer = null;
  }, durationMs);
}

export function clearIntelListRefreshMarchSublineResidualDeepestDeepestDeepestDeeperPulse(
  intelRoot: ParentNode | null | undefined,
): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(
      `.${INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(
        INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    );
}

export function pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeepestDeeper(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  const subline = row?.querySelector<HTMLElement>(`.${INTEL_ROW_PHASE_SUBLINE_CLASS}`);
  if (!subline) return;

  if (refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer != null) {
    clearTimeout(refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer);
    refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer = null;
  }
  clearIntelListRefreshMarchSublineResidualDeepestDeepestDeepestDeeperPulse(intelRoot);
  subline.classList.add(
    INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  );
  void subline.offsetWidth;
  refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer = windowObj.setTimeout(() => {
    subline.classList.remove(
      INTEL_LIST_REFRESH_MARCH_SUBLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
    );
    refreshMarchSublineResidualDeepestDeepestDeepestDeeperPulseTimer = null;
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

/**
 * `MarchAttack` 成功：CLIENT-269 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深** 脉冲（CLIENT-285；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeeper(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPER_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-285 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深一层** 脉冲（CLIENT-301；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeepest(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepest(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-301 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深二层** 脉冲（CLIENT-317；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeepestDeeper(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeeperClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepest(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeeper(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-317 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深三层** 脉冲（CLIENT-333；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeepestDeepestDeeper(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeeperClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepest(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeeper(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-333 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深四层** 脉冲（CLIENT-349；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepest(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepest(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeepest(intelRoot, marchId);
}

/**
 * `MarchAttack` 成功：CLIENT-349 戳记加深 **3s** + 新行军 phase 次行 **巩固再加深五层** 脉冲（CLIENT-365；CLIENT-080 **不退化**）。
 */
export function applyMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestDeeper(
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
  syncMarchSubmitIntelRefreshStampResidualDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeeperClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestClass(intelRoot, true);
  syncMarchSubmitIntelRefreshStampResidualDeepestDeepestDeepestDeeperClass(intelRoot, true);
  scheduleMarchSubmitIntelRefreshStampHide(
    intelRoot,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchRow(
    intelRoot,
    marchId,
    globalThis.window,
    MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
  );
  pulseIntelListRefreshMarchSubline(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeep(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepest(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeeper(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeepest(intelRoot, marchId);
  pulseIntelListRefreshMarchSublineResidualDeepestDeepestDeepestDeeper(intelRoot, marchId);
}
