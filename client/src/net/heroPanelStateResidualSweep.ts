import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  heroListFilterLabel,
  heroListSortLabel,
  type HeroListFilter,
  type HeroListSort,
} from "@/net/heroListFilter";

/** CLIENT-247：将领列表/详情 panelState 骨架下只读残余扫读行（CLIENT-129 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS = "hero-panel-state-residual-sweep";
export const HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE = "hero-panel-state-residual-sweep";

export type HeroPanelStateResidualContext = {
  filter: HeroListFilter;
  sort: HeroListSort;
  /** 列表首屏 gateway error 文案已展示时附加重试扫读（**CLIENT-067** 表单错误不退化）。 */
  listGatewayError?: string | null;
  /** 列表 error 行内 `panel-gateway-retry` 已挂载。 */
  hasGatewayRetry?: boolean;
};

export function formatHeroPanelStateResidualSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const chipHint = `${heroListFilterLabel(ctx.filter)} · ${heroListSortLabel(ctx.sort)}`;
  switch (kind) {
    case "loading":
      return `列表拉取中（筛选记忆 ${chipHint}）`;
    case "empty":
      return `当前筛选 ${chipHint}`;
    case "error": {
      const parts = [`筛选 ${chipHint}`];
      if (ctx.listGatewayError?.trim()) {
        parts.push("可点上方「刷新列表」重试");
      }
      if (ctx.hasGatewayRetry) {
        parts.push("或点行内「重试」");
      }
      return parts.join(" · ");
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE}"]`)?.remove();
  const line = formatHeroPanelStateResidualSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  host.appendChild(p);
}

export function skimHeroDetailPanelStateResidualSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualSweep(chrome.parentElement, kind, ctx);
}
