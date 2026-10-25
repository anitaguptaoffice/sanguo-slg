import type { BagStack } from "@/net/bagState";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualDeepestDeepestDeepestSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeepestSweep";
import {
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** CLIENT-358：详情养成堆叠残余 **巩固再加深五层** 扫读行 DOM class（CLIENT-342 再加深四层扫读 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deeper-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deeper-sweep";

/** CLIENT-358：巩固再加深五层扫读 3s 动画环（叠在静态再加深四层扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deeper-sweep-ring";

/** CLIENT-358：再加深五层扫读环时长（CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS = 3000;

export type HeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep = {
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
 * 详情养成区堆叠 + 背包深链 hint 只读 **巩固再加深五层** 扫读文案（CLIENT-358；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep | null {
  if (!detail?.hero_id) return null;
  const deepestDeepestDeepestSweep = formatHeroDetailConsumableStackResidualDeepestDeepestDeepestSweep(
    detail,
    bag,
  );
  if (!deepestDeepestDeepestSweep) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠巩固再加深五层 · ${deepestDeepestDeepestSweep.text.replace(/^堆叠巩固再加深四层 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: deepestDeepestDeepestSweep.hasDeficit };
}

let deepestDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成巩固再加深五层扫读行根节点附加 sweep class 3s（与 CLIENT-342 再加深四层扫读行并存）。 */
export function applyHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(
    HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  );
  void el.offsetWidth;
  el.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS);
  if (deepestDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(deepestDeepestDeepestDeeperSweepTimer);
  }
  deepestDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
    );
    deepestDeepestDeepestDeeperSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-342 再加深四层扫读行之后挂载巩固再加深五层扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute("data-role", HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweepLine(detailRoot, detail, bag);
  }
  applyHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweepTimersForTests(): void {
  if (deepestDeepestDeepestDeeperSweepTimer != null) {
    clearTimeout(deepestDeepestDeepestDeeperSweepTimer);
    deepestDeepestDeepestDeeperSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
