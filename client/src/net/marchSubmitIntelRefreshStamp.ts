import { formatPanelRefreshRelative } from "@/net/panelRefreshStamp";

/** 出征成功 ListMarches 刷新戳记（CLIENT-238；与 CLIENT-222 军情交接条并存）。 */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_ROLE = "march-submit-intel-refresh-stamp";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS = "march-submit-intel-refresh-stamp";
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS = 2000;

/** 刷新戳记触发时军情列表新行军行 2s 脉冲（与 `intel-new-march-highlight` 并存）。 */
export const INTEL_LIST_REFRESH_MARCH_PULSE_CLASS = "intel-list-refresh-march-pulse";
export const INTEL_LIST_REFRESH_MARCH_PULSE_MS = MARCH_SUBMIT_INTEL_REFRESH_STAMP_MS;

let refreshStampHideTimer: ReturnType<typeof setTimeout> | null = null;
let refreshMarchPulseTimer: ReturnType<typeof setTimeout> | null = null;

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
  scheduleMarchSubmitIntelRefreshStampHide(intelRoot);
  pulseIntelListRefreshMarchRow(intelRoot, marchId);
}
