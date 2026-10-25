import type { BagStack } from "@/net/bagState";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualDeeperSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE,
} from "@/net/heroDetailConsumableStackResidualDeeperSweep";
import {
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** CLIENT-294：详情养成堆叠残余 **巩固再加深一层** 扫读行 DOM class（CLIENT-278 再加深扫读 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deepest-sweep";

/** CLIENT-294：巩固再加深一层扫读 2.5s 动画环（叠在静态更深扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deepest-sweep-ring";

/** CLIENT-294：再加深一层扫读环时长（CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_MS = 2500;

export type HeroDetailConsumableStackResidualDeepestSweep = {
  text: string;
  bagDeepLinkHint: string;
  hasDeficit: boolean;
};

function formatBagDeepLinkReadonlyHint(heroId: number, bag: BagStack[]): string {
  const pick = pickHeroDetailBagDeepLink(heroId, bag);
  if (!pick.ok) {
    return `背包深链 · ${pick.errorMessage}`;
  }
  return `背包深链 · #${pick.itemCfgId} · 只读扫读2.5s`;
}

/**
 * 详情养成区堆叠 + 背包深链 hint 只读 **巩固再加深一层** 扫读文案（CLIENT-294；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeepestSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeepestSweep | null {
  if (!detail?.hero_id) return null;
  const deeperSweep = formatHeroDetailConsumableStackResidualDeeperSweep(detail, bag);
  if (!deeperSweep) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠巩固再加深一层 · ${deeperSweep.text.replace(/^堆叠巩固再加深 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: deeperSweep.hasDeficit };
}

let deepestSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成巩固再加深一层扫读行根节点附加 sweep class 2.5s（与 CLIENT-278 再加深扫读行并存）。 */
export function applyHeroDetailConsumableStackResidualDeepestSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS);
  void el.offsetWidth;
  el.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS);
  if (deepestSweepTimer != null) {
    windowObj.clearTimeout(deepestSweepTimer);
  }
  deepestSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS);
    deepestSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-278 再加深扫读行之后挂载巩固再加深一层扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeepestSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeepestSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute("data-role", HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_ROLE);
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeepestSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeepestSweepLine(detailRoot, detail, bag);
  }
  applyHeroDetailConsumableStackResidualDeepestSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeepestSweepTimersForTests(): void {
  if (deepestSweepTimer != null) {
    clearTimeout(deepestSweepTimer);
    deepestSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
