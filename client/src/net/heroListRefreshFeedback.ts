import { formatHeroListRefreshedAt } from "@/net/formatHeroListRefreshedAt";
import { ensureHeroListRowAvatarNameInScrollClip } from "@/ui/heroDetailScrollClip";
import { resetContentPanelScroll } from "@/ui/queuePanelScroll";

export const HERO_LIST_INFLIGHT_ATTR = "data-hero-list-inflight";

export const HERO_LIST_REFRESH_PULSE_CLASS = "hero-list-refresh-pulse";
/** 列表刷新成功脉冲时长（≤2s，与日常领奖脉冲并存）。 */
export const HERO_LIST_REFRESH_PULSE_MS = 1200;

export const HERO_REFRESH_BUTTON_DEFAULT_LABEL = "刷新列表";
export const HERO_REFRESH_BUTTON_INFLIGHT_LABEL = "刷新中…";

export function scheduleHeroListRefreshPulse(listEl: HTMLElement | null | undefined): void {
  if (!listEl) return;
  listEl.classList.remove(HERO_LIST_REFRESH_PULSE_CLASS);
  void listEl.offsetWidth;
  listEl.classList.add(HERO_LIST_REFRESH_PULSE_CLASS);
  window.setTimeout(() => listEl.classList.remove(HERO_LIST_REFRESH_PULSE_CLASS), HERO_LIST_REFRESH_PULSE_MS);
}

export function syncHeroListRefreshInflight(panel: ParentNode | null | undefined, busy: boolean): void {
  const root = panel instanceof HTMLElement ? panel : panel?.querySelector<HTMLElement>('[data-center-panel="hero"]');
  if (!root) return;
  if (busy) root.setAttribute(HERO_LIST_INFLIGHT_ATTR, "1");
  else root.removeAttribute(HERO_LIST_INFLIGHT_ATTR);
}

export function syncHeroListRefreshButton(panel: ParentNode | null | undefined, busy: boolean): void {
  const btn = panel?.querySelector<HTMLButtonElement>('[data-action="refresh-heroes"]');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? HERO_REFRESH_BUTTON_INFLIGHT_LABEL : HERO_REFRESH_BUTTON_DEFAULT_LABEL;
  syncHeroListRefreshInflight(panel, busy);
}

export function syncHeroListRefreshedAtDisplay(
  panel: ParentNode | null | undefined,
  atMs: number,
  nowMs = Date.now(),
): void {
  const el = panel?.querySelector<HTMLElement>('[data-role="hero-list-refreshed-at"]');
  if (!el) return;
  const text = formatHeroListRefreshedAt(atMs, nowMs);
  if (text) {
    el.textContent = text;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function scrollHeroListRowIntoView(panel: ParentNode | null | undefined, heroId: number): boolean {
  if (!panel || heroId <= 0) return false;
  const row = panel.querySelector<HTMLElement>(`li[data-hero-id="${heroId}"]`);
  if (!row) return false;
  if (panel instanceof HTMLElement) resetContentPanelScroll(panel);
  const templateCfgId = Number(row.getAttribute("data-template-cfg-id"));
  if (templateCfgId > 0) {
    ensureHeroListRowAvatarNameInScrollClip(panel, templateCfgId);
    return true;
  }
  const scroll = panel.querySelector<HTMLElement>('[data-role="hero-scroll"]');
  if (!(scroll instanceof HTMLElement)) return false;
  const rowTop = row.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  scroll.scrollTop = Math.max(0, rowTop - 48);
  return true;
}

export function setHeroListFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-list-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}
