import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepestDeepestDeepestHint,
  formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-375：将领 panelState loading/empty/error 只读 wave:58 巩固再加深五层行（CLIENT-343 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deepest-deepest-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-deepest-deepest-deepest-sweep";

export function formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeepest = formatHeroPanelGatewayRetryDeepestDeepestDeepestHint(ctx);
  if (!deepestDeepestDeepest) return null;
  return `${deepestDeepestDeepest} · CLIENT-343 不退化`;
}

export function formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeepest = formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine(kind, ctx);
  if (!deepestDeepestDeepest) return null;
  const gatewayDeepestDeepestDeepestDeepest = formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepestDeepestDeepestDeepest
        ? `panelState巩固再加深五层 · ${deepestDeepestDeepest} · ${gatewayDeepestDeepestDeepestDeepest}`
        : `panelState巩固再加深五层 · ${deepestDeepestDeepest}`;
    case "empty":
      return `panelState巩固再加深五层 · ${deepestDeepestDeepest}`;
    case "error": {
      const hint =
        gatewayDeepestDeepestDeepestDeepest ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-343 不退化";
      return `panelState巩固再加深五层 · ${deepestDeepestDeepest} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host
    .querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`)
    ?.remove();
  const line = formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepestDeepestDeepestEl = host.querySelector(
    `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
  );
  if (deepestDeepestDeepestEl?.nextSibling) {
    host.insertBefore(p, deepestDeepestDeepestEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeepestSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(chrome.parentElement, kind, ctx);
}
