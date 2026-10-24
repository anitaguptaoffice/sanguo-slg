/** CLIENT-248：手动刷新后钉选行 1.5s 保持高亮环（CLIENT-242/184 密度不退化）。 */
export const RANK_PIN_KEEP_RESIDUAL_RING_CLASS = "rank-pin-keep-residual-ring";
export const RANK_PIN_KEEP_RESIDUAL_RING_MS = 1500;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualRing(rankPanelRoot: ParentNode | null | undefined): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(`${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_RING_CLASS}`)
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-ring` 1.5s（手动刷新成功后调用）。 */
export function highlightRankPinKeepResidualRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  clearRankPinKeepResidualRing(rankPanelRoot);
  if (pinKeepRingTimer != null) {
    windowObj.clearTimeout(pinKeepRingTimer);
    pinKeepRingTimer = null;
  }
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_RING_CLASS);
  void row.offsetWidth;
  pinKeepRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_RING_CLASS);
    pinKeepRingTimer = null;
  }, durationMs);
  return true;
}
