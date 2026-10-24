/** CLIENT-280：手动刷新后钉选行 2.5s 更深环（与 CLIENT-248/264 环 **并存**）。 */
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS = "rank-pin-keep-residual-deeper-ring";
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_MS = 2500;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualDeeperRing(
  rankPanelRoot: ParentNode | null | undefined,
): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(`${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS}`)
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-deeper-ring` 2.5s（不摘除 CLIENT-248/264 环）。 */
export function highlightRankPinKeepResidualDeeperRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  if (pinKeepDeeperRingTimer != null) {
    windowObj.clearTimeout(pinKeepDeeperRingTimer);
    pinKeepDeeperRingTimer = null;
  }
  row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS);
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS);
  void row.offsetWidth;
  pinKeepDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS);
    pinKeepDeeperRingTimer = null;
  }, durationMs);
  return true;
}
