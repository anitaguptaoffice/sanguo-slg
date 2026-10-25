import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepestDeepestDeeperHint,
  formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeeperSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-343：将领 panelState loading/empty/error 只读巩固再加深四层行（CLIENT-327 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deepest-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE =
  "hero-panel-state-residual-deepest-deepest-deepest-sweep";

export function formatHeroPanelGatewayRetryDeepestDeepestDeepestHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeeper = formatHeroPanelGatewayRetryDeepestDeepestDeeperHint(ctx);
  if (!deepestDeepestDeeper) return null;
  return `${deepestDeepestDeeper} · CLIENT-327 不退化`;
}

export function formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deepestDeepestDeeper = formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine(kind, ctx);
  if (!deepestDeepestDeeper) return null;
  const gatewayDeepestDeepestDeepest = formatHeroPanelGatewayRetryDeepestDeepestDeepestHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeepestDeepestDeepest
        ? `panelState巩固再加深四层 · ${deepestDeepestDeeper} · ${gatewayDeepestDeepestDeepest}`
        : `panelState巩固再加深四层 · ${deepestDeepestDeeper}`;
    case "empty":
      return `panelState巩固再加深四层 · ${deepestDeepestDeeper}`;
    case "error": {
      const hint =
        gatewayDeepestDeepestDeepest ??
        "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化 · CLIENT-327 不退化";
      return `panelState巩固再加深四层 · ${deepestDeepestDeeper} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepestDeepestDeepestSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host
    .querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`)
    ?.remove();
  const line = formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepestDeepestDeeperEl = host.querySelector(
    `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
  );
  if (deepestDeepestDeeperEl?.nextSibling) {
    host.insertBefore(p, deepestDeepestDeeperEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepestDeepestDeepestSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepestDeepestDeepestSweep(chrome.parentElement, kind, ctx);
}
