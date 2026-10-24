import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";

/** HUD 顶栏：邮件/日常/队列/社交四面板 tab 深链合并扫读（CLIENT-202；与 CLIENT-193 sweep 同源邮件/日常文案）。 */
export const HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE = "hud-center-panel-deeplink-line";
export const HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR = "data-hud-center-panel-facet";

export const CENTER_PANEL_TAB_PULSE_CLASS = "center-panel-tab-pulse";
export const CENTER_PANEL_TAB_PULSE_MS = 1500;

export type HudCenterPanelDeepLinkFacet = "mail" | "daily" | "queue" | "social";

export type CenterPanelTabFromHudTodo = HudCenterPanelDeepLinkFacet;

export type HudCenterPanelDeepLinkCounts = {
  mailClaimable: number;
  dailyClaimable: number;
  queueBuilding: number;
  chatUnread: number;
};

export const HUD_CENTER_PANEL_TAB_PRIORITY: HudCenterPanelDeepLinkFacet[] = [
  "daily",
  "mail",
  "queue",
  "social",
];

export type HudCenterPanelDeepLinkSegment = {
  facet: HudCenterPanelDeepLinkFacet;
  label: string;
};

function facetCount(counts: HudCenterPanelDeepLinkCounts, facet: HudCenterPanelDeepLinkFacet): number {
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

function facetLabel(facet: HudCenterPanelDeepLinkFacet, count: number): string | null {
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

/** 可点击分段：邮件/日常与 `formatHudTodoSweepLine` 文案一致，队列/社交追加余量。 */
export function hudCenterPanelDeepLinkSegments(
  counts: HudCenterPanelDeepLinkCounts,
): HudCenterPanelDeepLinkSegment[] {
  const segments: HudCenterPanelDeepLinkSegment[] = [];
  for (const facet of ["mail", "daily", "queue", "social"] as const) {
    const n = facetCount(counts, facet);
    const label = facetLabel(facet, n);
    if (label) segments.push({ facet, label });
  }
  return segments;
}

export function formatHudCenterPanelDeepLinkLine(counts: HudCenterPanelDeepLinkCounts): string | null {
  const sweep = formatHudTodoSweepLine({
    mailClaimable: counts.mailClaimable,
    dailyClaimable: counts.dailyClaimable,
  });
  const segments = hudCenterPanelDeepLinkSegments(counts);
  if (!segments.length) return null;
  const mailDaily = sweep ?? "";
  const rest = segments
    .filter((s) => s.facet === "queue" || s.facet === "social")
    .map((s) => s.label);
  const parts = [mailDaily, ...rest].filter((p) => p.length > 0);
  return parts.join(" · ");
}

/** 点击分段或默认优先级时解析应打开的中心面板 tab（无待办则 null）。 */
export function resolveCenterPanelTabFromHudTodo(
  facet: HudCenterPanelDeepLinkFacet,
  counts: HudCenterPanelDeepLinkCounts,
): CenterPanelTabFromHudTodo | null {
  return facetCount(counts, facet) > 0 ? facet : null;
}

export function pickDefaultCenterPanelTabFromHudTodo(
  counts: HudCenterPanelDeepLinkCounts,
): CenterPanelTabFromHudTodo | null {
  for (const facet of HUD_CENTER_PANEL_TAB_PRIORITY) {
    const tab = resolveCenterPanelTabFromHudTodo(facet, counts);
    if (tab) return tab;
  }
  return null;
}

export function centerPanelTabToolbarAction(tab: CenterPanelTabFromHudTodo): string {
  switch (tab) {
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

export function scheduleCenterPanelTabPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(CENTER_PANEL_TAB_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(CENTER_PANEL_TAB_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(CENTER_PANEL_TAB_PULSE_CLASS);
  }, CENTER_PANEL_TAB_PULSE_MS);
}
