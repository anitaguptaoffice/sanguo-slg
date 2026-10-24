import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";

/** 出征成功→军情列表新行军行扫读高亮（CLIENT-222，与 CLIENT-116 `march-row-recent` 并存）。 */
export const INTEL_NEW_MARCH_HIGHLIGHT_CLASS = "intel-new-march-highlight";

export const INTEL_NEW_MARCH_HIGHLIGHT_MS = 3000;

export const MARCH_SUBMIT_INTEL_HANDOFF_STRIP_CLASS = "march-submit-intel-handoff-strip";
export const MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE = "march-submit-intel-handoff-line";

export const MARCH_SUBMIT_INTEL_HANDOFF_VISIBLE_MS = INTEL_NEW_MARCH_HIGHLIGHT_MS;

let intelNewMarchHighlightTimer: ReturnType<typeof setTimeout> | null = null;
let marchSubmitIntelHandoffHideTimer: ReturnType<typeof setTimeout> | null = null;

/** 军情面板顶栏只读交接文案：目标坐标 + phase hint（CLIENT-222）。 */
export function formatMarchSubmitIntelHandoffLine(
  toX: number,
  toY: number,
  phaseHint: string,
): string {
  const x = Math.trunc(toX);
  const y = Math.trunc(toY);
  const hint = (phaseHint ?? "").trim() || "行军中";
  return `军情交接 · (${x},${y}) · ${hint}`;
}

export function formatMarchSubmitIntelHandoffPhaseHint(
  march: MarchSummary | null | undefined,
  nowMs: number,
): string {
  if (march) {
    const strip = formatMarchIntelPhaseEtaStrip(march, nowMs);
    if (strip.trim()) return strip;
  }
  return "行军中";
}

export function resolveMarchSubmitIntelHandoffCoords(
  march: MarchSummary | null | undefined,
  fallbackToX: number,
  fallbackToY: number,
): { toX: number; toY: number } {
  const tx = march?.to_x;
  const ty = march?.to_y;
  if (Number.isFinite(tx) && Number.isFinite(ty)) {
    return { toX: Math.trunc(tx!), toY: Math.trunc(ty!) };
  }
  return { toX: Math.trunc(fallbackToX), toY: Math.trunc(fallbackToY) };
}

export type SyncMarchSubmitIntelHandoffInput = {
  march?: MarchSummary | null;
  toX: number;
  toY: number;
  nowMs: number;
  visible: boolean;
};

export function syncMarchSubmitIntelHandoffLine(
  intelRoot: ParentNode | null | undefined,
  input: SyncMarchSubmitIntelHandoffInput,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_SUBMIT_INTEL_HANDOFF_LINE_ROLE}"]`,
  );
  if (!el) return;
  if (!input.visible) {
    el.classList.add("hidden");
    el.textContent = "";
    el.removeAttribute("data-march-id");
    return;
  }
  const { toX, toY } = resolveMarchSubmitIntelHandoffCoords(input.march, input.toX, input.toY);
  const hint = formatMarchSubmitIntelHandoffPhaseHint(input.march, input.nowMs);
  el.classList.remove("hidden");
  el.classList.add(MARCH_SUBMIT_INTEL_HANDOFF_STRIP_CLASS);
  el.textContent = formatMarchSubmitIntelHandoffLine(toX, toY, hint);
  const marchId = input.march?.march_id;
  if (marchId != null && marchId > 0) {
    el.setAttribute("data-march-id", String(Math.trunc(marchId)));
  } else {
    el.removeAttribute("data-march-id");
  }
}

export function clearIntelNewMarchHighlight(intelRoot: ParentNode | null | undefined): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_NEW_MARCH_HIGHLIGHT_CLASS}`)
    .forEach((row) => row.classList.remove(INTEL_NEW_MARCH_HIGHLIGHT_CLASS));
}

export function pulseIntelNewMarchHighlight(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = INTEL_NEW_MARCH_HIGHLIGHT_MS,
): void {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return;
  const id = Math.trunc(marchId);
  const row = intelRoot.querySelector<HTMLElement>(`.march-list li[data-march-id="${id}"]`);
  if (!row) return;

  if (intelNewMarchHighlightTimer != null) {
    clearTimeout(intelNewMarchHighlightTimer);
    intelNewMarchHighlightTimer = null;
  }
  clearIntelNewMarchHighlight(intelRoot);
  row.classList.add(INTEL_NEW_MARCH_HIGHLIGHT_CLASS);
  void row.offsetWidth;
  if (typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  intelNewMarchHighlightTimer = windowObj.setTimeout(() => {
    row.classList.remove(INTEL_NEW_MARCH_HIGHLIGHT_CLASS);
    intelNewMarchHighlightTimer = null;
  }, durationMs);
}

export function scheduleMarchSubmitIntelHandoffHide(
  intelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
  durationMs: number = MARCH_SUBMIT_INTEL_HANDOFF_VISIBLE_MS,
): void {
  if (marchSubmitIntelHandoffHideTimer != null) {
    clearTimeout(marchSubmitIntelHandoffHideTimer);
    marchSubmitIntelHandoffHideTimer = null;
  }
  marchSubmitIntelHandoffHideTimer = windowObj.setTimeout(() => {
    syncMarchSubmitIntelHandoffLine(intelRoot, {
      visible: false,
      toX: 0,
      toY: 0,
      nowMs: 0,
    });
    marchSubmitIntelHandoffHideTimer = null;
  }, durationMs);
}

export type ApplyMarchSubmitIntelHandoffInput = {
  march?: MarchSummary | null;
  toX: number;
  toY: number;
  nowMs: number;
};

/** 出征成功：军情顶栏交接文案 + 新行军行 3s 高亮（CLIENT-222）。 */
export function applyMarchSubmitIntelHandoff(
  intelRoot: ParentNode | null | undefined,
  marchId: number | null | undefined,
  input: ApplyMarchSubmitIntelHandoffInput,
): void {
  if (marchId == null || marchId <= 0) return;
  syncMarchSubmitIntelHandoffLine(intelRoot, {
    visible: true,
    march: input.march,
    toX: input.toX,
    toY: input.toY,
    nowMs: input.nowMs,
  });
  scheduleMarchSubmitIntelHandoffHide(intelRoot);
  pulseIntelNewMarchHighlight(intelRoot, marchId);
}
