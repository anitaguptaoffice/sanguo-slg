/** CLIENT-344：手动刷新后钉选行 3s 更深环（与 CLIENT-248/264/280/296/312/328 环 **并存**）。 */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "rank-pin-keep-residual-deepest-deepest-deepest-ring";
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS = 3000;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualDeepestDeepestDeepestRing(
  rankPanelRoot: ParentNode | null | undefined,
): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(
      `${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`,
    )
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-deepest-deepest-deepest-ring` 3s（不摘除 CLIENT-248/264/280/296/312/328 环）。 */
export function highlightRankPinKeepResidualDeepestDeepestDeepestRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  if (pinKeepDeepestDeepestDeepestRingTimer != null) {
    windowObj.clearTimeout(pinKeepDeepestDeepestDeepestRingTimer);
    pinKeepDeepestDeepestDeepestRingTimer = null;
  }
  row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  void row.offsetWidth;
  pinKeepDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
    pinKeepDeepestDeepestDeepestRingTimer = null;
  }, durationMs);
  return true;
}
