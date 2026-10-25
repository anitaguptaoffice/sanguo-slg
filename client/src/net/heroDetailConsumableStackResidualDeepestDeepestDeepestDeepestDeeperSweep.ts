import type { BagStack } from "@/net/bagState";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep";
import {
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** CLIENT-374：详情养成堆叠残余 **wave:58 巩固再加深五层** 扫读行 DOM class（CLIENT-358 再加深五层扫读 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-deeper-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-deeper-sweep";

/** CLIENT-374：wave:58 巩固再加深五层扫读 3s 动画环（叠在 CLIENT-358 再加深五层扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-deeper-sweep-ring";

/** CLIENT-374：wave:58 再加深五层扫读环时长（CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS = 3000;

export type HeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep = {
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
 * 详情养成区堆叠 + 背包深链 hint 只读 **wave:58 巩固再加深五层** 扫读文案（CLIENT-374；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep | null {
  if (!detail?.hero_id) return null;
  const deepestDeepestDeepestDeeperSweep =
    formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(detail, bag);
  if (!deepestDeepestDeepestDeeperSweep) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠巩固再加深五层 · ${deepestDeepestDeepestDeeperSweep.text.replace(/^堆叠巩固再加深五层 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: deepestDeepestDeepestDeeperSweep.hasDeficit };
}

let deepestDeepestDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成 wave:58 巩固再加深五层扫读行根节点附加 sweep class 3s（与 CLIENT-358 再加深五层扫读行并存）。 */
export function applyHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(
    HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  );
  void el.offsetWidth;
  el.classList.add(
    HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  );
  if (deepestDeepestDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(deepestDeepestDeepestDeepestDeeperSweepTimer);
  }
  deepestDeepestDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_RING_CLASS,
    );
    deepestDeepestDeepestDeepestDeeperSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-358 再加深五层扫读行之后挂载 wave:58 巩固再加深五层扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute(
    "data-role",
    HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
  );
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweepLine(
      detailRoot,
      detail,
      bag,
    );
  }
  applyHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweepTimersForTests(): void {
  if (deepestDeepestDeepestDeepestDeeperSweepTimer != null) {
    clearTimeout(deepestDeepestDeepestDeepestDeeperSweepTimer);
    deepestDeepestDeepestDeepestDeeperSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
