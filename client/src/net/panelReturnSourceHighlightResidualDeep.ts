import {
  highlightPanelReturnSourceCategoryResidual,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
} from "@/net/panelReturnSourceHighlightResidual";
import { highlightPanelReturnSourceCategoryResidualDeeper } from "@/net/panelReturnSourceHighlightResidualDeeper";
import { highlightPanelReturnSourceCategoryResidualDeepest } from "@/net/panelReturnSourceHighlightResidualDeepest";
import { highlightPanelReturnSourceCategoryResidualDeepestDeeper } from "@/net/panelReturnSourceHighlightResidualDeepestDeeper";
import { highlightPanelReturnSourceCategoryResidualDeepestDeepestDeeper } from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeeper";
import { highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepest } from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeepest";
import { highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeeper } from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeepestDeeper";

/** CLIENT-272：自排行/军情返回时分类 tab/chip **加深** 高亮（2.5s；CLIENT-256 2s **并存**）。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS =
  "panel-return-source-highlight-residual-deep";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS = 2500;

let returnSourceHighlightDeepTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeep(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(`.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS}`)
    .forEach((el) => el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS));
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deep` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeep(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeep(panelRoot);
  if (returnSourceHighlightDeepTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepTimer);
    returnSourceHighlightDeepTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS);
  returnSourceHighlightDeepTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS);
    returnSourceHighlightDeepTimer = null;
  }, durationMs);
  return true;
}

/** CLIENT-256 残余高亮 + CLIENT-272 加深 + CLIENT-288 再深 + CLIENT-304 巩固再加深一层 + CLIENT-320 巩固再加深二层 + CLIENT-336 巩固再加深三层 + CLIENT-352 巩固再加深四层 + CLIENT-368 巩固再加深五层（CLIENT-211 行返回不退化）。 */
export function pulsePanelReturnSourceCategoryResidualHighlights(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const highlighted = highlightPanelReturnSourceCategoryResidual(
    tab,
    panelRoot,
    windowObj,
    PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
  );
  highlightPanelReturnSourceCategoryResidualDeep(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeeper(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeepest(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeepestDeeper(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeepestDeepestDeeper(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepest(tab, panelRoot, windowObj);
  highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeeper(tab, panelRoot, windowObj);
  return highlighted;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepTimersForTests(): void {
  if (returnSourceHighlightDeepTimer != null) {
    clearTimeout(returnSourceHighlightDeepTimer);
    returnSourceHighlightDeepTimer = null;
  }
}
