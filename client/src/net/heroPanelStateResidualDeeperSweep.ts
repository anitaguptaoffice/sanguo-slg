import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelGatewayRetryDeepHint,
  formatHeroPanelStateResidualDeepSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepSweep";
import type { HeroPanelStateResidualContext } from "@/net/heroPanelStateResidualSweep";

/** CLIENT-279：将领 panelState loading/empty/error 只读巩固再加深行（CLIENT-263 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deeper-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE =
  "hero-panel-state-residual-deeper-sweep";

export function formatHeroPanelGatewayRetryDeeperHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deep = formatHeroPanelGatewayRetryDeepHint(ctx);
  if (!deep) return null;
  return `${deep} · CLIENT-173 行内重试不退化`;
}

export function formatHeroPanelStateResidualDeeperSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const deep = formatHeroPanelStateResidualDeepSweepLine(kind, ctx);
  if (!deep) return null;
  const gatewayDeeper = formatHeroPanelGatewayRetryDeeperHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayDeeper
        ? `panelState巩固再加深 · ${deep} · ${gatewayDeeper}`
        : `panelState巩固再加深 · ${deep}`;
    case "empty":
      return `panelState巩固再加深 · ${deep}`;
    case "error": {
      const hint = gatewayDeeper ?? "网关重试 hint：刷新列表或行内重试 · CLIENT-173 行内重试不退化";
      return `panelState巩固再加深 · ${deep} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeeperSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE}"]`)?.remove();
  const line = formatHeroPanelStateResidualDeeperSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const deepEl = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE}"]`);
  if (deepEl?.nextSibling) {
    host.insertBefore(p, deepEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeeperSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeeperSweep(chrome.parentElement, kind, ctx);
}
