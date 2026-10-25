/** CLIENT-288：自排行/军情返回时分类 tab/chip **巩固再加深** 高亮（2.5s；CLIENT-272 **并存**）。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS =
  "panel-return-source-highlight-residual-deeper";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_MS = 2500;

let returnSourceHighlightDeeperTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeeper(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(`.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS}`)
    .forEach((el) => el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS));
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deeper` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeeper(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeeper(panelRoot);
  if (returnSourceHighlightDeeperTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeeperTimer);
    returnSourceHighlightDeeperTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS);
  returnSourceHighlightDeeperTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS);
    returnSourceHighlightDeeperTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeeperTimersForTests(): void {
  if (returnSourceHighlightDeeperTimer != null) {
    clearTimeout(returnSourceHighlightDeeperTimer);
    returnSourceHighlightDeeperTimer = null;
  }
}
