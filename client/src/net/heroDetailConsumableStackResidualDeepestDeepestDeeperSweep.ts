import type { BagStack } from "@/net/bagState";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualDeepestDeeperSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroDetailConsumableStackResidualDeepestDeeperSweep";
import {
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** CLIENT-326：详情养成堆叠残余 **巩固再加深三层** 扫读行 DOM class（CLIENT-310 再加深二层扫读 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep";

/** CLIENT-326：巩固再加深三层扫读 3s 动画环（叠在静态再加深二层扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep-ring";

/** CLIENT-326：再加深三层扫读环时长（CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_MS = 3000;

export type HeroDetailConsumableStackResidualDeepestDeepestDeeperSweep = {
  text: string;
  bagDeepLinkHint: string;
  hasDeficit: boolean;
};

function formatBagDeepLinkReadonlyHint(heroId: number, bag: BagStack[]): string {
  const pick = pickHeroDetailBagDeepLink(heroId, bag);
  if (!pick.ok) {
    return `背包深链 · ${pick.errorMessage}`;
  }
  return `背包深链 · #${pick.itemCfgId} · 只读扫读3s`;
}

/**
 * 详情养成区堆叠 + 背包深链 hint 只读 **巩固再加深三层** 扫读文案（CLIENT-326；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeepestDeepestDeeperSweep | null {
  if (!detail?.hero_id) return null;
  const deepestDeeperSweep = formatHeroDetailConsumableStackResidualDeepestDeeperSweep(detail, bag);
  if (!deepestDeeperSweep) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠巩固再加深三层 · ${deepestDeeperSweep.text.replace(/^堆叠巩固再加深二层 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: deepestDeeperSweep.hasDeficit };
}

let deepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成巩固再加深三层扫读行根节点附加 sweep class 3s（与 CLIENT-310 再加深二层扫读行并存）。 */
export function applyHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  void el.offsetWidth;
  el.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (deepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(deepestDeepestDeeperSweepTimer);
  }
  deepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
    deepestDeepestDeeperSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-310 再加深二层扫读行之后挂载巩固再加深三层扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeepestDeepestDeeperSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute("data-role", HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeepestDeepestDeeperSweepLine(detailRoot, detail, bag);
  }
  applyHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeepestDeepestDeeperSweepTimersForTests(): void {
  if (deepestDeepestDeeperSweepTimer != null) {
    clearTimeout(deepestDeepestDeeperSweepTimer);
    deepestDeepestDeeperSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
