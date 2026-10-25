import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep,
  formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint,
  formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeepestSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepestDeepestDeepestSweep";

describe("heroPanelStateResidualDeepestDeepestDeepestDeepestSweep (CLIENT-375)", () => {
  it("formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine consolidates deepest-deepest-deepest sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深五层",
    );
    const err = formatHeroPanelStateResidualDeepestDeepestDeepestDeepestSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深五层");
    expect(err).toContain("CLIENT-343");
  });

  it("formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint extends deepest-deepest-deepest hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestDeepestDeepestDeepestHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-343");
  });

  it("appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep mounts class after deepest-deepest-deepest sweep", () => {
    const host = document.createElement("li");
    const deepestDeepestDeepest = document.createElement("p");
    deepestDeepestDeepest.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE);
    host.appendChild(deepestDeepestDeepest);
    appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
    );
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS)).toBe(
      true,
    );
    expect(deepestDeepestDeepest.nextElementSibling).toBe(el);
  });
});
