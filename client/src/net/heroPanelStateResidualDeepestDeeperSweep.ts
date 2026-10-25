import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepestHint,
  formatHeroPanelStateResidualDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-311：将领 panelState loading/empty/error 只读巩固再加深二层行（CLIENT-295 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deeper-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-deeper-sweep";

export function formatHeroPanelGatewayRetryDeepestDeeperHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepest = formatHeroPanelGatewayRetryDeepestHint(ctx);
  if (!deepest) return null;
  return `${deepest} · CLIENT-295 不退化`;
}

export function formatHeroPanelStateResidualDeepestDeeperSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepest = formatHeroPanelStateResidualDeepestSweepLine(kind, ctx);
  if (!deepest) return null;
  const gatewayDeepestDeeper = formatHeroPanelGatewayRetryDeepestDeeperHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepestDeeper
        ? `panelState巩固再加深二层 · ${deepest} · ${gatewayDeepestDeeper}`
        : `panelState巩固再加深二层 · ${deepest}`;
    case "empty":
      return `panelState巩固再加深二层 · ${deepest}`;
    case "error": {
      const hint =
        gatewayDeepestDeeper ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-295 不退化";
      return `panelState巩固再加深二层 · ${deepest} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestDeeperSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host
    .querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"]`)
    ?.remove();
  const line = formatHeroPanelStateResidualDeepestDeeperSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepestEl = host.querySelector(
    `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`,
  );
  if (deepestEl?.nextSibling) {
    host.insertBefore(p, deepestEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestDeeperSweep(chrome.parentElement, kind, ctx);
}
