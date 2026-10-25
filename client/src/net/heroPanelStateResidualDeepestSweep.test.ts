import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestSweep,
  formatHeroPanelGatewayRetryDeepestHint,
  formatHeroPanelStateResidualDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeeperSweep";

describe("heroPanelStateResidualDeepestSweep (CLIENT-295)", () => {
  it("formatHeroPanelStateResidualDeepestSweepLine consolidates deeper sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深一层",
    );
    expect(formatHeroPanelStateResidualDeepestSweepLine("empty", ctx)).toContain(
      "panelState巩固再加深",
    );
    const err = formatHeroPanelStateResidualDeepestSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深一层");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
    expect(err).toContain("CLIENT-279");
  });

  it("formatHeroPanelGatewayRetryDeepestHint extends deeper hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-279");
  });

  it("appendHeroPanelStateResidualDeepestSweep mounts deepest class after deeper sweep", () => {
    const host = document.createElement("li");
    const deeper = document.createElement("p");
    deeper.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE);
    host.appendChild(deeper);
    appendHeroPanelStateResidualDeepestSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`);
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS)).toBe(true);
    expect(deeper.nextElementSibling).toBe(el);
  });
});
