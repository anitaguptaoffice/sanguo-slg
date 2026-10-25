/** CLIENT-360 / CLIENT-376（wave:58 轮转回主城栈巩固）：手动刷新后钉选行 3s 更深环（与 CLIENT-248/264/280/296/312/328/344 环 **并存**）。 */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "rank-pin-keep-residual-deepest-deepest-deepest-deeper-ring";
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 3000;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepDeepestDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualDeepestDeepestDeepestDeeperRing(
  rankPanelRoot: ParentNode | null | undefined,
): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(
      `${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS}`,
    )
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-deepest-deepest-deepest-deeper-ring` 3s（不摘除 CLIENT-248/264/280/296/312/328/344 环）。 */
export function highlightRankPinKeepResidualDeepestDeepestDeepestDeeperRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  if (pinKeepDeepestDeepestDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(pinKeepDeepestDeepestDeepestDeeperRingTimer);
    pinKeepDeepestDeepestDeepestDeeperRingTimer = null;
  }
  row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  void row.offsetWidth;
  pinKeepDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
    pinKeepDeepestDeepestDeepestDeeperRingTimer = null;
  }, durationMs);
  return true;
}
