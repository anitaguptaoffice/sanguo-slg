import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeeperHint,
  formatHeroPanelStateResidualDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeeperSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-295：将领 panelState loading/empty/error 只读巩固再加深一层行（CLIENT-279 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-sweep";

export function formatHeroPanelGatewayRetryDeepestHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deeper = formatHeroPanelGatewayRetryDeeperHint(ctx);
  if (!deeper) return null;
  return `${deeper} · CLIENT-279 不退化`;
}

export function formatHeroPanelStateResidualDeepestSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deeper = formatHeroPanelStateResidualDeeperSweepLine(kind, ctx);
  if (!deeper) return null;
  const gatewayDeepest = formatHeroPanelGatewayRetryDeepestHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepest
        ? `panelState巩固再加深一层 · ${deeper} · ${gatewayDeepest}`
        : `panelState巩固再加深一层 · ${deeper}`;
    case "empty":
      return `panelState巩固再加深一层 · ${deeper}`;
    case "error": {
      const hint =
        gatewayDeepest ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-279 不退化";
      return `panelState巩固再加深一层 · ${deeper} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`)?.remove();
  const line = formatHeroPanelStateResidualDeepestSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deeperEl = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE}"]`);
  if (deeperEl?.nextSibling) {
    host.insertBefore(p, deeperEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestSweep(chrome.parentElement, kind, ctx);
}
