import { applyPanelStateChrome } from "@/engine/panelStateChrome";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { MarchSummary } from "@/net/militaryFormat";
import { filterMarchesByDestination } from "@/ui/marchWorldListLink";

/** 军事出征表单目标坐标输入框高亮（军情选中互链，CLIENT-189）。 */
export const MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS = "march-form-coord-sync-highlight";

/** 军情列表行：与表单坐标匹配的终点高亮。 */
export const MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS = "march-intel-row-coord-sync-highlight";

export const MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE = "march-intel-coord-sync-empty-hint";

export const MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS = 1500;

export type MarchFormCoordSyncTimers = {
  formHighlightTimer: ReturnType<typeof setTimeout> | null;
  rowHighlightTimer: ReturnType<typeof setTimeout> | null;
};

export function createMarchFormCoordSyncTimers(): MarchFormCoordSyncTimers {
  return { formHighlightTimer: null, rowHighlightTimer: null };
}

function clearFormCoordSyncHighlight(militaryRoot: ParentNode | null | undefined): void {
  if (!militaryRoot) return;
  for (const input of militaryRoot.querySelectorAll<HTMLElement>(
    `[data-field="to-x"], [data-field="to-y"]`,
  )) {
    input.classList.remove(MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS);
  }
}

function clearIntelRowCoordSyncHighlight(intelRoot: ParentNode | null | undefined): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS}`)
    .forEach((row) => row.classList.remove(MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS));
}

/** 表单坐标无匹配行军时的 empty 文案（与 CLIENT-173 empty 态口径一致，非网关 error）。 */
export function formatMarchIntelCoordSyncEmptyHint(x: number, y: number): string {
  return `格点 (${x},${y}) 暂无指向行军（军事表单坐标同步）`;
}

export type HighlightMarchFormCoordsFromIntelOptions = {
  durationMs?: number;
  timers?: MarchFormCoordSyncTimers;
};

/**
 * 军情列表选中行军时：以该行 `to_x`/`to_y` 为同源，高亮军事表单目标坐标输入框。
 */
export function highlightMarchFormCoordsFromIntel(
  militaryRoot: ParentNode | null | undefined,
  march: MarchSummary | null,
  options?: HighlightMarchFormCoordsFromIntelOptions,
): void {
  const timers = options?.timers;
  if (timers?.formHighlightTimer) {
    clearTimeout(timers.formHighlightTimer);
    timers.formHighlightTimer = null;
  }
  clearFormCoordSyncHighlight(militaryRoot);
  if (!militaryRoot || !march) return;

  const tx = march.to_x;
  const ty = march.to_y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

  const inputs = militaryRoot.querySelectorAll<HTMLElement>(
    `[data-field="to-x"], [data-field="to-y"]`,
  );
  for (const input of inputs) {
    input.classList.add(MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS);
  }

  const duration = options?.durationMs ?? MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS;
  if (timers && duration > 0) {
    timers.formHighlightTimer = setTimeout(() => {
      timers.formHighlightTimer = null;
      clearFormCoordSyncHighlight(militaryRoot);
    }, duration);
  }
}

export type ScrollIntelRowForCoordsOptions = {
  durationMs?: number;
  timers?: MarchFormCoordSyncTimers;
  assets?: AssetLoader;
};

/**
 * 军事表单改坐标后：军情列表滚动并高亮终点匹配行；无匹配则展示 CLIENT-173 风格 empty hint。
 */
export function scrollIntelRowForCoords(
  intelRoot: ParentNode | null | undefined,
  marches: MarchSummary[],
  x: number,
  y: number,
  options?: ScrollIntelRowForCoordsOptions,
): void {
  const timers = options?.timers;
  if (timers?.rowHighlightTimer) {
    clearTimeout(timers.rowHighlightTimer);
    timers.rowHighlightTimer = null;
  }
  clearIntelRowCoordSyncHighlight(intelRoot);
  syncMarchIntelCoordSyncEmptyHint(intelRoot, null, options?.assets);

  if (!intelRoot || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const matches = filterMarchesByDestination(marches, Math.trunc(x), Math.trunc(y));
  const first = matches[0];
  const marchId = first?.march_id;
  if (marchId == null || !Number.isFinite(marchId)) {
    syncMarchIntelCoordSyncEmptyHint(
      intelRoot,
      formatMarchIntelCoordSyncEmptyHint(Math.trunc(x), Math.trunc(y)),
      options?.assets,
    );
    return;
  }

  const li = intelRoot.querySelector<HTMLElement>(
    `.march-list li[data-march-id="${Math.trunc(marchId)}"]`,
  );
  if (!li) {
    syncMarchIntelCoordSyncEmptyHint(
      intelRoot,
      formatMarchIntelCoordSyncEmptyHint(Math.trunc(x), Math.trunc(y)),
      options?.assets,
    );
    return;
  }

  li.classList.add(MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS);
  li.scrollIntoView?.({ block: "nearest" });

  const duration = options?.durationMs ?? MARCH_FORM_COORD_SYNC_HIGHLIGHT_MS;
  if (timers && duration > 0) {
    timers.rowHighlightTimer = setTimeout(() => {
      timers.rowHighlightTimer = null;
      li.classList.remove(MARCH_INTEL_ROW_COORD_SYNC_HIGHLIGHT_CLASS);
    }, duration);
  }
}

export function syncMarchIntelCoordSyncEmptyHint(
  intelRoot: ParentNode | null | undefined,
  message: string | null,
  assets?: AssetLoader,
): void {
  const el = intelRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_COORD_SYNC_EMPTY_HINT_ROLE}"]`,
  );
  if (!el) return;
  if (!message) {
    el.textContent = "";
    el.classList.add("hidden");
    el.removeAttribute("data-panel-state");
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
  applyPanelStateChrome(el, "empty", assets);
}
