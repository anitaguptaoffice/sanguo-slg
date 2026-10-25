import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepestDeeperHint,
  formatHeroPanelStateResidualDeepestDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeeperSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-327：将领 panelState loading/empty/error 只读巩固再加深三层行（CLIENT-311 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deeper-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-deepest-deeper-sweep";

export function formatHeroPanelGatewayRetryDeepestDeepestDeeperHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeeper = formatHeroPanelGatewayRetryDeepestDeeperHint(ctx);
  if (!deepestDeeper) return null;
  return `${deepestDeeper} · CLIENT-311 不退化`;
}

export function formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeeper = formatHeroPanelStateResidualDeepestDeeperSweepLine(kind, ctx);
  if (!deepestDeeper) return null;
  const gatewayDeepestDeepestDeeper = formatHeroPanelGatewayRetryDeepestDeepestDeeperHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepestDeepestDeeper
        ? `panelState巩固再加深三层 · ${deepestDeeper} · ${gatewayDeepestDeepestDeeper}`
        : `panelState巩固再加深三层 · ${deepestDeeper}`;
    case "empty":
      return `panelState巩固再加深三层 · ${deepestDeeper}`;
    case "error": {
      const hint =
        gatewayDeepestDeepestDeeper ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-311 不退化";
      return `panelState巩固再加深三层 · ${deepestDeeper} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestDeepestDeeperSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host
    .querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`)
    ?.remove();
  const line = formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepestDeeperEl = host.querySelector(
    `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (deepestDeeperEl?.nextSibling) {
    host.insertBefore(p, deepestDeeperEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestDeepestDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestDeepestDeeperSweep(chrome.parentElement, kind, ctx);
}
