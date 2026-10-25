import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint,
  formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeepestSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-375：将领 panelState loading/empty/error 只读巩固再加深五层行（CLIENT-375 deepest-deepest-deepest-deepest **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deepest-deeper-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-deepest-deepest-deeper-sweep";

export function formatHeroPanelGatewayRetryDeepestDeepestDeepestDeeperHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeepestDeepest = formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint(ctx);
  if (!deepestDeepestDeepestDeepest) return null;
  return `${deepestDeepestDeepestDeepest} · CLIENT-375 不退化`;
}

export function formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeepestDeepest = formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine(
    kind,
    ctx,
  );
  if (!deepestDeepestDeepestDeepest) return null;
  const gatewayDeepestDeepestDeepestDeeper = formatHeroPanelGatewayRetryDeepestDeepestDeepestDeeperHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepestDeepestDeepestDeeper
        ? `panelState巩固再加深五层 · ${deepestDeepestDeepestDeepest} · ${gatewayDeepestDeepestDeepestDeeper}`
        : `panelState巩固再加深五层 · ${deepestDeepestDeepestDeepest}`;
    case "empty":
      return `panelState巩固再加深五层 · ${deepestDeepestDeepestDeepest}`;
    case "error": {
      const hint =
        gatewayDeepestDeepestDeepestDeeper ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-375 不退化";
      return `panelState巩固再加深五层 · ${deepestDeepestDeepestDeepest} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host
    .querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`)
    ?.remove();
  const line = formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepestDeepestDeepestDeepestEl = host.querySelector(
    `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
  );
  if (deepestDeepestDeepestDeepestEl?.nextSibling) {
    host.insertBefore(p, deepestDeepestDeepestDeepestEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(chrome.parentElement, kind, ctx);
}
