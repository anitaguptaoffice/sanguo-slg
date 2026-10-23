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

export function syncHeroListRefreshButton(panel: ParentNode | null | undefined, busy: boolean): void {
  const btn = panel?.querySelector<HTMLButtonElement>('[data-action="refresh-heroes"]');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = busy ? HERO_REFRESH_BUTTON_INFLIGHT_LABEL : HERO_REFRESH_BUTTON_DEFAULT_LABEL;
}

export function scrollHeroListRowIntoView(panel: ParentNode | null | undefined, heroId: number): boolean {
  if (!panel || heroId <= 0) return false;
  const row = panel.querySelector<HTMLElement>(`li[data-hero-id="${heroId}"]`);
  if (!row || typeof row.scrollIntoView !== "function") return false;
  row.scrollIntoView({ block: "nearest" });
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
