/** CLIENT-296：手动刷新后钉选行 2.5s 更深环（与 CLIENT-248/264/280 环 **并存**）。 */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS = "rank-pin-keep-residual-deepest-ring";
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_MS = 2500;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualDeepestRing(
  rankPanelRoot: ParentNode | null | undefined,
): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(`${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS}`)
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-deepest-ring` 2.5s（不摘除 CLIENT-248/264/280 环）。 */
export function highlightRankPinKeepResidualDeepestRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  if (pinKeepDeepestRingTimer != null) {
    windowObj.clearTimeout(pinKeepDeepestRingTimer);
    pinKeepDeepestRingTimer = null;
  }
  row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS);
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS);
  void row.offsetWidth;
  pinKeepDeepestRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS);
    pinKeepDeepestRingTimer = null;
  }, durationMs);
  return true;
}
