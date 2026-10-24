import { formatMarchListSecondary, type MarchSummary } from "@/net/militaryFormat";
import { marchRowShouldBeRecent, type MarchHighlightState } from "@/net/marchHighlight";

export const MARCH_QUEUE_BANNER_CLASS = "march-queue-banner";
export const MARCH_QUEUE_BANNER_PULSE_CLASS = "march-queue-banner-pulse";
export const MARCH_QUEUE_BANNER_PULSE_MS = 5000;
export const MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS = "march-queue-banner-mutual-highlight";
export const MARCH_QUEUE_BANNER_ID_PREFIX = "march-queue-banner-";
export const MARCH_ROW_SUBMITTED_STAMP = "已提交";

export const MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION = "march-queue-banner-open-intel";
export const MARCH_INTEL_TO_QUEUE_BANNER_ACTION = "march-intel-to-queue-banner";

export type MarchQueueBannerTarget = {
  march_id: number;
  to_x: number;
  to_y: number;
};

export type MarchQueueJumpIndex = {
  marchId: number;
  bannerDomId: string;
  intelRowSelector: string;
};

export function marchQueueBannerDomId(marchId: number): string {
  return `${MARCH_QUEUE_BANNER_ID_PREFIX}${Math.trunc(marchId)}`;
}

/** 军事面板队列顶栏摘要文案（CLIENT-156）。 */
export function formatMarchQueueBanner(marchId: number, toX: number, toY: number): string {
  const id = Math.trunc(marchId);
  const x = Math.trunc(toX);
  const y = Math.trunc(toY);
  return `最新出征 #${id} → (${x},${y})`;
}

/** 军情行 ↔ 军事摘要条互跳 DOM 索引（单测覆盖）。 */
export function resolveMarchQueueJumpIndex(marchId: number): MarchQueueJumpIndex {
  const id = Math.trunc(marchId);
  return {
    marchId: id,
    bannerDomId: marchQueueBannerDomId(id),
    intelRowSelector: `.march-list li[data-march-id="${id}"]`,
  };
}

export function formatMarchListSecondaryWithSubmitted(
  secondaryLine: string,
  showSubmittedStamp: boolean,
): string {
  if (!showSubmittedStamp) return secondaryLine;
  if (!secondaryLine) return MARCH_ROW_SUBMITTED_STAMP;
  return `${MARCH_ROW_SUBMITTED_STAMP} · ${secondaryLine}`;
}

export function marchIntelRowShowsSubmittedStamp(
  marchId: number | null | undefined,
  highlight: MarchHighlightState | null,
  nowMs: number,
): boolean {
  if (marchId == null) return false;
  return marchRowShouldBeRecent(marchId, highlight, nowMs);
}

export function formatMarchIntelSecondaryLine(
  m: MarchSummary,
  nowMs: number,
  highlight: MarchHighlightState | null,
): string {
  const base = formatMarchListSecondary(m, nowMs);
  const stamp = marchIntelRowShowsSubmittedStamp(m.march_id, highlight, nowMs);
  return formatMarchListSecondaryWithSubmitted(base, stamp);
}

export function scheduleMarchQueueBannerPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(MARCH_QUEUE_BANNER_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(MARCH_QUEUE_BANNER_PULSE_CLASS);
  window.setTimeout(() => el.classList.remove(MARCH_QUEUE_BANNER_PULSE_CLASS), MARCH_QUEUE_BANNER_PULSE_MS);
}

export function syncMarchQueueBanner(
  militaryRoot: ParentNode | null | undefined,
  target: MarchQueueBannerTarget | null | undefined,
  opts?: { pulse?: boolean },
): void {
  const el = militaryRoot?.querySelector<HTMLElement>('[data-role="march-queue-banner"]');
  if (!el) return;
  if (
    target == null ||
    !Number.isFinite(target.march_id) ||
    target.march_id <= 0 ||
    !Number.isFinite(target.to_x) ||
    !Number.isFinite(target.to_y)
  ) {
    el.classList.add("hidden");
    el.removeAttribute("id");
    el.removeAttribute("data-march-id");
    el.textContent = "";
    el.classList.remove(MARCH_QUEUE_BANNER_PULSE_CLASS, MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS);
    return;
  }
  const marchId = Math.trunc(target.march_id);
  const toX = Math.trunc(target.to_x);
  const toY = Math.trunc(target.to_y);
  el.classList.remove("hidden");
  el.classList.add(MARCH_QUEUE_BANNER_CLASS);
  el.id = marchQueueBannerDomId(marchId);
  el.setAttribute("data-march-id", String(marchId));
  el.setAttribute("data-action", MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION);
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.textContent = formatMarchQueueBanner(marchId, toX, toY);
  if (opts?.pulse) scheduleMarchQueueBannerPulse(el);
}

export type MarchQueueJumpSide = "military-banner" | "intel-row";

export function clearMarchQueueMutualHighlights(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>(`.${MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS}`)
    .forEach((node) => node.classList.remove(MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS));
}

export function applyMarchQueueMutualHighlight(
  root: ParentNode,
  jump: MarchQueueJumpIndex,
  side: MarchQueueJumpSide,
): void {
  clearMarchQueueMutualHighlights(root);
  if (side === "military-banner") {
    const banner = root.querySelector<HTMLElement>(`#${CSS.escape(jump.bannerDomId)}`);
    banner?.classList.add(MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS);
    return;
  }
  const row = root.querySelector<HTMLElement>(jump.intelRowSelector);
  row?.classList.add(MARCH_QUEUE_BANNER_MUTUAL_HIGHLIGHT_CLASS);
}

export type OpenMarchPanelAndHighlightHandlers = {
  openMarchIntel: (marchId: number) => void;
  highlightIntelRow: (jump: MarchQueueJumpIndex) => void;
};

/** 军事摘要条点击：打开军情面板并高亮对应行军行（CLIENT-156）。 */
export function openMarchPanelAndHighlight(
  marchId: number,
  handlers: OpenMarchPanelAndHighlightHandlers,
): void {
  const jump = resolveMarchQueueJumpIndex(marchId);
  handlers.openMarchIntel(jump.marchId);
  handlers.highlightIntelRow(jump);
}

export type OpenMilitaryQueueBannerHandlers = {
  openMilitaryPanel: () => void;
  highlightMilitaryBanner: (jump: MarchQueueJumpIndex) => void;
};

/** 军情新出征行 → 军事面板队列顶栏摘要互跳。 */
export function openMilitaryQueueBannerAndHighlight(
  marchId: number,
  handlers: OpenMilitaryQueueBannerHandlers,
): void {
  const jump = resolveMarchQueueJumpIndex(marchId);
  handlers.openMilitaryPanel();
  handlers.highlightMilitaryBanner(jump);
}

export function marchQueueBannerTargetFromMarch(
  march: MarchSummary | null | undefined,
): MarchQueueBannerTarget | null {
  const marchId = march?.march_id;
  const toX = march?.to_x;
  const toY = march?.to_y;
  if (marchId == null || marchId <= 0) return null;
  if (!Number.isFinite(toX) || !Number.isFinite(toY)) return null;
  return { march_id: Math.trunc(marchId), to_x: Math.trunc(toX!), to_y: Math.trunc(toY!) };
}
