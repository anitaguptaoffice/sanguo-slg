/** CLIENT-384：自排行/军情返回时分类 tab/chip **巩固再加深五层** 高亮（2.5s；CLIENT-368 **并存**）。窄屏 manifest 导出软依赖 **CLIENT-387**。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS =
  "panel-return-source-highlight-residual-deepest-deepest-deepest-deepest-deeper";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS = 2500;

let returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer: ReturnType<
  typeof setTimeout
> | null = null;

export function clearPanelReturnSourceHighlightResidualDeepestDeepestDeepestDeepestDeeper(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(
      `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(
        PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
      ),
    );
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deepest-deepest-deepest-deepest-deeper` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeepestDeeper(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeepestDeepestDeepestDeepestDeeper(panelRoot);
  if (returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer);
    returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer = null;
  }
  tab.classList.remove(
    PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
  );
  void tab.offsetWidth;
  tab.classList.add(
    PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
  );
  returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer = windowObj.setTimeout(() => {
    tab.classList.remove(
      PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
    );
    returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepestDeepestDeepestDeepestDeeperTimersForTests(): void {
  if (returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer != null) {
    clearTimeout(returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer);
    returnSourceHighlightDeepestDeepestDeepestDeepestDeeperTimer = null;
  }
}
