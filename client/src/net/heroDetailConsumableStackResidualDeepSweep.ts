import type { BagStack } from "@/net/bagState";
import { HERO_GOTO_BAG_CULTIVATION_LABEL } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualLine,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_ROLE,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** DATA-001 养成消耗品子集（与 `heroMailState` 同源，避免循环 import）。 */
const HERO_CULTIVATION_BAG_ITEM_CFG_IDS = [2017] as const;

/** CLIENT-262：详情养成堆叠残余 **深扫读** 行 DOM class（CLIENT-246 主残余行 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deep-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deep-sweep";

/** CLIENT-262：深扫读 2s 动画环（叠在静态深扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deep-sweep-ring";

/** CLIENT-262：深扫读环时长（与 CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_MS = 2000;

export type HeroDetailConsumableStackResidualDeepSweep = {
  text: string;
  bagDeepLinkHint: string;
  hasDeficit: boolean;
};

function formatBagDeepLinkReadonlyHint(heroId: number, bag: BagStack[]): string {
  if (!Number.isFinite(heroId) || heroId <= 0) {
    return "背包深链 · 请先选择将领（hero_id 不能为空）";
  }
  const itemCfgId = HERO_CULTIVATION_BAG_ITEM_CFG_IDS.find(
    (id) => (bag.find((b) => b.item_cfg_id === id)?.quantity ?? 0) > 0,
  );
  if (!itemCfgId) {
    return "背包深链 · 背包暂无养成消耗品（将魂碎晶等）";
  }
  return `背包深链 · ${HERO_GOTO_BAG_CULTIVATION_LABEL} · #${itemCfgId} · 只读扫读2s`;
}

/**
 * 详情养成区堆叠 + 背包深链 hint 只读深扫读文案（CLIENT-262；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeepSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeepSweep | null {
  if (!detail?.hero_id) return null;
  const residual = formatHeroDetailConsumableStackResidualLine(detail, bag);
  if (!residual) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠深扫读 · ${residual.text.replace(/^堆叠残余 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: residual.hasDeficit };
}

let deepSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成深扫读行根节点附加 sweep class 2s（与 CLIENT-246 残余行并存）。 */
export function applyHeroDetailConsumableStackResidualDeepSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS);
  void el.offsetWidth;
  el.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS);
  if (deepSweepTimer != null) {
    windowObj.clearTimeout(deepSweepTimer);
  }
  deepSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS);
    deepSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-246 残余行之后挂载深扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeepSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeepSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute("data-role", HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE);
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeepSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeepSweepLine(detailRoot, detail, bag);
  }
  applyHeroDetailConsumableStackResidualDeepSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeepSweepTimersForTests(): void {
  if (deepSweepTimer != null) {
    clearTimeout(deepSweepTimer);
    deepSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
