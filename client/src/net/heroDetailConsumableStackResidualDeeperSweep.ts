import type { BagStack } from "@/net/bagState";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";
import {
  formatHeroDetailConsumableStackResidualDeepSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE,
} from "@/net/heroDetailConsumableStackResidualDeepSweep";
import {
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS,
} from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

/** CLIENT-278：详情养成堆叠残余 **巩固再加深** 扫读行 DOM class（CLIENT-262 深扫读 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deeper-sweep";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE =
  "hero-detail-consumable-stack-residual-deeper-sweep";

/** CLIENT-278：巩固再加深扫读 2.5s 动画环（叠在静态更深扫读行上）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_RING_CLASS =
  "hero-detail-consumable-stack-residual-deeper-sweep-ring";

/** CLIENT-278：更深扫读环时长（CLIENT-230 hero 壳 panelState 扫读并存）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_MS = 2500;

export type HeroDetailConsumableStackResidualDeeperSweep = {
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
 * 详情养成区堆叠 + 背包深链 hint 只读 **巩固再加深** 扫读文案（CLIENT-278；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualDeeperSweep(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualDeeperSweep | null {
  if (!detail?.hero_id) return null;
  const deepSweep = formatHeroDetailConsumableStackResidualDeepSweep(detail, bag);
  if (!deepSweep) return null;
  const bagDeepLinkHint = formatBagDeepLinkReadonlyHint(detail.hero_id, bag);
  const text = `堆叠巩固再加深 · ${deepSweep.text.replace(/^堆叠深扫读 · /, "")} · ${bagDeepLinkHint}`;
  return { text, bagDeepLinkHint, hasDeficit: deepSweep.hasDeficit };
}

let deeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 详情养成巩固再加深扫读行根节点附加 sweep class 2.5s（与 CLIENT-262 深扫读行并存）。 */
export function applyHeroDetailConsumableStackResidualDeeperSweep(
  el: HTMLElement | null | undefined,
  durationMs: number = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  if (!el) return;
  el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_RING_CLASS);
  void el.offsetWidth;
  el.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_RING_CLASS);
  if (deeperSweepTimer != null) {
    windowObj.clearTimeout(deeperSweepTimer);
  }
  deeperSweepTimer = windowObj.setTimeout(() => {
    el.classList.remove(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_RING_CLASS);
    deeperSweepTimer = null;
  }, durationMs);
}

/** 在 CLIENT-262 深扫读行之后挂载巩固再加深扫读行（纯 DOM；供 HeroMailPanels 调用）。 */
export function mountHeroDetailConsumableStackResidualDeeperSweepLine(
  detailRoot: ParentNode | null | undefined,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HTMLElement | null {
  if (!detailRoot) return null;
  const roleSel = `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE}"]`;
  detailRoot.querySelector(roleSel)?.remove();
  const sweep = formatHeroDetailConsumableStackResidualDeeperSweep(detail, bag);
  if (!sweep) return null;
  const p = document.createElement("p");
  p.className = HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS;
  if (sweep.hasDeficit) {
    p.classList.add(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS);
  }
  p.setAttribute("data-role", HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-label", sweep.bagDeepLinkHint);
  p.textContent = sweep.text;
  const anchor = detailRoot.querySelector(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_ROLE}"]`,
  );
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(p, anchor.nextSibling);
  } else {
    detailRoot.appendChild(p);
  }
  return p;
}

export function scheduleHeroDetailConsumableStackResidualDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  detail?: HeroDetail | null,
  bag: BagStack[] = [],
): void {
  if (!detailRoot) return;
  let line = detailRoot.querySelector<HTMLElement>(
    `[data-role="${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_ROLE}"]`,
  );
  if (!line && detail) {
    line = mountHeroDetailConsumableStackResidualDeeperSweepLine(detailRoot, detail, bag);
  }
  applyHeroDetailConsumableStackResidualDeeperSweep(line);
}

/** @internal vitest */
export function resetHeroDetailConsumableStackResidualDeeperSweepTimersForTests(): void {
  if (deeperSweepTimer != null) {
    clearTimeout(deeperSweepTimer);
    deeperSweepTimer = null;
  }
}

export { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS };
