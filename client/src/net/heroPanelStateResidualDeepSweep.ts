import type { PanelStateKind } from "@/engine/panelStateChrome";
import {
  formatHeroPanelStateResidualSweepLine,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE,
  type HeroPanelStateResidualContext,
} from "@/net/heroPanelStateResidualSweep";

/** CLIENT-263：将领 panelState loading/empty/error 只读巩固次行（CLIENT-247 **不退化**）。 */
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-panel-state-residual-deep-sweep";
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE =
  "hero-panel-state-residual-deep-sweep";

export function formatHeroPanelGatewayRetryDeepHint(
  ctx: HeroPanelStateResidualContext,
): string | null {
  const hasErr = Boolean(ctx.listGatewayError?.trim());
  if (!hasErr && !ctx.hasGatewayRetry) return null;
  const parts: string[] = [];
  if (hasErr) parts.push("顶栏「刷新列表」");
  if (ctx.hasGatewayRetry) parts.push("行内「重试」");
  if (!parts.length) return null;
  return `网关重试 hint：${parts.join(" · ")}`;
}

export function formatHeroPanelStateResidualDeepSweepLine(
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): string | null {
  const sweep = formatHeroPanelStateResidualSweepLine(kind, ctx);
  if (!sweep) return null;
  const gatewayHint = formatHeroPanelGatewayRetryDeepHint(ctx);
  switch (kind) {
    case "loading":
      return gatewayHint
        ? `panelState巩固 · ${sweep} · ${gatewayHint}`
        : `panelState巩固 · ${sweep}`;
    case "empty":
      return `panelState巩固 · ${sweep}`;
    case "error": {
      const hint = gatewayHint ?? "网关重试 hint：刷新列表或行内重试";
      return `panelState巩固 · ${sweep} · ${hint}`;
    }
    default:
      return null;
  }
}

export function appendHeroPanelStateResidualDeepSweep(
  host: HTMLElement,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE}"]`)?.remove();
  const line = formatHeroPanelStateResidualDeepSweepLine(kind, ctx);
  if (!line) return;
  const p = document.createElement("p");
  p.className = HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS;
  p.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE);
  p.setAttribute("aria-live", "polite");
  p.textContent = line;
  const sweepEl = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE}"]`);
  if (sweepEl?.nextSibling) {
    host.insertBefore(p, sweepEl.nextSibling);
  } else {
    host.appendChild(p);
  }
}

export function skimHeroDetailPanelStateResidualDeepSweep(
  detailRoot: ParentNode | null | undefined,
  kind: PanelStateKind,
  ctx: HeroPanelStateResidualContext,
): void {
  const chrome = detailRoot?.querySelector<HTMLElement>(
    `[data-role="panel-state-chrome"][data-panel-state="${kind}"]`,
  );
  if (!chrome?.parentElement) return;
  appendHeroPanelStateResidualDeepSweep(chrome.parentElement, kind, ctx);
}
