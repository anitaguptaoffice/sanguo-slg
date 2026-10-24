/** 自详情返回将领列表时行扫读脉冲（CLIENT-231；`hero-list-return-v1` 消费后仍靠 CLIENT-151 键记忆筛选）。 */
export const HERO_LIST_RETURN_HIGHLIGHT_CLASS = "hero-list-return-highlight";
export const HERO_ROW_RETURN_HIGHLIGHT_MS = 2000;

let heroRowReturnHighlightTimer: ReturnType<typeof setTimeout> | null = null;

/** 列表行 `hero-list-return-highlight` 扫读脉冲 2s（与 `.selected` 行选中并存）。 */
export function scheduleHeroRowReturnHighlight(
  heroPanel: ParentNode | null | undefined,
  heroId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  if (!heroPanel || heroId <= 0) return false;
  const row = heroPanel.querySelector<HTMLElement>(`li[data-hero-id="${heroId}"]`);
  if (!row) return false;
  row.classList.add(HERO_LIST_RETURN_HIGHLIGHT_CLASS);
  if (heroRowReturnHighlightTimer) windowObj.clearTimeout(heroRowReturnHighlightTimer);
  heroRowReturnHighlightTimer = windowObj.setTimeout(() => {
    row.classList.remove(HERO_LIST_RETURN_HIGHLIGHT_CLASS);
    heroRowReturnHighlightTimer = null;
  }, HERO_ROW_RETURN_HIGHLIGHT_MS);
  return true;
}
