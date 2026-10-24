import {
  marchFormAllowsSubmit,
  type MarchFormTroopReserveLineResult,
} from "@/net/marchFormTroopReserve";
import type { MarchFormValidationResult } from "@/net/marchFormValidation";
import type { MarchSubmitState } from "@/net/marchSubmitFeedback";
import type { MarchSummary } from "@/net/militaryFormat";
import { marchShowsDestOnMinimap } from "@/ui/worldMinimap";

/** HUD 军事待办分段扫读（CLIENT-226；与 CLIENT-216 合并行并存）。 */
export const HUD_MILITARY_TODO_SWEEP_LINE_ROLE = "hud-military-todo-sweep-line";
export const HUD_MILITARY_TODO_SWEEP_CLASS = "hud-military-todo-sweep";
export const HUD_MILITARY_TODO_FACET_ATTR = "data-hud-military-todo-facet";

export const HUD_MILITARY_TODO_PULSE_CLASS = "hud-military-todo-pulse";
export const HUD_MILITARY_TODO_PULSE_MS = 1500;

export type HudMilitaryTodoSweepFacet = "intel" | "reports" | "march";

export type ToolbarPanelFromHudMilitaryTodo = "marches" | "reports" | "military";

export type HudMilitaryTodoSweepCounts = {
  /** ListMarches 快照：进行中军情条数（与 minimap 目的点口径一致）。 */
  intelInProgress: number;
  /** 战报未读（与底栏战报角标 / CLIENT-158 同源）。 */
  battleReportUnread: number;
  /** 出征表单可提交：0 或 1（CLIENT-156 提交态不退化）。 */
  marchSubmittable: number;
};

export type HudMilitaryTodoSweepSegment = {
  facet: HudMilitaryTodoSweepFacet;
  label: string;
};

function facetCount(
  counts: HudMilitaryTodoSweepCounts,
  facet: HudMilitaryTodoSweepFacet,
): number {
  switch (facet) {
    case "intel":
      return Math.max(0, counts.intelInProgress);
    case "reports":
      return Math.max(0, counts.battleReportUnread);
    case "march":
      return Math.max(0, counts.marchSubmittable);
    default:
      return 0;
  }
}

function facetLabel(facet: HudMilitaryTodoSweepFacet, count: number): string | null {
  if (count <= 0) return null;
  switch (facet) {
    case "intel":
      return `军情进行中 ${count}`;
    case "reports":
      return `战报未读 ${count}`;
    case "march":
      return `出征可提交 ${count}`;
    default:
      return null;
  }
}

/** ListMarches 客户端快照：进行中军情条数（无新 RPC）。 */
export function countIntelInProgressMarches(marches: MarchSummary[]): number {
  let n = 0;
  for (const m of marches) {
    if (marchShowsDestOnMinimap(m)) n++;
  }
  return n;
}

export function findFirstIntelInProgressMarchId(marches: MarchSummary[]): number {
  for (const m of marches) {
    if (!marchShowsDestOnMinimap(m)) continue;
    const id = m.march_id ?? 0;
    if (id > 0) return id;
  }
  return 0;
}

export function resolveHudMarchSubmittableCount(
  marchSubmitState: MarchSubmitState,
  validation: MarchFormValidationResult,
  reserve: MarchFormTroopReserveLineResult | null,
): number {
  if (marchSubmitState === "submitting") return 0;
  return marchFormAllowsSubmit(validation, reserve) ? 1 : 0;
}

export function buildHudMilitaryTodoSweepCounts(input: {
  marches: MarchSummary[];
  battleReportUnread: number;
  marchSubmitState: MarchSubmitState;
  marchFormValidation: MarchFormValidationResult;
  troopReserve: MarchFormTroopReserveLineResult | null;
}): HudMilitaryTodoSweepCounts {
  return {
    intelInProgress: countIntelInProgressMarches(input.marches),
    battleReportUnread: Math.max(0, input.battleReportUnread),
    marchSubmittable: resolveHudMarchSubmittableCount(
      input.marchSubmitState,
      input.marchFormValidation,
      input.troopReserve,
    ),
  };
}

export function hudMilitaryTodoSweepSegments(
  counts: HudMilitaryTodoSweepCounts,
): HudMilitaryTodoSweepSegment[] {
  const segments: HudMilitaryTodoSweepSegment[] = [];
  for (const facet of ["intel", "reports", "march"] as const) {
    const n = facetCount(counts, facet);
    const label = facetLabel(facet, n);
    if (label) segments.push({ facet, label });
  }
  return segments;
}

/** 军情/战报/出征分段合并为单行「 · 」分隔文案（无军事待办则 null）。 */
export function formatHudMilitaryTodoSweepLine(counts: HudMilitaryTodoSweepCounts): string | null {
  const segments = hudMilitaryTodoSweepSegments(counts);
  if (!segments.length) return null;
  return segments.map((s) => s.label).join(" · ");
}

/** 点击军事待办分段或角标时解析应打开的底栏军情/战报/军事面板（无待办则 null）。 */
export function resolveToolbarPanelFromHudMilitaryTodo(
  facet: HudMilitaryTodoSweepFacet,
  counts: HudMilitaryTodoSweepCounts,
): ToolbarPanelFromHudMilitaryTodo | null {
  return facetCount(counts, facet) > 0 ? panelFromFacet(facet) : null;
}

function panelFromFacet(facet: HudMilitaryTodoSweepFacet): ToolbarPanelFromHudMilitaryTodo {
  switch (facet) {
    case "intel":
      return "marches";
    case "reports":
      return "reports";
    case "march":
      return "military";
    default:
      return "military";
  }
}

export function toolbarPanelActionFromHudMilitaryTodo(
  panel: ToolbarPanelFromHudMilitaryTodo,
): string {
  switch (panel) {
    case "marches":
      return "toggle-marches";
    case "reports":
      return "toggle-reports";
    case "military":
      return "toggle-military";
    default:
      return "toggle-military";
  }
}

export function hudMilitaryTodoFacetForToolbarAction(
  action: string,
  counts: HudMilitaryTodoSweepCounts,
): HudMilitaryTodoSweepFacet | null {
  switch (action) {
    case "toggle-marches":
      return counts.intelInProgress > 0 ? "intel" : null;
    case "toggle-reports":
      return counts.battleReportUnread > 0 ? "reports" : null;
    case "toggle-military":
      return counts.marchSubmittable > 0 ? "march" : null;
    default:
      return null;
  }
}

export function scheduleHudMilitaryTodoPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(HUD_MILITARY_TODO_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(HUD_MILITARY_TODO_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(HUD_MILITARY_TODO_PULSE_CLASS);
  }, HUD_MILITARY_TODO_PULSE_MS);
}
