/** CLIENT-336：自排行/军情返回时分类 tab/chip **巩固再加深三层** 高亮（2.5s；CLIENT-320 **并存**）。窄屏 manifest 导出软依赖 **CLIENT-339**。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS =
  "panel-return-source-highlight-residual-deepest-deepest-deeper";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS = 2500;

let returnSourceHighlightDeepestDeepestDeeperTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeepestDeepestDeeper(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(
      `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS),
    );
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deepest-deepest-deeper` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeepestDeepestDeeper(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeepestDeepestDeeper(panelRoot);
  if (returnSourceHighlightDeepestDeepestDeeperTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepestDeepestDeeperTimer);
    returnSourceHighlightDeepestDeepestDeeperTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS);
  returnSourceHighlightDeepestDeepestDeeperTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS);
    returnSourceHighlightDeepestDeepestDeeperTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepestDeepestDeeperTimersForTests(): void {
  if (returnSourceHighlightDeepestDeepestDeeperTimer != null) {
    clearTimeout(returnSourceHighlightDeepestDeepestDeeperTimer);
    returnSourceHighlightDeepestDeepestDeeperTimer = null;
  }
}
