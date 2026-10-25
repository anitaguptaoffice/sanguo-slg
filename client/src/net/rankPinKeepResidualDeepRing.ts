import { highlightRankPinKeepResidualDeeperRing } from "@/net/rankPinKeepResidualDeeperRing";
import { highlightRankPinKeepResidualDeepestRing } from "@/net/rankPinKeepResidualDeepestRing";
import { highlightRankPinKeepResidualDeepestDeeperRing } from "@/net/rankPinKeepResidualDeepestDeeperRing";
import { highlightRankPinKeepResidualDeepestDeepestDeeperRing } from "@/net/rankPinKeepResidualDeepestDeepestDeeperRing";
import { highlightRankPinKeepResidualDeepestDeepestDeepestRing } from "@/net/rankPinKeepResidualDeepestDeepestDeepestRing";
import { RANK_PIN_KEEP_RESIDUAL_RING_MS } from "@/net/rankPinKeepResidualRing";

/** CLIENT-264：手动刷新后钉选行 2s 深环（与 CLIENT-248 `rank-pin-keep-residual-ring` 并存）。 */
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS = "rank-pin-keep-residual-deep-ring";
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_MS = 2000;

const PIN_ROW_SELECTOR = ".rank-table tr.rank-pin-row";

let pinKeepDeepRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRankPinKeepResidualDeepRing(
  rankPanelRoot: ParentNode | null | undefined,
): void {
  if (!rankPanelRoot) return;
  rankPanelRoot
    .querySelectorAll<HTMLElement>(`${PIN_ROW_SELECTOR}.${RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS}`)
    .forEach((row) => row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS));
}

/** 钉选行附加 `rank-pin-keep-residual-deep-ring` 2s（不摘除 CLIENT-248 残余环）。 */
export function highlightRankPinKeepResidualDeepRing(
  rankPanelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = RANK_PIN_KEEP_RESIDUAL_DEEP_RING_MS,
): boolean {
  const row = rankPanelRoot?.querySelector<HTMLElement>(PIN_ROW_SELECTOR);
  if (!row) return false;
  if (pinKeepDeepRingTimer != null) {
    windowObj.clearTimeout(pinKeepDeepRingTimer);
    pinKeepDeepRingTimer = null;
  }
  row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS);
  row.classList.add(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS);
  void row.offsetWidth;
  pinKeepDeepRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS);
    pinKeepDeepRingTimer = null;
  }, durationMs);
  return true;
}

/** 手动刷新成功：CLIENT-248 1.5s 环 + CLIENT-264 2s 深环 + CLIENT-280 2.5s 更深环 + CLIENT-296 2.5s 最深环 + CLIENT-312 3s 更深二层环 + CLIENT-328 3s 更深三层环 + CLIENT-344 3s 更深四层环。 */
export function pulseRankPinKeepResidualRingsAfterManualRefresh(
  rankPanelRoot: ParentNode | null | undefined,
  highlightResidualRing: (
    root: ParentNode | null | undefined,
    windowObj?: Pick<Window, "setTimeout" | "clearTimeout">,
    durationMs?: number,
  ) => boolean,
): void {
  highlightResidualRing(rankPanelRoot, globalThis.window, RANK_PIN_KEEP_RESIDUAL_RING_MS);
  highlightRankPinKeepResidualDeepRing(rankPanelRoot);
  highlightRankPinKeepResidualDeeperRing(rankPanelRoot);
  highlightRankPinKeepResidualDeepestRing(rankPanelRoot);
  highlightRankPinKeepResidualDeepestDeeperRing(rankPanelRoot);
  highlightRankPinKeepResidualDeepestDeepestDeeperRing(rankPanelRoot);
  highlightRankPinKeepResidualDeepestDeepestDeepestRing(rankPanelRoot);
}
