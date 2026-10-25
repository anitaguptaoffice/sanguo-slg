import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestSweep,
  formatHeroPanelGatewayRetryDeepestDeepestDeepestHint,
  formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepestDeepestDeeperSweep";

describe("heroPanelStateResidualDeepestDeepestDeepestSweep (CLIENT-343)", () => {
  it("formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine consolidates deepest-deepest-deeper sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深四层",
    );
    expect(formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine("empty", ctx)).toContain(
      "panelState巩固再加深",
    );
    const err = formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深四层");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
    expect(err).toContain("CLIENT-327");
  });

  it("formatHeroPanelGatewayRetryDeepestDeepestDeepestHint extends deepest-deepest-deeper hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestDeepestDeepestHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-327");
  });

  it("appendHeroPanelStateResidualDeepestDeepestDeepestSweep mounts class after deepest-deepest-deeper sweep", () => {
    const host = document.createElement("li");
    const deepestDeepestDeeper = document.createElement("p");
    deepestDeepestDeeper.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE);
    host.appendChild(deepestDeepestDeeper);
    appendHeroPanelStateResidualDeepestDeepestDeepestSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
    );
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS)).toBe(
      true,
    );
    expect(deepestDeepestDeeper.nextElementSibling).toBe(el);
  });
});
