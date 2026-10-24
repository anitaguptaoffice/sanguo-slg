import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";

/** HUD 待办区：邮件/日常/队列/社交合并单行扫读（CLIENT-216；邮件/日常文案与 CLIENT-193/202 同源）。 */
export const HUD_TODO_MERGED_SWEEP_LINE_ROLE = "hud-todo-merged-sweep-line";
export const HUD_TODO_MERGED_SWEEP_FACET_ATTR = "data-hud-todo-merged-facet";

export const TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS = "toolbar-panel-deep-link-pulse";
export const TOOLBAR_PANEL_DEEP_LINK_PULSE_MS = 1500;

export type HudTodoMergedSweepFacet = "mail" | "daily" | "queue" | "social";

export type ToolbarPanelFromHudTodo = HudTodoMergedSweepFacet;

export type HudTodoMergedSweepCounts = {
  mailClaimable: number;
  dailyClaimable: number;
  queueBuilding: number;
  chatUnread: number;
};

export type HudTodoMergedSweepSegment = {
  facet: HudTodoMergedSweepFacet;
  label: string;
};

function facetCount(counts: HudTodoMergedSweepCounts, facet: HudTodoMergedSweepFacet): number {
  switch (facet) {
    case "mail":
      return Math.max(0, counts.mailClaimable);
    case "daily":
      return Math.max(0, counts.dailyClaimable);
    case "queue":
      return Math.max(0, counts.queueBuilding);
    case "social":
      return Math.max(0, counts.chatUnread);
    default:
      return 0;
  }
}

function facetLabel(facet: HudTodoMergedSweepFacet, count: number): string | null {
  if (count <= 0) return null;
  switch (facet) {
    case "mail":
      return `邮件附件 ${count}`;
    case "daily":
      return `日常可领 ${count}`;
    case "queue":
      return `建造中 ${count}`;
    case "social":
      return `聊天未读 ${count}`;
    default:
      return null;
  }
}

export function hudTodoMergedSweepSegments(
  counts: HudTodoMergedSweepCounts,
): HudTodoMergedSweepSegment[] {
  const segments: HudTodoMergedSweepSegment[] = [];
  for (const facet of ["mail", "daily", "queue", "social"] as const) {
    const n = facetCount(counts, facet);
    const label = facetLabel(facet, n);
    if (label) segments.push({ facet, label });
  }
  return segments;
}

/** 邮件/日常/队列/社交合并为单行「 · 」分隔文案（无待办则 null）。 */
export function formatHudTodoMergedSweepLine(counts: HudTodoMergedSweepCounts): string | null {
  const sweep = formatHudTodoSweepLine({
    mailClaimable: counts.mailClaimable,
    dailyClaimable: counts.dailyClaimable,
  });
  const segments = hudTodoMergedSweepSegments(counts);
  if (!segments.length) return null;
  const mailDaily = sweep ?? "";
  const rest = segments
    .filter((s) => s.facet === "queue" || s.facet === "social")
    .map((s) => s.label);
  const parts = [mailDaily, ...rest].filter((p) => p.length > 0);
  return parts.join(" · ");
}

/** 点击合并行分段或角标深链时解析应打开的底栏四面板（无待办则 null）。 */
export function resolveToolbarPanelFromHudTodo(
  facet: HudTodoMergedSweepFacet,
  counts: HudTodoMergedSweepCounts,
): ToolbarPanelFromHudTodo | null {
  return facetCount(counts, facet) > 0 ? facet : null;
}

export function toolbarPanelActionFromHudTodo(panel: ToolbarPanelFromHudTodo): string {
  switch (panel) {
    case "mail":
      return "toggle-mail";
    case "daily":
      return "toggle-daily";
    case "queue":
      return "toggle-queue";
    case "social":
      return "toggle-chat";
    default:
      return "toggle-mail";
  }
}

export function scheduleToolbarPanelDeepLinkPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS);
  }, TOOLBAR_PANEL_DEEP_LINK_PULSE_MS);
}
